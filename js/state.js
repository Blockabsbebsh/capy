/* =======================================================================
   GAME STATE
   ======================================================================= */
const game = {
  state: 'menu',            // menu | playing | paused | over
  score: 0,
  best: 0,
  lives: START_LIVES,
  maxLives: START_LIVES,
  combo: 0,
  bestCombo: 0,
  level: 1,
  devLock: false,           // when true, the dev level switcher is holding the level fixed
  elapsed: 0,
  fallSpeed: 6.0,
  fmtGap: 2.6,        // seconds between formations
  strayEvery: 3.6,    // seconds between unscripted single items
  levelHold: 0,       // seconds until the next level-up is allowed
  shake: 0,
  hitFlash: 0,
  comboTime: 0,
  comboMax: 4.6,
  powerTimer: 14,
  heartTimer: 52,
  power: null,        // { type, t, dur }
  shield: false,
  timeScale: 1,
  fovKick: 0,
  unlocked: {},
  /* Drafted upgrades; every system reads these live. `speed` is no longer
     something an upgrade raises — Quick Paws moved to the dash — but it stays
     as the one place anything scales movement, because Sticky Feet halves it
     and formations.js has to time its gaps against whatever it says. */
  up: { reach:0, dashCD:1, shock:0, speed:1, melon:1, life:0, heartRate:0,
        autoShield:false, chain:false },
  run: { phantom:false, sticky:false, puzzler:false },   // one-per-run perks
  chain: 0,           // Chain Sweeper: consecutive route clears
  as: { t:0, cd:0 },  // Auto-Shield: seconds up, then seconds until it can fire
  taken: {},          // upgrade id -> times taken
  pendingLevel: null, // level+theme waiting to start once a draft is picked
};

const BASE_FOV = 52;

function resetUpgrades(){
  game.up = { reach:0, dashCD:1, shock:0, speed:1, melon:1, life:0, heartRate:0,
              autoShield:false, chain:false };
  game.run = { phantom:false, sticky:false, puzzler:false };
  game.chain = 0;
  game.as = { t:0, cd:0 };
  game.taken = {};
  game.pendingLevel = null;
  game.maxLives = START_LIVES;
}

/* Long Snout only reaches for FOOD. Applied to everything, the perk got worse
   the more you took: hazard density climbs with level and with every heart
   banked, so a wider circle eventually swept up more chillies than burgers.
   Every catch test passes what it is testing, so the drawn aura (which passes
   true) is the good-item radius it has always looked like. */
const catchReach = (good = true) => CATCH_R + (good ? game.up.reach : 0);

/* One run perk per run, total — see the gold slot in offerUpgrades. */
const hasRunPerk = () => RUN_PERKS.some(p => game.run[p.id]);

/* Every life the game hands out goes through here. Puzzler pays a life per
   cleared route, which can outrun maxLives — so gains raise the ceiling with
   them, up to a cap, rather than silently doing nothing at full health. */
function gainLife(raiseMax){
  if (raiseMax && game.maxLives < LIVES_MAX && game.lives >= game.maxLives) game.maxLives++;
  if (game.lives >= game.maxLives) return false;
  game.lives++;
  renderLives(game.lives - 1);
  return true;
}

try { game.unlocked = JSON.parse(store.get('capyHats', '{}')) || {}; }
catch(e){ game.unlocked = {}; }

function hatUnlocked(h){
  return h.score === 0 || game.unlocked[h.id] || game.best >= h.score;
}
function checkHatUnlocks(){
  for (const h of HATS){
    if (h.score > 0 && !game.unlocked[h.id] && game.score >= h.score){
      game.unlocked[h.id] = true;
      store.set('capyHats', JSON.stringify(game.unlocked));
      showBanner('HAT UNLOCKED — ' + h.name.toUpperCase(), '#ffd77a', 'hat');
      Audio.levelUp();
    }
  }
}

game.best = parseInt(store.get('capybaraSnackRushBest', '0'), 10) || 0;

function difficultyFrom(score, elapsed){
  const lvl = 1 + Math.floor(score / 220) + Math.floor(elapsed / 34);
  return lvl;
}
function applyDifficulty(){
  const L = game.level;
  game.fallSpeed  = Math.min(FALL_CAP, 5.8 + L * 0.52);
  // What ramps: formations arrive closer together and strays fill the gaps
  // more often. How much slack each step leaves lives in fmtReach().
  // Routes are the pacing — early levels get a real breather between them, late
  // ones almost none. Only one route is ever live at a time, so this gap is
  // measured from the last beat of one landing to the first of the next.
  game.fmtGap     = Math.max(0.45, 4.2 - L * 0.16);
  // Strays are seasoning, not the meal — enough that the sky is not a
  // metronome, not so much that the routes get lost in noise. Measured over a
  // simulated minute this holds them to roughly a quarter of everything that
  // falls; at 4.6 - L*0.15 they were half of it.
  game.strayEvery = Math.max(2.6, 6.0 - L * 0.16);
  game.comboMax   = Math.max(2.9, 4.8 - L * 0.07);
  Audio.setMusicLevel(L);
}

/* Arriving at a level: theme, music, badge bump, and the biome ceremony — but
   only for a biome that actually CHANGED. themeFor clamps at Hell, so every ten
   levels past it used to replay the whole arrival for a theme that had not
   moved. Both ways into a theme level (a draft closing, and no perks left to
   offer) come through here. Returns whether the biome is new. */
function enterLevel(level){
  const was = curTheme;
  game.level = level;
  const th = themeFor(level);
  applyTheme(th, false);
  Audio.setMusicTheme(THEMES.indexOf(th));
  bumpLevelBadge();
  if (th === was) return false;
  Audio.themeShift();
  if (!REDUCED){ flash('#ffffff', 0.3); game.fovKick = 3.2; }
  return true;
}

/* --- overtime -------------------------------------------------------------
   Every curve above bottoms out: fall speed by level 10, fmtReach by 16,
   strayEvery by 21, fmtGap by 23 — past which a good player farms a game that
   has stopped getting harder, and the last biome is the easiest part of a run.
   So one scalar keeps rising from where the curves stop, spent deliberately on
   DENSITY and never on speed: more hazards, less quiet, bigger set-pieces. Fall
   speed still caps at FALL_CAP and fmtReach at 0.78 — a route you cannot read
   is not difficulty. Uncapped on purpose, and slow enough that level 60 is hard
   rather than impossible. */
const OVERTIME_FROM = 24;
const overtime = () => Math.max(0, game.level - OVERTIME_FROM) / 10;

/* Hazard rate. Two multipliers, both of which the player chose: overtime, and
   how many hearts they are carrying — a fourth heart is +20%, a fifth another
   +20%, so banking lives with Second Wind or Puzzler buys risk with it. */
function hazardMul(){
  return (1 + 0.35 * overtime()) *
         (1 + HAZARD_PER_HEART * Math.max(0, game.lives - START_LIVES));
}

/* =======================================================================
   COMBO
   ======================================================================= */
function bumpCombo(){
  game.combo++;
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  game.comboTime = game.comboMax;
}
function breakCombo(silent){
  if (game.combo > 0 && !silent) Audio.comboBreak();
  game.combo = 0;
  game.comboTime = 0;
  dropStack();
}

