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

  /* ---------------- MUSIC ----------------
     The five biome pieces live in js/music/ as Tone.js ES modules, one file
     per biome, each exporting start()/stop()/setVolume(). They are loaded by
     the single module script at the end of index.html, which publishes them as
     `window.Music`; everything below is the adapter from the game's long-
     standing Audio.startMusic()/setMusicTheme()/duck() surface onto that.

     Two audio contexts, on purpose. The SFX above keep their own hand-rolled
     Web Audio graph (`ctx`/`master`); Tone runs its own. Merging them would
     mean either handing Tone a context it did not create or rewriting every
     SFX, and the only thing the two need to agree on is relative level, which
     `MUSIC_TRIM` below is for.

     The module script is deferred, so it runs after every classic script has
     parsed. startMusic() is only ever reached from a click, long after that —
     `__musicPending` covers the pathological ordering, not the normal one. */

  /* The game asks for music at 0.55 and ducks to 0.28 under menus. Those
     numbers were chosen against the OLD engine, whose output also passed
     through `master` at 0.32; Tone's does not, so 0.55 on its own would come
     out about 10dB hotter than the SFX it has to sit under, and the balance
     the whole game was tuned at would be gone.

     Measured, not guessed. The five old themes rendered at RMS 0.0091-0.0110,
     geometric mean 0.0101; the five new ones render at 0.0866 with their own
     fader at 0.75. `setVolume` is squared and sits after each track's
     compressor, so the scaling is exactly linear in v^2:

         0.0866 * (0.55*T)^2 / 0.75^2 = 0.0101   ->   T = 0.47

     Re-derive this if the tracks' MIX trims move. `tools/music.js` prints the
     RMS it measures, which is the left-hand side. */
  const MUSIC_TRIM = 0.47;

  let musicVol = 0.55, musicTheme = 0, musicLevel = 1, musicOn = false;
  const musicMod = () => globalThis.Music || null;

  /* `muted` is folded in HERE rather than left to each track. The SFX above get
     muted for free because they all check it before touching `master`; the
     music is a second context with its own output, so the mute button reaches
     it only through this. Volume, not stop(): the piece keeps its place, so
     unmuting drops you back into the bar you were on rather than at bar one. */
  function pushMusic(M){
    if (!M) return;
    M.setTheme(musicTheme);
    M.setLevel(musicLevel);
    M.setVolume(muted ? 0 : musicVol * MUSIC_TRIM);
    if (musicOn) M.play(); else M.stop();
  }
  // js/music/index.js calls this if it finishes loading after something asked
  globalThis.__musicPending = pushMusic;

  return {
    resume, init,
    get muted(){ return muted; },

    startMusic(){
      init(); resume();                       // the SFX context still wants a gesture
      musicOn = true;
      pushMusic(musicMod());
    },
    stopMusic(){ musicOn = false; const M = musicMod(); if (M) M.stop(); },
    setMusicLevel(l){ musicLevel = l; const M = musicMod(); if (M) M.setLevel(l); },
    setMusicTheme(i){ musicTheme = i; const M = musicMod(); if (M) M.setTheme(i); },
    /* Pulled down under menus and drafts. It is the music's only volume now —
       there is no second per-theme trim here, because each track carries its
       own balance offset (`MIX`) inside its module. */
    duck(v){ musicVol = v; const M = musicMod(); if (M) M.setVolume(muted ? 0 : v * MUSIC_TRIM); },

    toggleMute(){
      muted = !muted;
      if (!muted) { resume(); tone({freq:660, dur:0.09, gain:0.3, type:'triangle'}); }
      const M = musicMod();
      if (M) M.setVolume(muted ? 0 : musicVol * MUSIC_TRIM);
      return muted;
    },

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

