function loseLife(reason){
  game.lives--;
  // A grace window after every hit. There was none, so three chillis landing
  // in quick succession — which the targeted hazard spawn makes quite likely —
  // took all three lives before the first one had finished reading. Hazards
  // phase through while this runs (see the canHit test in updateItems).
  capyState.invuln = Math.max(capyState.invuln, HIT_INVULN);
  Audio.life();
  game.shake = 0.42;
  flash('#ff2d40', 0.55);
  renderLives(game.lives);
  if (game.lives <= 0) endGame(reason);
}

/* =======================================================================
   GAME FLOW
   ======================================================================= */
function startGame(){
  Audio.resume();
  Audio.start();
  game.state = 'playing';
  resetUpgrades();
  game.score = 0; game.lives = game.maxLives; game.combo = 0; game.bestCombo = 0;
  game.level = 1; game.elapsed = 0; game.shake = 0;
  game.devLock = false;
  game.comboTime = 0; game.powerTimer = 14; game.heartTimer = 52; game.power = null;
  game.shield = false; game.timeScale = 1; game.fovKick = 0;
  shieldBubble.visible = false;
  applyTheme(THEMES[0], true);
  Audio.setMusicTheme(0);
  Audio.duck(0.55);
  applyDifficulty();
  clearItems();
  clearHoles();
  clearStack();
  clearPerkFX();
  resetEvents();
  resetFormations();
  resetCapy();
  renderLives();
  refreshHUD();
  ui.hud.classList.add('on');
  showPanel(null);
  Audio.startMusic();
}
function pauseGame(){
  if (game.state !== 'playing') return;
  game.state = 'paused';
  Audio.stopMusic();
  showPanel(ui.pausePanel);
}
function resumeGame(){
  if (game.state !== 'paused') return;
  Audio.resume();
  Audio.startMusic();
  game.state = 'playing';
  showPanel(null);
}
function toMenu(){
  game.state = 'menu';
  Audio.stopMusic();
  Audio.setMusicTheme(0);
  Audio.duck(0.55);
  game.level = 1;
  game.devLock = false;
  applyTheme(THEMES[0], true);
  clearItems();
  clearHoles();
  clearStack();
  clearPerkFX();
  resetEvents();
  resetFormations();
  resetCapy();
  game.power = null; game.shield = false; game.timeScale = 1;
  shieldBubble.visible = false;
  renderHatPicker();
  ui.hud.classList.remove('on');
  showPanel(ui.startPanel);
}
function endGame(reason){
  game.state = 'over';
  Audio.stopMusic();
  Audio.over();
  clearPerkFX();          // the aura and any live ghosts are gameplay, not scenery
  checkHatUnlocks();
  const isBest = game.score > game.best;
  if (isBest){
    game.best = game.score;
    try { localStorage.setItem('capybaraSnackRushBest', String(game.best)); } catch(e){}
  }
  ui.finalScore.textContent = game.score;
  ui.finalBest.textContent = game.best;
  ui.finalCombo.textContent = game.bestCombo;
  ui.newBest.style.display = isBest && game.score > 0 ? 'block' : 'none';
  ui.overTitle.textContent = isBest && game.score > 0 ? 'Snack Legend' : 'Nap Time';
  ui.overSub.textContent =
    reason === 'spicy' ? 'Too many chili peppers. The capybara needs a soak.' :
    reason === 'hole'  ? 'Swallowed by a sinkhole. Look before you snack.' :
    reason === 'route' ? 'One route too many left on the floor.' :
                         'The capybara is out of snack stamina.';
  showPanel(ui.overPanel);
  ui.hud.classList.remove('on');
}

function toggleMute(){
  const m = Audio.toggleMute();
  ui.btnMute.innerHTML = m ? '&#128263;' : '&#128266;';
  ui.btnMute.style.opacity = m ? 0.55 : 1;
}

$('btnStart').addEventListener('click', () => { Audio.init(); startGame(); });
$('btnRetry').addEventListener('click', startGame);
$('btnMenu').addEventListener('click', toMenu);
$('btnResume').addEventListener('click', resumeGame);
$('btnQuit').addEventListener('click', toMenu);
$('btnPause').addEventListener('click', () => game.state === 'playing' ? pauseGame() : resumeGame());
$('btnDash').addEventListener('pointerdown', e => { e.preventDefault(); tryDash(); });
ui.btnMute.addEventListener('click', () => { Audio.init(); toggleMute(); });

