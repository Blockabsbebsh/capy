/* =======================================================================
   ROUTE EDITOR — the page

   Draws every route in the library, prices each step with the GAME's own
   arithmetic, and writes js/routes.js back through tools/routes.js.

   WHAT IS DRAWN IS WHAT LANDS. A route is emitted exactly as authored — the
   game rotates it and scales it to the arena radius, and that is the whole
   transform — so unlike the shape editor this replaced, the picture here is
   the contract rather than an approximation of one. The only thing the game
   adds is the angle, which is what the ROTATE slider is for.

   THE ARENA IS A CIRCLE AND SO IS THIS. Routes are authored in a unit disc.
   Rotation on a disc is exact, so a beat drawn inside it is inside the arena
   at every angle — which is why the editor can promise that a route never
   needs clamping, squashing or redrawing to fit.

   WHAT COMES FROM THE GAME, AND WHAT DOES NOT. stepTime, fmtReach, fmtSpeed,
   beside and REVEAL_AHEAD are the director's own — a checker that drifts from
   the game is worse than none, because it is believed. The readability
   findings (crossings, reversals, beats too close to tell apart) are the
   editor's own now and deliberately so: the game used to score routes at emit
   time and pick the cleanest of fourteen, and there is no such search any
   more. Those are authoring advice, and a warning is a reading rather than a
   rule — only the structural errors block a save.

   It cannot prove a route is WALKABLE and does not claim to. Gaps come out of
   stepTime, so a route is clearable by construction; whether a person can read
   and walk it is what `node tools/shoot.js --fmt` answers.
   ======================================================================= */
'use strict';

const S = { routes: [], sel: -1, beat: -1, dirty: false, busy: false, rot: 0, game: false };
const $ = id => document.getElementById(id);

/* Disc space is -1..1 with x^2 + z^2 <= 1; the arena radius scales it at emit
   time. Both numbers below are the game's, not a copy. */
const world = (b, rot = 0) => {
  const c = Math.cos(rot), s = Math.sin(rot);
  const x = b.x * ARENA.r, z = b.z * ARENA.r;
  return { x: x * c - z * s, z: x * s + z * c, dash: !!b.dash };
};
const worldPts = (rt, rot = 0) => rt.beats.map(b => world(b, rot));

/* How much shallower the arena looks than it is, because the camera looks down
   the field at an angle. Measured off the running game at a desktop aspect;
   it is only used for the GAME VIEW toggle, which is a sanity check on how a
   route reads rather than anything the data depends on. */
const GAME_SQUASH = 1.92;

/* ------------------------------------------------------------ drawing --- */
const PAD = 18;
function mapper(cv, squash){
  const w = cv.width, h = cv.height;
  const k = squash ? GAME_SQUASH : 1;
  // fit the disc: full radius across, radius/squash down
  const s = Math.min((w - PAD * 2) / (ARENA.r * 2), (h - PAD * 2) / (ARENA.r * 2 / k));
  const cx = w / 2, cy = h / 2;
  return {
    px: x => cx + x * s,
    pz: z => cy + z * s / k,
    ux: p => (p - cx) / s,
    uz: p => (p - cy) * k / s,
    r: d => d * s,
    rz: d => d * s / k,
    s, k,
  };
}

function drawRoute(cv, rt, opts = {}){
  const g = cv.getContext('2d');
  const big = !!opts.big;
  const squash = big && S.game;
  const m = mapper(cv, squash);
  const rot = big ? S.rot : 0;
  const pts = worldPts(rt, rot);
  g.clearRect(0, 0, cv.width, cv.height);

  // the field, and the rim a route may reach
  g.save();
  g.translate(m.px(0), m.pz(0));
  g.scale(1, 1 / m.k);
  g.fillStyle = '#241a12';
  g.beginPath(); g.arc(0, 0, m.r(PATCH_R), 0, 7); g.fill();
  g.fillStyle = '#2c2016';
  g.beginPath(); g.arc(0, 0, m.r(ARENA.r), 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,205,140,.35)'; g.lineWidth = 1;
  g.beginPath(); g.arc(0, 0, m.r(ARENA.r), 0, 7); g.stroke();
  if (big){
    g.setLineDash([4, 5]); g.strokeStyle = 'rgba(255,205,140,.16)';
    for (const f of [0.25, 0.5, 0.75]){
      g.beginPath(); g.arc(0, 0, m.r(ARENA.r * f), 0, 7); g.stroke();
    }
    g.beginPath();
    g.moveTo(-m.r(ARENA.r), 0); g.lineTo(m.r(ARENA.r), 0);
    g.moveTo(0, -m.r(ARENA.r)); g.lineTo(0, m.r(ARENA.r));
    g.stroke(); g.setLineDash([]);
  }
  g.restore();

  /* The ribbon, tapered the way the game tapers it: first step widest and
     brightest. Where a route doubles back over itself this ordering is the
     only thing in the picture that says which line you walk first. */
  for (let i = 1; i < pts.length; i++){
    const u = (i - 1) / Math.max(1, pts.length - 1);
    g.strokeStyle = `rgba(255,215,122,${0.85 - 0.55 * u})`;
    g.lineWidth = (big ? 12 : 4) * (1 - 0.35 * u);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(m.px(pts[i-1].x), m.pz(pts[i-1].z));
    g.lineTo(m.px(pts[i].x), m.pz(pts[i].z));
    g.stroke();
  }

  pts.forEach((p, i) => {
    const u = i / Math.max(1, pts.length - 1);
    if (big){                                    // where the capybara can catch
      g.save(); g.translate(m.px(p.x), m.pz(p.z)); g.scale(1, 1 / m.k);
      g.strokeStyle = 'rgba(159,224,122,.14)'; g.lineWidth = 1;
      g.beginPath(); g.arc(0, 0, m.r(CATCH_R), 0, 7); g.stroke();
      g.restore();
    }
    g.fillStyle = `rgba(255,225,168,${0.95 - 0.4 * u})`;
    g.beginPath(); g.arc(m.px(p.x), m.pz(p.z), big ? 14 : 4, 0, 7); g.fill();
    if (p.dash){                                 // a step priced against a dash
      g.strokeStyle = '#9fe07a'; g.lineWidth = big ? 3 : 2;
      g.beginPath(); g.arc(m.px(p.x), m.pz(p.z), big ? 20 : 7, 0, 7); g.stroke();
    }
    if (big){
      if (i === opts.sel){
        g.strokeStyle = '#fff'; g.lineWidth = 2;
        g.beginPath(); g.arc(m.px(p.x), m.pz(p.z), 23, 0, 7); g.stroke();
      }
      g.fillStyle = '#2b1d16'; g.font = 'bold 14px ui-monospace, monospace';
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
  S.routes.forEach((rt, i) => {
    const card = document.createElement('div');
    card.className = 'card' + (i === S.sel ? ' sel' : '');
    card.innerHTML =
      `<canvas width="132" height="132"></canvas>` +
      `<div><div class="name">${rt.id}${rt._new ? ' <span class="dirty">new</span>' : ''}</div>` +
      `<div class="meta">level ${rt.min}+ · weight ${rt.weight} · ` +
      `${rt.beats.length} beats${rt.beats.some(b => b.dash) ? ' · dash' : ''}</div>` +
      `<div class="row">` +
      `<button data-a="edit">EDIT</button>` +
      `<button class="ghost" data-a="test">TEST</button>` +
      `<button class="ghost" data-a="copy">COPY</button>` +
      `<button class="danger" data-a="del">DELETE</button></div></div>`;
    drawRoute(card.querySelector('canvas'), rt);
    card.addEventListener('click', e => {
      const a = e.target.dataset && e.target.dataset.a;
      if (a === 'del') return del(i);
      if (a === 'copy') return copy(i);
      if (a === 'test') return test(i);
      select(i);
    });
    box.appendChild(card);
  });
  $('fileLine').textContent = `js/routes.js — ${S.routes.length} routes` +
                              (S.dirty ? ' — UNSAVED' : '');
  $('fileLine').className = 'sub' + (S.dirty ? ' dirty' : '');
}

/* -------------------------------------------------------------- editor --- */
function select(i){
  S.sel = i; S.beat = -1;
  const rt = S.routes[i];
  if (rt){
    $('fId').value = rt.id; $('fMin').value = rt.min;
    $('fWeight').value = rt.weight;
    $('fNote').value = rt.note || '';
    if (!$('fLevel').dataset.touched) $('fLevel').value = rt.min;
  }
  renderAll();
}

function cur(){ return S.routes[S.sel] || null; }
function touch(){ S.dirty = true; renderAll(); }

function renderAll(){
  const rt = cur();
  $('editor').style.display = rt ? '' : 'none';
  if (rt) drawRoute($('stage'), rt, { big:true, sel:S.beat, hazards:hazardSpots(rt) });
  renderLibrary();
  if (rt) renderCheck();
}

/* Every step, priced by the game's own stepTime at a given level. */
function steps(rt, level){
  const keep = game.level;
  game.level = level;
  const speed = fmtSpeed(), reach = fmtReach();
  const pts = worldPts(rt);
  const out = [];
  for (let i = 1; i < pts.length; i++){
    const d = Math.hypot(pts[i].x - pts[i-1].x, pts[i].z - pts[i-1].z);
    const t = stepTime(d, speed, reach, pts[i].dash);
    out.push({ i, d, t, dash: pts[i].dash, speed, need: d / Math.max(t, 1e-6) });
  }
  game.level = keep;
  return out;
}

/* Which steps could carry a decoy, using placeHazards' own `beside`. A route
   whose steps are all short or all boxed in never takes one — that is a real
   property of the route, not a fault. */
function hazardSpots(rt){
  const pts = worldPts(rt, S.rot), out = [];
  for (let i = 1; i < pts.length; i++){
    const h = beside(pts[i-1], pts[i], pts);
    if (h) out.push(h);
  }
  return out;
}

const BEAT_APART = 1.2;   // closer than this and two dots read as one

function findings(rt, level){
  const pts = worldPts(rt), out = [];
  const add = (kind, text) => out.push({ kind, text });

  if (rt.beats.length < 2) add('bad', 'a route needs at least two beats');
  rt.beats.forEach((b, i) => {
    const d = Math.hypot(b.x, b.z);
    if (d > 1.0001)
      add('bad', `beat ${i + 1} is outside the disc (${d.toFixed(2)}) — drag it back inside the rim`);
  });

  /* Crossings, weighted by the ribbon's own window: inside it they are what
     makes a route unreadable, outside it the first line is long gone by the
     time the second is drawn. */
  const near = [], far = [];
  for (let i = 1; i < pts.length; i++)
    for (let j = i + 2; j < pts.length; j++)
      if (segCross(pts[i-1], pts[i], pts[j-1], pts[j]))
        (j - i <= REVEAL_AHEAD ? near : far).push(`${i}x${j}`);
  if (near.length)
    add('warn', `steps ${near.join(', ')} cross while both are on screen — ` +
                'nothing in the picture says which line you walk first');
  if (far.length)
    add('note', `steps ${far.join(', ')} cross, but more than ${REVEAL_AHEAD} beats ` +
                'apart: the first line is off the ground before the second is drawn');

  /* Reversals, as one line rather than one per beat — a zig-zag route trips
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
        'a near-reversal walks over ground just used');

  const close = [];
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 2; j < pts.length; j++)
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) < BEAT_APART)
        close.push({ pair: `${i + 1}+${j + 1}`, seen: j - i <= REVEAL_AHEAD });
  if (close.length)
    add(close.some(c => c.seen) ? 'warn' : 'note',
        `beats ${close.map(c => c.pair).join(', ')} land under ${BEAT_APART}u apart — ` +
        'that close, two dots read as one');

  const st = steps(rt, level);
  const free = st.filter(s => s.t <= 0.35).length;
  if (free) add('note', `${free} step${free > 1 ? 's are' : ' is'} at the stepTime ` +
                        'floor — the route is a pause there, which is worth having');
  const hz = hazardSpots(rt).length;
  add('note', hz ? `${hz} of ${st.length} steps have room for a decoy beside them`
                 : 'no step has room for a decoy — this route will rarely carry one');
  if (rt.beats.some(b => b.dash))
    add('note', 'a dash beat falls back to walking time for a player with ' +
                'Sticky Feet, so it stays clearable without the dash');
  return out;
}

// segment intersection — the editor's own, since the game no longer scores routes
function segCross(a, b, c, d){
  const s = (p, q, r) => Math.sign((q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x));
  return s(a, b, c) * s(a, b, d) < 0 && s(c, d, a) * s(c, d, b) < 0;
}

function renderCheck(){
  const rt = cur();
  if (!rt) return;
  const level = Math.max(1, Number($('fLevel').value) || rt.min);
  const st = steps(rt, level), late = steps(rt, 24);
  const total = st.reduce((a, s) => a + s.t, 0);

  const rows = st.map((s, k) => `<tr>
    <td class="n">${s.i}&rarr;${s.i + 1}</td>
    <td class="n">${s.d.toFixed(2)}u</td>
    <td class="n">${s.t.toFixed(2)}s</td>
    <td class="n">${Math.round(s.need / s.speed * 100)}%</td>
    <td class="n">${late[k].t.toFixed(2)}s</td>
    <td>${s.dash ? '<span class="ok">dash</span>' : ''}</td></tr>`).join('');

  const f = findings(rt, level);
  const list = f.length ? '<ul class="notes">' + f.map(x =>
    `<li class="${x.kind === 'bad' ? 'bad' : x.kind === 'warn' ? 'warn' : ''}">${x.text}</li>`).join('') + '</ul>'
    : '<div class="ok">nothing to flag</div>';

  $('check').innerHTML = `
    <table>
      <tr><th class="n">step</th><th class="n">distance</th><th class="n">time at L${level}</th>
          <th class="n">of top speed</th><th class="n">at L24</th><th></th></tr>
      ${rows}
    </table>
    <div class="sub" style="margin-top:8px">${rt.beats.length} beats ·
      ${total.toFixed(1)}s of route at L${level} · unlocks at level ${rt.min}</div>
    ${list}`;
}

/* --------------------------------------------------------------- stage --- */
const stage = $('stage');
function stagePt(e){
  const r = stage.getBoundingClientRect();
  const m = mapper(stage, S.game);
  const px = (e.clientX - r.left) * (stage.width / r.width);
  const pz = (e.clientY - r.top) * (stage.height / r.height);
  return { px, pz, m };
}
/* Screen -> disc, undoing the preview rotation so a dragged beat lands where
   the pointer is however the stage is turned. Clamped INTO the disc rather
   than rejected: dragging past the rim parks the beat on it. */
function toDisc(px, pz, m){
  let x = m.ux(px) / ARENA.r, z = m.uz(pz) / ARENA.r;
  const c = Math.cos(-S.rot), s = Math.sin(-S.rot);
  const rx = x * c - z * s, rz = x * s + z * c;
  const d = Math.hypot(rx, rz);
  return d <= 1 ? { x: rx, z: rz } : { x: rx / d, z: rz / d };
}
function nearestBeat(rt, px, pz, m){
  const pts = worldPts(rt, S.rot);
  let best = -1, bd = 26;
  pts.forEach((p, i) => {
    const d = Math.hypot(m.px(p.x) - px, m.pz(p.z) - pz);
    if (d < bd){ bd = d; best = i; }
  });
  return best;
}
const snap = (v, on) => on ? Math.round(v * 20) / 20 : Math.round(v * 100) / 100;

let dragging = false;
stage.addEventListener('pointerdown', e => {
  const rt = cur(); if (!rt) return;
  e.preventDefault(); stage.setPointerCapture(e.pointerId);
  const { px, pz, m } = stagePt(e);
  const hit = nearestBeat(rt, px, pz, m);
  if (hit >= 0){ S.beat = hit; dragging = true; }
  else {
    const p = toDisc(px, pz, m);
    rt.beats.push({ x: snap(p.x, e.shiftKey), z: snap(p.z, e.shiftKey) });
    S.beat = rt.beats.length - 1; dragging = true;
    S.dirty = true;
  }
  renderAll();
});
stage.addEventListener('pointermove', e => {
  const rt = cur(); if (!rt || !dragging || S.beat < 0) return;
  const { px, pz, m } = stagePt(e);
  const p = toDisc(px, pz, m);
  rt.beats[S.beat].x = snap(p.x, e.shiftKey);
  rt.beats[S.beat].z = snap(p.z, e.shiftKey);
  S.dirty = true;
  renderAll();
});
['pointerup','pointercancel'].forEach(ev =>
  stage.addEventListener(ev, () => { dragging = false; }));

window.addEventListener('keydown', e => {
  const rt = cur();
  if (!rt || S.beat < 0 || /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
  if (e.key === 'Delete' || e.key === 'Backspace'){
    if (rt.beats.length <= 2) return toast('a route needs at least two beats');
    rt.beats.splice(S.beat, 1); S.beat = Math.min(S.beat, rt.beats.length - 1);
  }
  else if (e.key === 'd' || e.key === 'D') rt.beats[S.beat].dash = !rt.beats[S.beat].dash;
  else if (e.key === '['){ if (S.beat > 0){ const b = rt.beats.splice(S.beat,1)[0]; rt.beats.splice(--S.beat,0,b); } }
  else if (e.key === ']'){ if (S.beat < rt.beats.length-1){ const b = rt.beats.splice(S.beat,1)[0]; rt.beats.splice(++S.beat,0,b); } }
  else return;
  e.preventDefault();
  touch();
});

/* --------------------------------------------------------------- fields --- */
const bind = (id, fn) => $(id).addEventListener('input', () => { const rt = cur(); if (rt){ fn(rt, $(id).value); touch(); } });
bind('fId', (rt, v) => rt.id = v.trim());
bind('fMin', (rt, v) => rt.min = Math.max(1, Math.round(Number(v) || 1)));
bind('fWeight', (rt, v) => rt.weight = Math.max(1, Math.min(6, Math.round(Number(v) || 1))));
bind('fNote', (rt, v) => rt.note = v);
$('fLevel').addEventListener('input', () => { $('fLevel').dataset.touched = '1'; renderCheck(); });

/* ROTATE is a preview, never saved. The game rolls a fresh angle every time a
   route is emitted, so "how does this read turned 140 degrees" is a question
   the author has to be able to ask — it is the one thing about a route that is
   not in the data. */
$('fRot').addEventListener('input', () => {
  S.rot = Number($('fRot').value) * Math.PI / 180;
  $('rotLabel').textContent = Math.round(Number($('fRot').value)) + '°';
  renderAll();
});
$('btnSpin').addEventListener('click', () => {
  $('fRot').value = Math.floor(Math.random() * 360);
  $('fRot').dispatchEvent(new Event('input'));
});
$('btnGame').addEventListener('click', () => {
  S.game = !S.game;
  $('btnGame').classList.toggle('on', S.game);
  renderAll();
});

/* ------------------------------------------------------------ the file --- */
let toastT = null;
function toast(msg, bad){
  const el = $('toast');
  el.textContent = msg;
  el.style.borderColor = bad ? 'var(--melon)' : 'var(--line)';
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), bad ? 9000 : 2600);
}

async function load(){
  const r = await fetch('/api/routes');
  const j = await r.json();
  S.routes = j.routes; S.dirty = false;
  if (S.sel >= S.routes.length) S.sel = S.routes.length - 1;
  select(Math.max(0, S.sel));
}

/* One PUT writes the whole library, and the reply is what is now on disk — so
   the page can never drift from the file it is editing. */
async function save(){
  if (S.busy) return false;
  const ids = S.routes.map(r => r.id);
  const dupe = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupe){ toast(`two routes are called "${dupe}" — ids are how the game names them`, true); return false; }
  S.busy = true;
  try {
    const r = await fetch('/api/routes', { method:'PUT',
      headers:{ 'content-type':'application/json' },
      body: JSON.stringify({ routes: S.routes }) });
    const j = await r.json();
    if (!r.ok){ toast(j.error || 'NOT saved', true); return false; }
    S.routes = j.routes; S.dirty = false;
    S.routes.forEach(x => delete x._new);
    toast(`saved — ${S.routes.length} routes`);
    renderAll();
    return true;
  } catch (e){ toast(String(e.message), true); return false; }
  finally { S.busy = false; }
}

function del(i){
  if (S.routes.length <= 1) return toast('the library cannot be empty');
  if (!confirm(`delete "${S.routes[i].id}"?`)) return;
  S.routes.splice(i, 1);
  if (S.sel >= S.routes.length) S.sel = S.routes.length - 1;
  S.dirty = true;
  select(S.sel);
}
function copy(i){
  const rt = S.routes[i];
  const clone = JSON.parse(JSON.stringify(rt));
  let n = 2;
  while (S.routes.some(x => x.id === clone.id.replace(/\d+$/, '') + n)) n++;
  clone.id = clone.id.replace(/\d+$/, '') + n;
  clone._new = true;
  S.routes.splice(i + 1, 0, clone);
  S.dirty = true;
  select(i + 1);
}
async function test(i){
  if (S.dirty && !(await save())) return;
  window.open('/index.html?route=' + encodeURIComponent(S.routes[i].id), '_blank');
}

$('btnNew').addEventListener('click', () => {
  let n = 1;
  while (S.routes.some(x => x.id === 'route' + n)) n++;
  S.routes.push({ id:'route' + n, min:1, weight:2, note:'',
                  beats:[{x:-0.7,z:0},{x:0,z:0},{x:0.7,z:0}], _new:true });
  S.dirty = true;
  select(S.routes.length - 1);
});
$('btnSave').addEventListener('click', save);
$('btnReload').addEventListener('click', async () => {
  if (S.dirty && !confirm('discard unsaved changes and reload from disk?')) return;
  await load(); toast('reloaded from disk');
});
$('btnOpen').addEventListener('click', () => window.open('/index.html', '_blank'));
$('btnTest').addEventListener('click', () => test(S.sel));
window.addEventListener('beforeunload', e => { if (S.dirty){ e.preventDefault(); e.returnValue = ''; } });

load();
