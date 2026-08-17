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

  /* Every traversal gets its own z LANE, front to back. The swings used to sit
     at z 0, 0.4, -0.4, 0.35, 0 — four end-to-end lines stacked into the same
     shallow band, which drew as three overlapping streaks with no way to tell
     which one came first. The arena is twice as wide as it is deep, so anything
     that crosses it repeatedly has to step in z as it goes or it is unreadable
     however it is drawn. The walk is the same; the picture is legible. */
  { id:'pendulum', min:7, span:0.95, weight:2, beats:[
    {x:-1,z:-0.9}, {x:0.9,z:-0.4}, {x:-0.7,z:0.15}, {x:0.7,z:0.6}, {x:0,z:0.95} ] },

  /* min 11, not 9: the steps here are about the length of one dash, so at 9 a
     player who dashes into them overshoots and the cooldown blocks the
     correction — measured as losing the fifth beat 12 times out of 12, while
     walking it cleared every run. By 11 it is robust either way. */
  { id:'comb', min:11, span:0.9, weight:2, beats:[
    {x:-1,z:-0.8}, {x:-0.7,z:0.7}, {x:-0.35,z:-0.8,bad:true}, {x:0,z:0.7},
    {x:0.35,z:-0.8}, {x:0.7,z:0.7}, {x:1,z:-0.8} ] },

  /* ---- the second wave of shapes ------------------------------------------
     Ten more, added because nine shapes — with the plain sweep thinned out past
     level 8 — is a small enough deck that a long run started recognising hands
     rather than reading routes. Nothing here is harder than what was already in: the gaps
     still come out of stepTime, so variety is free — these are new PATHS, not
     new demands. Each one has a distinct idea, since two shapes that walk the
     same way are one shape as far as the player is concerned. */

  // a plain V: in and out on the diagonal, the simplest depth-change there is
  { id:'chevron', min:2, span:0.85, weight:2, beats:[
    {x:-1,z:-0.85}, {x:-0.5,z:0.1}, {x:0,z:0.9}, {x:0.5,z:0.1}, {x:1,z:-0.85} ] },

  // a smooth bow — the wave's curve without the reversals, so it walks as one
  // continuous arc instead of five decisions
  { id:'arc', min:3, span:0.9, weight:2, beats:[
    {x:-1,z:0.55}, {x:-0.55,z:-0.35}, {x:0,z:-0.85}, {x:0.55,z:-0.35}, {x:1,z:0.55} ] },

  // four beats, full depth each time: fewer, longer strides than the wave
  { id:'ladder', min:4, span:0.8, weight:2, beats:[
    {x:-0.95,z:0.85}, {x:-0.3,z:-0.85}, {x:0.3,z:0.85}, {x:0.95,z:-0.85} ] },

  // runs out one way and returns, so the second half is walked backwards
  // through ground you have already covered
  { id:'boomerang', min:5, span:0.95, weight:2, beats:[
    {x:-1,z:0.5}, {x:-0.2,z:-0.55}, {x:0.7,z:0.35}, {x:0,z:0.85}, {x:-0.75,z:-0.2} ] },

  // both far corners first, then closing in on the middle — laned in z like the
  // pendulum above, and unlike it the amplitude shrinks every step, so the
  // picture is a funnel of crossings converging rather than parallel streaks
  { id:'pincer', min:6, span:1.0, weight:2, beats:[
    {x:-1,z:0.9}, {x:1,z:0.45}, {x:-0.55,z:0}, {x:0.5,z:-0.45}, {x:0,z:-0.9} ] },

  // decoys strictly off the line, as ever: the food is a straight run along
  // the near edge and the hazards hang above it
  { id:'slalom', min:7, span:0.9, weight:3, beats:[
    {x:-1,z:-0.55}, {x:-0.6,z:0.6,bad:true}, {x:-0.3,z:-0.6}, {x:0.1,z:0.6,bad:true},
    {x:0.4,z:-0.6}, {x:0.85,z:-0.5} ] },

  // a spiral inward — every step turns the same way, which reads very
  // differently from anything that zig-zags
  { id:'coil', min:8, span:0.95, weight:2, beats:[
    {x:1,z:0.1}, {x:0.35,z:0.8}, {x:-0.55,z:0.5}, {x:-0.9,z:-0.4},
    {x:0.05,z:-0.85}, {x:0.5,z:-0.25} ] },

  // the second dash shape: one long committed hop across, then a short
  // recovery back — the leap without the second dash in a row
  { id:'hook', min:9, span:1.0, weight:2, beats:[
    {x:-1,z:-0.6}, {x:-0.4,z:0.5}, {x:0.85,z:0.6,dash:true}, {x:0.5,z:-0.7} ] },

  // peaks of uneven height off a shared baseline, so the rhythm is irregular
  // where the wave's is metronomic
  { id:'crown', min:10, span:0.92, weight:2, beats:[
    {x:-1,z:-0.2}, {x:-0.6,z:0.85}, {x:-0.2,z:-0.2}, {x:0.15,z:0.55},
    {x:0.5,z:-0.2}, {x:1,z:-0.2} ] },

  // the long one: seven beats weaving the full width, no decoys — the length
  // is the challenge and a hazard on a weave has no line to sit off of
  { id:'serpent', min:12, span:1.0, weight:2, beats:[
    {x:-1,z:0.2}, {x:-0.62,z:-0.7}, {x:-0.25,z:0.55}, {x:0.1,z:-0.75},
    {x:0.42,z:0.6}, {x:0.72,z:-0.5}, {x:1,z:0.35} ] },
];

/* A landing route drawn on the ground the moment the formation is emitted.
   This is the lead indicator that matters: the per-item rings only tell you
   about one item at a time, and only once it is close. */
const fmtPathGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const fmtDotGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);

const fmt = { clock:0, queue:[], gap:1.4, strayTimer:2.5, nextId:0, live:new Map() };

function resetFormations(){
  fmt.clock = 0;
  fmt.queue.length = 0;
  fmt.gap = 1.4;
  fmt.strayTimer = 2.5;
  for (const rec of fmt.live.values()) disposePath(rec);
  fmt.live.clear();
  disposeFeastPath();
}

function disposePath(rec){
  if (!rec.path) return;
  scene.remove(rec.path);
  rec.path.children.forEach(m => m.material.dispose());
  rec.path = null;
}

/* One ribbon, drawn as a run of segments that TAPER along the route: the first
   step is the widest and brightest, the last the thinnest and faintest.

   The taper is not decoration. A single flat-opacity ribbon is unreadable the
   moment a shape doubles back over itself — pincer, boomerang, coil and serpent
   all put two lines across the same ground, and with both drawn identically
   there is nothing in the picture that says which one you walk first. Brightness
   ordering answers that at a glance, in the direction of travel.

   Each segment records the beat it ARRIVES at, so formationItemResolved can
   take spent segments off the ground as the route is used up — see there. */
function buildPath(pts, colour, opacity = 0.42, dots = false){
  const g = new THREE.Group();
  const last = Math.max(1, pts.length - 2);

  /* The landing SPOTS, marked before anything is in the air, and graded largest
     and brightest first. This is what actually makes a route readable: the
     connecting lines say how the beats join up, but where two of them run over
     the same ground — and in an arena twice as wide as it is deep, any shape
     that crosses from end to end does — the lines alone are spaghetti. Five
     dots in descending size are not.

     Hazard beats are marked red, because "do not stand here" is part of the
     route and waiting for the item's own ring to say so is late. */
  if (dots) for (let i = 0; i < pts.length; i++){
    const u = pts.length > 1 ? i / (pts.length - 1) : 0;
    const dot = new THREE.Mesh(fmtDotGeo, new THREE.MeshBasicMaterial({
      color: pts[i].bad ? 0xff5a4a : colour, transparent:true,
      opacity: (pts[i].bad ? 0.5 : 0.66) * (1 - 0.45 * u), depthWrite:false }));
    dot.position.set(pts[i].x, 0.03, pts[i].z);
    dot.scale.setScalar(0.44 - 0.16 * u);
    dot.userData.beat = i;
    g.add(dot);
  }

  for (let i = 1; i < pts.length; i++){
    const a = pts[i-1], b = pts[i];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    const u = Math.min(1, (i - 1) / last);          // 0 at the first step, 1 at the last
    // wide and bright enough to read on a phone, where the whole arena is a
    // couple of hundred pixels across and a hairline simply disappears
    const seg = new THREE.Mesh(fmtPathGeo, new THREE.MeshBasicMaterial({
      color: colour, transparent:true, opacity: opacity * (1 - 0.5 * u), depthWrite:false }));
    seg.position.set((a.x + b.x) / 2, 0.035, (a.z + b.z) / 2);
    seg.rotation.y = -Math.atan2(dz, dx);
    seg.scale.set(len, 1, 0.28 - 0.12 * u);
    seg.userData.beat = i;
    g.add(seg);
  }
  scene.add(g);
  return g;
}

/* How much of top speed a player is expected to need between beats. Low is
   generous — lots of slack in every step — and it tightens with level. */
/* Capped at 0.78, not 0.86. An autopilot clears 0.86 fine because it knows the
   landing spot the instant the beat spawns and never second-guesses; a person
   reads the ribbon, decides, and starts moving. Leaving at least a fifth of
   every step as slack is what keeps a route clearable by someone reacting
   rather than someone precomputing. */
const fmtReach = () => Math.min(0.78, 0.5 + game.level * 0.018);
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
  /* `pts` is kept on the record because the ribbon is public information: it is
     what the player reads to plan the whole route. The autopilot sweep in
     tools/shoot.js reads it for the same reason — an autopilot that waits for
     each beat to spawn is not testing the shape, it is testing a player with no
     lead time, and it fails shapes that are comfortably walkable off the
     ribbon. */
  /* Chain Sweeper: this route's score multiple, fixed the moment it is emitted
     so the ribbon, the items and the payout cannot disagree. */
  const gold = chainMul();
  const rec = { fid, total: pts.length, pending: pts.length, goods, caught: 0,
                spoiled: false, blocked: false, gold, name: shape.id, pts,
                // dots on a formation, not on a feast: five landing spots are
                // information, twenty are wallpaper over the trail itself
                path: buildPath(pts, gold > 1 ? 0xffe14d : 0xffd77a,
                                gold > 1 ? 0.75 : 0.55, true) };
  fmt.live.set(fid, rec);

  // Each gap gets exactly the time needed to walk it, floored so a tight
  // shape cannot machine-gun. `rush` cuts below that on purpose.
  let t = 0;
  for (let i = 0; i < pts.length; i++){
    const p = pts[i];
    if (i > 0){
      const q = pts[i-1];
      /* A `dash` beat is timed against a dash-assisted run, which is SHORTER
         than the walk — so it has to fall back to walking time for a player who
         has no dash. Sticky Feet trades the dash away, and without this the
         leap and hook shapes would be the one thing in the game that perk makes
         literally unclearable rather than merely slower. */
      t += stepTime(Math.hypot(p.x - q.x, p.z - q.z), speed, reach,
                    p.dash && !game.run.sticky);
    }
    const type = p.bad ? (Math.random() < 0.55 ? 'chili' : 'soap')
                       : (Math.random() < 0.24 ? 'watermelon' : 'burger');
    fmt.queue.push({ at: fmt.clock + t, fn: () =>
      spawnItem(type, { targeted:false, x:p.x, z:p.z, fid, gold }) });
  }
  /* Deadline for the safety valve in updateFormations, measured rather than
     assumed: the last beat is emitted at `t` and then still has to fall, and
     Puzzler halves that fall speed. A flat 14s would have quietly binned long
     Puzzler routes — dropping the record, the ribbon and the route clear with
     it — instead of waiting for them. */
  rec.limit = t + SPAWN_Y / Math.max(1, game.fallSpeed * routeFallMul()) + 6;
  return t;
}

/* Called from onCatch/onMiss for anything carrying a formation id. */
function formationItemResolved(it, caught){
  const rec = fmt.live.get(it.fid);
  if (!rec) return;
  rec.pending--;
  /* Did this beat land somewhere the player could not stand? A set-piece can
     open a sinkhole on top of a live route, and under Puzzler that turned the
     game's own doing into a lost life. Recorded per beat, at the moment it is
     missed, because a hole can open after the route was emitted. */
  if (!caught && it.def.good && !it.def.neutral){
    const p = it.mesh.position;
    for (const h of holes){
      if (Math.hypot(p.x - h.x, p.z - h.z) < h.r + it.def.radius){ rec.blocked = true; break; }
    }
  }
  if (it.def.good && !it.def.neutral){
    if (caught) rec.caught++; else rec.spoiled = true;
  } else if (!it.def.good && caught){
    rec.spoiled = true;                       // ate a decoy
  }
  /* Spent segments leave the ground, so what is drawn is always the route you
     still have to walk. Dimming the whole ribbon instead (what this used to do)
     left every crossing line in place, which is most of why a doubling-back
     shape was hard to read halfway through: you were looking at the part you
     had already done as well as the part you had not. */
  const done = rec.total - rec.pending;
  if (rec.path){
    for (const seg of rec.path.children) seg.visible = seg.userData.beat >= done;
  }
  if (rec.pending <= 0) completeFormation(rec);
}

function completeFormation(rec){
  const perfect = !rec.spoiled && rec.caught === rec.goods && rec.goods >= 3;
  // Puzzler pays out on every route, either way — see puzzlerReward
  puzzlerReward(perfect, rec.blocked);
  if (perfect) chainCleared(); else chainBroken();
  if (perfect){
    // The point of the whole system: clearing a route pays more than the
    // same number of unrelated catches, and refills the combo timer so a
    // clean run can actually be chained.
    const bonus = Math.round(28 * rec.goods * Math.min(multiplier(), 5) * (rec.gold || 1));
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

  /* One route at a time. Two overlapping shapes are not twice the challenge,
     they are an unreadable mess — the whole point is that you can see the
     route and plan it, and you cannot plan two at once. A formation stays
     live until its last beat has been caught or hit the ground, so the pause
     below starts from the moment the arena is actually clear.

     The age check is a safety valve: `live` is what gates emission, so a
     record that somehow never resolved would wedge the director permanently
     and the game would simply stop dropping food. */
  for (const rec of fmt.live.values()){
    rec.age = (rec.age || 0) + dt;
    if (rec.age > (rec.limit || 14)){ disposePath(rec); fmt.live.delete(rec.fid); }
  }
  if (fmt.queue.length || fmt.live.size) return;

  fmt.gap -= dt;
  if (fmt.gap <= 0){
    emitFormation();
    // slow-mo is a downpour: the same shapes, closer together
    const rush = game.power && game.power.type === 'slowmo' ? 0.4 : 1;
    fmt.gap = game.fmtGap * rush * (0.8 + Math.random() * 0.45);
  }
}

/* =======================================================================
   FEAST ROUTES

   The watermelon feast used to be a shower: sixteen melons at random x, which
   at a 40-point melon meant the reward beat was also the least interesting
   twenty seconds in the game — you stood roughly in the middle and let it
   happen, and the ones that fell out of reach were nobody's fault.

   Now it is one long continuous path, chosen from five, with every melon on
   it. Same reward, but you run it: the ribbon shows the whole line the moment
   the banner lands, and following it is the entire ask.

   These are parametric rather than hand-placed beats — a feast route is
   sixteen-plus points long, and a curve you can read as one expression is much
   easier to keep continuous than a list. `at(u)` returns normalised -1..1
   coordinates for u in 0..1, the same footprint convention as FMT_SHAPES.
   ======================================================================= */
const tri = u => 1 - 4 * Math.abs(((u + 0.25) % 1) - 0.5);   // triangle wave, -1..1

const FEAST_ROUTES = [
  // one long S down the arena and back up
  { id:'ess',    n:17, at: u => ({ x: -1 + 2*u, z: Math.sin(u * Math.PI * 2) * 0.9 }) },
  // a full circuit of the arena, closing where it started
  { id:'loop',   n:19, at: u => ({ x: -Math.cos(u * Math.PI * 2),
                                   z: Math.sin(u * Math.PI * 2) * 0.92 }) },
  // figure of eight: crosses its own middle, so the centre is walked twice
  { id:'eight',  n:20, at: u => ({ x: Math.sin(u * Math.PI * 2),
                                   z: Math.sin(u * Math.PI * 4) * 0.85 }) },
  // straight run with a hard triangular weave, the most demanding of the five
  { id:'weave',  n:18, at: u => ({ x: -1 + 2*u, z: tri(u * 3) * 0.85 }) },
  // spiral inward from the rim to the middle
  { id:'spiral', n:20, at: u => ({ x: Math.cos(u * Math.PI * 3.4) * (1 - u * 0.8),
                                   z: Math.sin(u * Math.PI * 3.4) * (1 - u * 0.8) * 0.92 }) },
];

const feast = { path:null, route:null };

/* Queue a whole feast onto evt.queue and draw its ribbon. Returns the seconds
   of melons queued; events.js adds the tail for the last one to land.
   `forceId` exists for the autopilot sweep in tools/shoot.js, which has to walk
   each route in turn rather than whichever one the dice picked. */
function startFeastRoute(queue, forceId){
  const route = FEAST_ROUTES.find(r => r.id === forceId)
             || FEAST_ROUTES[(Math.random() * FEAST_ROUTES.length) | 0];
  feast.route = route.id;

  const spanX = ARENA.halfX * 0.92, spanZ = ARENA.halfZ * 0.66;
  const flipZ = Math.random() < 0.5 ? 1 : -1;
  const pts = [];
  for (let i = 0; i < route.n; i++){
    const p = route.at(route.n > 1 ? i / (route.n - 1) : 0);
    pts.push({
      x: THREE.MathUtils.clamp(p.x * spanX, -ARENA.halfX, ARENA.halfX),
      z: THREE.MathUtils.clamp(p.z * spanZ * flipZ, -ARENA.halfZ, ARENA.halfZ),
    });
  }

  /* A feast is a REWARD, so its steps get far more slack than a formation's:
     FEAST_REACH is well under the 0.5 a level-1 route starts at, which means
     every hop along the path is walkable at about a third of top speed. The
     path is dense, so this mostly resolves to the stepTime floor anyway. */
  const FEAST_REACH = 0.34;
  const speed = fmtSpeed();
  let t = 0.6;
  for (let i = 0; i < pts.length; i++){
    const p = pts[i];
    if (i > 0){
      const q = pts[i-1];
      t += stepTime(Math.hypot(p.x - q.x, p.z - q.z), speed, FEAST_REACH, false);
    }
    // `straight` keeps a melon over the ribbon: its usual lateral wander would
    // land it a couple of units off the promised line
    queue.push({ at: t, fn: () =>
      spawnItem('watermelon', { targeted:false, straight:true, x:p.x, z:p.z }) });
  }

  /* Brighter and more saturated than a formation's ribbon: this one is a
     twenty-melon trail rather than five landing spots, it is the only thing on
     the ground for the length of the set-piece, and at the formation ribbon's
     0.42 the pale melon pink washed out to grey against grass. */
  disposeFeastPath();
  feast.path = buildPath(pts, 0xff5d73, 0.6);
  return t;
}

function disposeFeastPath(){
  if (!feast.path) return;
  scene.remove(feast.path);
  feast.path.children.forEach(m => m.material.dispose());
  feast.path = null;
  feast.route = null;
}
