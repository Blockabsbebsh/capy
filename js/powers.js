/* =======================================================================
   POWER-UPS
   ======================================================================= */
const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1.32, 22, 16), mat.bubbleSkin);
shieldBubble.visible = false;
scene.add(shieldBubble);

function activatePower(type, at){
  const P = POWERS[type];
  if (type === 'shield'){
    game.shield = true;
    shieldBubble.visible = true;
  }
  /* Straight off POWERS — there is no duration multiplier any more (Power
     Hoarder became Overcharged). This used to read `P.dur * game.up.powerMul`
     against a field that no longer exists, which made every duration NaN: `t`
     started NaN, `t -= dt` stayed NaN, `t <= 0` was never true, and slow-mo,
     shield and magnet all ran for the rest of the run. */
  const dur = P.dur;
  game.power = { type, t: dur, dur };
  if (type === 'slowmo') Audio.slowmo();
  else Audio.powerUp();
  popup(at, P.name + '!', P.color);
  flash(P.color, 0.28);
  game.shake = Math.max(game.shake, 0.1);
}

/* Is anything protecting us right now — the power-up bubble, or Auto-Shield
   mid-flash? Everything that used to test `game.shield` goes through here, so a
   new source of protection is one function to change and not six. */
const shieldUp = () => game.shield || game.as.t > 0;

/* Take a hit on whatever is up. The power-up shield is SPENT by this; the
   Auto-Shield is not — it holds for its full two seconds and eats everything
   that arrives inside them, which is what makes it worth a perk slot rather
   than being a worse copy of the power-up. */
function absorbHit(at){
  if (game.shield) popShield(at);
  else {
    Audio.shieldBreak();
    burst(at, 18, PAL.soap, { spread:5.6, up:4.0, size:0.11, life:0.6 });
    popup(at, 'AUTO-BLOCK!', '#9fe0ff');
    game.shake = Math.max(game.shake, 0.14);
    flash('#9fe0ff', 0.22);
  }
}

/* --- Auto-Shield ---------------------------------------------------------
   Fires on PROXIMITY rather than on contact, because a bubble that appears at
   the moment of impact is indistinguishable from not being hit. It watches for
   a hazard that is both close in plan and actually coming down at us. */
function updateAutoShield(dt){
  if (!game.up.autoShield) return;
  if (game.as.t > 0){
    game.as.t = Math.max(0, game.as.t - dt);
    if (game.as.t <= 0 && !game.shield) shieldBubble.visible = false;
    return;
  }
  if (game.as.cd > 0){ game.as.cd = Math.max(0, game.as.cd - dt); return; }
  if (capyState.falling) return;

  for (const it of items){
    if (it.gone || it.dead || it.def.good) continue;
    const p = it.mesh.position;
    if (p.y > CATCH_Y + AS_RADIUS * 1.6 || p.y < 0) continue;   // still far above, or landed
    const dx = p.x - capyState.x, dz = p.z - capyState.z;
    if (dx*dx + dz*dz > AS_RADIUS * AS_RADIUS) continue;
    game.as.t = AS_BLINK;
    /* The minute starts when the bubble drops, not when it fires: the cooldown
       does not tick while the shield is still up (see the early return above),
       so adding the blink on here would have charged the player 62 seconds for
       an advertised one. */
    game.as.cd = AS_COOL;
    shieldBubble.visible = true;
    Audio.powerUp();
    popup(new THREE.Vector3(capyState.x, 1.6, capyState.z), 'AUTO-SHIELD', '#9fe0ff');
    return;
  }
}

function updatePower(dt){
  game.timeScale = 1;
  if (game.power){
    game.power.t -= dt;
    if (game.power.type === 'slowmo') game.timeScale = 0.45;
    if (game.power.t <= 0){
      if (game.power.type === 'shield' && game.shield){
        // shield simply times out if it was never spent
        game.shield = false;
        if (game.as.t <= 0) shieldBubble.visible = false;
      }
      if (game.power.type === 'slowmo') Audio.unslow();
      game.power = null;
    }
  }
  updateAutoShield(dt);

  // the bubble sits on the capybara and breathes — and blinks hard while it is
  // the Auto-Shield holding, so its two seconds are visibly running out
  if (shieldBubble.visible){
    const t = performance.now() * 0.001;
    shieldBubble.position.set(capyState.x, 0.85 + capyState.hopY + Math.sin(t*2)*0.03, capyState.z);
    shieldBubble.scale.setScalar(1 + Math.sin(t * 3.4) * 0.035);
    shieldBubble.rotation.y += dt * 0.7;
    const flashing = game.as.t > 0 && !game.shield;
    shieldBubble.material.opacity = flashing
      ? (Math.sin(t * 34) > 0 ? 0.42 : 0.06)     // rapid blink, unmistakable
      : 0.22;
  }
}

function popShield(at){
  game.shield = false;
  if (game.as.t <= 0) shieldBubble.visible = false;
  if (game.power && game.power.type === 'shield') game.power = null;
  Audio.shieldBreak();
  burst(at, 22, PAL.soap, { spread:6.4, up:4.4, size:0.12, life:0.7 });
  popup(at, 'BLOCKED!', '#8fe9ff');
  game.shake = Math.max(game.shake, 0.18);
  flash('#8fe9ff', 0.3);
}

