/* =======================================================================
   UI WIRING
   ======================================================================= */
const $ = id => document.getElementById(id);
const ui = {
  hud: $('hud'), score: $('score'), best: $('best'), lives: $('lives'),
  level: $('level'), comboWrap: $('comboWrap'), comboText: $('comboText'), comboBar: $('comboBar'),
  startPanel: $('startPanel'), pausePanel: $('pausePanel'), overPanel: $('overPanel'),
  upgradePanel: $('upgradePanel'), levelBadge: $('levelBadge'), themeName: $('themeName'),
  finalScore: $('finalScore'), finalBest: $('finalBest'), finalCombo: $('finalCombo'),
  newBest: $('newBest'), flash: $('flash'), overSub: $('overSub'), overTitle: $('overTitle'),
  btnMute: $('btnMute'), banner: $('banner'), btnDash: $('btnDash'),
  powerWrap: $('powerWrap'), powerName: $('powerName'), powerBar: $('powerBar'),
  hatPicker: $('hatPicker'), perkRail: $('perkRail'),
  testLevelPanel: $('testLevelPanel'), testLevelButtons: $('testLevelButtons'),
  scorePanel: $('scorePanel'), scoreList: $('scoreList'), scoreStatus: $('scoreStatus'),
  boardAll: $('boardAll'), boardBest: $('boardBest'), btnBoardClose: $('btnBoardClose'),
  btnBoard: $('btnBoard'), btnBoardOver: $('btnBoardOver'),
  tagRow: $('tagRow'), tagInput: $('tagInput'), tagNote: $('tagNote'), btnTagSubmit: $('btnTagSubmit'),
};

/* One glyph per life, up to LIVES_SHOWN — past that the row switches to a
   "5+n" tally. Puzzler pays a life per cleared route, so a good run can hold
   ten of them, and ten glyphs is wider than the chip they live in. */
function renderLives(animateIndex = -1){
  ui.lives.innerHTML = '';
  const shown = Math.min(game.maxLives, LIVES_SHOWN);
  for (let i = 0; i < shown; i++){
    const s = document.createElement('span');
    s.className = 'heart' + (i >= game.lives ? ' lost' : '') + (i === animateIndex ? ' pop' : '');
    s.textContent = '♥';
    ui.lives.appendChild(s);
  }
  if (game.lives > LIVES_SHOWN){
    const plus = document.createElement('span');
    plus.className = 'lifeplus';
    plus.textContent = '+' + (game.lives - LIVES_SHOWN);
    ui.lives.appendChild(plus);
  }
}
/* Uncapped, but the climb slows down: one step every 4 catches up to x6, then
   every 8. A 60-combo run should feel different from a 20-combo one. */
function multiplierFor(c){
  return c < 20 ? 1 + Math.floor(c / 4) : 6 + Math.floor((c - 20) / 8);
}
function multiplier(){ return multiplierFor(game.combo); }

/* Write only when the value actually changed. refreshHUD runs every frame, and
   an assignment to textContent is a DOM mutation whether or not the string is
   the same — the theme name and the level change a handful of times a RUN, and
   the power bar's icon markup was being reparsed sixty times a second. */
const setText = (el, v) => { if (el._v !== v){ el._v = v; el.textContent = v; } };
const setHTML = (el, v) => { if (el._v !== v){ el._v = v; el.innerHTML = v; } };
const setStyle = (el, k, v) => { const c = '_s' + k; if (el[c] !== v){ el[c] = v; el.style[k] = v; } };

function refreshHUD(){
  setText(ui.score, game.score);
  setText(ui.best, 'Best ' + Math.max(game.best, game.score));
  setText(ui.level, game.level);
  setText(ui.themeName, themeFor(game.level).name);

  const m = multiplier();
  if (game.combo >= 2){
    ui.comboWrap.classList.add('on');
    setText(ui.comboText, 'x' + m + '  ·  ' + game.combo + ' combo');
    // the bar is the decay timer now: keep eating before it empties
    const frac = THREE.MathUtils.clamp(game.comboTime / game.comboMax, 0, 1);
    ui.comboBar.style.width = (frac * 100) + '%';
    ui.comboBar.classList.toggle('urgent', frac < 0.34);
  } else {
    ui.comboWrap.classList.remove('on');
  }

  ui.btnDash.classList.toggle('cooling', capyState.dashCD > 0);
  // Sticky Feet takes the dash away entirely — the button says so rather than
  // sitting there looking pressable
  ui.btnDash.classList.toggle('gone', !!game.run.sticky);
  document.body.classList.toggle('no-dash', !!game.run.sticky);
  renderPerkRail();

  if (game.power){
    const P = POWERS[game.power.type];
    ui.powerWrap.classList.add('on');
    setHTML(ui.powerName, icon(P.icon, 19) + P.name);
    setStyle(ui.powerName, 'color', P.color);
    setStyle(ui.powerBar, 'background', P.color);
    ui.powerBar.style.width = (THREE.MathUtils.clamp(game.power.t / game.power.dur, 0, 1) * 100) + '%';
  } else {
    ui.powerWrap.classList.remove('on');
  }
}

/* ------------------------------ hat picker ----------------------------- */
function renderHatPicker(){
  const box = ui.hatPicker;
  box.innerHTML = '';
  for (const h of HATS){
    const b = document.createElement('button');
    const open = hatUnlocked(h);
    b.className = 'hatbtn' + (open ? '' : ' locked') + (currentHatDef.id === h.id ? ' sel' : '');
    b.innerHTML = open
      ? h.name
      : h.name + '<i>' + h.score + '</i>';
    if (open){
      b.addEventListener('click', () => { setHat(h.id); renderHatPicker(); Audio.jump(); });
    }
    box.appendChild(b);
  }
}

/* --------------------------- owned perk rail ---------------------------
   Every perk you hold, as a small tinted icon down the left edge: tier colour
   for the background (plain / silver / gold), a n/max badge on anything that
   stacks, and a countdown on Auto-Shield. Rebuilt only when the SET changes —
   this runs inside refreshHUD, i.e. every frame — while the Auto-Shield number
   is written in place, because that does change every frame. */
const PERK_ALL = UPGRADES.concat(RUN_PERKS);   // static; refreshHUD runs 60x a second
let railKey = '', railTimer = null;

function renderPerkRail(){
  const box = ui.perkRail;
  if (!box) return;
  const held = PERK_ALL.filter(u => (game.taken[u.id] || 0) > 0);
  const key = held.map(u => u.id + (game.taken[u.id] || 0)).join(',');
  if (key !== railKey){
    railKey = key;
    box.innerHTML = '';
    for (const u of held){
      const n = game.taken[u.id] || 0;
      const el = document.createElement('div');
      el.className = 'perk' + (u.tier ? ' ' + u.tier : '');
      el.innerHTML = `<i>${icon(u.icon, 21)}</i>` +
        (u.max > 1 ? `<b>${n}/${u.max}</b>` : '') +
        (u.id === 'autoShield' ? `<s></s>` : '');
      el.title = u.name;
      box.appendChild(el);
      if (u.id === 'autoShield') railTimer = el.querySelector('s');
    }
    if (!held.some(u => u.id === 'autoShield')) railTimer = null;
  }
  // Auto-Shield: blank when ready, seconds when it is coming back
  if (railTimer){
    const secs = Math.ceil(game.as.cd);
    setText(railTimer, game.as.t > 0 ? 'ON' : (secs > 0 ? String(secs) : ''));
    railTimer.className = game.as.t > 0 ? 'on' : '';
  }
}

// floating score popups projected from world space
const _proj = new THREE.Vector3();
/* `art` is an icon id, drawn ahead of the text — the emoji these replaced were
   a platform font's idea of a ghost or a puzzle piece, which is the same reason
   nothing else in the interface is one. Both of these take innerHTML, and every
   caller passes a string literal: anything player-written would have to be
   escaped first, which is what scores.js does for the board. */
function popup(worldPos, text, color, art){
  _proj.copy(worldPos).project(camera);
  const el = document.createElement('div');
  el.className = 'popup';
  if (art) el.innerHTML = icon(art, 22) + text;
  else el.textContent = text;
  el.style.color = color;
  el.style.left = ((_proj.x * 0.5 + 0.5) * window.innerWidth) + 'px';
  el.style.top  = ((-_proj.y * 0.5 + 0.5) * window.innerHeight) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function showPanel(p){
  [ui.startPanel, ui.pausePanel, ui.overPanel, ui.upgradePanel,
   ui.scorePanel].forEach(x => x.classList.add('hidden'));
  if (p) p.classList.remove('hidden');
}

function flash(color, strength){
  if (REDUCED) return;                 // full-screen colour pulses are the worst offender
  ui.flash.style.background = color;
  ui.flash.style.transition = 'none';
  ui.flash.style.opacity = strength;
  // next frame, fade out
  requestAnimationFrame(() => {
    ui.flash.style.transition = 'opacity .45s ease';
    ui.flash.style.opacity = 0;
  });
}

function showBanner(text, color, art){
  const el = ui.banner;
  if (art) el.innerHTML = icon(art, 34) + text;
  else el.textContent = text;
  el.style.color = color;
  el.classList.remove('show');
  void el.offsetWidth;              // restart the CSS animation
  el.classList.add('show');
}

