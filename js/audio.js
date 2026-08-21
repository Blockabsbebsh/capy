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
     Five written pieces, one per biome, rather than one loop reskinned five
     ways. Melody notes drawn at RANDOM from a pentatonic pool is why it used to
     "work but not sound great": random pitches never form a phrase, so there
     was nothing to hum and no difference between biomes beyond timbre. Each
     theme has its own key, tempo, metre, groove, bass line and a motif.

       Meadow     G major, 104bpm, swung eighths, marimba stroll
       Pond       D major, 92bpm, kalimba over water drips, lots of air
       Bubblegum  A major, 124bpm, sixteenth-note square lead, four-on-the-floor
       Night      A minor WALTZ (3/4), 72bpm, music box, almost no percussion
       Hell       D harmonic minor, 126bpm, circus oompah organ and tambourine

     Level never changes the piece, only how filled in it is: tempo creeps up
     across a biome's ten levels and the extra percussion joins halfway. A tune
     that mutated with difficulty would stop being a tune. */
  /* Two gain stages, on purpose: `musicBus` carries the per-theme trim (see
     `mix` on each theme — the sparse pieces need a few dB to sit level with the
     busy ones) and `musicGain` is what duck() pulls down for menus, so ducking
     cannot quietly undo a theme's balance. */
  let musicGain = null, musicBus = null, musicTimer = null;
  let nextNote = 0, step = 0, tempo = 104, intensity = 1;
  const MIDI = m => 440 * Math.pow(2, (m - 69) / 12);

  /* Parts are written one string per bar, one token per step:
       74   start a note here (MIDI number)
       -    hold the previous note one step longer
       .    rest
     `pat` checks every bar against the theme's step grid: a miscounted bar does
     not look wrong, it silently shifts the rest of the phrase off the beat. */
  function pat(bars, spb, label){
    const out = [];
    bars.forEach((bar, i) => {
      const toks = bar.trim().split(/\s+/);
      if (toks.length !== spb)
        console.error(`[audio] ${label} bar ${i + 1}: ${toks.length} steps, expected ${spb}`);
      out.push(...toks);
    });
    return out;
  }
  // token list -> per-step buckets of {n, len}, so a step costs one array lookup
  function events(toks, label){
    const at = toks.map(() => null);
    let last = null;
    toks.forEach((t, s) => {
      if (t === '.'){ last = null; return; }
      if (t === '-'){
        if (!last) console.error(`[audio] ${label} step ${s}: hold with nothing to hold`);
        else last.len++;
        return;
      }
      last = { n: +t, len: 1 };
      at[s] = last;
    });
    return at;
  }
  // drums are one bar that repeats: 'x' hits, anything else rests
  const beats = (bar, spb, label) => pat([bar], spb, label).map(t => t === 'x');

  function part(bars, spb, label){ return events(pat(bars, spb, label), label); }

  const THEMES_M = [
  { /* ---- MEADOW: a stroll. I-vi-IV-V, the friendliest loop there is, with a
         swung skip in the eighths so it ambles rather than marches. */
    id:'meadow', tempo:104, tempoUp:8, stepsPerBar:8, stepBeats:0.5, swing:0.12, mix:1.00,
    lead:'marimba', pad:'warm', bass:'round',
    chords:[
      { bass:43, pad:[59,62,67] },   // G
      { bass:40, pad:[59,62,64] },   // Em7
      { bass:48, pad:[60,64,67] },   // C
      { bass:50, pad:[57,62,66] },   // D
    ],
    leadP:[
      '.  71 74 76 -  74 .  .',
      '.  71 74 76 79 -  76 .',
      '79 -  76 79 81 -  79 .',
      '78 -  74 .  81 -  79 78',     // F# turns the phrase back to G
    ],
    bassP:[
      '43 .  .  .  50 .  .  55',
      '40 .  .  .  47 .  .  52',
      '48 .  .  .  55 .  .  48',
      '50 .  .  .  57 .  .  42',     // F#2 walks up into the top of the loop
    ],
    drums:{ kick:'x . . . x . . .', shaker:'. x . x . x . x', 'tom+':'. . . . . . x .' },
  },

  { /* ---- POND: chill, but cheerful about it. The soundscape is the point — a
         kalimba over water drips, sparse and unhurried — and the first version
         of this got that part right while reading as SAD, in D major, for four
         reasons that had nothing to do with the key:

           - the melody fell in three bars out of four, and a descending line is
             a sigh however bright the chord under it is
           - maj7 chords everywhere. A major seventh is wistful, not happy; a
             major SIXTH (the B in bar one) is the playful one
           - the minor vi (Bm7) landed in bar three, the emphasised bar, exactly
             where the tune bottomed out
           - the loop ended on the V, so it never came home

         So: I-IV-V-I, plain triads with a 6th for sparkle, no minor chord
         anywhere, a melody that CLIMBS and resolves onto the tonic at the top
         of bar four, a small lilt in the eighths, and eight bpm more. Every
         sustained note is a unison with a chord tone, which is what makes it
         sound settled rather than yearning. The drips stay exactly as they
         were, and get a frog to answer them once the biome fills in. */
    id:'pond', tempo:92, tempoUp:5, stepsPerBar:8, stepBeats:0.5, swing:0.08, mix:1.18,
    lead:'kalimba', pad:'glass', bass:'round',
    chords:[
      { bass:38, pad:[66,69,71] },   // D6   — the 6th is the cheerful interval
      { bass:43, pad:[62,67,71] },   // G
      { bass:45, pad:[64,69,73] },   // A
      { bass:38, pad:[62,66,69] },   // D    — home every loop
    ],
    leadP:[
      '74 78 81 -  -  83 .  .',      // up through the chord to the bright 6th
      '83 81 79 -  -  81 83 .',
      '81 83 85 -  -  83 81 .',      // peaks on C#6, which wants to go home
      '86 -  -  83 81 -  78 .',      // and does: D6 on the downbeat
    ],
    bassP:[
      '38 -  -  50 -  .  45 .',
      '43 -  -  55 -  .  50 .',
      '45 -  -  57 -  .  52 .',
      '38 -  -  50 -  .  45 49',     // C#3 leads back up into bar one
    ],
    drums:{ drip:'. . x . . . . x', 'croak+':'. . . x . . . .' },
  },

  { /* ---- BUBBLEGUM: the sugar rush. Sixteenth grid, square lead, I-V-vi-IV
         and a four-on-the-floor kick. The only theme that is genuinely fast. */
    id:'candy', tempo:124, tempoUp:6, stepsPerBar:16, stepBeats:0.25, swing:0, mix:0.95,
    lead:'square', pad:'warm', bass:'round',
    chords:[
      { bass:45, pad:[61,64,69] },   // A
      { bass:40, pad:[59,64,68] },   // E
      { bass:42, pad:[61,66,69] },   // F#m
      { bass:38, pad:[62,66,69] },   // D
    ],
    leadP:[
      '81 . 81 . 76 . 78 . 81 -  -  .  78 .  76 .',
      '80 . 78 . 76 . 78 . 80 -  -  .  76 .  73 .',
      '78 . 78 . 73 . 76 . 78 -  -  .  81 .  78 .',
      '76 . 74 . 76 . 78 . 81 -  -  -  78 76 74 .',
    ],
    bassP:[
      '45 . 45 . 45 . 45 . 45 .  45 .  52 .  45 .',
      '40 . 40 . 40 . 40 . 40 .  40 .  47 .  40 .',
      '42 . 42 . 42 . 42 . 42 .  42 .  49 .  42 .',
      '38 . 38 . 38 . 38 . 38 .  38 .  45 .  47 .',
    ],
    drums:{ kick:'x . . . x . . . x . . . x . . .',
            clap:'. . . . x . . . . . . . x . . .',
            hat: '. . x . . . x . . . x . . . x .',
            'hat+':'. x . x . x . x . x . x . x . x' },
  },

  { /* ---- NIGHT: a waltz, and the only theme not in 4/4 — six eighths to the
         bar, oom-pah-pah bass, music box on top. The metre is the identity;
         nothing else in the game is in three. */
    id:'night', tempo:72, tempoUp:4, stepsPerBar:6, stepBeats:0.5, swing:0, mix:1.20,
    lead:'musicbox', pad:'glass', bass:'round',
    chords:[
      { bass:45, pad:[57,60,64] },   // Am
      { bass:41, pad:[57,60,65] },   // F
      { bass:48, pad:[55,60,64] },   // C
      { bass:40, pad:[56,59,64] },   // E7 — the G# is the whole colour
    ],
    leadP:[
      '81 . 79 . 76 .',
      '77 . 76 . 72 .',
      '76 . 79 . 84 -',
      '83 . 80 . 76 -',
    ],
    bassP:[
      '45 . 52 . 52 .',
      '41 . 48 . 48 .',
      '48 . 55 . 55 .',
      '40 . 47 . 47 .',
    ],
    drums:{ 'tom+':'x . . . . .' },
  },

  { /* ---- HELL: a circus, not a dirge. D harmonic minor — the augmented second
         between Bb and C# is both the spooky interval and the funny one — over
         an oompah bass and a tambourine that never stops. Goofy menace. */
    id:'hell', tempo:126, tempoUp:8, stepsPerBar:8, stepBeats:0.5, swing:0, mix:1.45,
    lead:'organ', pad:'reed', bass:'growl',
    chords:[
      { bass:38, pad:[57,62,65] },   // Dm
      { bass:45, pad:[55,61,64] },   // A7
      { bass:43, pad:[58,62,67] },   // Gm
      { bass:45, pad:[55,61,64] },   // A7
    ],
    leadP:[
      '74 . 77 . 81 -  79 77',
      '76 . 79 . 85 -  81 79',
      '82 . 81 . 79 -  77 79',
      '81 . 85 . 81 .  76 74',
    ],
    bassP:[
      '38 . 45 . 38 .  45 .',
      '45 . 52 . 45 .  52 .',
      '43 . 50 . 43 .  50 .',
      '45 . 52 . 45 .  52 45',
    ],
    drums:{ kick:'x . . . x . . .', snare:'. . . x . . . x',
            tamb:'. x . x . x . x', 'tom+':'. . x . . . x .' },
  },
];

  let mTheme = THEMES_M[0];

  /* --- lead voices ------------------------------------------------------
     Two oscillators each, a body and one inharmonic partial, which is what makes
     a struck or plucked thing sound struck. `decay` scales the written note
     length, so the same phrase can ring or stay staccato. */
  const VOICE = {
    marimba: { type:'triangle', ratio:2.01, partial:0.30, decay:1.10, atk:0.006, gain:0.100 },
    kalimba: { type:'sine',     ratio:3.01, partial:0.34, decay:1.70, atk:0.008, gain:0.088 },
    square:  { type:'square',   ratio:2.00, partial:0.08, decay:0.85, atk:0.004, gain:0.058, vib:5.5 },
    musicbox:{ type:'sine',     ratio:4.02, partial:0.20, decay:2.20, atk:0.004, gain:0.078 },
    organ:   { type:'sawtooth', ratio:1.50, partial:0.26, decay:0.60, atk:0.005, gain:0.088, lp:2400 },
  };
  const PAD = {
    warm:  { type:'sine',     lp:1800, gain:0.045 },
    glass: { type:'triangle', lp:2600, gain:0.038 },
    /* Hell's pad is a sawtooth, so its harmonics run high; at a 900Hz cutoff the
       third harmonic of the A7 chord's C#4 landed on 831Hz — a semitone under
       the melody's A5 — and buzzed loudly enough to bury the tune it was
       supposed to sit under. Cut it well below the lead's register instead. */
    /* Triangle, not sawtooth. A saw pad's third harmonic is a third of its
       fundamental, and Hell's Dm is voiced on A3 — a strong 660Hz tone a
       semitone under the melody's F5, at 2.4x the melody's level. A triangle's
       third is a ninth, ~10dB down; the darkness comes from the cutoff. */
    reed:  { type:'triangle', lp:520,  gain:0.030 },
  };
  const BASS = {
    // `pluck` is how far the filter opens on the attack. A triangle can take a
    // wide one (it has almost nothing up there to expose); a sawtooth cannot —
    // at 2.2x Hell's bass swept to ~700Hz, and the 6th harmonic of its A2 sat a
    // semitone under the melody's F5, buzzing over the tune every oompah.
    round: { type:'triangle', lp:420, pluck:2.2, gain:0.160 },
    /* 220Hz, not 300: at 300 the sixth harmonic of Hell's A2 oompah (110Hz x 6
       = 660Hz) came through loud enough to sit under the melody's F5 a semitone
       down and buzz against it. An oompah bass at 126bpm wants weight, not
       harmonics — this rolls them off nearly 20dB and the tune comes forward. */
    growl: { type:'sawtooth', lp:220, pluck:1.4, gain:0.150 },
  };

  function leadNote(n, time, dur, gain){
    const V = VOICE[mTheme.lead] || VOICE.marimba;
    const freq = MIDI(n);
    dur = Math.max(0.08, dur) * V.decay;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    const g = ctx.createGain(), g2 = ctx.createGain();
    o1.type = V.type; o1.frequency.value = freq;
    o2.type = 'sine';  o2.frequency.value = freq * V.ratio;
    g2.gain.value = V.partial;
    let out = g;
    if (V.lp){                              // the organ needs its edge taken off
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = V.lp;
      g.connect(lp); out = lp;
    }
    if (V.vib){                             // chiptune wobble, small and fast
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = V.vib; lg.gain.value = freq * 0.006;
      lfo.connect(lg); lg.connect(o1.frequency);
      lfo.start(time); lfo.stop(time + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain * V.gain / 0.1, time + V.atk);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o1.connect(g); o2.connect(g2); g2.connect(g);
    out.connect(musicBus);
    o1.start(time); o2.start(time);
    o1.stop(time + dur + 0.03); o2.stop(time + dur + 0.03);
  }

  function padChord(ns, time, dur){
    const P = PAD[mTheme.pad] || PAD.warm;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = P.lp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(P.gain, time + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, time + dur);
    lp.connect(g); g.connect(musicBus);
    for (const n of ns){
      // a detuned pair per note: one oscillator per chord tone is a test tone,
      // two beating against each other is a chord
      for (const cents of [-5, 5]){
        const o = ctx.createOscillator();
        o.type = P.type; o.frequency.value = MIDI(n); o.detune.value = cents;
        o.connect(lp);
        o.start(time); o.stop(time + dur + 0.05);
      }
    }
  }

  function bassNote(n, time, dur){
    const B = BASS[mTheme.bass] || BASS.round;
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(B.lp * B.pluck, time);  // a little pluck in the filter
    lp.frequency.exponentialRampToValueAtTime(B.lp, time + 0.09);
    o.type = B.type; o.frequency.value = MIDI(n);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(B.gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.12, dur));
    o.connect(lp); lp.connect(g); g.connect(musicBus);
    o.start(time); o.stop(time + dur + 0.05);
  }

  /* --- kit -------------------------------------------------------------- */
  function mNoise(time, dur, gain, type, freq, q = 1){
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(f); f.connect(g); g.connect(musicBus);
    src.start(time); src.stop(time + dur + 0.02);
  }
  function mTone(time, dur, gain, f1, f2, type = 'sine', lp = 0){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, time);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, time + dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    // a square or saw hit needs the top taken off it, or it is all buzz
    if (lp){
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lp;
      g.connect(f); f.connect(musicBus);
    } else g.connect(musicBus);
    o.start(time); o.stop(time + dur + 0.02);
  }
  const KIT = {
    kick:  t => { mTone(t, 0.16, 0.30, 118, 46); mNoise(t, 0.03, 0.06, 'lowpass', 400); },
    snare: t => { mNoise(t, 0.13, 0.13, 'bandpass', 1900, 0.8); mTone(t, 0.07, 0.07, 190, 140, 'triangle'); },
    hat:   t => mNoise(t, 0.03, 0.045, 'highpass', 7200),
    clap:  t => { for (let i = 0; i < 3; i++) mNoise(t + i * 0.011, 0.06, 0.075, 'bandpass', 1500, 0.7); },
    shaker:t => mNoise(t, 0.045, 0.042, 'highpass', 5400),
    tamb:  t => { mNoise(t, 0.045, 0.024, 'highpass', 5200); mTone(t, 0.05, 0.010, 5200, 0, 'sine'); },
    tom:   t => mTone(t, 0.22, 0.13, 165, 92, 'sine'),
    drip:  t => { mTone(t, 0.09, 0.055, 1500, 880); mNoise(t, 0.02, 0.012, 'highpass', 4000); },
    /* A frog answering the drips: two low blips, the second lower and quieter,
       which is what makes it "rib-bit" rather than a beep. Filtered hard —
       an unfiltered square down here is a buzzer, not an animal. */
    croak: t => { mTone(t, 0.085, 0.040, 168, 98, 'square', 820);
                  mTone(t + 0.075, 0.065, 0.026, 152, 92, 'square', 760); },
  };

  // compile the written parts once, at load
  for (const T of THEMES_M){
    const spb = T.stepsPerBar;
    T.leadAt = part(T.leadP, spb, T.id + ' lead');
    T.bassAt = part(T.bassP, spb, T.id + ' bass');
    T.loop = T.chords.length * spb;
    /* Resolved once, at load: instrument, whether it is a fill layer, and its
       bar. A trailing '+' marks a layer that joins in the second half of a
       biome. The name is checked against the kit HERE because it used to be
       looked up per hit — a pattern keyed 'extra' threw on every fill hit from
       level 6 and took the whole scheduler down with it. */
    T.hits = Object.keys(T.drums).map(k => {
      const fillOnly = k.endsWith('+');
      const inst = fillOnly ? k.slice(0, -1) : k;
      if (!KIT[inst]) console.error(`[audio] ${T.id}: no kit instrument '${inst}'`);
      return { inst, fillOnly, on: beats(T.drums[k], spb, `${T.id} ${k}`) };
    });
  }

  /* How far into a biome we are, 0 at its first level and 1 at its last. The
     piece is identical either way; this only adds fill and a few bpm. */
  function ramp(){
    const span = typeof THEME_EVERY === 'number' ? THEME_EVERY : 10;
    return Math.min(1, Math.max(0, ((intensity - 1) % span) / (span - 1)));
  }
  function tempoFor(T){ return Math.round(T.tempo + ramp() * T.tempoUp); }
  function stepDur(){ return (60 / tempo) * mTheme.stepBeats; }

  function scheduleStep(s, time){
    const T = mTheme, spb = T.stepsPerBar;
    const beat = s % spb;
    const ch = T.chords[Math.floor(s / spb) % T.chords.length];
    const sd = stepDur();
    const fill = ramp() >= 0.5;

    // swing: hold the odd eighths back a fraction of a step
    if (T.swing && beat % 2 === 1) time += sd * T.swing;

    if (beat === 0) padChord(ch.pad, time, sd * spb * 0.96);

    const b = T.bassAt[s];
    if (b) bassNote(b.n, time, sd * b.len * 0.92);

    const l = T.leadAt[s];
    if (l){
      leadNote(l.n, time, sd * l.len, 0.1);
      // the top octave joins for the last stretch of a biome, quietly — the
      // phrase is unchanged, it just gains a sparkle
      if (fill && ramp() >= 0.8) leadNote(l.n + 12, time + 0.012, sd * l.len * 0.6, 0.028);
    }

    for (const h of T.hits){
      if (h.fillOnly && !fill) continue;
      if (h.on[beat]) KIT[h.inst](time);
    }
  }

  function musicTick(){
    if (!ctx || !musicGain) return;
    const sd = stepDur();
    // if the tab was throttled, resync instead of dumping a burst of notes
    if (nextNote < ctx.currentTime - 0.4) nextNote = ctx.currentTime + 0.05;
    while (nextNote < ctx.currentTime + 0.15){
      if (!muted) scheduleStep(step, Math.max(nextNote, ctx.currentTime + 0.02));
      nextNote += sd;
      step = (step + 1) % mTheme.loop;
    }
  }

  return {
    resume, init,
    get muted(){ return muted; },

    startMusic(){
      init(); if (!ctx) return;
      resume();
      if (!musicGain){
        musicGain = ctx.createGain(); musicGain.gain.value = 0.55; musicGain.connect(master);
        musicBus = ctx.createGain(); musicBus.connect(musicGain);
      }
      musicBus.gain.value = mTheme.mix;
      if (musicTimer) return;
      nextNote = ctx.currentTime + 0.12; step = 0;
      musicTimer = setInterval(musicTick, 25);
    },
    stopMusic(){ if (musicTimer){ clearInterval(musicTimer); musicTimer = null; } },
    setMusicLevel(l){ intensity = l; tempo = tempoFor(mTheme); },
    setMusicTheme(i){
      const next = THEMES_M[Math.min(THEMES_M.length - 1, Math.max(0, i))];
      if (next === mTheme) return;
      mTheme = next;
      step = 0;                       // every piece starts from its own bar one
      tempo = tempoFor(next);
      if (musicBus) musicBus.gain.value = next.mix;
    },
    duck(v){ if (musicGain) musicGain.gain.value = v; },

    /* The compiled themes, for tools/music.js: what note is written where, so a
       checker can verify the music as WRITTEN rather than infer notes back out
       of a mix, where a square wave's seventh harmonic reads as an out-of-key
       pitch and the kick's sweep as a bass note. Measure the audio for level
       and timing; check the data for notes. */
    musicData(){
      return THEMES_M.map(T => ({
        id:T.id, tempo:T.tempo, tempoUp:T.tempoUp, mix:T.mix,
        stepsPerBar:T.stepsPerBar, stepBeats:T.stepBeats, swing:T.swing, loop:T.loop,
        lead:T.lead, pad:T.pad, bass:T.bass,
        // how long a lead note actually rings, as a multiple of its written
        // length — the organ is staccato, the music box is not, and a checker
        // measuring the pitch has to look while the note is still sounding
        leadDecay:(VOICE[T.lead] || VOICE.marimba).decay,
        chords:T.chords.map(c => ({ bass:c.bass, pad:c.pad.slice() })),
        leadAt:T.leadAt.map(e => e && { n:e.n, len:e.len }),
        bassAt:T.bassAt.map(e => e && { n:e.n, len:e.len }),
        drums:T.hits.map(h => h.inst + (h.fillOnly ? '+' : '')),
        kit:Object.keys(KIT),
      }));
    },

    /* Offline render of one theme, for tools/music.js — the one part of this
       game that cannot be checked by looking at it, and the only real test is
       handing a WAV to a human. Uses a private OfflineAudioContext; do not call
       it mid-run, since it borrows the module's context while it renders. */
    async renderTheme({ theme = 0, seconds = 24, level = 1, rate = 44100 } = {}){
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OAC) return null;
      const save = { ctx, master, musicGain, musicBus, mTheme, tempo, intensity, step, muted };
      const off = new OAC(1, Math.ceil(rate * seconds), rate);
      ctx = off;
      master = off.createGain(); master.gain.value = 0.32;
      const comp = off.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003;
      master.connect(comp); comp.connect(off.destination);
      musicGain = off.createGain(); musicGain.gain.value = 0.55; musicGain.connect(master);
      musicBus = off.createGain(); musicBus.connect(musicGain);
      muted = false;
      mTheme = THEMES_M[Math.min(THEMES_M.length - 1, Math.max(0, theme))];
      musicBus.gain.value = mTheme.mix;
      intensity = level; tempo = tempoFor(mTheme); step = 0;
      // captured before the restore below: tempo rises with the level, and a
      // caller told the resting tempo would analyse the render on the wrong grid
      const used = tempo;
      for (let t = 0.05; t < seconds; t += stepDur()){
        scheduleStep(step, t);
        step = (step + 1) % mTheme.loop;
      }
      const buf = await off.startRendering();
      const pcm = Array.from(buf.getChannelData(0));
      ({ ctx, master, musicGain, musicBus, mTheme, tempo, intensity, step, muted } = save);
      return { pcm, rate, tempo: used, id: THEMES_M[theme].id,
               loop: THEMES_M[theme].loop, stepsPerBar: THEMES_M[theme].stepsPerBar };
    },
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

