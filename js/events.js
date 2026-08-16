/* =======================================================================
   EVENT DIRECTOR — periodic set-piece challenges
   ======================================================================= */
const evt = { active:null, last:null, t:0, dur:0, timer:20, queue:[] };

function resetEvents(){
  evt.active = null; evt.last = null; evt.t = 0; evt.dur = 0; evt.queue.length = 0;
  evt.timer = 20;
}

/* power-ups arrive on their own timer, never during a missile volley */
function updatePowerSpawns(dt){
  if (game.power || evt.active === 'missiles' || evt.active === 'feast') return;
  game.powerTimer -= dt;
  if (game.powerTimer <= 0){
    const kinds = ['magnet', 'shield', 'slowmo'];
    spawnItem(kinds[(Math.random() * kinds.length) | 0]);
    game.powerTimer = 17 + Math.random() * 11;
  }
}

/* Hearts are the rescue drop: only when you're actually down a life, never
   more than one in play, and never in the middle of a missile volley or a
   watermelon feast (the feast is watermelons only, nothing else falls). */
function updateHeartSpawns(dt){
  if (game.lives >= game.maxLives || evt.active === 'missiles' || evt.active === 'feast') return;
  if (items.some(i => i.def.heal)) return;
  game.heartTimer -= dt * (1 + game.up.heartRate);
  if (game.heartTimer <= 0){
    spawnItem('heart');
    showBanner('💖 HEART FALLING', '#ff8fae');
    game.heartTimer = 46 + Math.random() * 26;
  }
}

function triggerEvent(){
  const pool = ['missiles', 'feast'];
  if (game.level >= 3) pool.push('sinkholes');
  if (game.level >= 5) pool.push('feast');
  if (game.level >= 6) pool.push('missiles', 'sinkholes');
  // never run the same set-piece twice in a row
  let kind = pool[(Math.random() * pool.length) | 0];
  if (kind === evt.last && pool.length > 1){
    kind = pool[(Math.random() * pool.length) | 0];
  }
  evt.last = kind;

  evt.active = kind; evt.t = 0; evt.queue.length = 0;

  if (kind === 'feast'){
    // a pure reward beat: nothing but watermelons, raining down
    showBanner('🍉 WATERMELON FEAST!', '#ffe14d');
    Audio.feast();
    game.fovKick = 2.4;
    const n = 16 + game.level;
    for (let i = 0; i < n; i++){
      evt.queue.push({ at: 0.5 + i * 0.19, fn: () =>
        spawnItem('watermelon', { targeted:false }) });
    }
    evt.dur = 0.5 + n * 0.19 + 2.2;
    return;
  }

  Audio.alarm();

  if (kind === 'missiles'){
    const n = Math.min(7, 3 + Math.floor(game.level / 3));
    showBanner('⚠ CHILI MISSILES — DODGE!', '#ff7a5a');
    for (let i = 0; i < n; i++){
      evt.queue.push({ at: 1.1 + i * 0.52, fn: () => spawnItem('chili', { missile:true }) });
    }
    evt.dur = 1.1 + n * 0.52 + 2.4;
  } else {
    const n = 2 + Math.floor(Math.random() * 2) + (game.level >= 8 ? 1 : 0);
    showBanner('⚠ SINKHOLES — MIND YOUR FEET!', '#ffcf5a');
    for (let i = 0; i < n; i++){
      evt.queue.push({ at: i * 0.4, fn: spawnHoleSafe });
    }
    evt.dur = n * 0.4 + 2;
  }
}

function updateEvents(dt){
  if (evt.active){
    evt.t += dt;
    while (evt.queue.length && evt.t >= evt.queue[0].at) evt.queue.shift().fn();
    if (!evt.queue.length && evt.t >= evt.dur){
      evt.active = null;
      evt.timer = 17 + Math.random() * 11;
    }
    return;
  }
  if (game.level < 2) return;
  evt.timer -= dt;
  if (evt.timer <= 0) triggerEvent();
}

