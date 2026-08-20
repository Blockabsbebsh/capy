/* =======================================================================
   ROUTE EDITOR — the page

   Served by tools/routes.js, which also serves the game, so everything here
   runs against the REAL code: ARENA and the dash constants out of config.js,
   and stepTime / fmtReach / fmtSpeed / routeNoise / crosses / beside straight
   out of formations.js. Nothing in this file re-implements a number the
   director computes — a checker that disagrees with the game is worse than no
   checker, since it is believed.

   What it cannot answer is whether a shape is WALKABLE, and it does not
   pretend to: clearability is proved by walking it, which is what
   `node tools/shoot.js --fmt` does against a real browser. This draws the
   picture, prices every step, and scores the reading.
   ======================================================================= */
'use strict';

const S = { shapes: [], sel: -1, dirty: false, busy: false };
const $ = id => document.getElementById(id);

/* Shape space is -1..1 inside a footprint; the footprint is placed in the
   arena at emit time. Both numbers below come from buildRoute — spanZ is a
   fixed fraction of the arena's depth for every shape, spanX is the shape's
   own `span`. Anchored at x 0 here: the director slides that along to meet the
   walk, which moves a shape but never changes its picture. */
const spanX = sh => ARENA.halfX * sh.span;
const spanZ = sh => ARENA.halfZ * (sh.depth || FMT_DEPTH);
const world = (sh, b) => ({ x: b.x * spanX(sh), z: b.z * spanZ(sh), dash: !!b.dash });
const worldPts = sh => sh.beats.map(b => world(sh, b));

/* ------------------------------------------------------------ drawing --- */
const PAD = 24;   // a beat at x -1 or 1 sits ON the arena edge — leave it room
function mapper(cv){
  const w = cv.width, h = cv.height;
  const sx = (w - PAD * 2) / (ARENA.halfX * 2), sz = (h - PAD * 2) / (ARENA.halfZ * 2);
  return {
    // z grows toward the camera, so +z draws DOWN — the same way you see it
    px: x => PAD + (x + ARENA.halfX) * sx,
    pz: z => PAD + (z + ARENA.halfZ) * sz,
    ux: p => (p - PAD) / sx - ARENA.halfX,
    uz: p => (p - PAD) / sz - ARENA.halfZ,
    r: d => d * sx,
    sx, sz,
  };
}

function drawShape(cv, sh, opts = {}){
  const g = cv.getContext('2d'), m = mapper(cv);
  const big = !!opts.big, pts = worldPts(sh);
  g.clearRect(0, 0, cv.width, cv.height);

  // the arena, and the footprint this shape actually lands in
  g.fillStyle = '#241a12';
  g.fillRect(m.px(-ARENA.halfX), m.pz(-ARENA.halfZ),
             m.r(ARENA.halfX * 2), m.pz(ARENA.halfZ) - m.pz(-ARENA.halfZ));
  g.strokeStyle = 'rgba(255,205,140,.35)'; g.lineWidth = 1;
  g.strokeRect(m.px(-ARENA.halfX), m.pz(-ARENA.halfZ),
               m.r(ARENA.halfX * 2), m.pz(ARENA.halfZ) - m.pz(-ARENA.halfZ));
  if (big){
    g.setLineDash([4, 5]); g.strokeStyle = 'rgba(255,205,140,.22)';
    g.strokeRect(m.px(-spanX(sh)), m.pz(-spanZ(sh)),
                 m.r(spanX(sh) * 2), m.pz(spanZ(sh)) - m.pz(-spanZ(sh)));
    g.beginPath();
    g.moveTo(m.px(0), m.pz(-ARENA.halfZ)); g.lineTo(m.px(0), m.pz(ARENA.halfZ));
    g.moveTo(m.px(-ARENA.halfX), m.pz(0)); g.lineTo(m.px(ARENA.halfX), m.pz(0));
    g.stroke(); g.setLineDash([]);
  }

  /* The ribbon, tapered the way buildPath tapers it: first step widest and
     brightest. Where a shape doubles back over itself this ordering is the
     only thing in the picture that says which line you walk first. */
  for (let i = 1; i < pts.length; i++){
    const u = (i - 1) / Math.max(1, pts.length - 1);
    g.strokeStyle = `rgba(255,215,122,${0.85 - 0.55 * u})`;
    g.lineWidth = (big ? 13 : 5) * (1 - 0.35 * u);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(m.px(pts[i-1].x), m.pz(pts[i-1].z));
    g.lineTo(m.px(pts[i].x), m.pz(pts[i].z));
    g.stroke();
  }

  pts.forEach((p, i) => {
    const u = i / Math.max(1, pts.length - 1);
    if (big){                                    // where the capybara can catch
      g.strokeStyle = 'rgba(159,224,122,.14)'; g.lineWidth = 1;
      g.beginPath(); g.arc(m.px(p.x), m.pz(p.z), m.r(CATCH_R), 0, 7); g.stroke();
    }
    g.fillStyle = `rgba(255,225,168,${0.95 - 0.4 * u})`;
    g.beginPath(); g.arc(m.px(p.x), m.pz(p.z), big ? 15 : 5, 0, 7); g.fill();
    if (p.dash){                                 // a step priced against a dash
      g.strokeStyle = '#9fe07a'; g.lineWidth = big ? 3 : 2;
      g.beginPath(); g.arc(m.px(p.x), m.pz(p.z), big ? 21 : 8, 0, 7); g.stroke();
    }
    if (big){
      if (i === opts.sel){
        g.strokeStyle = '#fff'; g.lineWidth = 2;
        g.beginPath(); g.arc(m.px(p.x), m.pz(p.z), 24, 0, 7); g.stroke();
      }
      g.fillStyle = '#2b1d16'; g.font = 'bold 15px ui-monospace, monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(i + 1), m.px(p.x), m.pz(p.z) + 1);
    }
  });

  /* Where placeHazards COULD put a decoy — `beside` says a step has room, it
     does not say one lands there. Crossed, not ringed: a ring here reads as
     another catch radius, and these are the opposite of somewhere to stand. */
  if (big && opts.hazards) for (const h of opts.hazards){
    const x = m.px(h.x), z = m.pz(h.z), r = 7;
    g.strokeStyle = 'rgba(255,90,74,.8)'; g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(x - r, z - r); g.lineTo(x + r, z + r);
    g.moveTo(x + r, z - r); g.lineTo(x - r, z + r);
    g.stroke();
  }
}

/* ------------------------------------------------------------- library --- */
function renderLibrary(){
  const box = $('library');
  box.innerHTML = '';
  S.shapes.forEach((sh, i) => {
    const card = document.createElement('div');
    card.className = 'card' + (i === S.sel ? ' sel' : '');
    card.innerHTML =
      `<canvas width="208" height="104"></canvas>` +
      `<div><div class="name">${sh.id}${sh._new ? ' <span class="dirty">new</span>' : ''}</div>` +
      `<div class="meta">level ${sh.min}+ · weight ${sh.weight} · span ${sh.span} · ` +
      `${sh.beats.length} beats${sh.beats.some(b => b.dash) ? ' · dash' : ''}</div>` +
      `<div class="row">` +
      `<button data-a="edit">EDIT</button>` +
      `<button class="ghost" data-a="test">TEST</button>` +
      `<button class="ghost" data-a="copy">COPY</button>` +
      `<button class="danger" data-a="del">DELETE</button></div></div>`;
    drawShape(card.querySelector('canvas'), sh);
    card.addEventListener('click', e => {
      const a = e.target.dataset && e.target.dataset.a;
      if (a === 'del') return del(i);
      if (a === 'copy') return copy(i);
      if (a === 'test') return test(i);
      select(i);
    });
    box.appendChild(card);
  });
  $('fileLine').textContent = `js/shapes.js — ${S.shapes.length} shapes` +
                              (S.dirty ? ' — UNSAVED' : '');
  $('fileLine').className = 'sub' + (S.dirty ? ' dirty' : '');
}

/* -------------------------------------------------------------- editor --- */
function select(i){
  S.sel = i; S.beat = -1;
  const sh = S.shapes[i];
  if (sh){
    $('fId').value = sh.id; $('fMin').value = sh.min;
    $('fWeight').value = sh.weight; $('fSpan').value = sh.span;
    $('fDepth').value = sh.depth || FMT_DEPTH;
    $('fNote').value = sh.note || '';
    if (!$('fLevel').dataset.touched) $('fLevel').value = sh.min;
  }
  renderAll();
}

function cur(){ return S.shapes[S.sel] || null; }
function touch(){ S.dirty = true; renderAll(); }

function renderAll(){
  const sh = cur();
  $('editor').style.display = sh ? '' : 'none';
  if (sh) drawShape($('stage'), sh, { big:true, sel:S.beat, hazards:hazardSpots(sh) });
  renderCheck();
  renderLibrary();
}

/* -------------------------------------------------------------- checks ---
   Everything here is the game's own arithmetic, called with the editor's level
   in game.level so a shape can be priced at its unlock level and again at 24,
   where fmtReach has hit its 0.78 ceiling and every step is at its tightest. */
function atLevel(level){
  const was = game.level;
  game.level = level;
  const out = { reach: fmtReach(), speed: fmtSpeed() };
  game.level = was;
  return out;
}

function steps(sh, level){
  const pts = worldPts(sh), { reach, speed } = atLevel(level);
  const out = [];
  for (let i = 1; i < pts.length; i++){
    const a = pts[i-1], b = pts[i];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const t = stepTime(d, speed, reach, b.dash);
    out.push({ i, d, t, dash: !!b.dash, need: t > 0 ? d / t : 0, speed,
               walk: stepTime(d, speed, reach, false) });
  }
  return out;
}

/* Which steps could carry a decoy, using placeHazards' own `beside`. A shape
   whose steps are all short or all boxed in never takes one — that is a real
   property of the shape (a weave takes fewer than a sweep), not a fault. */
function hazardSpots(sh){
  const pts = worldPts(sh), out = [];
  for (let i = 1; i < pts.length; i++){
    const h = beside(pts[i-1], pts[i], pts);
    if (h) out.push(h);
  }
  return out;
}

function findings(sh, level){
  const pts = worldPts(sh), out = [];
  const add = (kind, text) => out.push({ kind, text });

  if (sh.beats.length < 2) add('bad', 'a shape needs at least two beats');
  sh.beats.forEach((b, i) => {
    if (Math.abs(b.x) > 1 || Math.abs(b.z) > 1)
      add('bad', `beat ${i + 1} is outside the -1..1 footprint`);
  });

  /* Crossings, weighted the way routeNoise weights them: inside the ribbon's
     line window they are what makes a route unreadable, outside it the first
     line is long gone by the time the second is drawn. */
  const near = [], far = [];
  for (let i = 1; i < pts.length; i++)
    for (let j = i + 2; j < pts.length; j++)
      if (crosses(pts[i-1], pts[i], pts[j-1], pts[j]))
        (j - i <= LINE_AHEAD ? near : far).push(`${i}x${j}`);
  if (near.length)
    add('warn', `steps ${near.join(', ')} cross while both are on screen — ` +
                'nothing in the picture says which line you walk first');
  if (far.length)
    add('note', `steps ${far.join(', ')} cross, but more than ${LINE_AHEAD} beats ` +
                'apart: the first line is off the ground before the second is drawn');

  /* Reversals, as one line rather than one per beat — a zig-zag shape trips
     this at every beat, and a list of five is not five findings. */
  const turns = [];
  for (let i = 1; i < pts.length - 1; i++){
    const ax = pts[i].x - pts[i-1].x, az = pts[i].z - pts[i-1].z;
    const bx = pts[i+1].x - pts[i].x, bz = pts[i+1].z - pts[i].z;
    const c = (ax*bx + az*bz) / (Math.hypot(ax,az) * Math.hypot(bx,bz) || 1);
    const turn = Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
    if (turn > 115) turns.push({ i: i + 1, turn });
  }
  if (turns.length)
    add(turns.some(t => t.turn > 150) ? 'warn' : 'note',
        `beat${turns.length > 1 ? 's' : ''} ${turns.map(t => t.i).join(', ')} ` +
        `turn back over 115° (sharpest ${Math.round(Math.max(...turns.map(t => t.turn)))}°) — ` +
        'routeNoise prices each one; a near-reversal walks over ground just used');

  const close = [];
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 2; j < pts.length; j++)
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) < BEAT_APART)
        close.push({ pair: `${i + 1}+${j + 1}`, seen: j - i <= DOT_AHEAD });
  if (close.length)
    add(close.some(c => c.seen) ? 'warn' : 'note',
        `beats ${close.map(c => c.pair).join(', ')} land under ${BEAT_APART}u apart — ` +
        'that close, two dots read as one');

  /* Z LANES. The arena is twice as wide as it is deep, so a shape that crosses
     it more than once draws near-parallel streaks in one shallow band unless
     it steps in z as it goes. Measured on the traversals only — a short step
     has no lane to share. */
  const cross = [];
  for (let i = 1; i < sh.beats.length; i++)
    if (Math.abs(sh.beats[i].x - sh.beats[i-1].x) >= 1.3)
      cross.push({ i, z: (sh.beats[i].z + sh.beats[i-1].z) / 2 });
  for (let a = 0; a < cross.length; a++)
    for (let b = a + 1; b < cross.length; b++)
      if (Math.abs(cross[a].z - cross[b].z) < 0.3)
        add('warn', `steps ${cross[a].i} and ${cross[b].i} both cross the arena in ` +
                    'the same z lane — step in z between them or they draw as ' +
                    'parallel streaks');

  const st = steps(sh, level);
  const free = st.filter(s => s.t <= 0.35).length;
  if (free) add('note', `${free} step${free > 1 ? 's are' : ' is'} at the stepTime ` +
                        'floor — the shape is a pause there, which is what cluster is for');
  const hz = hazardSpots(sh).length;
  add('note', hz ? `${hz} of ${st.length} steps have room for a decoy beside them`
                 : 'no step has room for a decoy — this shape will rarely carry one');
  if (sh.beats.some(b => b.dash))
    add('note', 'a dash beat falls back to walking time for a player with ' +
                'Sticky Feet, so it stays clearable without the dash');
  return out;
}

function renderCheck(){
  const sh = cur();
  if (!sh) return;
  const level = Math.max(1, Number($('fLevel').value) || sh.min);
  const st = steps(sh, level), late = steps(sh, 24);
  const pts = worldPts(sh);
  const noise = routeNoise(pts);
  const deck = S.shapes.map(x => ({ id:x.id, n: routeNoise(worldPts(x)) }))
                       .sort((a, b) => a.n - b.n);
  const worst = deck[deck.length - 1];
  const total = st.reduce((a, s) => a + s.t, 0);

  const rows = st.map((s, k) => `<tr>
    <td class="n">${s.i}&rarr;${s.i + 1}</td>
    <td class="n">${s.d.toFixed(2)}u</td>
    <td class="n">${s.t.toFixed(2)}s</td>
    <td class="n">${Math.round(s.need / s.speed * 100)}%</td>
    <td class="n">${late[k].t.toFixed(2)}s</td>
    <td>${s.dash ? '<span class="ok">dash</span>' : ''}</td></tr>`).join('');

  const f = findings(sh, level);
  const list = f.length ? '<ul class="notes">' + f.map(x =>
    `<li class="${x.kind === 'bad' ? 'bad' : x.kind === 'warn' ? 'warn' : ''}">${x.text}</li>`).join('') + '</ul>'
    : '<div class="ok">nothing to flag</div>';

  $('check').innerHTML = `
    <table>
      <tr><th class="n">step</th><th class="n">distance</th><th class="n">time at L${level}</th>
          <th class="n">of top speed</th><th class="n">at L24</th><th></th></tr>
      ${rows}
    </table>
    <div class="hint" style="margin-top:10px">
      ${st.length} steps · ${total.toFixed(1)}s of route ·
      readability <b>${noise.toFixed(1)}</b>
      (deck runs ${deck[0].n.toFixed(1)} to ${worst.n.toFixed(1)}, worst is ${worst.id}) ·
      priced at reach ${atLevel(level).reach.toFixed(2)}, speed ${atLevel(level).speed.toFixed(1)}u/s
    </div>
    ${list}
    <div class="hint">
      Every gap is computed from its distance, so a shape is clearable by
      construction — what this cannot tell you is whether it is clearable by a
      PERSON reading it. That proof is
      <b>node tools/shoot.js --fmt</b>, which walks every shape at its unlock
      level, at 24, and at 24 under Sticky Feet. Run it before you keep a shape.
    </div>`;
}

/* -------------------------------------------------------------- pointer --- */
const stage = $('stage');
let drag = -1;

function hit(sh, e){
  const m = mapper(stage), r = stage.getBoundingClientRect();
  const px = (e.clientX - r.left) * stage.width / r.width;
  const pz = (e.clientY - r.top) * stage.height / r.height;
  const pts = worldPts(sh);
  let best = -1, bd = 26;
  pts.forEach((p, i) => {
    const d = Math.hypot(m.px(p.x) - px, m.pz(p.z) - pz);
    if (d < bd){ bd = d; best = i; }
  });
  return { i: best, x: m.ux(px) / spanX(sh), z: m.uz(pz) / spanZ(sh) };
}

const snap = (v, free) => Math.max(-1, Math.min(1, free ? Math.round(v * 100) / 100
                                                        : Math.round(v * 20) / 20));

stage.addEventListener('pointerdown', e => {
  const sh = cur(); if (!sh) return;
  const h = hit(sh, e);
  if (h.i >= 0){ S.beat = h.i; drag = h.i; stage.setPointerCapture(e.pointerId); }
  else { sh.beats.push({ x:snap(h.x, e.shiftKey), z:snap(h.z, e.shiftKey) }); S.beat = sh.beats.length - 1; }
  touch();
});
stage.addEventListener('pointermove', e => {
  if (drag < 0) return;
  const sh = cur(), h = hit(sh, e);
  sh.beats[drag].x = snap(h.x, e.shiftKey);
  sh.beats[drag].z = snap(h.z, e.shiftKey);
  touch();
});
const drop = () => { drag = -1; };
stage.addEventListener('pointerup', drop);
stage.addEventListener('pointercancel', drop);

addEventListener('keydown', e => {
  const sh = cur();
  if (!sh || S.beat < 0 || /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
  const b = sh.beats[S.beat];
  if (e.key === 'd' || e.key === 'D'){ if (b.dash) delete b.dash; else b.dash = true; }
  else if (e.key === 'Backspace' || e.key === 'Delete'){
    if (sh.beats.length <= 2) return toast('a shape needs at least two beats');
    sh.beats.splice(S.beat, 1); S.beat = Math.min(S.beat, sh.beats.length - 1);
  }
  else if (e.key === 'i' || e.key === 'I'){
    const n = sh.beats[S.beat + 1] || b;
    sh.beats.splice(S.beat + 1, 0, { x:(b.x + n.x) / 2, z:(b.z + n.z) / 2 });
    S.beat++;
  }
  else return;
  e.preventDefault();
  touch();
});

/* --------------------------------------------------------------- fields --- */
const bind = (id, fn) => $(id).addEventListener('input', () => { const sh = cur(); if (sh){ fn(sh, $(id).value); touch(); } });
bind('fId', (sh, v) => sh.id = v.trim());
bind('fMin', (sh, v) => sh.min = Math.max(1, Math.round(Number(v) || 1)));
bind('fWeight', (sh, v) => sh.weight = Math.max(1, Math.min(6, Math.round(Number(v) || 1))));
bind('fSpan', (sh, v) => sh.span = Math.max(0.06, Math.min(1, Number(v) || 1)));
/* Held as a plain number here and dropped on the way out when it matches the
   default — see save(). The deck reads better with one field per shape that
   has an opinion about depth than with `depth:0.62` on all nineteen. */
bind('fDepth', (sh, v) => sh.depth = Math.max(0.06, Math.min(1, Number(v) || FMT_DEPTH)));
bind('fNote', (sh, v) => sh.note = v);
$('fLevel').addEventListener('input', () => { $('fLevel').dataset.touched = '1'; renderCheck(); });

/* ------------------------------------------------------------ the file --- */
let toastT = null;
function toast(msg, bad){
  const el = $('toast');
  el.textContent = msg;
  el.style.borderColor = bad ? 'var(--melon)' : 'var(--line)';
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), bad ? 9000 : 3000);
}

async function load(){
  const r = await fetch('/api/shapes');
  const j = await r.json();
  if (j.error) return toast(j.error, true);
  S.shapes = j.shapes; S.dirty = false;
  if (S.sel >= S.shapes.length) S.sel = S.shapes.length - 1;
  select(Math.max(0, S.sel));
}

/* One PUT writes the whole library, and the reply is what is now on disk — so
   the page can never drift from the file it is editing. */
async function save(){
  if (S.busy) return false;
  const ids = S.shapes.map(s => s.id);
  const dupe = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupe){ toast(`two shapes are called "${dupe}" — ids are how the game names them`, true); return false; }
  S.busy = true;
  try {
    const r = await fetch('/api/shapes', { method:'PUT',
      headers:{ 'content-type':'application/json' },
      body: JSON.stringify({ shapes: S.shapes.map(s =>
        Math.abs((s.depth || FMT_DEPTH) - FMT_DEPTH) < 1e-9
          ? Object.assign({}, s, { depth: undefined }) : s) }) });
    const j = await r.json();
    if (!r.ok){ toast('NOT saved:\n' + j.error, true); return false; }
    S.shapes = j.shapes; S.dirty = false;
    for (const s of S.shapes) delete s._new;
    renderAll();
    toast(`written to js/shapes.js — ${S.shapes.length} shapes.\nreload the game to play them`);
    return true;
  } catch (e){ toast('NOT saved: ' + e.message, true); return false; }
  finally { S.busy = false; }
}

async function del(i){
  const sh = S.shapes[i];
  if (!confirm(`Delete "${sh.id}" from js/shapes.js?\n\n` +
               `The file is the game's only copy — git is the undo.`)) return;
  S.shapes.splice(i, 1);
  if (S.sel >= S.shapes.length) S.sel = S.shapes.length - 1;
  if (!await save()) { S.dirty = true; renderAll(); }
}

function uniqueId(base){
  let id = base, n = 2;
  while (S.shapes.some(s => s.id === id)) id = base + (n++);
  return id;
}

function copy(i){
  const sh = S.shapes[i];
  const clone = JSON.parse(JSON.stringify(sh));
  clone.id = uniqueId(sh.id.replace(/[0-9]+$/, ''));
  clone._new = true;
  S.shapes.splice(i + 1, 0, clone);
  S.dirty = true;
  select(i + 1);
}

async function test(i){
  if (S.dirty && !await save()) return;
  window.open('/index.html?dev=1&shape=' + encodeURIComponent(S.shapes[i].id), '_blank');
}

$('btnNew').addEventListener('click', () => {
  S.shapes.push({ id: uniqueId('shape'), min:1, span:0.9, weight:2, note:'',
                  _new: true,
                  beats:[ {x:-1,z:0.5}, {x:0,z:-0.5}, {x:1,z:0.5} ] });
  S.dirty = true;
  select(S.shapes.length - 1);
});
$('btnSave').addEventListener('click', save);
$('btnTest').addEventListener('click', () => test(S.sel));
$('btnReload').addEventListener('click', () => {
  if (S.dirty && !confirm('Throw away the unsaved changes and re-read js/shapes.js?')) return;
  load();
});
$('btnGame').addEventListener('click', () => window.open('/index.html?dev=1', '_blank'));
addEventListener('beforeunload', e => { if (S.dirty){ e.preventDefault(); e.returnValue = ''; } });

load();
