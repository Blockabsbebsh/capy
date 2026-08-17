/* =======================================================================
   PERK MECHANICS

   The drafted perks that are more than a number: the dash shockwave, the
   Phantombara afterimage, the Long Snout aura, Clean Sweep's pull and
   Overcharged's hazard wipe. They all live here rather than being sprinkled
   through the systems they touch, so a perk is one thing to read.

   Everything in here is inert until the matching perk is drafted — the update
   pass returns immediately when nothing is owned.
   ======================================================================= */

/* --- Quick Paws: the landing shockwave ---------------------------------
   Thrown out where the dash ENDS, and it catches food outright rather than
   dragging it: the dash is already a commitment, and having to then walk back
   over what it flew past is exactly the feel the perk is meant to remove. */
const shockGeo = new THREE.RingGeometry(0.62, 1.0, 40).rotateX(-Math.PI / 2);
const shocks = [];

function shockRadius(){ return catchReach() * (SHOCK_R[Math.min(game.up.shock, 3)] || 0); }

function dashShockwave(){
  const r = shockRadius();
  if (r <= 0) return;

  const ring = new THREE.Mesh(shockGeo, new THREE.MeshBasicMaterial({
    color: 0x9fe07a, transparent: true, opacity: 0.75, depthWrite: false }));
  ring.position.set(capyState.x, 0.06, capyState.z);
  ring.scale.setScalar(r * 0.35);
  scene.add(ring);
  shocks.push({ ring, t: 0, r });

  Audio.shieldBreak();
  burst(new THREE.Vector3(capyState.x, 0.16, capyState.z), 10, PAL.dust,
        { spread: r * 2.4, up: 1.6, size: 0.09, life: 0.4 });

  // Good food only. Sweeping hazards up as well would make the dash strictly
  // safer to spam, and the decoys in a formation are the whole reason the
  // walking line matters.
  for (const it of [...items]){
    if (it.dead || !it.def.good || it.def.power || it.def.heal) continue;
    const dx = it.mesh.position.x - capyState.x, dz = it.mesh.position.z - capyState.z;
    if (dx*dx + dz*dz <= r*r) onCatch(it);
  }
}

function updateShocks(dt){
  for (let i = shocks.length - 1; i >= 0; i--){
    const s = shocks[i];
    s.t += dt;
    const u = s.t / SHOCK_LIFE;
    s.ring.scale.setScalar(s.r * (0.35 + u * 0.75));
    s.ring.material.opacity = 0.75 * (1 - u);
    if (u >= 1){
      scene.remove(s.ring);
      s.ring.material.dispose();
      shocks.splice(i, 1);
    }
  }
}

/* --- Phantombara: the dash afterimage ----------------------------------
   A translucent copy of the capybara, left standing where the dash began. It
   catches on the same radius the real one does, so the perk is really a second
   pair of hands you place by dashing away from where the food is about to be.

   Built once and cloned: THREE's clone shares geometry and material, so a
   ghost costs a handful of objects and nothing on the GPU — which is also why
   removing one must NOT dispose anything it walks. */
/* Shaded, not flat, and it writes depth. Both matter: a MeshBasicMaterial
   turned the whole animal into one pale silhouette with no volume, and without
   depthWrite every overlapping piece blended through every other one, so the
   ghost read as a cluster of soap bubbles rather than a capybara. Emissive
   keeps it visible in Night and Hell, where a 0.55 white would sink into the
   background. */
const ghostMat = new THREE.MeshStandardMaterial({
  color: 0xbfe9ff, roughness: 0.55, metalness: 0,
  emissive: 0x3f6f8f, emissiveIntensity: 0.35,
  transparent: true, opacity: 0.55, depthWrite: true });
/* The ghost is the REAL capybara: the .glb's skinned geometry, rendered as a
   plain Mesh so it stands frozen in its bind pose — which is the model's
   neutral standing pose, since the retarget in capyrig.js composes its deltas
   onto exactly those bone rest quaternions. A plain Mesh also means no cloned
   skeleton to keep in step, and no chance of the afterimage animating along
   with the capybara that left it.

   Placed by the live mesh's own transform relative to `capy.root`, rather than
   by hand: the loader's own offsets are then accounted for whatever the model
   does, and the ghost stands where the capybara stands.

   The procedural build stays as the fallback, for the same reason
   buildCapybara() has one — a model that fails the rig contract should
   downgrade the ghost, not break the perk. */
const ghostTemplate = (() => {
  const skin = capy.torso;
  if (skin && skin.isSkinnedMesh){
    capy.root.updateMatrixWorld(true);
    const g = new THREE.Group();
    const m = new THREE.Mesh(skin.geometry, ghostMat);
    new THREE.Matrix4().copy(capy.root.matrixWorld).invert().multiply(skin.matrixWorld)
      .decompose(m.position, m.quaternion, m.scale);
    m.frustumCulled = false;    // as with the live mesh
    g.add(m);
    g.userData.scale = 1;       // already the right size: it IS the model
    return g;
  }
  const g = buildProceduralCapybara();
  g.root.traverse(o => { if (o.isMesh){ o.material = ghostMat; o.castShadow = false; } });
  // the procedural build is a little smaller than the model the game normally
  // uses; the ghost has to read as the same animal standing there
  g.root.userData.scale = 1.15;
  return g.root;
})();
const GHOST_SCALE = ghostTemplate.userData.scale;
const ghosts = [];

function spawnGhost(x, z){
  const obj = ghostTemplate.clone();
  obj.position.set(x, 0, z);
  obj.scale.setScalar(GHOST_SCALE);
  scene.add(obj);
  ghosts.push({ obj, t: GHOST_LIFE });
  burst(new THREE.Vector3(x, 0.7, z), 8, PAL.soap,
        { spread: 2.2, up: 1.8, size: 0.09, life: 0.5, drag: 0.94 });
}

function popGhost(g, at){
  scene.remove(g.obj);
  const i = ghosts.indexOf(g);
  if (i >= 0) ghosts.splice(i, 1);
  burst(at, 16, PAL.soap, { spread: 4.4, up: 3.4, size: 0.11, life: 0.6, drag: 0.95 });
  popup(at.clone().setY(1.5), 'GHOST POPPED', '#bfe9ff');
  Audio.soap();
}

function updateGhosts(dt){
  const t = performance.now() * 0.001;
  for (let i = ghosts.length - 1; i >= 0; i--){
    const g = ghosts[i];
    g.t -= dt;
    if (g.t <= 0){
      scene.remove(g.obj);
      ghosts.splice(i, 1);
      continue;
    }
    /* Breathes, then sinks away over its last half second. The wind-down is
       scale, not opacity: every ghost shares one material (that is the point of
       cloning), so fading one would fade all of them. */
    const out = THREE.MathUtils.clamp(g.t / 0.5, 0, 1);
    g.obj.position.y = Math.sin(t * 2.4 + i) * 0.05 - (1 - out) * 0.5;
    g.obj.scale.setScalar(GHOST_SCALE * (0.98 + Math.sin(t * 3.1 + i) * 0.02) * out);
  }
}

/* Called from updateItems for anything that has reached catch height and was
   not caught by the capybara itself. Returns true if the ghost consumed it. */
function ghostItemTest(it){
  if (!ghosts.length || it.dead) return false;
  const p = it.mesh.position;
  for (const g of [...ghosts]){
    const dx = p.x - g.obj.position.x, dz = p.z - g.obj.position.z;
    const reach = catchReach() + it.def.radius;
    if (dx*dx + dz*dz > reach*reach) continue;

    /* Hearts and power-ups go through the ordinary onCatch: the whole point of
       a heart or a magnet is the effect it has on the RUN, and reimplementing
       that here is how the ghost ended up silently dropping them. Only plain
       food takes the ghost-specific path, because that is the only case where
       the difference matters (no hop, no chew, nothing on the head stack — the
       food went into something standing somewhere else). */
    if (it.def.heal || it.def.power){
      burst(p.clone(), 10, PAL.soap, { spread: 3.0, up: 2.4, size: 0.1, life: 0.5 });
      onCatch(it);
      return true;
    }
    if (it.def.good){
      ghostCatch(it);
      return true;
    }
    if (!it.def.good){
      popGhost(g, p.clone());
      if (it.fid) formationItemResolved(it, false);
      removeItem(it);
      return true;
    }
  }
  return false;
}

/* A ghost catch pays and combos like a real one, but deliberately does NOT run
   any of the capybara's catch juice — no hop, no chew, nothing on the head
   stack. The food went into a ghost standing somewhere else. */
function ghostCatch(it){
  const p = it.mesh.position.clone();
  if (it.fid) formationItemResolved(it, true);
  bumpCombo();
  const gained = Math.round(it.def.points * multiplier() *
                            (it.type === 'watermelon' ? game.up.melon : 1));
  game.score += gained;
  popup(p, '+' + gained + ' 👻', '#cdeeff');
  burst(p, 14, it.type === 'watermelon' ? PAL.watermelon : PAL.burger,
        { spread: 4.0, up: 4.0, size: 0.11, life: 0.7 });
  Audio.chew();
  checkHatUnlocks();
  removeItem(it);
  refreshHUD();
}

/* --- Long Snout: the reach aura ----------------------------------------
   The perk is +0.22 on an invisible radius, which is the least legible upgrade
   in the game — you can only infer it from catches that feel generous. The
   bubble is the same number, drawn. */
const reachRing = new THREE.Mesh(
  new THREE.RingGeometry(0.94, 1.0, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffe1a8, transparent: true, opacity: 0.22, depthWrite: false }));
const reachDome = new THREE.Mesh(
  new THREE.SphereGeometry(1, 22, 14),
  new THREE.MeshBasicMaterial({ color: 0xffe1a8, transparent: true, opacity: 0.07,
                                depthWrite: false, side: THREE.DoubleSide }));
reachRing.visible = reachDome.visible = false;
scene.add(reachRing, reachDome);

function updateAura(dt){
  const on = game.up.reach > 0 && game.state === 'playing' && !capyState.falling;
  reachRing.visible = reachDome.visible = on;
  if (!on) return;
  const r = catchReach();
  const pulse = 1 + Math.sin(performance.now() * 0.0022) * 0.02;
  reachRing.position.set(capyState.x, 0.045, capyState.z);
  reachRing.scale.set(r * pulse, 1, r * pulse);
  reachDome.position.set(capyState.x, 0.05 + capyState.hopY, capyState.z);
  reachDome.scale.set(r * pulse, r * 0.62 * pulse, r * pulse);
}

/* --- Clean Sweep: the route-clear pull ---------------------------------
   Reuses the magnet's pursuit in updateItems rather than a second homing
   model — see the note there about why anything chasing a moving target
   drives velocity. Negative items are left exactly where they were: a perk
   that delivered the decoys too would be a punishment. */
function sweepArena(){
  let n = 0;
  for (const it of items){
    if (it.dead || !it.def.good) continue;
    it.sweep = 1.4;
    n++;
  }
  if (!n) return;
  popup(new THREE.Vector3(capyState.x, 2.0, capyState.z), 'CLEAN SWEEP ×' + n, '#9fe07a');
  burst(new THREE.Vector3(capyState.x, 0.9, capyState.z), 14, PAL.dust,
        { spread: 5.6, up: 2.2, size: 0.1, life: 0.6 });
  Audio.powerUp();
}

/* --- Overcharged: the hazard wipe --------------------------------------
   Fires on any power-up pickup, and takes everything hostile with it: items in
   the air, missiles mid-volley, and open sinkholes, which close early rather
   than vanishing so the ground still reads as ground growing back. */
function overchargeWipe(at){
  let n = 0;
  for (const it of [...items]){
    if (it.def.good || it.dead) continue;
    const p = it.mesh.position.clone();
    burst(p, 12, PAL.chili, { spread: 4.0, up: 3.0, size: 0.11, life: 0.5 });
    if (it.fid) formationItemResolved(it, false);
    removeItem(it);
    n++;
  }
  for (const h of holes){
    if (h.state === 'close') continue;
    h.state = 'close'; h.t = 0;
    h.warn.visible = false;
    burst(new THREE.Vector3(h.x, 0.25, h.z), 14, PAL.dust,
          { spread: 5.0, up: 3.4, size: 0.12, life: 0.6 });
    n++;
  }
  if (!n) return;
  showBanner('⚡ OVERCHARGED — FIELD CLEARED', '#ffe14d');
  flash('#ffe14d', 0.3);
  game.shake = Math.max(game.shake, 0.24);
  Audio.levelUp();
}

/* --- Puzzler ------------------------------------------------------------
   Routes fall at half speed, which is where the whole perk lives: the shape is
   readable for twice as long, and in exchange every route is a life on the
   table. Strays keep their normal speed — they are noise, not the puzzle. */
function routeFallMul(){ return game.run.puzzler ? 0.5 : 1; }

function puzzlerReward(cleared){
  if (!game.run.puzzler) return;
  if (cleared){
    if (gainLife(true)){
      popup(new THREE.Vector3(capyState.x, 2.6, capyState.z), '🧩 +1 ♥', '#ff8fae');
      Audio.heart();
    }
  } else {
    popup(new THREE.Vector3(capyState.x, 2.6, capyState.z), '🧩 ROUTE LOST -1 ♥', '#ff6b5a');
    loseLife('route');
  }
  refreshHUD();
}

function clearPerkFX(){
  for (const s of [...shocks]){
    scene.remove(s.ring); s.ring.material.dispose();
  }
  shocks.length = 0;
  for (const g of [...ghosts]) scene.remove(g.obj);
  ghosts.length = 0;
  reachRing.visible = reachDome.visible = false;
}

function updatePerks(dt){
  updateShocks(dt);
  updateGhosts(dt);
  updateAura(dt);
}
