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
        over:false, sweep:false },
  run: { phantom:false, sticky:false, puzzler:false },   // one-per-run perks
  taken: {},          // upgrade id -> times taken
  pendingLevel: null, // level+theme waiting to start once a draft is picked
};

const BASE_FOV = 52;

function resetUpgrades(){
  game.up = { reach:0, dashCD:1, shock:0, speed:1, melon:1, life:0, heartRate:0,
              over:false, sweep:false };
  game.run = { phantom:false, sticky:false, puzzler:false };
  game.taken = {};
  game.pendingLevel = null;
  game.maxLives = START_LIVES;
}

const catchReach = () => CATCH_R + game.up.reach;

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

try {
  game.unlocked = JSON.parse(localStorage.getItem('capyHats') || '{}') || {};
} catch(e){ game.unlocked = {}; }

function hatUnlocked(h){
  return h.score === 0 || game.unlocked[h.id] || game.best >= h.score;
}
function checkHatUnlocks(){
  for (const h of HATS){
    if (h.score > 0 && !game.unlocked[h.id] && game.score >= h.score){
      game.unlocked[h.id] = true;
      try { localStorage.setItem('capyHats', JSON.stringify(game.unlocked)); } catch(e){}
      showBanner('🎩 HAT UNLOCKED — ' + h.name.toUpperCase(), '#ffd77a');
      Audio.levelUp();
    }
  }
}

try { game.best = parseInt(localStorage.getItem('capybaraSnackRushBest') || '0', 10) || 0; }
catch(e){ game.best = 0; }

function difficultyFrom(score, elapsed){
  const lvl = 1 + Math.floor(score / 220) + Math.floor(elapsed / 34);
  return lvl;
}
function applyDifficulty(){
  const L = game.level;
  game.fallSpeed  = Math.min(FALL_CAP, 5.8 + L * 0.52);
  // What actually ramps now: formations arrive closer together and strays
  // fill the gaps more often. Their internal difficulty — how much slack
  // each step leaves — lives in fmtReach() over in formations.js.
  // Routes are the pacing. Early levels get a real breather between them —
  // one shape, cleared, then a beat to notice you did it — and late levels
  // get barely a pause, so they run almost back to back. Only one route is
  // ever live at a time (see formations.js), so this gap is measured from the
  // last beat of one landing to the first of the next.
  game.fmtGap     = Math.max(0.45, 4.2 - L * 0.16);
  // Strays are seasoning, not the meal — enough that the sky is not a
  // metronome, not so much that the routes get lost in noise. Measured over a
  // simulated minute this holds them to roughly a quarter of everything that
  // falls; at 4.6 - L*0.15 they were half of it.
  game.strayEvery = Math.max(2.6, 6.0 - L * 0.16);
  game.comboMax   = Math.max(2.9, 4.8 - L * 0.07);
  Audio.setMusicLevel(L);
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

