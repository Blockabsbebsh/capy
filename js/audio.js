/* =======================================================================
   AUDIO  (fully synthesized, Web Audio API)
   ======================================================================= */
const Audio = (() => {
  let ctx = null, master = null, muted = false;

  function init(){
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    // gentle bus compression so stacked SFX don't clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003;
    master.connect(comp); comp.connect(ctx.destination);
  }
  function resume(){ init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function now(){ return ctx ? ctx.currentTime : 0; }

  function tone({freq=440, freq2=null, type='sine', dur=0.18, gain=0.5, delay=0, attack=0.006, detune=0}){
    if (!ctx || muted) return;
    const t = now() + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type; osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t);
    if (freq2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.03);
  }

  function noise({dur=0.2, gain=0.35, delay=0, hp=300, lp=6000, sweep=true}){
    if (!ctx || muted) return;
    const t = now() + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(lp, t);
    if (sweep) bp.frequency.exponentialRampToValueAtTime(Math.max(60, hp), t + dur);
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  /* ---------------- procedural music ----------------
     A slow four-bar loop in A minor: pad, walking bass, marimba melody
     drawn from a pentatonic scale, and a shaker that joins later on.   */
  let musicGain = null, musicTimer = null, nextNote = 0, step = 0, tempo = 92, intensity = 1;
  const MIDI = m => 440 * Math.pow(2, (m - 69) / 12);

  /* One progression per visual theme, so the meadow and the music turn over
     together. `voice` picks the melody timbre; `tempoBase` sets the floor. */
  const MUSIC_THEMES = [
  { // Meadow — playful marimba, warm and open
    prog:[{bass:45,pad:[57,60,64]},{bass:41,pad:[57,60,65]},{bass:48,pad:[55,60,64]},{bass:43,pad:[55,59,62]}],
    pent:[69,72,74,76,79,81,84], tempoBase:90, voice:'marimba', style:'meadow' },
  { // Lily Pad Ponds — suspended bells and watery fifths
    prog:[{bass:42,pad:[54,57,61]},{bass:38,pad:[54,59,61]},{bass:45,pad:[53,57,62]},{bass:40,pad:[52,57,61]}],
    pent:[66,69,73,76,78,81,85], tempoBase:78, voice:'bell', style:'pond' },
  { // Bubblegum — springy plucks, bright harmony
    prog:[{bass:48,pad:[60,64,67]},{bass:43,pad:[60,65,69]},{bass:45,pad:[59,64,67]},{bass:41,pad:[57,62,65]}],
    pent:[72,74,76,79,81,84,88], tempoBase:108, voice:'pluck', style:'candy' },
  { // Night — sparse music-box phrases with long air
    prog:[{bass:45,pad:[57,60,64]},{bass:40,pad:[55,59,64]},{bass:41,pad:[57,60,65]},{bass:43,pad:[55,59,62]}],
    pent:[81,84,86,88,91,93,96], tempoBase:64, voice:'bell', style:'night' },
  { // Hell — low saw bass, ominous minor melody
    prog:[{bass:33,pad:[45,48,52]},{bass:29,pad:[45,50,52]},{bass:36,pad:[44,48,51]},{bass:31,pad:[43,47,50]}],
    pent:[57,60,62,64,67,69,72], tempoBase:96, voice:'pluck', style:'hell' },
];
  let mTheme = MUSIC_THEMES[0];

  // one lead voice, three flavours — partial ratio and gain shape the timbre
  const VOICE = {
    marimba: { type:'triangle', ratio:2.01, partial:0.30, decay:1.0 },
    pluck:   { type:'sawtooth', ratio:1.50, partial:0.16, decay:0.7 },
    bell:    { type:'sine',     ratio:3.01, partial:0.42, decay:1.7 },
  };
  function marimba(freq, time, dur, gain){
    const V = VOICE[mTheme.voice] || VOICE.marimba;
    dur *= V.decay;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    const g = ctx.createGain(), g2 = ctx.createGain();
    o1.type = V.type; o1.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq * V.ratio;
    g2.gain.value = V.partial;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(musicGain);
    o1.start(time); o2.start(time);
    o1.stop(time + dur + 0.03); o2.stop(time + dur + 0.03);
  }
  function padChord(notes, time, dur){
    for (const n of notes){
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = MIDI(n);
      o.detune.value = (Math.random() - 0.5) * 10;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(0.045, time + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.0001, time + dur);
      o.connect(g); g.connect(musicGain);
      o.start(time); o.stop(time + dur + 0.05);
    }
  }
  function bassNote(n, time, dur){
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    o.type = 'triangle'; o.frequency.value = MIDI(n);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.16, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(lp); lp.connect(g); g.connect(musicGain);
    o.start(time); o.stop(time + dur + 0.03);
  }
  function shaker(time){
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2 - 1) * (1 - i/len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200;
    const g = ctx.createGain(); g.gain.value = 0.05;
    src.connect(hp); hp.connect(g); g.connect(musicGain);
    src.start(time); src.stop(time + 0.07);
  }

  function scheduleStep(s, time){
    const PROG = mTheme.prog, PENT = mTheme.pent;
    const ch = PROG[Math.floor(s / 8) % 4];
    const beat = s % 8;
    const bar = Math.floor(s / 8);

    if (mTheme.style === 'night'){
      // Deliberately leave holes in the arrangement: one chord per bar,
      // occasional bell notes, no shaker.
      if (beat === 0) padChord(ch.pad, time, (60 / tempo) * 4 * 0.98);
      if (beat === 0 && bar % 2 === 0) bassNote(ch.bass, time, 0.75);
      if (beat === 2 && bar % 2 === 1) bassNote(ch.bass + 12, time, 0.32);
      if (beat === 3 && Math.random() < 0.55){
        const n = PENT[(Math.random() * PENT.length) | 0];
        marimba(MIDI(n), time, 0.95, 0.075);
      }
      return;
    }

    if (beat === 0) padChord(ch.pad, time, (60 / tempo) * 4 * 0.92);
    if (beat === 0 || beat === 4) bassNote(ch.bass, time, mTheme.style === 'hell' ? 0.55 : 0.45);
    if (beat === 6 && intensity >= 2) bassNote(ch.bass + (mTheme.style === 'hell' ? 1 : 7), time, 0.22);

    let chance = 0.30 + Math.min(0.32, intensity * 0.05);
    if (mTheme.style === 'pond') chance *= 0.68;
    if (mTheme.style === 'candy') chance = Math.min(0.78, chance + 0.22);
    if (mTheme.style === 'hell') chance = Math.min(0.64, chance + 0.12);

    if (Math.random() < chance){
      const n = PENT[(Math.random() * PENT.length) | 0];
      const dur = mTheme.style === 'pond' ? 0.85 : (mTheme.style === 'candy' ? 0.34 : 0.55);
      const gain = mTheme.style === 'hell' ? 0.085 : 0.10;
      marimba(MIDI(n), time, dur, gain);
      if (mTheme.style === 'candy' && Math.random() < 0.45)
        marimba(MIDI(n + 12), time + 0.08, 0.24, 0.05);
      if (mTheme.style === 'pond' && Math.random() < 0.35)
        marimba(MIDI(n + 7), time + 0.16, 0.65, 0.035);
    }
    if (mTheme.style === 'hell' && intensity >= 2 && beat % 2 === 1) shaker(time);
    if (mTheme.style !== 'pond' && mTheme.style !== 'hell' && intensity >= 3 && beat % 2 === 1) shaker(time);
  }

  function musicTick(){
    if (!ctx || !musicGain) return;
    const eighth = 60 / tempo / 2;
    // if the tab was throttled, resync instead of dumping a burst of notes
    if (nextNote < ctx.currentTime - 0.4) nextNote = ctx.currentTime + 0.05;
    while (nextNote < ctx.currentTime + 0.15){
      if (!muted) scheduleStep(step, Math.max(nextNote, ctx.currentTime + 0.02));
      nextNote += eighth;
      step = (step + 1) % 32;
    }
  }

  return {
    resume, init,
    get muted(){ return muted; },

    startMusic(){
      init(); if (!ctx) return;
      resume();
      if (!musicGain){ musicGain = ctx.createGain(); musicGain.gain.value = 0.55; musicGain.connect(master); }
      if (musicTimer) return;
      nextNote = ctx.currentTime + 0.12; step = 0;
      musicTimer = setInterval(musicTick, 25);
    },
    stopMusic(){ if (musicTimer){ clearInterval(musicTimer); musicTimer = null; } },
    setMusicLevel(l){ intensity = l; tempo = Math.min(124, mTheme.tempoBase + l * 1.5); },
    setMusicTheme(i){
      const next = MUSIC_THEMES[Math.min(MUSIC_THEMES.length - 1, Math.max(0, i))];
      if (next === mTheme) return;
      mTheme = next;
      step = 0;                       // restart the loop on the new progression
      tempo = Math.min(124, mTheme.tempoBase + intensity * 1.5);
    },
    duck(v){ if (musicGain) musicGain.gain.value = v; },
    toggleMute(){ muted = !muted; if (!muted) { resume(); tone({freq:660, dur:0.09, gain:0.3, type:'triangle'}); } return muted; },

    burger(combo){
      const p = Math.min(combo, 12);
      tone({freq: 420 + p*38, freq2: 760 + p*46, type:'triangle', dur:0.13, gain:0.42});
      noise({dur:0.13, gain:0.20, hp:500, lp:3800});
    },
    melon(combo){
      const p = Math.min(combo, 12) * 22;
      tone({freq: 523+p, freq2: 784+p, type:'sine',     dur:0.24, gain:0.40});
      tone({freq: 659+p, type:'triangle', dur:0.30, gain:0.26, delay:0.05});
      tone({freq: 988+p, type:'sine',     dur:0.34, gain:0.18, delay:0.11});
      noise({dur:0.3, gain:0.24, hp:180, lp:2400});
    },
    bad(){
      tone({freq:220, freq2:60, type:'sawtooth', dur:0.34, gain:0.42});
      tone({freq:150, freq2:48, type:'square',   dur:0.30, gain:0.22, delay:0.02});
      noise({dur:0.28, gain:0.3, hp:120, lp:1600});
    },
    soap(){
      tone({freq:900, freq2:180, type:'sine', dur:0.35, gain:0.3});
      noise({dur:0.35, gain:0.18, hp:2000, lp:7000, sweep:false});
    },
    life(){
      [0,1,2].forEach(i => tone({freq: 500 - i*130, type:'square', dur:0.2, gain:0.3, delay:i*0.09}));
      noise({dur:0.5, gain:0.25, hp:80, lp:900});
    },
    miss(){
      tone({freq:180, freq2:90, type:'sine', dur:0.16, gain:0.26});
      noise({dur:0.14, gain:0.12, hp:120, lp:900});
    },
    start(){
      [523,659,784,1046].forEach((f,i) => tone({freq:f, type:'triangle', dur:0.20, gain:0.30, delay:i*0.07}));
    },
    over(){
      [660,523,415,311,262].forEach((f,i) => tone({freq:f, type:'triangle', dur:0.42, gain:0.32, delay:i*0.15}));
      tone({freq:131, type:'sine', dur:1.4, gain:0.25, delay:0.6});
    },
    levelUp(){
      [784,988,1318].forEach((f,i) => tone({freq:f, type:'sine', dur:0.26, gain:0.26, delay:i*0.06}));
    },
    jump(){
      tone({freq:300, freq2:620, type:'triangle', dur:0.13, gain:0.24});
    },
    dash(){
      // a whoosh, not a hop: noise sweeping down past a low body, so it reads
      // as going somewhere rather than going up
      noise({dur:0.2, gain:0.2, lp:4200, hp:520});
      tone({freq:520, freq2:190, type:'triangle', dur:0.17, gain:0.19});
    },
    land(){
      tone({freq:120, freq2:70, type:'sine', dur:0.1, gain:0.2});
      noise({dur:0.1, gain:0.1, hp:100, lp:700});
    },
    alarm(){
      for (let i = 0; i < 3; i++){
        tone({freq:880, freq2:660, type:'square', dur:0.16, gain:0.24, delay:i*0.24});
        tone({freq:587, type:'sawtooth', dur:0.12, gain:0.12, delay:i*0.24 + 0.12});
      }
    },
    incoming(){
      tone({freq:1400, freq2:300, type:'sawtooth', dur:0.5, gain:0.16});
    },
    rumble(){
      noise({dur:0.85, gain:0.4, hp:40, lp:520});
      tone({freq:70, freq2:38, type:'sine', dur:0.8, gain:0.32});
    },
    fall(){
      tone({freq:520, freq2:70, type:'triangle', dur:0.7, gain:0.34});
      noise({dur:0.7, gain:0.22, hp:60, lp:1400});
      tone({freq:90, freq2:50, type:'sine', dur:0.3, gain:0.3, delay:0.62});
    },
    respawn(){
      [523,784,1046].forEach((f,i) => tone({freq:f, type:'sine', dur:0.2, gain:0.22, delay:i*0.05}));
    },
    powerUp(){
      [523,659,784,1046,1318].forEach((f,i) =>
        tone({freq:f, type:'triangle', dur:0.28, gain:0.28, delay:i*0.055}));
      tone({freq:2093, type:'sine', dur:0.5, gain:0.12, delay:0.3});
    },
    heart(){
      [659,880,1046,1318].forEach((f,i) =>
        tone({freq:f, type:'sine', dur:0.5, gain:0.30, delay:i*0.075}));
      tone({freq:1760, type:'triangle', dur:0.7, gain:0.12, delay:0.28});
      noise({dur:0.5, gain:0.08, hp:3000, lp:9000, sweep:false});
    },
    sparkle(){
      tone({freq:1800 + Math.random()*900, type:'sine', dur:0.10, gain:0.045});
    },
    themeShift(){
      [392,523,659,784,1046].forEach((f,i) =>
        tone({freq:f, type:'sine', dur:0.7, gain:0.22, delay:i*0.10}));
      noise({dur:1.1, gain:0.12, hp:200, lp:5000});
    },
    slowmo(){
      tone({freq:900, freq2:180, type:'sine', dur:0.9, gain:0.28});
      tone({freq:450, freq2:90,  type:'triangle', dur:1.0, gain:0.18, delay:0.05});
    },
    unslow(){
      tone({freq:180, freq2:900, type:'sine', dur:0.5, gain:0.22});
    },
    shieldBreak(){
      noise({dur:0.4, gain:0.3, hp:800, lp:6500});
      tone({freq:1200, freq2:400, type:'sine', dur:0.35, gain:0.24});
    },
    comboBreak(){
      tone({freq:400, freq2:180, type:'triangle', dur:0.26, gain:0.2});
      tone({freq:300, freq2:120, type:'sine', dur:0.3, gain:0.14, delay:0.05});
    },
    chew(){
      for (let i = 0; i < 3; i++) noise({dur:0.07, gain:0.13, hp:400, lp:2600, delay:i*0.09});
    },
    feast(){
      [523,659,784,1046,1318,1568].forEach((f,i) =>
        tone({freq:f, type:'triangle', dur:0.22, gain:0.26, delay:i*0.06}));
    },
  };
})();

