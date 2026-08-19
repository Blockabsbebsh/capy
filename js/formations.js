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

/* The shape deck lives in js/shapes.js — FMT_SHAPES. It is data, and it is
   what the route editor (`node tools/routes.js`) reads and writes. */

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
/* THE RIBBON IS A WINDOW THAT SLIDES, not a picture drawn once. It shows the
   next few steps brightly, the ones after that fading out, and nothing beyond —
   and it slides forward every time a beat lands, so a route reveals itself as
   you walk it. That is what makes a long route readable: by the time a later
   segment appears, the earlier one it would have crossed is already gone, so
   the crossings that survive route generation still never end up on screen at
   the same moment.

   Dots run further ahead than lines. A dot says "a thing lands here" and stays
   legible however many there are; a line says "and these two join up", which is
   only worth knowing for the next few and is what turns into spaghetti in an
   arena twice as wide as it is deep. Neither is allowed to be drawn without the
   other around it — a dot beyond the line window with no line reaching it is
   the "dot in the middle of nowhere" this replaced. */
const DOT_AHEAD = 9, LINE_AHEAD = 5;

/* Show the part of the route still ahead of `done`, faded by how far off it is.
   Called once at build and again on every beat that resolves — per beat, not
   per frame. */
function revealPath(g, done){
  for (const m of g.children){
    const ahead = m.userData.beat - done;
    const span = m.userData.line ? LINE_AHEAD : DOT_AHEAD;
    m.visible = ahead >= 0 && ahead <= span;
    if (!m.visible) continue;
    const u = ahead / span;             // 0 = next, 1 = the edge of the window
    m.material.opacity = m.userData.base * (1 - 0.72 * u);
    if (!m.userData.line) m.scale.setScalar(m.userData.baseScale * (1 - 0.42 * u));
  }
}

function buildPath(pts, colour, opacity = 0.42, dots = false){
  const g = new THREE.Group();

  /* The landing SPOTS, marked before anything is in the air, and graded largest
     and brightest first. This is what actually makes a route readable: the
     connecting lines say how the beats join up, but where two of them run over
     the same ground — and in an arena twice as wide as it is deep, any shape
     that crosses from end to end does — the lines alone are spaghetti. Five
     dots in descending size are not.

     Hazard beats are marked red, because "do not stand here" is part of the
     route and waiting for the item's own ring to say so is late. */
  if (dots) for (let i = 0; i < pts.length; i++){
    const dot = new THREE.Mesh(fmtDotGeo, new THREE.MeshBasicMaterial({
      color: pts[i].bad ? 0xff5a4a : colour, transparent:true, depthWrite:false }));
    dot.position.set(pts[i].x, 0.03, pts[i].z);
    dot.userData.beat = i;
    dot.userData.base = pts[i].bad ? 0.62 : 0.72;
    dot.userData.baseScale = 0.44;
    g.add(dot);
  }

  for (let i = 1; i < pts.length; i++){
    const a = pts[i-1], b = pts[i];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    // wide and bright enough to read on a phone, where the whole arena is a
    // couple of hundred pixels across and a hairline simply disappears
    const seg = new THREE.Mesh(fmtPathGeo, new THREE.MeshBasicMaterial({
      color: colour, transparent:true, depthWrite:false }));
    seg.position.set((a.x + b.x) / 2, 0.035, (a.z + b.z) / 2);
    seg.rotation.y = -Math.atan2(dz, dx);
    seg.scale.set(len, 1, 0.26);
    seg.userData.beat = i;
    seg.userData.line = true;
    seg.userData.base = opacity;
    g.add(seg);
  }
  revealPath(g, 0);
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

/* ?shape=<id> pins the director to that one shape, ignoring its unlock level.
   This is how the route editor's TEST button opens the game — a shape you have
   just drawn is a shape you want to walk immediately, not one you want to wait
   twelve levels and a dice roll for. Resolved once at load, and an id nobody
   drew is ignored, so a typo plays a normal game rather than no game. */
const FMT_ONLY = FMT_SHAPES.find(s =>
  s.id === new URLSearchParams(location.search).get('shape')) || null;

function pickShape(){
  if (FMT_ONLY) return FMT_ONLY;
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

/* ROUTE LENGTH. One shape used to be the whole route, which stopped scaling
   long before the difficulty did: three to seven beats is one decision, and by
   the time a player reads routes fluently that is over before it starts. A
   route is now several shapes walked back to back, each anchored where the last
   one ended so the join is an ordinary step that stepTime prices like any
   other. Nothing about a shape changes — the length grows out of shapes that
   were already proven walkable, rather than out of new demands inside one.

   Capped at 18 food beats: past there the ribbon has more dots than the arena
   can separate — which is the same crowding that took the ribbon off a feast
   altogether. The jitter is what makes late routes vary rather than all
   arriving at the cap. */
const FOOD_CAP = 18, ROUTE_SEGS = 5, ROUTE_TRIES = 14;

/* Length is a DISTRIBUTION, not a curve. Scaling one length up with the level
   meant short routes stopped existing, and a three-to-five beat route read at a
   glance is the best-feeling thing in the game — it should never go away. So
   every level rolls: a short route, or a long one. What climbs is the CHANCE of
   a long one and how long it is allowed to be. */
function routeBeats(){
  const longest = Math.min(FOOD_CAP, 5 + game.level * 0.55);
  const goLong = Math.random() < THREE.MathUtils.clamp((game.level - 5) / 22, 0, 0.65);
  return goLong ? 5 + Math.random() * (longest - 5) : 3 + Math.random() * 3;
}

/* HOW LEGIBLE IS THIS ROUTE? Clearability has always been arithmetic here
   rather than eyeballing; readability was left to the shapes being hand-drawn,
   and that stopped being true the moment routes started chaining several of
   them into one arena. Crossings grow with the SQUARE of the length — every new
   segment can cross every earlier one — so a five-beat shape averaged 0.2 of
   them and a fourteen-beat chain averaged 16, which is the "random noise" a
   route should never look like.

   Three things make a route hard to read, and none of them is length:
     - a segment crossing another, so you cannot tell which line is next;
     - a near-reversal, where the path doubles back over ground it just used;
     - two beats almost on top of each other, which read as one dot.
   Scored, not forbidden: a sharp angle is sometimes the good part, so this
   picks the cleanest of several candidates rather than banning anything. */
function crosses(a, b, c, d){
  const s = (p, q, r) => Math.sign((q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x));
  return s(a, b, c) * s(a, b, d) < 0 && s(c, d, a) * s(c, d, b) < 0;
}
const BEAT_APART = 1.2;                 // closer than this and two dots read as one

/* Weighted by whether the two would ever be ON SCREEN TOGETHER, which is what
   actually confuses a player: the ribbon only draws a window, so a route folding
   back across ground it used ten beats ago is never ambiguous — that line is
   long gone. A crossing inside the window is. Scoring the visible ones hard and
   the rest barely at all is what lets a long route use the whole arena instead
   of being pushed into a corner to avoid itself. */
function routeNoise(p){
  let noise = 0;
  for (let i = 1; i < p.length; i++)
    for (let j = i + 2; j < p.length; j++)
      if (crosses(p[i-1], p[i], p[j-1], p[j]))
        noise += (j - i <= LINE_AHEAD) ? 12 : 1;
  for (let i = 1; i < p.length - 1; i++){
    const ax = p[i].x - p[i-1].x, az = p[i].z - p[i-1].z;
    const bx = p[i+1].x - p[i].x, bz = p[i+1].z - p[i].z;
    const c = (ax*bx + az*bz) / (Math.hypot(ax,az) * Math.hypot(bx,bz) || 1);
    // 0 is straight on, 180 is a full reversal
    const turn = Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
    if (turn > 115) noise += 3 + (turn - 115) / 10;
  }
  for (let i = 0; i < p.length; i++)
    for (let j = i + 2; j < p.length; j++)
      if (Math.hypot(p[i].x - p[j].x, p[i].z - p[j].z) < BEAT_APART)
        noise += (j - i <= DOT_AHEAD) ? 4 : 0.5;
  return noise;
}

/* HAZARDS. Placed here rather than written into the shapes, so a route is not
   a hand you learn to recognise. Two rules, and the first is the player-facing
   one: never more than one hazard per six food items. A route you mostly dodge
   is not a harder route, it is a shorter one with walking in between — and the
   whole point of a formation is the catching. The second is that a decoy has to
   sit OFF the walking line, which is what made the old hand-placed ones fair;
   `beside` enforces it by construction instead of by authoring care.

   Density therefore climbs with LENGTH, which is where late-game difficulty
   actually comes from: a five-beat route can carry none, an eighteen-beat one
   carries three. */
const HAZARD_CLEAR = 1.9;   // > CATCH_R + a hazard's radius: the line stays walkable

/* A decoy needs a line to sit off of. Offset perpendicular to the step, on
   whichever side has more room, and only where it clears every other beat —
   a hazard inside catch range of a spot the player has to stand on is not a
   decoy, it is a tax. Returns null when there is nowhere fair to put one,
   which is how a weave ends up carrying fewer than a sweep does. */
function beside(a, b, food){
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
  if (d < 0.8) return null;                     // too short a step to have a side
  const nx = -dz / d, nz = dx / d;
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
  const order = Math.abs(mz + nz * HAZARD_CLEAR) <= Math.abs(mz - nz * HAZARD_CLEAR)
              ? [1, -1] : [-1, 1];
  for (const side of order){
    const x = mx + nx * HAZARD_CLEAR * side, z = mz + nz * HAZARD_CLEAR * side;
    if (Math.abs(x) > ARENA.halfX - 0.4 || Math.abs(z) > ARENA.halfZ - 0.4) continue;
    if (food.some(p => Math.hypot(p.x - x, p.z - z) < HAZARD_CLEAR)) continue;
    return { x, z, bad: true, dash: false };
  }
  return null;
}

function placeHazards(food, at){
  const cap = Math.floor(food.length / 6);      // the 1 : 6 rule, and it is a cap
  if (cap < 1) return [];
  /* How much of the cap this level spends. Nothing before level 5, the full
     allowance by 14 — and hazardMul carries overtime and the hearts the player
     chose to bank, so those reach the top of it sooner rather than past it. */
  const ramp = Math.min(1, Math.max(0, (game.level - 4) / 10) * hazardMul());
  const n = Math.round(cap * ramp);
  if (n < 1) return [];

  /* Spread over the route rather than clustered: one per evenly spaced bucket
     of steps, picked at random inside its bucket so the placement is not a
     pattern of its own. */
  const out = [];
  for (let b = 0; b < n; b++){
    const lo = 1 + Math.floor((food.length - 1) * b / n);
    const hi = Math.max(lo, Math.floor((food.length - 1) * (b + 1) / n) - 1);
    for (let tries = 0; tries < 4; tries++){
      const i = lo + ((Math.random() * (hi - lo + 1)) | 0);
      const h = beside(food[i - 1], food[i], food);
      /* Halfway between its neighbours in TIME, not an extra beat in the
         sequence: a decoy the route had to wait for would hand the player more
         time than the shape was priced at, so dodging one would make the food
         easier rather than harder. Mid-step is also exactly where the player is
         when it lands, which is the whole idea. */
      if (h){ h.at = (at[i - 1] + at[i]) / 2; out.push(h); break; }
    }
  }
  return out;
}

/* One candidate route: shapes chained until it is about `want` beats long, each
   anchored where the last one ended so the join is an ordinary step. */
function buildRoute(want){
  const spanZ = ARENA.halfZ * 0.62;
  const segs = [];
  let n = 0;
  while (segs.length < ROUTE_SEGS){
    const shape = pickShape();
    const len = shape.beats.length;
    // nearest fit, not first-past-the-post: stopping short of `want` is better
    // than overshooting it by most of another shape
    if (n && (n + len > FOOD_CAP || Math.abs(n + len - want) >= Math.abs(n - want))) break;
    segs.push(shape); n += len;
  }

  const food = [];
  let fromX = capyState.x;
  for (let si = 0; si < segs.length; si++){
    const shape = segs[si];
    const flipX = Math.random() < 0.5, flipZ = Math.random() < 0.5;
    const spanX = ARENA.halfX * shape.span;
    const slackX = Math.max(0, ARENA.halfX - 0.6 - spanX);
    /* Anchor so the OPENING beat lands near wherever the walk already is — the
       capybara for the first shape, the previous shape's last beat after that.
       Every gap inside a shape is sized to be walkable, but the step INTO one
       was not: anchored at random it could open on the far side of the arena
       from a player who had just finished the last one, which is a dropped item
       through no fault of theirs. The jitter is first-shape only, so
       continuations stay continuations. */
    const firstX = (flipX ? -shape.beats[0].x : shape.beats[0].x) * spanX;
    const jitter = si === 0 ? (Math.random() * 2 - 1) * slackX * 0.4 : 0;
    const ax = THREE.MathUtils.clamp(fromX - firstX + jitter, -slackX, slackX);
    for (const b of shape.beats){
      food.push({
        x: THREE.MathUtils.clamp(ax + (flipX ? -b.x : b.x) * spanX, -ARENA.halfX, ARENA.halfX),
        z: THREE.MathUtils.clamp((flipZ ? -b.z : b.z) * spanZ, -ARENA.halfZ, ARENA.halfZ),
        bad: false, dash: !!b.dash,
      });
    }
    fromX = food[food.length - 1].x;
  }
  food.name = segs.map(s => s.id).join('+');
  return food;
}

function emitFormation(){
  const reach = fmtReach(), speed = fmtSpeed();

  /* Build several and walk the cleanest. Which shapes come up, which way each
     is flipped and where it is anchored are all rolled per candidate, so this
     is sampling the same generator rather than repairing one draw — and a route
     that scores zero is taken immediately, which is most of them at short
     lengths. Cheap: a few hundred comparisons against a frame's budget. */
  const want = routeBeats();
  let food = null, noise = Infinity;
  for (let k = 0; k < ROUTE_TRIES; k++){
    const cand = buildRoute(want);
    const n = routeNoise(cand);
    if (n < noise){ noise = n; food = cand; }
    if (!noise) break;
  }

  /* The timeline is over the FOOD only. Each gap gets exactly the time needed
     to walk it, floored so a tight shape cannot machine-gun. A `dash` beat is
     timed against a dash-assisted run, which is SHORTER than the walk — so it
     has to fall back to walking time for a player who has no dash. Sticky Feet
     trades the dash away, and without this the leap and hook shapes would be
     the one thing that perk makes literally unclearable rather than slower. */
  const at = [0];
  for (let i = 1; i < food.length; i++){
    const p = food[i], q = food[i - 1];
    at.push(at[i - 1] + stepTime(Math.hypot(p.x - q.x, p.z - q.z), speed, reach,
                                 p.dash && !game.run.sticky));
  }

  const pts = food.map((p, i) => Object.assign({ at: at[i] }, p));
  for (const h of placeHazards(food, at)) pts.push(h);
  pts.sort((a, b) => a.at - b.at);

  const fid = ++fmt.nextId;
  const goods = food.length;
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
                spoiled: false, blocked: false, gold,
                name: food.name, pts,
                path: buildPath(pts, gold > 1 ? 0xffe14d : 0xffd77a,
                                gold > 1 ? 0.75 : 0.55, true) };
  fmt.live.set(fid, rec);

  for (const p of pts){
    const type = p.bad ? (Math.random() < 0.55 ? 'chili' : 'soap')
                       : (Math.random() < 0.24 ? 'watermelon' : 'burger');
    fmt.queue.push({ at: fmt.clock + p.at, fn: () =>
      spawnItem(type, { targeted:false, x:p.x, z:p.z, fid, gold }) });
  }
  const t = pts[pts.length - 1].at;
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
  if (rec.path) revealPath(rec.path, done);
  if (rec.pending <= 0) completeFormation(rec);
}

function completeFormation(rec){
  const perfect = !rec.spoiled && rec.caught === rec.goods && rec.goods >= 3;
  /* `spoiled` is the only real failure: a good item dropped, or a decoy eaten.
     A route that is neither perfect NOR spoiled can only be one with fewer than
     three good beats, and charging Puzzler a life — or breaking a Chain Sweeper
     streak — for finishing one of those cleanly would be the game's fault, not
     the player's. Every shape has three goods today; this keeps that from being
     load-bearing for a future one. */
  const failed = rec.spoiled;
  puzzlerReward(perfect, rec.blocked, failed);
  if (perfect) chainCleared(); else if (failed) chainBroken();
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
   it. Same reward, but you run it: the melons arrive in order along the curve,
   each with its own landing ring, and following the trail is the entire ask.
   Nothing is drawn on the ground for it — see the end of startFeastRoute.

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

/* Queue a whole feast onto evt.queue. Returns the seconds of melons queued;
   events.js adds the tail for the last one to land.
   `forceId` exists for the autopilot sweep in tools/shoot.js, which has to walk
   each route in turn rather than whichever one the dice picked. */
function startFeastRoute(queue, forceId){
  const route = FEAST_ROUTES.find(r => r.id === forceId)
             || FEAST_ROUTES[(Math.random() * FEAST_ROUTES.length) | 0];

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

  /* NO RIBBON. A feast used to draw one, and it was the one place the sliding
     window was wrong for the job: revealPath only ever shows LINE_AHEAD steps
     of line, which on a five-beat formation is the whole route and on a
     twenty-melon feast is the first third — so the trail visibly stopped
     partway across the arena and never slid, because nothing here resolves
     formation beats. It also never needed one. A feast is a dense continuous
     line of melons falling in order; the items' own landing rings already draw
     it, several beats ahead, and they are the indicator that keeps up.
     Drawing the path is what is gone, not the routing: the melons still land
     on the curve, in order, at slack-priced steps. */
  return t;
}
