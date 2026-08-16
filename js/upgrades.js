/* =======================================================================
   UPGRADE DRAFT — every 5 levels the run pauses and you pick a perk
   ======================================================================= */
/* Offer a draft for `level`, the level that's about to start. The game
   pauses right here on the OLD level/theme; game.level itself doesn't
   move and the new theme doesn't apply until a pick is made (see
   takeUpgrade), so the pause lines up with the moment the new level
   actually begins instead of firing a beat early. */
function offerUpgrades(level){
  const pool = UPGRADES.filter(u => (game.taken[u.id] || 0) < u.max);
  if (!pool.length) return false;

  // shuffle a copy and take up to three
  const picks = pool.slice();
  for (let i = picks.length - 1; i > 0; i--){
    const j = (Math.random() * (i + 1)) | 0;
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }
  picks.length = Math.min(3, picks.length);

  game.pendingLevel = level;
  game.state = 'upgrade';
  Audio.duck(0.28);                     // drop the music under the menu
  // name the level/theme the player is about to start, not the one
  // they're standing on
  $('upgradeTitle').textContent = 'Level ' + level;
  $('upgradeSub').textContent = themeFor(level).name + ' — pick a snack perk.';

  const box = $('upgradeCards');
  box.innerHTML = '';
  for (const u of picks){
    const have = game.taken[u.id] || 0;
    const b = document.createElement('button');
    b.className = 'upcard';
    b.innerHTML = `<i>${u.icon}</i><span style="flex:1"><b>${u.name}</b><span>${u.desc}</span>` +
                  (have ? `<u>OWNED ${have}/${u.max}</u>` : '') + `</span>`;
    b.addEventListener('click', () => takeUpgrade(u));
    box.appendChild(b);
  }
  showPanel($('upgradePanel'));
  return true;
}

function takeUpgrade(u){
  u.apply(game.up);
  game.taken[u.id] = (game.taken[u.id] || 0) + 1;

  if (u.id === 'life'){
    game.maxLives++;
    game.lives = game.maxLives;         // "refilled now"
    renderLives();
  }

  // the level this draft was for hasn't actually started yet — kick it
  // off now that a pick has been made, so the new theme/sky/music land
  // right as play resumes instead of a beat later
  const startingLevel = game.pendingLevel;
  game.pendingLevel = null;
  if (startingLevel){
    game.level = startingLevel;
    const th = themeFor(startingLevel);
    applyTheme(th, false);
    Audio.setMusicTheme(THEMES.indexOf(th));
    Audio.themeShift();
    if (!REDUCED){ flash('#ffffff', 0.3); game.fovKick = 3.2; }
    ui.levelBadge.classList.remove('bump');
    void ui.levelBadge.offsetWidth;
    ui.levelBadge.classList.add('bump');
  }

  applyDifficulty();                    // comboMax reads game.up.decay
  Audio.powerUp();
  showPanel(null);
  Audio.duck(0.55);
  game.state = 'playing';
  clock.getDelta();                     // swallow the paused time
  showBanner(u.icon + ' ' + u.name.toUpperCase(), '#ffd77a');
  refreshHUD();
}

