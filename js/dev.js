/* =======================================================================
   DEV LEVEL SWITCHER (testing aid — not part of normal play)
   Toggle with DEV_MODE below, or by adding ?dev=1 to the URL.
   ======================================================================= */
const DEV_MODE = /[?&]dev=1\b/.test(location.search);
const DEV_LEVELS = [
  { level:1,  label:'1 · Meadow' },
  { level:6,  label:'6 · Pond' },
  { level:11, label:'11 · Candy' },
  { level:16, label:'16 · Night' },
  { level:21, label:'21 · Hell' },
];
function jumpToLevel(n){
  if (game.state === 'menu') startGame();
  game.level = n;
  game.devLock = true;
  game.elapsed = 0;
  applyDifficulty();
  const th = themeFor(n);
  applyTheme(th, true);
  Audio.setMusicTheme(THEMES.indexOf(th));
  clearItems(); clearHoles();
  refreshHUD();
  [...ui.testLevelButtons.children].forEach(b =>
    b.classList.toggle('active', Number(b.dataset.level) === n));
}
if (DEV_MODE){
  ui.testLevelPanel.style.display = 'block';
  DEV_LEVELS.forEach(({level, label}) => {
    const b = document.createElement('button');
    b.className = 'testlevel-btn';
    b.textContent = label;
    b.dataset.level = level;
    b.addEventListener('click', () => jumpToLevel(level));
    ui.testLevelButtons.appendChild(b);
  });
}

