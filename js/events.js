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
    showBanner('HEART FALLING', '#ff8fae', 'life');
    game.heartTimer = 46 + Math.random() * 26;
  }
}

function triggerEvent(){
  const pool = ['missiles', 'feast'];
  if (game.level >= 3) pool.push('sinkholes');
  if (game.level >= 5) pool.push('feast');
  if (game.level >= 6) pool.push('missiles', 'sinkholes');
  // never run the same set-piece twice in a row — drop the previous kind from
  // the pool rather than rerolling once, since a single reroll draws from the
  // same pool and can land on it again (at level 6+ that was roughly one
  // repeat in nine). Duplicate entries stay in, so the weighting is unchanged.
  const fresh = pool.filter(k => k !== evt.last);
  const from = fresh.length ? fresh : pool;
  const kind = from[(Math.random() * from.length) | 0];
  evt.last = kind;

  evt.active = kind; evt.t = 0; evt.queue.length = 0;

  if (kind === 'feast'){
    /* A reward beat, but a routed one: every melon lands in order along one
       long continuous path (see startFeastRoute), so the melons themselves —
       and the landing ring each one drops with — draw the line. The old
       version dropped them at random x, which paid the same for standing
       still, and quietly wasted the ones that fell out of reach. */
    showBanner('MELON FEAST!', '#ffe14d', 'melon');   // any longer overflows a phone
    Audio.feast();
    game.fovKick = 2.4;
    // + the last melon's fall, + a beat before normal service resumes
    evt.dur = startFeastRoute(evt.queue)
            + SPAWN_Y / Math.max(1, game.fallSpeed) + 1.6;
    return;
  }

  Audio.alarm();

  if (kind === 'missiles'){
    const n = Math.min(11, 3 + Math.floor(game.level / 3) + Math.floor(overtime() * 2));
    showBanner('CHILI MISSILES — DODGE!', '#ff7a5a');
    for (let i = 0; i < n; i++){
      evt.queue.push({ at: 1.1 + i * 0.52, fn: () => spawnItem('chili', { missile:true }) });
    }
    evt.dur = 1.1 + n * 0.52 + 2.4;
  } else {
    const n = 2 + Math.floor(Math.random() * 2) + (game.level >= 8 ? 1 : 0)
            + Math.floor(overtime());
    showBanner('SINKHOLES — MIND YOUR FEET!', '#ffcf5a');
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
      evt.timer = Math.max(7, 17 - overtime() * 3) + Math.random() * 11;
    }
    return;
  }
  if (game.level < 2) return;
  evt.timer -= dt;
  if (evt.timer <= 0) triggerEvent();
}

