/* =======================================================================
   SPAWN DIRECTOR — formations

   Food used to arrive as an unrelated drip: one item every spawnInterval,
   at a random x, with the difficulty knob being how fast it fell. Late on
   that turned into three unrelated items in the air at once with under a
   third of a second of readable warning each, so the game stopped being
   about catching and became about triage.

   A formation is a SHAPE — a run of landing spots with a route through
   them — emitted as one unit. The player reads the whole route the moment
   it appears (see the path ribbon below) and plans one movement instead of
   reacting three times, which is what makes a long combo feel earned.

   Solvability is arithmetic, not eyeballing. Each gap between consecutive
   beats is given exactly the time needed to walk it — distance divided by a
   fraction of top speed — so no formation can ever ask for more than the
   capybara has. Difficulty raises that fraction (less slack in every step)
   and lengthens the shapes; it is NOT carried by fall speed any more, which
   now caps out early.

   Not everything is scripted: strays keep dropping between formations on
   their own timer, so the sky still has some noise in it.
   ======================================================================= */

/* Shapes are normalised: x and z run -1..1 inside the formation's own
   footprint, which is sized and anchored in the arena at emit time. They are
   listed in the order the items ARRIVE — every item falls at the same speed
   from the same height, so emission order is landing order.

   `bad` marks a beat as a hazard: a decoy to route around rather than a
   thing to catch. Missing one costs nothing, so it is always fair — the
   cost is only in accidentally eating it, which the red ring telegraphs.
   `dash` times that beat's gap against a dash-assisted run instead of a
   walking one, so the step is only comfortable if you use the dash — and is
   still always reachable.  `min` is the level the shape unlocks at. */
const FMT_SHAPES = [
  { id:'sweep', min:1, span:0.92, weight:3, beats:[
    {x:-1,z:0}, {x:-0.5,z:0}, {x:0,z:0}, {x:0.5,z:0}, {x:1,z:0} ] },

  { id:'cluster', min:1, span:0.16, weight:2, beats:[
    {x:-1,z:0.5}, {x:1,z:-0.3}, {x:0,z:0.9} ] },

  { id:'wave', min:2, span:0.9, weight:3, beats:[
    {x:-1,z:0.2}, {x:-0.5,z:-0.9}, {x:0,z:0.2}, {x:0.5,z:-0.9}, {x:1,z:0.2} ] },

  { id:'stairs', min:3, span:0.85, weight:2, beats:[
    {x:-1,z:-0.9}, {x:-0.6,z:-0.45}, {x:-0.2,z:0}, {x:0.2,z:0.45}, {x:0.6,z:0.9} ] },

  { id:'funnel', min:4, span:1.0, weight:2, beats:[
    {x:-1,z:0}, {x:1,z:0.35}, {x:-0.55,z:-0.35}, {x:0.55,z:0.2}, {x:0,z:0} ] },

  // the dash shape: long hops timed against a dash rather than a walk
  { id:'leap', min:5, span:1.0, weight:2, beats:[
    {x:-1,z:0.3}, {x:0.2,z:-0.4,dash:true}, {x:1,z:0.35,dash:true} ] },

  // hazards sit OFF the walking line, in z, so there is always a way past
  { id:'gauntlet', min:6, span:0.95, weight:3, beats:[
    {x:-1,z:0.35}, {x:-0.45,z:-0.75,bad:true}, {x:-0.1,z:0.35},
    {x:0.45,z:-0.75,bad:true}, {x:1,z:0.35} ] },

  { id:'pendulum', min:7, span:0.95, weight:2, beats:[
    {x:-1,z:0}, {x:0.85,z:0.4}, {x:-0.6,z:-0.4}, {x:0.35,z:0.35}, {x:0,z:0} ] },

  /* min 11, not 9: the steps here are about the length of one dash, so at 9 a
     player who dashes into them overshoots and the cooldown blocks the
     correction — measured as losing the fifth beat 12 times out of 12, while
     walking it cleared every run. By 11 it is robust either way. */
  { id:'comb', min:11, span:0.9, weight:2, beats:[
    {x:-1,z:-0.8}, {x:-0.7,z:0.7}, {x:-0.35,z:-0.8,bad:true}, {x:0,z:0.7},
    {x:0.35,z:-0.8}, {x:0.7,z:0.7}, {x:1,z:-0.8} ] },
];

/* A landing route drawn on the ground the moment the formation is emitted.
   This is the lead indicator that matters: the per-item rings only tell you
   about one item at a time, and only once it is close. */
const fmtPathGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

const fmt = { clock:0, queue:[], gap:1.4, strayTimer:2.5, nextId:0, live:new Map() };

function resetFormations(){
  fmt.clock = 0;
  fmt.queue.length = 0;
  fmt.gap = 1.4;
  fmt.strayTimer = 2.5;
  for (const rec of fmt.live.values()) disposePath(rec);
  fmt.live.clear();
}

function disposePath(rec){
  if (!rec.path) return;
  scene.remove(rec.path);
  rec.path.children.forEach(m => m.material.dispose());
  rec.path = null;
}

function buildPath(pts, colour){
  const g = new THREE.Group();
  // wide and bright enough to read on a phone, where the whole arena is a
  // couple of hundred pixels across and a hairline simply disappears
  const mat = new THREE.MeshBasicMaterial({
    color: colour, transparent:true, opacity:0.42, depthWrite:false });
  for (let i = 1; i < pts.length; i++){
    const a = pts[i-1], b = pts[i];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    const seg = new THREE.Mesh(fmtPathGeo, mat);
    seg.position.set((a.x + b.x) / 2, 0.035, (a.z + b.z) / 2);
    seg.rotation.y = -Math.atan2(dz, dx);
    seg.scale.set(len, 1, 0.22);
    g.add(seg);
  }
  scene.add(g);
  return g;
}

/* How much of top speed a player is expected to need between beats. Low is
   generous — lots of slack in every step — and it tightens with level. */
const fmtReach = () => Math.min(0.86, 0.5 + game.level * 0.018);
const fmtSpeed = () => (12.2 + game.level * 0.16) * game.up.speed;

/* Time to allow for a step of `d` units. Dividing by `reach` is the slack:
   at reach 0.5 a step gets twice the time a flat-out run would need, at 0.86
   it gets barely any spare. A dash step is measured against a dash-assisted
   run instead, which is shorter — that is what makes the dash necessary
   rather than optional, while keeping the step provably reachable. */
function stepTime(d, speed, reach, dash){
  if (!dash) return Math.max(0.34, d / (speed * reach));
  const burst = (DASH_SPEED + speed) / 2 * DASH_TIME;      // ground a dash covers
  const t = d <= burst ? DASH_TIME * (d / burst)
                       : DASH_TIME + (d - burst) / speed;
  return Math.max(0.3, t / reach);
}

function pickShape(){
  const pool = [];
  for (const s of FMT_SHAPES){
    if (game.level < s.min) continue;
    // shapes fade in rather than appearing at full weight, and the plain
    // sweep thins out once there are better options
    const w = s.id === 'sweep' && game.level > 8 ? 1 : s.weight;
    for (let i = 0; i < w; i++) pool.push(s);
  }
  if (!pool.length) return FMT_SHAPES[0];
  return pool[(Math.random() * pool.length) | 0];
}

function emitFormation(){
  const shape = pickShape();
  const flipX = Math.random() < 0.5, flipZ = Math.random() < 0.5;
  const reach = fmtReach(), speed = fmtSpeed();

  // footprint, then an anchor that keeps the whole thing inside the arena
  const spanX = ARENA.halfX * shape.span;
  const spanZ = ARENA.halfZ * 0.62;
  const slackX = Math.max(0, ARENA.halfX - 0.6 - spanX);
  /* Anchor so the OPENING beat lands near wherever the capybara already is.
     Every gap inside a formation is sized to be walkable, but the step INTO
     one was not: a shape anchored at random could open on the far side of
     the arena from a player who had just finished the last one, which is a
     dropped first item through no fault of theirs. Some jitter is kept so
     formations do not all start underfoot. */
  const firstX = (flipX ? -shape.beats[0].x : shape.beats[0].x) * spanX;
  const ax = THREE.MathUtils.clamp(
    capyState.x - firstX + (Math.random() * 2 - 1) * slackX * 0.4, -slackX, slackX);

  const pts = shape.beats.map(b => ({
    x: THREE.MathUtils.clamp(ax + (flipX ? -b.x : b.x) * spanX, -ARENA.halfX, ARENA.halfX),
    z: THREE.MathUtils.clamp((flipZ ? -b.z : b.z) * spanZ, -ARENA.halfZ, ARENA.halfZ),
    bad: !!b.bad, dash: !!b.dash,
  }));

  const fid = ++fmt.nextId;
  const goods = pts.filter(p => !p.bad).length;
  const rec = { fid, total: pts.length, pending: pts.length, goods, caught: 0,
                spoiled: false, name: shape.id, path: buildPath(pts, 0xffd77a) };
  fmt.live.set(fid, rec);

  // Each gap gets exactly the time needed to walk it, floored so a tight
  // shape cannot machine-gun. `rush` cuts below that on purpose.
  let t = 0;
  for (let i = 0; i < pts.length; i++){
    const p = pts[i];
    if (i > 0){
      const q = pts[i-1];
      t += stepTime(Math.hypot(p.x - q.x, p.z - q.z), speed, reach, p.dash);
    }
    const type = p.bad ? (Math.random() < 0.55 ? 'chili' : 'soap')
                       : (Math.random() < 0.24 ? 'watermelon' : 'burger');
    fmt.queue.push({ at: fmt.clock + t, fn: () =>
      spawnItem(type, { targeted:false, x:p.x, z:p.z, fid }) });
  }
  return t;
}

/* Called from onCatch/onMiss for anything carrying a formation id. */
function formationItemResolved(it, caught){
  const rec = fmt.live.get(it.fid);
  if (!rec) return;
  rec.pending--;
  if (it.def.good && !it.def.neutral){
    if (caught) rec.caught++; else rec.spoiled = true;
  } else if (!it.def.good && caught){
    rec.spoiled = true;                       // ate a decoy
  }
  // the route dims as it gets used up, so a half-run formation still reads
  // as unfinished business rather than sitting at full brightness
  if (rec.path && rec.path.children.length){
    rec.path.children[0].material.opacity = 0.1 + 0.32 * (rec.pending / rec.total);
  }
  if (rec.pending <= 0) completeFormation(rec);
}

function completeFormation(rec){
  const perfect = !rec.spoiled && rec.caught === rec.goods && rec.goods >= 3;
  if (perfect){
    // The point of the whole system: clearing a route pays more than the
    // same number of unrelated catches, and refills the combo timer so a
    // clean run can actually be chained.
    const bonus = Math.round(28 * rec.goods * Math.min(multiplier(), 5));
    game.score += bonus;
    game.combo++;
    game.bestCombo = Math.max(game.bestCombo, game.combo);
    game.comboTime = game.comboMax;
    popup(new THREE.Vector3(capyState.x, 2.3, capyState.z),
          'ROUTE CLEAR +' + bonus, '#9fe07a');
    showBanner('✦ ROUTE CLEAR ×' + rec.goods, '#9fe07a');
    Audio.levelUp();
    burst(new THREE.Vector3(capyState.x, 1.0, capyState.z), 18, PAL.burger,
          { spread:5.0, up:4.6, size:0.12, life:0.8 });
    refreshHUD();
  }
  disposePath(rec);
  fmt.live.delete(rec.fid);
}

function updateFormations(dt){
  // set-pieces own the sky while they run; the queue keeps its place
  const busy = evt.active === 'feast' || evt.active === 'missiles';

  fmt.clock += dt;
  while (fmt.queue.length && fmt.clock >= fmt.queue[0].at) fmt.queue.shift().fn();

  if (busy) return;

  // strays: unscripted single items so the sky is not a metronome
  fmt.strayTimer -= dt;
  if (fmt.strayTimer <= 0){
    spawnItem(pickType());
    fmt.strayTimer = game.strayEvery * (0.7 + Math.random() * 0.7);
  }

  if (fmt.queue.length) return;
  fmt.gap -= dt;
  if (fmt.gap <= 0){
    emitFormation();
    // slow-mo is a downpour: the same shapes, closer together
    const rush = game.power && game.power.type === 'slowmo' ? 0.4 : 1;
    fmt.gap = game.fmtGap * rush * (0.8 + Math.random() * 0.45);
  }
}
