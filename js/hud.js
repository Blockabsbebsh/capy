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
  hatPicker: $('hatPicker'), ctrlPicker: $('ctrlPicker'),
  testLevelPanel: $('testLevelPanel'), testLevelButtons: $('testLevelButtons'),
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

function refreshHUD(){
  ui.score.textContent = game.score;
  ui.best.textContent = 'Best ' + Math.max(game.best, game.score);
  ui.level.textContent = game.level;
  ui.themeName.textContent = themeFor(game.level).name;

  const m = multiplier();
  if (game.combo >= 2){
    ui.comboWrap.classList.add('on');
    ui.comboText.textContent = 'x' + m + '  ·  ' + game.combo + ' combo';
    // the bar is the decay timer now: keep eating before it empties
    const frac = THREE.MathUtils.clamp(game.comboTime / game.comboMax, 0, 1);
    ui.comboBar.style.width = (frac * 100) + '%';
    ui.comboBar.classList.toggle('urgent', frac < 0.34);
  } else {
    ui.comboWrap.classList.remove('on');
  }

  ui.btnDash.classList.toggle('cooling', capyState.dashCD > 0);

  if (game.power){
    const P = POWERS[game.power.type];
    ui.powerWrap.classList.add('on');
    ui.powerName.textContent = P.name;
    ui.powerName.style.color = P.color;
    ui.powerBar.style.background = P.color;
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

/* ---------------------------- control scheme ---------------------------
   Two pointer schemes, picked on the title screen and remembered. The buttons
   reuse the hat picker's look because they are the same kind of choice: a
   preference, set before the run, not a HUD control. */
const CTRL_MODES = [
  { id:'follow', name:'Follow', hint:TOUCH ? 'thumbstick' : 'walk to cursor' },
  { id:'offset', name:'Drag',   hint:'relative drag' },
];
function renderControlPicker(){
  const box = ui.ctrlPicker;
  if (!box) return;
  box.innerHTML = '';
  for (const m of CTRL_MODES){
    const b = document.createElement('button');
    b.className = 'hatbtn' + (CTRL === m.id ? ' sel' : '');
    b.innerHTML = m.name + '<i>' + m.hint + '</i>';
    b.addEventListener('click', () => {
      setControlScheme(m.id);
      // drop whatever the old scheme was holding, so switching mid-menu can't
      // leave a stale velocity target or a visible indicator behind
      capyState.stickX = capyState.stickZ = 0;
      capyState.dragX = capyState.dragZ = null;
      capyState.dragging = false;
      endOffsetDrag();
      renderControlPicker();
      Audio.jump();
    });
    box.appendChild(b);
  }
}

// floating score popups projected from world space
const _proj = new THREE.Vector3();
function popup(worldPos, text, color){
  _proj.copy(worldPos).project(camera);
  const el = document.createElement('div');
  el.className = 'popup';
  el.textContent = text;
  el.style.color = color;
  el.style.left = ((_proj.x * 0.5 + 0.5) * window.innerWidth) + 'px';
  el.style.top  = ((-_proj.y * 0.5 + 0.5) * window.innerHeight) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function showPanel(p){
  [ui.startPanel, ui.pausePanel, ui.overPanel, ui.upgradePanel].forEach(x => x.classList.add('hidden'));
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

function showBanner(text, color){
  const el = ui.banner;
  el.textContent = text;
  el.style.color = color;
  el.classList.remove('show');
  void el.offsetWidth;              // restart the CSS animation
  el.classList.add('show');
}

