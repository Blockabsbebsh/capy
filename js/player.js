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
  stickX: 0, stickZ: 0, // analog thumbstick axes (touch)
  pvx: 0, pvz: 0,       // previous velocity, for stack-driving acceleration
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
  capy.root.position.set(0, 0, 1.0);
  capy.root.visible = true;
  blobShadow.visible = true;
}

function tryJump(){
  if (game.state !== 'playing' || capyState.falling) return;
  if (capyState.hopY > 0.06) return;
  capyState.hopV = curTheme.arena === 'candy' ? 11.3 : (curTheme.arena === 'pond' ? 9.0 : 9.4);
  squashPose(0.78, 1.32, 0.78);
  Audio.jump();
  burst(new THREE.Vector3(capyState.x, 0.12, capyState.z), 6, PAL.dust,
        { spread:2.6, up:1.6, size:0.09, life:0.4 });
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

function updateCapybara(dt){
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
  const ACC = slipping ? 34 : 92;

  let ax = 0, az = 0;
  const keyActive = input.left || input.right || input.up || input.down;
  const stickActive = capyState.stickX !== 0 || capyState.stickZ !== 0;

  if (stickActive && !slipping){
    // touch stick: snap straight toward the target velocity instead of
    // easing in — acceleration ramps read as "floaty" on a thumbstick,
    // where people expect the character to move the instant they push.
    const mag = Math.min(1, Math.hypot(capyState.stickX, capyState.stickZ));
    const tvx = capyState.stickX * SPEED, tvz = capyState.stickZ * SPEED;
    const snap = 1 - Math.pow(0.001, dt * (0.6 + mag));
    capyState.vx += (tvx - capyState.vx) * snap;
    capyState.vz += (tvz - capyState.vz) * snap;
  } else if (keyActive){
    if (input.left)  ax -= 1;
    if (input.right) ax += 1;
    if (input.up)    az -= 1;
    if (input.down)  az += 1;
    const len = Math.hypot(ax, az) || 1;
    ax /= len; az /= len;
    capyState.vx += ax * ACC * dt;
    capyState.vz += az * ACC * dt;
  } else if (capyState.dragX !== null){
    const dx = capyState.dragX - capyState.x;
    const dz = capyState.dragZ - capyState.z;
    const pull = slipping ? 5 : 14;
    capyState.vx += THREE.MathUtils.clamp(dx * 16, -SPEED, SPEED) * dt * pull;
    capyState.vz += THREE.MathUtils.clamp(dz * 16, -SPEED, SPEED) * dt * pull;
  }

  // friction — loose while steering, snappy stop when input is released,
  // and near-frictionless ice while the soap is still on your paws
  const steering = keyActive || stickActive || capyState.dragX !== null;
  if (!stickActive || slipping){
    // the stick branch above already snaps velocity toward its target
    // (including toward zero once the stick returns to its dead zone),
    // so skip the extra friction pass here to avoid fighting it.
    const grip = slipping ? Math.pow(0.86, dt) : (steering ? Math.pow(0.5, dt*4) : Math.pow(0.02, dt));
    capyState.vx *= grip;
    capyState.vz *= grip;
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

  const sp = Math.hypot(capyState.vx, capyState.vz);
  if (sp > SPEED){ capyState.vx = capyState.vx / sp * SPEED; capyState.vz = capyState.vz / sp * SPEED; }

  capyState.x += capyState.vx * dt;
  capyState.z += capyState.vz * dt;

  // Meadow stays a bounded field. Other themes get their own physical arena.
  if (curTheme.arena === 'pond'){
    // the giant lily pad is a hard wall, same as the meadow's rectangular
    // bounds — real sinkholes (checked below) are what should drop you in,
    // not simply walking to the edge of the pad
    const rx=9.15, rz=4.65;
    const q=(capyState.x*capyState.x)/(rx*rx)+(capyState.z*capyState.z)/(rz*rz);
    if(q>1){
      const k=1/Math.sqrt(q); capyState.x*=k; capyState.z*=k;
      capyState.vx*=-0.25; capyState.vz*=-0.25;
    }
  } else {
    if (capyState.x < -ARENA.halfX){ capyState.x = -ARENA.halfX; capyState.vx *= -0.25; }
    if (capyState.x >  ARENA.halfX){ capyState.x =  ARENA.halfX; capyState.vx *= -0.25; }
    if (capyState.z < -ARENA.halfZ){ capyState.z = -ARENA.halfZ; capyState.vz *= -0.25; }
    if (capyState.z >  ARENA.halfZ){ capyState.z =  ARENA.halfZ; capyState.vz *= -0.25; }
  }

  // hop physics
  const wasAirborne = capyState.hopY > 0.02;
  const hopGravity = curTheme.arena === 'candy' ? 0.78 : (curTheme.arena === 'night' ? 1.08 : (curTheme.arena === 'hell' ? 1.28 : 1.15));
  capyState.hopV += GRAV * hopGravity * dt;
  capyState.hopY += capyState.hopV * dt;
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

  // sinkholes only catch you when your feet are down
  if (game.state === 'playing' && capyState.hopY < 0.8 && capyState.invuln <= 0){
    const h = holeAt(capyState.x, capyState.z);
    if (h){
      if (game.shield){
        // the bubble bounces you back out to the rim
        popShield(new THREE.Vector3(capyState.x, 0.9, capyState.z));
        const away = new THREE.Vector2(capyState.x - h.x, capyState.z - h.z);
        if (away.lengthSq() < 0.001) away.set(1, 0);
        away.normalize().multiplyScalar(h.r * 1.35);
        capyState.x = THREE.MathUtils.clamp(h.x + away.x, -ARENA.halfX, ARENA.halfX);
        capyState.z = THREE.MathUtils.clamp(h.z + away.y, -ARENA.halfZ, ARENA.halfZ);
        capyState.hopV = 7.5;
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
  updateStack(dt, (capyState.vx - capyState.pvx) / Math.max(dt, 1e-4),
                  (capyState.vz - capyState.pvz) / Math.max(dt, 1e-4));
  capyState.pvx = capyState.vx; capyState.pvz = capyState.vz;

  // contact shadow follows and shrinks with hop height
  blobShadow.position.set(capyState.x, 0.03, capyState.z + 0.05);
  const hs = THREE.MathUtils.clamp(1 - capyState.hopY * 0.22, 0.55, 1);
  blobShadow.scale.setScalar(hs);
  blobShadow.material.opacity = 0.3 * hs;
}

