/* =======================================================================
   SPAWN DIRECTOR — formations

   A formation is a SHAPE — a run of landing spots with a route through them —
   emitted as one unit and read off the ribbon, so the player plans one
   movement instead of reacting three times. Food used to arrive as unrelated
   drips, which late on meant three items in the air with a third of a second
   of warning each: triage, not catching.

   Solvability is arithmetic. Every gap gets exactly the time needed to walk it
   (distance over a fraction of top speed), so no formation can ask for more
   than the capybara has. Difficulty raises that fraction and lengthens the
   shapes; it is NOT carried by fall speed, which caps out early. Strays keep
   dropping between formations so the sky still has noise in it.

   ROUTES ARE NOT BUILT HERE. js/routes.js is the whole deck; this file picks
   one, turns it to a random angle, scales it to the field, prices every step
   and queues the items. The chainer, the length distribution and the
   readability search that fed on it are gone — see routes.js for why.
   ======================================================================= */

/* The deck lives in js/routes.js — ROUTES. It is data, and it is what the
   route editor (`node tools/routes.js`) reads and writes. */

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

/* One ribbon, drawn as segments that TAPER along the route: first step widest
   and brightest, last thinnest and faintest. Not decoration — a flat ribbon is
   unreadable the moment a shape doubles back over itself, and pincer, boomerang,
   coil and serpent all put two lines across the same ground. Each segment
   records the beat it ARRIVES at, so spent segments can leave the ground. */
/* THE RIBBON IS A WINDOW THAT SLIDES, not a picture drawn once: the next few
   beats, dimmer further off, nothing beyond, sliding forward on every beat that
   lands, so a long route never arrives as a wall of dots.

   ONE WINDOW FOR BOTH. Dots and lines ran to different depths (9 and 5), which
   drew dots hanging several beats past any line. They share a beat index now,
   so a dot and the line reaching it appear, dim and leave as one thing.

   NOTHING CUTS IN OR OUT: every piece eases toward its target opacity over
   about a fifth of a second, so the window slides as a gradient rather than a
   shutter. Dots grow into place on the same curve. */
const REVEAL_AHEAD = 6;      // beats of route visible at once
const REVEAL_DIM = 0.55;     // how much the far edge of the window is dimmed
const FADE_RATE = 7.5;       // opacity units per second

/* Set where every piece of the ribbon is HEADING. Called on emit and on every
   beat that resolves; the easing toward it happens per frame in updatePaths. */
function revealPath(g, done){
  for (const m of g.children){
    const ahead = m.userData.beat - done;
    m.userData.want = (ahead < 0 || ahead > REVEAL_AHEAD) ? 0
      : m.userData.base * (1 - REVEAL_DIM * (ahead / REVEAL_AHEAD));
  }
}

/* Ease every live ribbon toward those targets. Cheap — a few dozen meshes —
   and it is the only per-frame work the director does. */
function updatePaths(dt){
  const k = 1 - Math.pow(0.001, dt * FADE_RATE / 7.5);
  for (const rec of fmt.live.values()){
    if (!rec.path) continue;
    for (const m of rec.path.children){
      const want = m.userData.want || 0;
      let o = m.material.opacity + (want - m.material.opacity) * k;
      // an exponential ease never actually reaches its target, so a spent piece
      // would sit at a fraction of a percent forever: close enough is done
      if (want === 0 && o < 0.012) o = 0;
      m.material.opacity = o;
      m.visible = o > 0;
      // dots grow in on the same curve they brighten on, so a beat arrives as
      // one gesture rather than as a full-size dot that then lights up
      if (m.visible && !m.userData.line){
        const u = THREE.MathUtils.clamp(o / m.userData.base, 0, 1);
        m.scale.setScalar(m.userData.baseScale * (0.5 + 0.5 * u));
      }
    }
  }
}

function buildPath(pts, colour, opacity = 0.42, dots = false){
  const g = new THREE.Group();

  /* The landing SPOTS, marked before anything is in the air and graded largest
     and brightest first. This is what makes a route readable: the lines say how
     beats join up, but where two run over the same ground they are spaghetti
     and five dots in descending size are not. Hazard beats are red — "do not
     stand here" is part of the route, and the item's own ring says it late. */
  if (dots) for (let i = 0; i < pts.length; i++){
    const dot = new THREE.Mesh(fmtDotGeo, new THREE.MeshBasicMaterial({
      color: pts[i].bad ? 0xff5a4a : colour, transparent:true, depthWrite:false,
      opacity: 0 }));
    dot.position.set(pts[i].x, 0.03, pts[i].z);
    dot.userData.beat = i;
    dot.userData.base = pts[i].bad ? 0.62 : 0.72;
    dot.userData.baseScale = 0.44;
    dot.scale.setScalar(0.44 * 0.5);
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
      color: colour, transparent:true, depthWrite:false, opacity: 0 }));
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
/* Capped at 0.78, not 0.86: an autopilot clears 0.86 because it knows the spot
   the instant the beat spawns, but a person reads, decides, then moves. A fifth
   of every step as slack is what keeps a route clearable by reacting. */
const fmtReach = () => Math.min(0.78, 0.5 + game.level * 0.018);
const fmtSpeed = () => (12.2 + game.level * 0.16) * game.up.speed;

/* Time to allow for a step of `d` units; dividing by `reach` is the slack. A
   dash step is measured against a dash-assisted run, which is shorter — that is
   what makes the dash necessary rather than optional. */
function stepTime(d, speed, reach, dash){
  if (!dash) return Math.max(0.34, d / (speed * reach));
  const burst = (DASH_SPEED + speed) / 2 * DASH_TIME;      // ground a dash covers
  const t = d <= burst ? DASH_TIME * (d / burst)
                       : DASH_TIME + (d - burst) / speed;
  return Math.max(0.3, t / reach);
}

/* ?route=<id> pins the director to one route, ignoring its unlock level — the
   route editor's TEST button. Resolved once at load; an unknown id plays a
   normal game rather than no game. */
const ROUTE_ONLY = ROUTES.find(r =>
  r.id === new URLSearchParams(location.search).get('route')) || null;

/* Everything unlocked, weighted. Length is not chosen here and there is no
   distribution to tune: a route's `min` is what paces length, so short routes
   simply stay in the pool forever while longer ones are added on top. */
function pickRoute(){
  if (ROUTE_ONLY) return ROUTE_ONLY;
  const pool = [];
  for (const r of ROUTES){
    if (game.level < r.min) continue;
    for (let i = 0; i < r.weight; i++) pool.push(r);
  }
  if (!pool.length) return ROUTES[0];
  return pool[(Math.random() * pool.length) | 0];
}

/* PLACING A ROUTE: a free rotation and an optional mirror, and that is the
   whole transform. On a circle a rotation is exact, so one authored route reads
   as a different one each time without any of it being generated. Scaled to the
   rim, not inside it — a beat at the edge of the disc lands at the edge of the
   field, which is the point of authoring in one. */
function placeRoute(route){
  const a = Math.random() * Math.PI * 2;
  const cos = Math.cos(a), sin = Math.sin(a);
  const mir = Math.random() < 0.5 ? -1 : 1;
  return route.beats.map(b => {
    const bx = b.x * ARENA.r, bz = b.z * mir * ARENA.r;
    // the clamp is belt and braces: a rotation of a point inside the disc is
    // still inside it, so this only ever catches a beat authored past the rim
    const p = arenaClamp(bx * cos - bz * sin, bx * sin + bz * cos);
    return { x: p.x, z: p.z, bad:false, dash: !!b.dash };
  });
}

/* Seconds an item takes to fall from spawn to catch height. Measured rather
   than assumed, because items accelerate on the way down and the answer is
   what the opening beat's lead is priced against. */
function fallTime(){
  const D = SPAWN_Y - CATCH_Y, a = Math.abs(GRAV * 0.16);
  const v = Math.max(0.1, game.fallSpeed * routeFallMul());
  return (-v + Math.sqrt(v * v + 2 * a * D)) / a;
}

/* HAZARDS, placed here rather than written into the routes, so a route is not a
   hand you learn. Two rules: never more than one hazard per six food items — a
   route you mostly dodge is a shorter route with walking in between — and a
   decoy has to sit OFF the walking line, which `beside` enforces by
   construction. Density therefore climbs with LENGTH, which is where late-game
   difficulty comes from: four beats carry none, fourteen carry two. */
const HAZARD_CLEAR = 1.9;   // > CATCH_R + a hazard's radius: the line stays walkable

/* A decoy needs a line to sit off of: offset perpendicular to the step, on
   whichever side has more room, and only where it clears every other beat — a
   hazard inside catch range of a spot you must stand on is a tax, not a decoy.
   Returns null when there is nowhere fair, which is why a weave carries fewer. */
function beside(a, b, food){
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
  if (d < 0.8) return null;                     // too short a step to have a side
  const nx = -dz / d, nz = dx / d;
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
  // prefer the side that points INTO the field, so a decoy beside a step along
  // the rim goes inward rather than being dropped for want of room
  const inward = -(mx * nx + mz * nz);
  const order = inward >= 0 ? [1, -1] : [-1, 1];
  for (const side of order){
    const x = mx + nx * HAZARD_CLEAR * side, z = mz + nz * HAZARD_CLEAR * side;
    if (!insideArena(x, z, 0.4)) continue;
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
      /* Halfway between its neighbours in TIME, not an extra beat: a decoy the
         route waited for would hand the player more time than the route was
         priced at. Mid-step is also exactly where the player is when it lands. */
      if (h){ h.at = (at[i - 1] + at[i]) / 2; out.push(h); break; }
    }
  }
  return out;
}

function emitFormation(){
  const reach = fmtReach(), speed = fmtSpeed();
  const route = pickRoute();
  const food = placeRoute(route);

  /* The timeline is over the FOOD only, each gap floored so a tight route cannot
     machine-gun. A `dash` beat is timed against a dash-assisted run, which is
     SHORTER — so it falls back to walking time for a player with no dash, or
     Sticky Feet would make dash routes unclearable rather than slower.

     The OPENING beat is priced the same way from wherever the capybara is, less
     the fall time, and that is what lets a route drop at any angle with no
     anchoring. The old chainer slid each shape sideways to meet the walk
     instead, which worked for eight of nineteen shapes and pinned the rest to
     the middle of the arena. */
  const at = [Math.max(0, stepTime(Math.hypot(food[0].x - capyState.x,
                                              food[0].z - capyState.z),
                                   speed, reach, false) - fallTime())];
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
  /* `pts` is kept on the record because the ribbon is public information — it is
     what the player plans off. The autopilot in tools/shoot.js reads it for the
     same reason: one that waits for each beat to spawn is testing a player with
     no lead time, not the route. */
  /* Chain Sweeper: this route's score multiple, fixed the moment it is emitted
     so the ribbon, the items and the payout cannot disagree. */
  const gold = chainMul();
  const rec = { fid, total: pts.length, pending: pts.length, goods, caught: 0,
                spoiled: false, blocked: false, gold,
                name: route.id, pts,
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
     assumed: the last beat still has to fall, and Puzzler halves fall speed. A
     flat 14s quietly binned long Puzzler routes, ribbon and route clear with. */
  rec.limit = t + fallTime() + 6;
  return t;
}

/* Called from onCatch/onMiss for anything carrying a formation id. */
function formationItemResolved(it, caught){
  const rec = fmt.live.get(it.fid);
  if (!rec) return;
  rec.pending--;
  /* Did this beat land somewhere the player could not stand? A set-piece can
     open a sinkhole on top of a live route, and under Puzzler that turned the
     game's own doing into a lost life. Recorded per beat, when it is missed. */
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
     still have to walk. Dimming the whole ribbon instead left every crossing
     line in place, which is most of why doubling-back shapes read badly. */
  const done = rec.total - rec.pending;
  if (rec.path) revealPath(rec.path, done);
  if (rec.pending <= 0) completeFormation(rec);
}

function completeFormation(rec){
  const perfect = !rec.spoiled && rec.caught === rec.goods && rec.goods >= 3;
  /* `spoiled` is the only real failure: a good item dropped or a decoy eaten. A
     route that is neither perfect NOR spoiled has fewer than three good beats,
     and charging Puzzler a life for finishing one cleanly would be the game's
     fault. Every shape has three goods today; this keeps that non-load-bearing. */
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

  // the ribbon eases every frame, whatever else the director is doing — a
  // set-piece must not freeze a route's fade halfway
  updatePaths(dt);

  fmt.clock += dt;
  while (fmt.queue.length && fmt.clock >= fmt.queue[0].at) fmt.queue.shift().fn();

  if (busy) return;

  // strays: unscripted single items so the sky is not a metronome
  fmt.strayTimer -= dt;
  if (fmt.strayTimer <= 0){
    spawnItem(pickType());
    fmt.strayTimer = game.strayEvery * (0.7 + Math.random() * 0.7);
  }

  /* One route at a time: two overlapping shapes are not twice the challenge,
     they are an unreadable mess, and the pause below starts from the moment the
     arena is actually clear. The age check is a safety valve — `live` gates
     emission, so a record that never resolved would wedge the director and the
     game would simply stop dropping food. */
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

   One long continuous path, chosen from five, with every melon on it: they
   arrive in order along the curve, each with its own landing ring, and
   following the trail is the entire ask. The shower this replaced put sixteen
   melons at random x, which made the reward beat the least interesting twenty
   seconds in the game. Nothing is drawn on the ground for it — see the end of
   startFeastRoute.

   Parametric rather than hand-placed: a curve you can read as one expression is
   much easier to keep continuous than a sixteen-point list. `at(u)` returns
   normalised -1..1 coordinates, the same unit-disc convention as ROUTES.
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

/* Queue a whole feast onto evt.queue; returns the seconds of melons queued.
   `forceId` is for the autopilot sweep, which walks each route in turn rather
   than whichever one the dice picked. */
function startFeastRoute(queue, forceId){
  const route = FEAST_ROUTES.find(r => r.id === forceId)
             || FEAST_ROUTES[(Math.random() * FEAST_ROUTES.length) | 0];

  /* Same disc convention as the route library: sampled in -1..1, scaled so the
     furthest point sits ON the rim, then turned. Normalising rather than
     clamping keeps a curve the shape it was written as — `ess` reaches 1.35 at
     its corners and used to be flattened against the arena's edge. */
  const raw = [];
  for (let i = 0; i < route.n; i++) raw.push(route.at(route.n > 1 ? i / (route.n - 1) : 0));
  const most = Math.max(1e-3, ...raw.map(p => Math.hypot(p.x, p.z)));
  const k = ARENA.r / most;
  const a = Math.random() * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a);
  const mir = Math.random() < 0.5 ? -1 : 1;
  const pts = raw.map(p => {
    const x = p.x * k, z = p.z * mir * k;
    const q = arenaClamp(x * cos - z * sin, x * sin + z * cos);
    return { x: q.x, z: q.z };
  });

  /* A feast is a REWARD, so its steps get far more slack than a formation's:
     every hop is walkable at about a third of top speed. The path is dense, so
     this mostly resolves to the stepTime floor anyway. */
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

  /* NO RIBBON, deliberately. The window only shows REVEAL_AHEAD beats and slides
     on resolved FORMATION beats — a feast resolves none, so its twenty-melon
     trail stopped a third of the way across and stayed there. It never needed
     one: the melons' own landing rings draw the line several beats ahead. The
     routing is untouched, only the drawing is gone. */
  return t;
}
