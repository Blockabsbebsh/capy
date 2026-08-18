/* =======================================================================
   CAPYBARA CONTROL
   ======================================================================= */
const capyState = {
  x: 0, z: 1.0,
  vx: 0, vz: 0,
  hopY: 0, hopV: 0,
  sx: 1, sy: 1, sz: 1,           // current squash
  tsx: 1, tsy: 1, tsz: 1,        // target squash
  lean: 0, targetLean: 0,
  yaw: 0,
  step: 0,
  dragging: false,
  dragX: null, dragZ: null,
  falling: false, fallT: 0, fallX: 0, fallZ: 0,
  invuln: 0,
  chew: 0,
  slip: 0,              // soap: seconds of low-friction skidding left
  slipSpin: 0,
  pvx: 0, pvz: 0,       // previous velocity, for stack-driving acceleration
  dashT: 0, dashCD: 0,  // seconds of burst left, then seconds until the next one
  dashDX: 0, dashDZ: 0, // unit direction the current dash is committed to
  faceX: 0, faceZ: -1,  // last direction actually travelled, for a standing dash
};

// rest positions of the two pieces the chew animation drives — these track
// where buildCapybara puts the muzzle and mouth, so they move together with it
const MUZZLE_Y = -0.12, MOUTH_Y = -0.19;

function resetCapy(){
  capyState.x = 0; capyState.z = 1.0; capyState.vx = 0; capyState.vz = 0;
  capyState.hopY = 0; capyState.hopV = 0;
  capyState.sx = capyState.sy = capyState.sz = 1;
  capyState.tsx = capyState.tsy = capyState.tsz = 1;
  capyState.lean = 0; capyState.yaw = 0; capyState.step = 0;
  capyState.dragX = null; capyState.dragZ = null; capyState.dragging = false;
  capyState.falling = false; capyState.fallT = 0; capyState.invuln = 0;
  capyState.slip = 0; capyState.slipSpin = 0;
  capyState.dashT = 0; capyState.dashCD = 0;
  capyState.faceX = 0; capyState.faceZ = -1;
  capy.root.position.set(0, 0, 1.0);
  capy.root.visible = true;
  blobShadow.visible = true;
}

/* The action button. Commits to a direction for DASH_TIME and drives the
   capybara along it well above top speed — see updateCapybara, which hands
   steering back once the burst is spent. Soap takes the dash away along with
   the grip: skidding helplessly past a sinkhole is the whole penalty, and an
   escape hatch would refund it. */
function tryDash(){
  if (game.state !== 'playing' || capyState.falling) return;
  if (capyState.dashT > 0 || capyState.dashCD > 0) return;
  if (capyState.slip > 0) return;
  if (game.run.sticky) return;          // Sticky Feet trades the dash away

  // dash where you are steering; failing that, where you are already going;
  // failing that, the last way you actually faced
  let dx = 0, dz = 0;
  if (input.left || input.right || input.up || input.down){
    dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    dz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  } else if (capyState.dragX !== null){
    dx = capyState.dragX - capyState.x; dz = capyState.dragZ - capyState.z;
  }
  if (Math.hypot(dx, dz) < 1e-3){ dx = capyState.vx; dz = capyState.vz; }
  if (Math.hypot(dx, dz) < 1e-3){ dx = capyState.faceX; dz = capyState.faceZ; }
  const len = Math.hypot(dx, dz) || 1;
  capyState.dashDX = dx / len; capyState.dashDZ = dz / len;

  // Quick Paws shortens the cooldown only — the burst itself is untouched, so
  // the dash keeps the same shape and formations' `dash` beats stay honest.
  capyState.dashT = DASH_TIME;
  capyState.dashCD = DASH_TIME + DASH_CD * game.up.dashCD;
  // Phantombara leaves the afterimage where the dash STARTED, which is what
  // makes it a placement tool rather than a trail
  if (game.run.phantom) spawnGhost(capyState.x, capyState.z);
  squashPose(1.3, 0.84, 0.86);          // lunge: long and low, whichever way it goes
  Audio.dash();
  burst(new THREE.Vector3(capyState.x, 0.12, capyState.z), 8, PAL.dust,
        { spread:3.0, up:1.4, size:0.09, life:0.4 });
}

function fallInHole(h){
  if (capyState.falling) return;
  capyState.falling = true;
  capyState.fallT = 0;
  capyState.fallX = h.x; capyState.fallZ = h.z;
  capyState.vx = capyState.vz = 0;
  breakCombo(true);
  Audio.fall();
  burst(new THREE.Vector3(h.x, 0.3, h.z), 20, PAL.dust, { spread:4.6, up:4.4, size:0.13, life:0.8 });
  popup(new THREE.Vector3(h.x, 1.4, h.z), 'SINKHOLE! -1 ♥', '#ffb04a');
  loseLife('hole');
}

// put the capybara back somewhere that isn't a pit
function respawnCapy(){
  let bx = 0, bz = 1.0, best = -1;
  for (let i = 0; i < 60; i++){
    const x = i === 0 ? 0 : (Math.random()*2 - 1) * (ARENA.halfX - 1);
    const z = i === 0 ? 1.0 : (Math.random()*2 - 1) * (ARENA.halfZ - 0.6);
    let d = Infinity;
    for (const h of holes) d = Math.min(d, Math.hypot(x - h.x, z - h.z) - h.r);
    if (d > best){ best = d; bx = x; bz = z; }
    if (best > 3) break;
  }
  capyState.x = bx; capyState.z = bz;
  capyState.hopY = 1.6; capyState.hopV = 0;
  capyState.falling = false;
  capyState.invuln = 1.6;
  squashPose(1.2, 0.8, 1.2);
  capy.root.visible = true;
  blobShadow.visible = true;
  Audio.respawn();
  burst(new THREE.Vector3(bx, 0.6, bz), 14, PAL.dust, { spread:3.6, up:3.2, size:0.11, life:0.6 });
}

function squashPose(sx, sy, sz){ capyState.tsx = sx; capyState.tsy = sy; capyState.tsz = sz; }

/* The one way anything should pop the capybara upward. Scaling by the headroom
   left is what stops pops stacking: a hit taken at head height barely lifts
   you, where a bare `hopV = 9.5` would relaunch you from up there and keep
   doing it. Never lowers an existing pop, so a big one still wins. */
function popUp(v){
  capyState.hopV = Math.max(capyState.hopV, v * Math.max(0, 1 - capyState.hopY / HOP_MAX));
}

/* Where the finger is pointing, drawn on the ground.

   A mouse has a cursor and a thumb does not, and the capybara stands a fixed
   distance ABOVE the fingertip, so without this the offset is something the
   player has to infer from watching the capybara chase it. It fades out as the
   capybara arrives — once you are standing on the mark there is nothing left
   to say, and a ring under your feet during the parked half of every beat is
   just clutter on the part of the ground the ribbon is drawn on. */
const steerMark = new THREE.Mesh(
  new THREE.RingGeometry(0.30, 0.44, 28).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color:0xffd07a, transparent:true, opacity:0, depthWrite:false }));
steerMark.position.y = 0.045;
steerMark.renderOrder = 2;
steerMark.visible = false;
scene.add(steerMark);

function updateSteerMark(dt){
  if (!TOUCH) return;                    // a mouse already draws its own
  const on = capyState.dragging && capyState.dragX !== null && game.state === 'playing';
  const d = on ? Math.hypot(capyState.dragX - capyState.x, capyState.dragZ - capyState.z) : 0;
  const want = on ? THREE.MathUtils.clamp((d - 0.45) / 1.4, 0, 1) * 0.5 : 0;
  const m = steerMark.material;
  m.opacity += (want - m.opacity) * (1 - Math.pow(0.002, dt));
  steerMark.visible = m.opacity > 0.01;
  if (on){ steerMark.position.x = capyState.dragX; steerMark.position.z = capyState.dragZ; }
}

function updateCapybara(dt){
  updateSteerMark(dt);
  // --- sinking into a sinkhole: no control until we pop back out --------
  if (capyState.falling){
    capyState.fallT += dt;
    const s = Math.min(1, capyState.fallT / 0.55);
    capy.root.position.set(capyState.fallX, -3.2 * s * s, capyState.fallZ);
    capy.tilt.rotation.z = s * 0.6;
    capy.squash.scale.set(1 - s*0.2, 1 + s*0.25, 1 - s*0.2);
    blobShadow.visible = false;
    if (capyState.fallT > 1.05 && game.lives > 0) respawnCapy();
    return;
  }
  if (capyState.invuln > 0){
    capyState.invuln -= dt;
    capy.root.visible = (Math.floor(capyState.invuln * 14) % 2) === 0 || capyState.invuln <= 0;
    if (capyState.invuln <= 0) capy.root.visible = true;
  }

  // soap: hardly any grip and sluggish steering for a couple of seconds
  const slipping = capyState.slip > 0;
  if (slipping) capyState.slip = Math.max(0, capyState.slip - dt);

  const SPEED = (12.2 + game.level * 0.16) * game.up.speed;

  if (capyState.dashCD > 0) capyState.dashCD = Math.max(0, capyState.dashCD - dt);

  const wasDashing = capyState.dashT > 0;

  if (capyState.dashT > 0){
    // --- dashing: the burst owns velocity outright, no steering ----------
    capyState.dashT = Math.max(0, capyState.dashT - dt);
    // Ease from the burst speed down to ordinary top speed across the dash,
    // so handing control back at the end is a taper and not a wall.
    const k = capyState.dashT / DASH_TIME;
    const sp = SPEED + (DASH_SPEED - SPEED) * k;
    capyState.vx = capyState.dashDX * sp;
    capyState.vz = capyState.dashDZ * sp;
    if (Math.random() < dt * 40){
      burst(new THREE.Vector3(capyState.x, 0.14, capyState.z), 2, PAL.dust,
            { spread:1.8, up:0.9, size:0.08, life:0.3 });
    }
  } else {
    /* --- one velocity-target model for both input paths ------------------
       Keys say a direction, a pointer says a destination, and both resolve to
       a desired velocity that the easing below closes on. Previously keys fed
       an accelerator, the pointer fed a spring and a thumbstick had its own
       snap that had to opt out of the friction pass to avoid fighting it;
       three different feels for one character. */
    let dvx = 0, dvz = 0;
    if (input.left || input.right || input.up || input.down){
      const ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const az = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const len = Math.hypot(ax, az) || 1;
      dvx = ax / len * SPEED; dvz = az / len * SPEED;
    } else if (capyState.dragX !== null){
      // A proportional controller straight onto VELOCITY. Driving acceleration
      // with the same gain made this a spring with almost no damping — it rang
      // for eight visible oscillations around the cursor, ±0.5 units, which is
      // most of a catch radius. On velocity it is first order and cannot
      // overshoot at all. Magnitude is clamped as a vector, not per axis, or a
      // diagonal drag would be worth SPEED * sqrt(2).
      const ex = capyState.dragX - capyState.x, ez = capyState.dragZ - capyState.z;
      const d = Math.hypot(ex, ez);
      if (d > DRAG_DEAD){
        const want = Math.min(d * DRAG_GAIN, SPEED);
        dvx = ex / d * want; dvz = ez / d * want;
      }
    }

    // Braking, turning and opening up are three different times to close the
    // gap, which is what stops the capybara sliding past everything it aims at.
    const want = Math.hypot(dvx, dvz);
    const cur  = Math.hypot(capyState.vx, capyState.vz);
    const T = slipping ? MOVE_T_SLIP
            : want < 0.01 ? MOVE_T_BRAKE
            : (cur > 0.01 && capyState.vx * dvx + capyState.vz * dvz < 0) ? MOVE_T_TURN
            : MOVE_T_ACCEL;
    const k = 1 - Math.pow(0.1, dt / T);      // close 90% of the gap in T seconds
    capyState.vx += (dvx - capyState.vx) * k;
    capyState.vz += (dvz - capyState.vz) * k;
  }

  if (slipping){
    capyState.slipSpin += dt * (4 + Math.hypot(capyState.vx, capyState.vz) * 0.5);
    if (Math.random() < dt * 22){
      burst(new THREE.Vector3(capyState.x, 0.12, capyState.z), 1, PAL.soap,
            { spread:1.6, up:1.2, size:0.07, life:0.5 });
    }
  } else if (capyState.slipSpin !== 0){
    capyState.slipSpin += (0 - capyState.slipSpin) * Math.min(1, dt * 6);
    if (Math.abs(capyState.slipSpin) < 0.01) capyState.slipSpin = 0;
  }

  // No top-speed clamp here any more: every steering path already asks for a
  // velocity no larger than SPEED, and an exponential approach never exceeds
  // its target, so the only thing a clamp could still catch is the dash — the
  // one thing that is meant to be faster.
  const sp = Math.hypot(capyState.vx, capyState.vz);
  if (sp > 0.5){ capyState.faceX = capyState.vx / sp; capyState.faceZ = capyState.vz / sp; }

  capyState.x += capyState.vx * dt;
  capyState.z += capyState.vz * dt;

  // One arena shape for every biome: the rectangular ARENA bounds. The pond
  // used to clamp to an ellipse of its own instead, which is what made it the
  // only level where you slid along a curved wall and could not reach the
  // corners — the lily rim is dressing on the same play field as everywhere
  // else, not a different one.
  let hitWall = false;
  if (capyState.x < -ARENA.halfX){ capyState.x = -ARENA.halfX; capyState.vx *= -0.25; hitWall = true; }
  if (capyState.x >  ARENA.halfX){ capyState.x =  ARENA.halfX; capyState.vx *= -0.25; hitWall = true; }
  if (capyState.z < -ARENA.halfZ){ capyState.z = -ARENA.halfZ; capyState.vz *= -0.25; hitWall = true; }
  if (capyState.z >  ARENA.halfZ){ capyState.z =  ARENA.halfZ; capyState.vz *= -0.25; hitWall = true; }
  // a dash into the wall ends there rather than grinding along it for the
  // rest of its duration, which is what re-applying the burst every frame
  // would otherwise do
  if (hitWall && capyState.dashT > 0) capyState.dashT = 0;

  /* Quick Paws' shockwave, at the moment the burst ends — after the wall clamp
     above, so a dash cut short against a wall still pays out where it stopped
     rather than being silently skipped. */
  if (wasDashing && capyState.dashT <= 0 && game.up.shock > 0) dashShockwave();

  // hop physics
  const wasAirborne = capyState.hopY > 0.02;
  const hopGravity = curTheme.arena === 'candy' ? 0.78 : (curTheme.arena === 'night' ? 1.08 : (curTheme.arena === 'hell' ? 1.28 : 1.15));
  capyState.hopV += GRAV * hopGravity * dt;
  capyState.hopY += capyState.hopV * dt;
  // hard ceiling as well as the scaling in popUp — belt and braces, since a
  // single very large pop should still not clear the arena
  if (capyState.hopY > HOP_MAX){
    capyState.hopY = HOP_MAX;
    capyState.hopV = Math.min(capyState.hopV, 0);
  }
  if (capyState.hopY <= 0){
    if (capyState.hopV < -4){
      squashPose(1.18, 0.8, 1.14);
      if (wasAirborne){
        Audio.land();
        burst(new THREE.Vector3(capyState.x, 0.1, capyState.z), 5, PAL.dust,
              { spread:2.2, up:1.4, size:0.08, life:0.35 });
      }
    }
    capyState.hopY = 0; capyState.hopV = 0;
  }

  // Sinkholes only catch you when your feet are down — and a dash carries you
  // clean over one. The check resumes the instant the burst ends, so a dash
  // that stops short still drops you in: it has to actually clear the hole.
  // Sticky Feet is the other way past a hole: it never falls in at all.
  if (game.state === 'playing' && capyState.dashT <= 0 && !game.run.sticky &&
      capyState.hopY < 0.8 && capyState.invuln <= 0){
    const h = holeAt(capyState.x, capyState.z);
    if (h){
      if (shieldUp()){
        // the bubble bounces you back out to the rim
        absorbHit(new THREE.Vector3(capyState.x, 0.9, capyState.z));
        const away = new THREE.Vector2(capyState.x - h.x, capyState.z - h.z);
        if (away.lengthSq() < 0.001) away.set(1, 0);
        away.normalize().multiplyScalar(h.r * 1.35);
        capyState.x = THREE.MathUtils.clamp(h.x + away.x, -ARENA.halfX, ARENA.halfX);
        capyState.z = THREE.MathUtils.clamp(h.z + away.y, -ARENA.halfZ, ARENA.halfZ);
        popUp(7.5);
        capyState.invuln = 0.7;
      } else {
        fallInHole(h);
        return;
      }
    }
  }

  // squash & stretch settles back to 1 (pure lerp, no tween lib)
  const k = 1 - Math.pow(0.0009, dt);
  capyState.sx += (capyState.tsx - capyState.sx) * k;
  capyState.sy += (capyState.tsy - capyState.sy) * k;
  capyState.sz += (capyState.tsz - capyState.sz) * k;
  capyState.tsx += (1 - capyState.tsx) * (1 - Math.pow(0.02, dt));
  capyState.tsy += (1 - capyState.tsy) * (1 - Math.pow(0.02, dt));
  capyState.tsz += (1 - capyState.tsz) * (1 - Math.pow(0.02, dt));

  // lean into horizontal movement, slight nose-down when moving forward
  capyState.targetLean = THREE.MathUtils.clamp(-capyState.vx * 0.045, -0.42, 0.42);
  capyState.lean += (capyState.targetLean - capyState.lean) * (1 - Math.pow(0.001, dt));
  capyState.yaw += (THREE.MathUtils.clamp(capyState.vx * 0.055, -0.5, 0.5) - capyState.yaw) * (1 - Math.pow(0.004, dt));

  // apply to the rig
  capy.root.position.set(capyState.x, 0, capyState.z);
  capy.bob.position.y = capyState.hopY;
  capy.squash.scale.set(capyState.sx, capyState.sy, capyState.sz);
  capy.tilt.rotation.z = capyState.lean;
  // slipping adds a helpless little skid-spin on top of the usual lean
  capy.tilt.rotation.y = capyState.yaw + Math.sin(capyState.slipSpin) * 0.5 *
                         THREE.MathUtils.clamp(capyState.slip / SLIP_TIME, 0, 1);
  capy.tilt.rotation.x = THREE.MathUtils.clamp(capyState.vz * 0.02, -0.14, 0.14);

  // idle breathing + running leg cycle
  const t = performance.now() * 0.001;
  capy.body.position.y = Math.sin(t * 2.2) * 0.022;
  capy.head.rotation.x = Math.sin(t * 1.7) * 0.05 + THREE.MathUtils.clamp(-capyState.hopV*0.012, -0.2, 0.2);
  capy.head.rotation.z = Math.sin(t * 1.1) * 0.03;

  capyState.step += sp * dt * STEP_RATE;
  const grounded = capyState.hopY < 0.02;
  for (let i = 0; i < capy.legs.length; i++){
    const phase = capyState.step + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI/2 : 0);
    const amp = Math.min(sp / 9, 1) * 0.14;
    capy.legs[i].position.y = capy.legRestY + (grounded ? Math.max(0, Math.sin(phase)) * amp : 0.06);
    capy.legs[i].rotation.x = grounded ? Math.sin(phase) * amp * 1.6 : -0.3;
  }

  // --- chewing: the muzzle pumps and the mouth flaps a few times --------
  if (capyState.chew > 0){
    capyState.chew = Math.max(0, capyState.chew - dt);
    const w = Math.sin(capyState.chew * 42);
    const amp = Math.min(1, capyState.chew * 3.2);
    capy.muzzle.position.y = MUZZLE_Y - Math.abs(w) * 0.05 * amp;
    capy.muzzle.scale.set(1 + Math.abs(w) * 0.09 * amp, 1 - w * 0.14 * amp, 1);
    capy.mouth.scale.set(1, 1 + Math.abs(w) * 4.5 * amp, 1);
    capy.mouth.position.y = MOUTH_Y - Math.abs(w) * 0.03 * amp;
    capy.skull.scale.x = 1 + Math.abs(w) * 0.05 * amp;
  } else if (capy.muzzle.scale.y !== 1){
    capy.muzzle.position.y = MUZZLE_Y;
    capy.muzzle.scale.set(1, 1, 1);
    capy.mouth.scale.set(1, 1, 1);
    capy.mouth.position.y = MOUTH_Y;
    capy.skull.scale.x = 1;
  }

  // --- head stack wobble, driven by how hard we just accelerated --------
  // Clamped, because a dash sets velocity outright rather than ramping to it:
  // taken literally that is a ~2000 u/s² spike in a single frame, which slams
  // every piece of the stack straight to its rotation limit. A lurch is the
  // right reaction to a dash; a slam is not.
  const STACK_ACC_MAX = 300;
  const jerk = a => THREE.MathUtils.clamp(a / Math.max(dt, 1e-4), -STACK_ACC_MAX, STACK_ACC_MAX);
  updateStack(dt, jerk(capyState.vx - capyState.pvx), jerk(capyState.vz - capyState.pvz));
  capyState.pvx = capyState.vx; capyState.pvz = capyState.vz;

  // contact shadow follows and shrinks with hop height
  blobShadow.position.set(capyState.x, 0.03, capyState.z + 0.05);
  const hs = THREE.MathUtils.clamp(1 - capyState.hopY * 0.22, 0.55, 1);
  blobShadow.scale.setScalar(hs);
  blobShadow.material.opacity = 0.3 * hs;
}

