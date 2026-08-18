/* =======================================================================
   MAIN LOOP
   ======================================================================= */
const clock = new THREE.Clock();
let camShakeSeed = Math.random() * 100;

function updateMenuIdle(dt){
  // gentle demo motion on the title screen
  const t = performance.now() * 0.001;
  capyState.x = Math.sin(t * 0.55) * 2.6;
  capyState.z = 1.0 + Math.cos(t * 0.4) * 0.5;
  capyState.vx = Math.cos(t * 0.55) * 0.55 * 2.6;
  capyState.vz = 0;
  if (capyState.hopY <= 0 && Math.random() < dt * 0.5){ capyState.hopV = 5.2; squashPose(0.86, 1.2, 0.86); }
}

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 1/25);
  const t = performance.now() * 0.001;

  // --- ambience always runs -------------------------------------------
  updateTheme(dt);
  updateThemeFX(t);
  // sky rig tracks the camera's position only (not its rotation) — see
  // the comment on skyRig's declaration for why
  skyRig.position.copy(camera.position);
  for (const c of clouds){
    c.position.x += dt * 0.42;
    if (c.position.x > 52) c.position.x = -52;
  }
  for (const c of pinkClouds){
    c.position.x += dt * 0.38;
    if (c.position.x > 52) c.position.x = -52;
  }
  const sa = t * 0.045;
  sun.position.set(Math.cos(sa) * 13 - 3, 30 + Math.sin(sa * 1.6) * 3, Math.sin(sa) * 9 + 14);
  sunDisc.position.set(Math.cos(sa + 2.4) * 10 - 2, 5 + Math.sin(sa) * 1.4, -40);
  sunHalo.position.copy(sunDisc.position);
  sunHalo.scale.setScalar(1 + Math.sin(t * 1.4) * 0.03);
  if(curTheme.arena === 'night'){
    sunDisc.position.set(8, 6, -40);
    sunHalo.position.copy(sunDisc.position);
    sunHalo.scale.setScalar(1.15);
  } else if(curTheme.arena === 'hell'){
    sunDisc.position.set(-8, 5.5, -40);
    sunHalo.position.copy(sunDisc.position);
    sunHalo.scale.setScalar(1.05);
  }
  pond.material.opacity = 0.82 + Math.sin(t * 1.3) * 0.05;

  // night biome: a warm point light glued just above the capybara keeps
  // the arena readable up close despite the deliberately low ambient/hemi.
  // Small offset only — see nightLight declaration comment for why.
  if (curTheme.arena === 'night'){
    nightLight.intensity = 2.4;
    nightLight.position.set(capyState.x, 3.4, capyState.z + 0.6);
    nightFill.intensity = 1.1;
    nightFill.position.set(capyState.x, 0.7, capyState.z + 1.0);
  } else if (nightLight.intensity !== 0){
    nightLight.intensity = 0;
    nightFill.intensity = 0;
  }

  if (game.state === 'playing'){
    game.elapsed += dt;

    /* Level-ups are rate limited. The curve reads score, and score is
       multiplied — a watermelon at x6 is 240, more than a whole level — so a
       feast, or worse a magnet running over a feast, banked a dozen levels in
       a couple of seconds and dropped a fresh run straight into Hell. Score
       still drives the pace; it just cannot skip the levels in between. */
    game.levelHold = Math.max(0, game.levelHold - dt);
    const want = game.devLock ? game.level : difficultyFrom(game.score, game.elapsed);
    const newLevel = game.devLock || game.levelHold > 0
                   ? game.level : Math.min(want, game.level + 1);
    if (newLevel !== game.level && newLevel > game.level){
      game.levelHold = LEVEL_MIN_GAP;
      // find the first level that would start a new theme — that's where
      // the run should pause for a draft, even if a big catch pushed
      // newLevel further past it in a single frame. Whatever's left over
      // gets picked up again next frame once we resume.
      const themeStart =
        (Math.floor((game.level - 1) / THEME_EVERY) + 1) * THEME_EVERY + 1;
      if (newLevel >= themeStart){
        if (!offerUpgrades(themeStart)){
          // no perks left to offer — just advance straight into the theme
          const was = curTheme;
          game.level = themeStart;
          applyDifficulty();
          const th = themeFor(themeStart);
          applyTheme(th, false);
          Audio.setMusicTheme(THEMES.indexOf(th));
          Audio.levelUp();
          refreshHUD();
          ui.levelBadge.classList.remove('bump');
          void ui.levelBadge.offsetWidth;
          ui.levelBadge.classList.add('bump');
          /* Only announce a biome the player is actually arriving in. themeFor
             clamps at Hell, so every ten levels past it used to fire the whole
             arrival ceremony — banner, whoosh, white flash, FOV punch — for a
             biome that had not changed. */
          if (th !== was){
            Audio.themeShift();
            showBanner('✦ ' + th.name.toUpperCase() + ' ✦', '#ffe1a8');
            if (!REDUCED){ flash('#ffffff', 0.3); game.fovKick = 3.2; }
          } else {
            showBanner('LEVEL ' + themeStart, '#ffe1a8');
          }
        }
      } else {
        game.level = newLevel;
        applyDifficulty();
        Audio.levelUp();
        refreshHUD();
        ui.levelBadge.classList.remove('bump');
        void ui.levelBadge.offsetWidth;
        ui.levelBadge.classList.add('bump');
        showBanner('LEVEL ' + newLevel, '#ffe1a8');
      }
    }

    updatePower(dt);

    // combo decays on its own now — keep eating or lose the stack
    if (game.combo > 0){
      game.comboTime -= dt;
      if (game.comboTime <= 0) breakCombo();
    }

    // food arrives as formations plus a thinner drip of strays; see
    // formations.js, which also stands down while a set-piece owns the sky
    updateFormations(dt);

    updatePowerSpawns(dt);
    updateHeartSpawns(dt);
    updateEvents(dt);
    updateHoles(dt);
    updateCapybara(dt);
    updateItems(dt * game.timeScale);
    updatePerks(dt);              // dash shockwaves, ghosts, the reach aura
    updateDebris(dt);
    refreshHUD();
  } else if (game.state === 'menu'){
    updateMenuIdle(dt);
    updateCapybara(dt);
    updateDebris(dt);
  } else if (game.state === 'paused' || game.state === 'over'){
    // keep the rig settled but frozen in place
    capy.root.position.set(capyState.x, 0, capyState.z);
  }

  // fold the animation proxies onto the model's bones. Guarded for the same
  // reason as buildCapybara: a stale cached index.html without capyrig.js must
  // fall back to the procedural capybara, not throw once per frame.
  if (typeof syncCapyRig === 'function') syncCapyRig();

  updateParticles(dt);

  // --- camera: base pose + shake + subtle follow ------------------------
  game.shake = Math.max(0, game.shake - dt * 1.35);
  const s = REDUCED ? 0 : game.shake * game.shake * 3.2;
  const follow = capyState.x * 0.12 * camFit.follow;
  camera.position.set(
    camFit.x + follow + (Math.sin(t * 47 + camShakeSeed) * s),
    camFit.y + (Math.sin(t * 39 + camShakeSeed * 2) * s * 0.8),
    camFit.z + (Math.cos(t * 43 + camShakeSeed * 3) * s * 0.5)
  );
  camera.lookAt(CAM_LOOK.x + follow * 0.55, CAM_LOOK.y, CAM_LOOK.z);
  if (s > 0) camera.rotation.z += Math.sin(t * 51) * s * 0.02;

  // FOV punch on a theme change, eased back out
  if (game.fovKick > 0.002){
    game.fovKick *= Math.pow(0.12, dt);          // slow swell, never a jolt
    camera.fov = BASE_FOV - game.fovKick;
    camera.updateProjectionMatrix();
  } else if (game.fovKick !== 0){
    game.fovKick = 0;
    camera.fov = BASE_FOV;
    camera.updateProjectionMatrix();
  }

  renderer.render(scene, camera);
}

function onResize(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  fitCamera();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

// a backgrounded tab shouldn't keep simulating (blur alone misses some cases)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') pauseGame();
});

// boot
fitCamera();
applyTheme(THEMES[0], true);
let savedHat = 'none';
try { savedHat = localStorage.getItem('capyHat') || 'none'; } catch(e){}
const savedDef = HATS.find(h => h.id === savedHat);
setHat(savedDef && hatUnlocked(savedDef) ? savedHat : 'none');
renderHatPicker();
renderLives();
refreshHUD();
document.getElementById('loading').remove();
animate();
