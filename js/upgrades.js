/* =======================================================================
   UPGRADE DRAFT — every 10 levels the run pauses and you pick a perk
   ======================================================================= */
const shuffled = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* Offer a draft for `level`, the level that's about to start. The game
   pauses right here on the OLD level/theme; game.level itself doesn't
   move and the new theme doesn't apply until a pick is made (see
   takeUpgrade), so the pause lines up with the moment the new level
   actually begins instead of firing a beat early. */
function offerUpgrades(level){
  const pool = UPGRADES.filter(u => (game.taken[u.id] || 0) < u.max);
  /* Half of all drafts put ONE run perk on the table, in the third slot,
     against two ordinary perks. Half, not always: a run perk reshapes the run,
     and a guaranteed one every draft would make the ordinary perks the
     sideshow.

     ONE PER RUN IS A BUDGET FOR THE WHOLE RUN, not one of each: taking any run
     perk closes the gold slot for good. Filtering only the perk that was taken
     let a run stack all three, and they are balanced as a single trade — a
     Phantombara who is also immune to everything and banking a life per route
     has paid one life for the lot. */
  const runPool = hasRunPerk() ? [] : RUN_PERKS.slice();
  const gold = runPool.length && Math.random() < 0.5
             ? shuffled(runPool)[0] : null;
  if (!pool.length && !gold) return false;

  const picks = shuffled(pool);
  picks.length = Math.min(gold ? 2 : 3, picks.length);
  if (gold) picks.push(gold);

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
    b.className = 'upcard' + (u.gold ? ' gold' : '');
    b.innerHTML = `<i>${u.icon}</i><span style="flex:1"><b>${u.name}</b><span>${u.desc}</span>` +
                  (u.gold ? `<u>ONE PER RUN</u>`
                          : have ? `<u>OWNED ${have}/${u.max}</u>` : '') + `</span>`;
    b.addEventListener('click', () => takeUpgrade(u));
    box.appendChild(b);
  }
  showPanel($('upgradePanel'));
  return true;
}

function takeUpgrade(u){
  u.apply(u.gold ? game.run : game.up);
  game.taken[u.id] = (game.taken[u.id] || 0) + 1;

  /* Side effects that are not just a field on game.up. Everything else in the
     draft is read live by the system that cares; these three change state that
     already exists. */
  if (u.id === 'life'){
    // +1 max and ONE heart back, not a full refill: a free top-up from one life
    // to four was worth more than the rest of the draft put together, and it
    // arrived precisely when a run was in trouble.
    game.maxLives = Math.min(LIVES_MAX, game.maxLives + 1);
    game.lives = Math.min(game.maxLives, game.lives + 1);
    renderLives(game.lives - 1);
  }
  if (u.id === 'phantom'){
    // the ghost is paid for up front, out of the life bar
    game.maxLives = Math.max(1, game.maxLives - 1);
    game.lives = Math.min(game.lives, game.maxLives);
    renderLives();
  }
  if (u.id === 'sticky'){
    // game.up.speed is the one place movement is scaled, and formations.js
    // times its gaps against it — so halving it here keeps every route
    // walkable at the new speed instead of quietly making them unclearable
    game.up.speed = 0.5;
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

  applyDifficulty();
  Audio.powerUp();
  showPanel(null);
  Audio.duck(0.55);
  game.state = 'playing';
  clock.getDelta();                     // swallow the paused time
  showBanner(u.icon + ' ' + u.name.toUpperCase(), '#ffd77a');
  refreshHUD();
}

