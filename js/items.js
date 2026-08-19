/* =======================================================================
   FALLING ITEM POOL
   ======================================================================= */
const items = [];
const indicatorGeo = new THREE.RingGeometry(0.42, 0.56, 26).rotateX(-Math.PI/2);

function spawnItem(type, opts = {}){
  const def = TYPES[type];
  const mesh = BUILDERS[type]();
  const missile  = !!opts.missile;
  // hazards hunt the capybara; food falls wherever it likes
  const targeted = opts.targeted ?? !def.good;

  let x, z;
  if (opts.x !== undefined){
    // the spawn director places formation beats itself
    x = THREE.MathUtils.clamp(opts.x, -ARENA.halfX, ARENA.halfX);
    z = THREE.MathUtils.clamp(opts.z, -ARENA.halfZ, ARENA.halfZ);
  } else if (targeted){
    const jx = missile ? 0.8 : 2.6, jz = missile ? 0.6 : 1.8;
    x = THREE.MathUtils.clamp(capyState.x + (Math.random()-0.5)*jx, -ARENA.halfX, ARENA.halfX);
    z = THREE.MathUtils.clamp(capyState.z + (Math.random()-0.5)*jz, -ARENA.halfZ, ARENA.halfZ);
  } else {
    const spreadZ = Math.min(ARENA.halfZ, 1.6 + game.level * 0.42);
    x = (Math.random()*2 - 1) * (ARENA.halfX - 0.5);
    z = (Math.random()*2 - 1) * spreadZ;
  }

  mesh.position.set(x, SPAWN_Y, z);
  if (missile){
    mesh.scale.setScalar(1.35);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat.missileGlow);
    mesh.add(glow);
  }
  // plain food (burger/watermelon) gets a soft glow halo, but only in the
  // Night biome — that's the one theme dark enough that falling food is
  // genuinely hard to spot, and a glow everywhere else just looked like a
  // stray light source that had no business being on in broad daylight
  if (def.good && !def.power && !def.heal && curTheme.arena === 'night'){
    const glowColor = type === 'watermelon' ? 0xff9aa8 : 0xffe08a;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(def.radius * 1.9, 14, 10),
      new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.22, depthWrite: false }));
    mesh.add(halo);
  }
  /* Chain Sweeper's golden route: worth a multiple, so it has to LOOK worth a
     multiple. A gold shell over the food plus a bigger halo reads at a glance
     from across the arena, which is the point — you want to see that this is
     the route not to drop. */
  if (opts.gold > 1){
    mesh.scale.multiplyScalar(1.12);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(def.radius * 1.5, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd33d, transparent: true, opacity: 0.30, depthWrite: false }));
    shell.name = 'gold';
    mesh.add(shell);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(def.radius * 2.4, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.16, depthWrite: false }));
    mesh.add(halo);
  }
  scene.add(mesh);

  const ring = new THREE.Mesh(indicatorGeo, new THREE.MeshBasicMaterial({
    color: def.heal ? 0xff5f86
         : opts.gold > 1 ? 0xffd33d
         : def.good ? (type === 'watermelon' ? 0xff8098 : 0xffd88a)
         : (missile ? 0xff2a1a : 0xff5a4a),
    transparent:true, opacity:0, depthWrite:false
  }));
  ring.position.set(x, 0.04, z);
  if (missile) ring.scale.setScalar(1.5);
  scene.add(ring);

  const isMelon = type === 'watermelon';
  const isPower = !!def.power;

  if (def.heal){
    // hearts are the one thing that ignores fallSpeed entirely — always the
    // same lazy drift, so a rescue is never something you can't get to
    items.push({
      type, def, mesh, ring, dead:false, missile:false,
      homing:0, maxLat:0, trail:0, sparkle:0,
      vy: -HEART_FALL, vx:(Math.random()-0.5)*0.5, vz:0,
      spin: new THREE.Vector3(0, 1.1, 0),
      wobble: Math.random() * Math.PI * 2,
    });
    return;
  }

  if (isPower){
    // power-ups drift down slowly, upright, so they read clearly
    items.push({
      type, def, mesh, ring, dead:false, missile:false,
      homing:0, maxLat:0, trail:0,
      vy: -(game.fallSpeed * 0.55), vx:0, vz:0,
      spin: new THREE.Vector3(0, 1.7, 0),
      wobble: Math.random() * Math.PI * 2,
    });
    return;
  }
  /* A routed item — a formation beat, or a melon on a feast path — falls
     straight down and at the shared speed: the ribbon promises where it lands
     and when, and a melon's usual lateral wander (up to 3.2 u/s) would make
     that promise a lie. Puzzler halves that speed for formation beats, which
     is the whole perk: the same shape, twice as long to read. */
  const straight = !!opts.fid || !!opts.straight;
  const routeMul = opts.fid ? routeFallMul() : 1;
  items.push({
    type, def, mesh, ring, dead:false, missile,
    fid: opts.fid || 0,             // formation this beat belongs to, 0 = stray
    // steering: how hard it chases, and how fast it can slide sideways
    homing: missile ? 3.1 : (targeted ? 1.05 : 0),
    maxLat: missile ? 6.4 : Math.min(4.6, 2.4 + game.level * 0.14) + overtime() * 0.5,
    trail: 0,
    gold: opts.gold || 1,           // Chain Sweeper: score multiple on this route
    vy: -(game.fallSpeed * routeMul
          * (straight ? 1 : isMelon ? 0.86 : missile ? 1.18 : 1)
          * (straight ? 1 : 0.92 + Math.random()*0.2)),
    vx: straight ? 0 : isMelon ? (Math.random()-0.5) * 3.2 : (Math.random()-0.5) * 0.5,
    vz: straight ? 0 : isMelon ? (Math.random()-0.5) * 1.2 : 0,
    // melons tumble mostly around Z so the cut face keeps facing the player
    spin: new THREE.Vector3(
      (Math.random()-0.5) * (isMelon ? 1.1 : 2.2),
      (Math.random()-0.5) * (isMelon ? 0.9 : 3.0),
      (Math.random()-0.5) * (isMelon ? 3.4 : 2.2)),
    wobble: Math.random() * Math.PI * 2,
  });
  if (missile) Audio.incoming();
}

function removeItem(it){
  it.gone = true;               // see the snapshot loop in updateItems
  scene.remove(it.mesh);
  scene.remove(it.ring);
  it.ring.material.dispose();
  it.mesh.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  const i = items.indexOf(it);
  if (i >= 0) items.splice(i, 1);
}
function clearItems(){ [...items].forEach(removeItem); }

/* =======================================================================
   CATCH / MISS RESOLUTION
   ======================================================================= */
function onCatch(it){
  const p = it.mesh.position.clone();
  const def = it.def;
  if (it.fid) formationItemResolved(it, true);

  // --- heart: a life back, or points if you're already topped up ---------
  if (def.heal){
    if (game.combo > 0) game.comboTime = game.comboMax;
    if (gainLife(false)){
      popup(p, '+1 ♥', '#ff8fae');
      showBanner('EXTRA LIFE', '#ff8fae', 'life');
    } else {
      game.score += 250;
      popup(p, '+250', '#ff8fae');
    }
    Audio.heart();
    burst(p, 30, PAL.heart, { spread:5.4, up:5.6, size:0.13, life:1.0 });
    flash('#ff8fae', 0.24);
    squashPose(1.24, 0.76, 1.2);
    popUp(7.0);
    capyState.chew = 0.5;
    removeItem(it);
    refreshHUD();
    return;
  }

  // --- power-ups ---------------------------------------------------------
  if (def.power){
    activatePower(def.power, p);
    if (game.combo > 0) game.comboTime = game.comboMax;   // catching one keeps the combo alive
    squashPose(1.2, 0.78, 1.16);
    popUp(6.4);
    capyState.chew = 0.4;
    removeItem(it);
    refreshHUD();
    return;
  }

  if (def.good){
    bumpCombo();
    addToStack(it.type);
    kickStack(3.2);
    capyState.chew = 0.55;
    Audio.chew();
    const mult = multiplier();
    // taking it on the dash is the skill play, so it pays double
    const dashCatch = capyState.dashT > 0;
    const melonBonus = it.type === 'watermelon' ? game.up.melon : 1;
    const gained = Math.round(def.points * mult * melonBonus * (it.gold || 1)
                              * (dashCatch ? DASH_BONUS : 1));
    game.score += gained;

    if (it.type === 'burger'){
      Audio.burger(game.combo);
      burst(p, 16, PAL.burger, { spread:4.2, up:4.4, size:0.11, life:0.7 });
      popup(p, '+' + gained, it.gold > 1 ? '#ffe14d' : '#ffd77a');
      squashPose(1.28, 0.7, 1.22);
      popUp(5.6);
    } else {
      Audio.melon(game.combo);
      burst(p, 30, PAL.watermelon, { spread:6.4, up:6.2, size:0.14, life:0.9 });
      popup(p, '+' + gained + '!', '#ff8098');
      squashPose(1.38, 0.62, 1.32);
      popUp(8.2);
    }
    if (dashCatch){
      popup(p.clone().add(new THREE.Vector3(0, 0.85, 0)), 'DASH SNACK ×2', '#9fe07a');
      burst(p, 10, PAL.dust, { spread:3.4, up:1.6, size:0.08, life:0.45 });
      Audio.levelUp();
      popUp(6.2);   // a little extra hang time
    }
    checkHatUnlocks();
    // shout only on the catch that actually stepped the multiplier up
    if (mult > 1 && mult !== multiplierFor(game.combo - 1)){
      popup(p.clone().add(new THREE.Vector3(0, 1.2, 0)), 'x' + mult + ' COMBO', '#fff0a0');
      Audio.levelUp();
    }
  } else if (shieldUp()){
    // the bubble eats the hazard — the power-up shield is spent by it, the
    // Auto-Shield holds for its full two seconds and eats whatever else arrives
    absorbHit(p);
    removeItem(it);
    refreshHUD();
    return;
  } else {
    // bad item caught
    breakCombo(true);
    if (it.type === 'chili'){
      loseLife('spicy');
      burst(p, 26, PAL.chili, { spread:6, up:5.4, size:0.13, life:0.8 });
      popup(p, 'SPICY! -1 ♥', '#ff6b5a');
      squashPose(0.72, 1.42, 0.72);
      popUp(9.5);
    } else {
      // soap doesn't quietly drain points any more — it makes you skid, which
      // you can actually feel (and which is far more dangerous near a sinkhole)
      capyState.slip = SLIP_TIME;
      Audio.soap();
      burst(p, 26, PAL.soap, { spread:5.4, up:5.0, size:0.13, life:1.0, drag:0.97 });
      popup(p, 'SLIPPERY!', '#bfe9ff');
      squashPose(0.78, 1.3, 0.9);
      game.shake = Math.max(game.shake, 0.14);
      flash('#5fd0ff', 0.22);
    }
  }

  removeItem(it);
  refreshHUD();
}

function onMiss(it){
  const p = it.mesh.position.clone();
  p.y = 0.2;
  if (it.fid) formationItemResolved(it, false);
  if (it.def.neutral){
    // a missed power-up just fizzles — no combo punishment
    burst(p, 10, PAL.soap, { spread:3.2, up:2.6, size:0.1, life:0.5 });
    return;
  }
  if (it.def.good){
    // A dropped snack no longer kills the combo outright — food you never
    // went for was ending runs at random. The decay timer is the pressure;
    // a miss just takes a bite out of it.
    if (game.combo > 0) game.comboTime = Math.max(0.01, game.comboTime - game.comboMax * 0.3);
    Audio.miss();
    const pal = it.type === 'watermelon' ? PAL.watermelon : PAL.burger;
    burst(p, it.type === 'watermelon' ? 22 : 12, pal, { spread:3.6, up:3.2, size:0.1, life:0.6 });
    burst(p, 6, PAL.dust, { spread:3.0, up:2.2, size:0.09, life:0.5 });
    refreshHUD();
  } else if (it.missile){
    // a dodged missile detonates on the grass
    Audio.bad();
    burst(p, 24, PAL.chili, { spread:7.2, up:5.0, size:0.14, life:0.7 });
    burst(p, 10, PAL.dust,  { spread:5.0, up:3.0, size:0.11, life:0.6 });
    game.shake = Math.max(game.shake, 0.2);
  } else {
    // hazards landing harmlessly: tiny puff, no penalty
    burst(p, 6, PAL.dust, { spread:2.6, up:2.0, size:0.08, life:0.45 });
  }
}

/* =======================================================================
   ITEM UPDATE
   ======================================================================= */
function pickType(){
  const L = game.level;
  /* Hazards home in now, so keep the steady drip a bit thinner. The 0.30 cap is
     what the ramp reaches by level 14; past that hazardMul() carries it — on
     overtime and on how many hearts are being carried — up to a hard 0.62, which
     is the point where a stray is more likely to be hostile than not. */
  const badChance = Math.min(0.62, Math.min(0.30, 0.09 + L * 0.015) * hazardMul());
  const melonChance = 0.17;
  const r = Math.random();
  if (r < badChance){
    return Math.random() < 0.55 ? 'chili' : 'soap';
  }
  if (r < badChance + melonChance) return 'watermelon';
  return 'burger';
}

function updateItems(dt){
  const capPos = new THREE.Vector3(capyState.x, 0, capyState.z);
  /* Iterated over a SNAPSHOT, skipping anything already removed. A resolution
     inside this pass can now take more than one item off the list — catching a
     power-up with Overcharged clears every hazard in the air — and a live
     reverse index over a shrinking array reads past its end the moment
     something below the cursor disappears. */
  for (const it of [...items]){
    if (it.gone) continue;
    const m = it.mesh;

    const magnetised = !!game.power && game.power.type === 'magnet'
                       && it.def.good && !it.def.power && !it.dead && !capyState.falling;

    if (magnetised){
      /* Pure pursuit, aimed at the capybara's MOUTH and driving velocity
         directly. The magnet used to add acceleration toward the capybara's
         feet with no damping and no vertical component, which is a spring:
         items closed on you, shot straight through, and swung back out —
         measured at 8.05 -> 0.60 -> 2.69 units while standing still — so they
         orbited past and landed on the floor. Only 4 of 10 were ever caught.
         Re-aiming velocity every frame converges instead of oscillating, and
         including Y means the item arrives at catch height rather than
         sailing over your head. */
      const dx = capyState.x - m.position.x;
      const dy = (CATCH_Y - 0.15) - m.position.y;
      const dz = capyState.z - m.position.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const k = 1 - Math.pow(0.001, dt);        // ~0.33s to swing onto the line
      it.vx += (dx / d * MAGNET_SPEED - it.vx) * k;
      it.vy += (dy / d * MAGNET_SPEED - it.vy) * k;
      it.vz += (dz / d * MAGNET_SPEED - it.vz) * k;
    } else if (!it.dead && !capyState.falling && it.homing > 0){
      // hazards steer toward the capybara — capped lateral speed keeps them
      // dodgeable as long as the player keeps moving
      it.vx += (capyState.x - m.position.x) * it.homing * dt;
      it.vz += (capyState.z - m.position.z) * it.homing * dt * 0.85;
      const lat = Math.hypot(it.vx, it.vz);
      if (lat > it.maxLat){ it.vx = it.vx / lat * it.maxLat; it.vz = it.vz / lat * it.maxLat; }
    }
    const steer = magnetised ? 0 : (it.dead || capyState.falling ? 0 : it.homing);

    if (it.missile && !it.dead){
      it.trail -= dt;
      if (it.trail <= 0){
        it.trail = 0.03;
        burst(m.position, 2, PAL.chili, { spread:0.7, up:0.3, size:0.1, life:0.35, drag:0.9 });
      }
      m.children.forEach(c => { if (c.material === mat.missileGlow) c.scale.setScalar(1 + Math.sin(performance.now()*0.02)*0.12); });
    }

    // hearts hold a constant speed; everything else picks up a little.
    // A magnetised item is flying under its own power — leaving gravity on
    // would fight the vertical half of the pursuit for anything below you.
    if (!it.def.heal && !magnetised) it.vy += GRAV * 0.16 * dt;
    m.position.y += it.vy * dt;
    m.position.x += it.vx * dt;
    m.position.z += it.vz * dt;

    // watermelons bounce off the invisible side walls while falling
    const lim = ARENA.halfX + 0.6;
    if (m.position.x < -lim){ m.position.x = -lim; it.vx = Math.abs(it.vx); }
    if (m.position.x >  lim){ m.position.x =  lim; it.vx = -Math.abs(it.vx); }
    const zlim = ARENA.halfZ + 0.8;
    if (m.position.z < -zlim){ m.position.z = -zlim; it.vz = Math.abs(it.vz); }
    if (m.position.z >  zlim){ m.position.z =  zlim; it.vz = -Math.abs(it.vz); }

    m.rotation.x += it.spin.x * dt;
    m.rotation.y += it.spin.y * dt;
    m.rotation.z += it.spin.z * dt;

    if (it.def.power){
      it.wobble += dt * 4;
      const s = 1 + Math.sin(it.wobble) * 0.07;
      m.scale.setScalar(s);
      const aura = m.getObjectByName('aura');
      if (aura){ aura.rotation.z -= dt * 2.4; aura.scale.setScalar(1 + Math.sin(it.wobble*1.7)*0.12); }
    }

    if (it.def.heal && !it.dead){
      // heartbeat pulse, breathing halo, and a steady trickle of sparkles
      it.wobble += dt * 5.2;
      const beat = Math.max(0, Math.sin(it.wobble)) ** 3;
      m.scale.setScalar(1 + beat * 0.16);
      const glow = m.getObjectByName('glow');
      if (glow){
        glow.scale.setScalar(1 + beat * 0.3 + Math.sin(it.wobble * 0.7) * 0.06);
        glow.material.opacity = 0.16 + beat * 0.2;
      }
      const aura = m.getObjectByName('aura');
      if (aura){ aura.rotation.z += dt * 1.8; aura.scale.setScalar(1.1 + beat * 0.16); }
      it.sparkle -= dt;
      if (it.sparkle <= 0){
        it.sparkle = 0.11;
        burst(m.position, 2, PAL.heart, { spread:1.5, up:0.6, size:0.075, life:0.55, drag:0.94 });
        if (Math.random() < 0.35) Audio.sparkle();
      }
    }

    if (it.type === 'watermelon'){
      it.wobble += dt * 9;
      const w = Math.sin(it.wobble) * 0.06;
      m.scale.set(1 + w, 1 - w, 1 + w * 0.5);
    }

    // landing indicator: predict where this thing actually ends up, so a
    // homing missile's ring shows the impact point rather than its shadow
    const tFall = THREE.MathUtils.clamp(
      (m.position.y - it.def.radius) / Math.max(0.5, -it.vy), 0, 3);
    let px = m.position.x + it.vx * Math.min(tFall, 1.0);
    let pz = m.position.z + it.vz * Math.min(tFall, 1.0);
    if (steer > 0){
      const k = THREE.MathUtils.clamp(steer * tFall * 0.42, 0, 0.85);
      px += (capyState.x - px) * k;
      pz += (capyState.z - pz) * k;
    }
    it.ring.position.x += (THREE.MathUtils.clamp(px, -ARENA.halfX - 1, ARENA.halfX + 1) - it.ring.position.x) * Math.min(1, dt * 9);
    it.ring.position.z += (THREE.MathUtils.clamp(pz, -ARENA.halfZ - 1, ARENA.halfZ + 1) - it.ring.position.z) * Math.min(1, dt * 9);

    /* Landing indicator. This is the only cue for where a thing will end up,
       and it used to key its visibility off HEIGHT — opacity 0.14 until the
       item dropped below y=6.5, which at the old top fall speed was two
       thirds of the way down. You got about 0.3s of legible warning out of a
       0.82s fall, i.e. the cue arrived after the moment it was useful.

       It keys off TIME TO LAND now, so it reads the same at any fall speed:
       clearly visible the moment the item exists, and closing from a wide
       ring onto its exact footprint as the item arrives. That collapse is
       the timing cue — the ring reaching full size IS the catch moment. */
    const lead = THREE.MathUtils.clamp(1 - tFall / 1.5, 0, 1);
    let alpha = 0.4 + lead * 0.5;
    if (!it.def.good && !it.def.neutral){
      alpha *= 0.75 + 0.25 * Math.sin(performance.now() * 0.012);   // hazards pulse
    }
    it.ring.material.opacity = it.dead ? 0 : alpha;
    it.ring.scale.setScalar(1 + (1 - lead) * 1.5);

    // catch test (hazards phase through you right after a respawn, and soap
    // phases through Sticky Feet entirely — that perk is bought with mobility,
    // so the slip has to be gone rather than merely survivable)
    const canHit = it.def.good ||
      (capyState.invuln <= 0 && !capyState.falling && !(game.run.sticky && it.def.slip));
    if (!it.dead && m.position.y <= CATCH_Y && m.position.y > -0.3){
      if (canHit){
        const dx = m.position.x - capPos.x;
        const dz = m.position.z - capPos.z;
        const reach = catchReach(it.def.good) + it.def.radius + (capyState.dashT > 0 ? DASH_REACH : 0);
        if (dx*dx + dz*dz < reach*reach){
          onCatch(it);
          continue;
        }
      }
      // whatever the capybara did not take, a Phantombara ghost might
      if (ghostItemTest(it)) continue;
    }

    // ground contact
    const floor = it.def.radius + 0.02;
    if (m.position.y <= floor){
      m.position.y = floor;
      // A magnetised item cannot be dropped: the whole point of the power-up
      // is that every good item reaches you, so one that gets low while you
      // are sprinting or dashing away skims the floor and keeps coming
      // instead of counting as a miss.
      if (!it.dead && !magnetised){
        it.dead = true;
        onMiss(it);          // bursts into particles for every type, including watermelon
        removeItem(it);
        continue;
      }
    }

    if (m.position.y < -4) removeItem(it);
  }
}

