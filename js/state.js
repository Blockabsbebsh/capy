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
  spawnTimer: 0,
  spawnInterval: 1.05,
  fallSpeed: 6.0,
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
  // drafted upgrades; every system reads these live
  up: { reach:0, decay:0, powerMul:1, speed:1, melon:1, life:0, heartRate:0 },
  taken: {},          // upgrade id -> times taken
  pendingLevel: null, // level+theme waiting to start once a draft is picked
};

const BASE_FOV = 52;

function resetUpgrades(){
  game.up = { reach:0, decay:0, powerMul:1, speed:1, melon:1, life:0, heartRate:0 };
  game.taken = {};
  game.pendingLevel = null;
  game.maxLives = START_LIVES;
}

const catchReach = () => CATCH_R + game.up.reach;

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
  game.spawnInterval = Math.max(0.34, 1.08 - L * 0.045);
  game.fallSpeed     = Math.min(15.5, 5.8 + L * 0.52);
  game.comboMax      = Math.max(2.9, 4.8 - L * 0.07) + game.up.decay;
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

