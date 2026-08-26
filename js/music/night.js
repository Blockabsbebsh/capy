/* =======================================================================
   NIGHT — "mysterious, but the capybara is still having fun"

   Key      A minor, with one chromatic note: the G# of the E7 in bar 14
   Tempo    88 BPM, 4/4, creeping to 92 across the biome's ten levels
   Form     16 bars, mostly one chord every TWO bars, then it loops (~44s)
   Voices   a legato mono lead with a touch of portamento, a low bowed
            counter-line, a sub bass, a wide dark pad, and almost no kit

   HARMONY — slow to bar 12, then it starts moving, which is the whole shape:

     1-2   Am7      9-10  Cmaj7
     3-4   Fmaj7   11-12  Bm7b5
     5-6   Dm7        13  Fmaj7
     7-8   Em7        14  E7        <- the G#, and the only real tension
                      15  Am7
                      16  E7sus4    <- turns the loop without closing it

   Everything up to bar 12 is diatonic and unhurried. The E7 in bar 14 is the
   one moment the piece leans on you; the E7sus4 in 16 takes the G# straight
   back out again, so the loop never quite lands. Mysterious, not scary.

   MELODY — about twenty notes in sixteen bars. Almost every one is tied over
   a barline, and the mono lead's small portamento joins them, which is what
   makes it read as legato rather than as a slow sequence of blips.

   COUNTER-MELODY — a bowed line an octave below, moving twice as often as the
   melody and always on beats the melody leaves empty. It is the thing keeping
   time here, since the kit barely does.
   ======================================================================= */
import { bars, grid, hz, midi, ticks, unitToDb, tone, ramp } from './lib.js';

const BPB = 4, TOTAL = 16, BEATS = BPB * TOTAL;

/* Voiced deliberately WITHOUT the interval each chord's melody note would rub
   against — an Am9 pad under a melody C is a semitone beat, not colour, and
   the same is true of a low F under a melody E on the Fmaj7. The 9ths and 7ths
   are in the tune instead, which is where you want to hear them. */
const CH = (name, bass, pad, n = 2) =>
  Array.from({ length: n }, () => ({ name, bass, pad }));
const CHORDS = [
  ...CH('Am7',    'A2', ['A3','C4','E4','G4']),   //  1-2
  ...CH('Fmaj7',  'F2', ['A3','C4','E4']),        //  3-4
  ...CH('Dm7',    'D2', ['F3','A3','C4','D4']),   //  5-6
  ...CH('Em7',    'E2', ['G3','B3','D4','E4']),   //  7-8
  ...CH('Cmaj7',  'C2', ['E4','G4','B4']),        //  9-10
  ...CH('Bm7b5',  'B2', ['B3','D4','F4','A4']),   // 11-12
  ...CH('Fmaj7',  'F2', ['A3','C4','E4'], 1),     // 13
  ...CH('E7',     'E2', ['G#3','B3','D4','E4'], 1), // 14  the one chromatic chord
  ...CH('Am7',    'A2', ['A3','C4','E4','G4'], 1),  // 15
  ...CH('E7sus4', 'E2', ['A3','B3','D4','E4'], 1),  // 16  suspended, so it turns
].map(c => ({ ...c, bassMidi: midi(c.bass), padMidi: c.pad.map(midi) }));

const LEAD = bars([
  './2 E5/2',                              //  1  Am7    enters late and alone
  '-/1 C5/2 ./1',                          //  2
  './1 A5/3',                              //  3  Fmaj7
  '-/2 E5/2',                              //  4
  './1 D5/3',                              //  5  Dm7
  '-/1.5 F5/2.5',                          //  6
  './1 B5/3',                              //  7  Em7
  '-/2 G5/2',                              //  8
  '-/1 E6/3',                              //  9  Cmaj7 the top note of the piece
  '-/2 B5/2',                              // 10
  '-/1 A5/3',                              // 11  Bm7b5
  '-/1.5 F5/2.5',                          // 12
  './1 E5/3',                              // 13  Fmaj7
  './1 G#5/3',                             // 14  E7    the G#, held
  './1 A5/2 ./1',                          // 15  Am7   and it resolves
  './1 B5/2 ./1',                          // 16  E7sus4
], BPB, 'night lead');

const COUNTER = bars([
  './4', './4',                            //  1-2  the melody alone
  'C4/2.5 ./0.5 A3/1',                     //  3  Fmaj7
  '-/1 E4/2 ./1',                          //  4
  './0.5 D4/2.5 A3/1',                     //  5  Dm7
  '-/1 F3/3',                              //  6
  './0.5 G3/2 B3/1.5',                     //  7  Em7
  '-/1 E4/3',                              //  8
  './0.5 G3/2.5 E4/1',                     //  9  Cmaj7
  '-/1.5 A3/2.5',                          // 10
  './0.5 D4/2 F4/1.5',                     // 11  Bm7b5
  '-/1 B3/3',                              // 12
  './0.5 A3/2 C4/1.5',                     // 13  Fmaj7
  './1.5 B3/1 G#3/1.5',                    // 14  E7   takes the G# too
  './1 E4/2 C4/1',                         // 15  Am7  enters with the melody
  './1.5 B3/1.5 ./1',                      // 16  E7sus4
], BPB, 'night counter');

// root then fifth, then a bar of nothing: the silence is half the atmosphere
const BASS = bars([
  'A2/2 E3/2', 'A2/2 ./2',                 //  1-2  Am7
  'F2/2 C3/2', 'F2/2 ./2',                 //  3-4  Fmaj7
  'D2/2 A2/2', 'D2/2 ./2',                 //  5-6  Dm7
  'E2/2 B2/2', 'E2/2 ./2',                 //  7-8  Em7
  'C2/2 G2/2', 'C2/2 ./2',                 //  9-10 Cmaj7
  'B2/2 F3/2', 'B2/2 ./2',                 // 11-12 Bm7b5
  'F2/2 C3/2',                             // 13  Fmaj7
  'E2/2 B2/2',                             // 14  E7
  'A2/2 E3/2',                             // 15  Am7
  'E2/2 B2/2',                             // 16  E7sus4
], BPB, 'night bass');

/* Barely a kit. The chime runs a four-bar pattern so it reads as something in
   the dark rather than as a percussion part. */
const KIT = [
  { inst:'kick',   beats: grid('x . . . . . . . . . . . . . . .', 16, BPB, TOTAL, 'night kick') },
  { inst:'shaker', beats: grid('. . . . . . x . . . . . . . x .', 16, BPB, TOTAL, 'night shaker') },
  { inst:'chime',  beats: grid([
      '. . . . . . . . . . . . . . x .',
      '. . . . . . . . . . . . . . . .',
      '. . . . . . . . . . x . . . . .',
      '. . . . . . . . . . . . . . . .'], 16, BPB, TOTAL, 'night chime') },
  { inst:'rim', fill:true,
    beats: grid('. . . . . . . . x . . . . . . .', 16, BPB, TOTAL, 'night rim') },
];

export const spec = {
  id:'night', name:'Night', key:'A minor', keyPitchClasses:[9,11,0,2,4,5,7,8],
  bpm:88, bpmUp:4, beatsPerBar:BPB, bars:TOTAL, totalBeats:BEATS,
  lead:'legato', chords:CHORDS,
  parts:{ lead:LEAD, counter:COUNTER, bass:BASS },
  drums:KIT.map(k => k.inst + (k.fill ? '+' : '')),
};

/* Balance trim, in dB. The five pieces have very different densities — a
   sparse pond and a wall-to-wall boss fight do not land at the same loudness
   at the same fader — so each carries its own offset and `tools/music.js`
   asserts they end up within 1.5x of each other. A theme change is a mood
   change, not a volume change. */
const MIX = -2.55;

let rig = null, playing = false, level = 1, vol = 0.75;

function build(){
  const T = tone();
  const out = new T.Volume(unitToDb(vol) + MIX);
  const comp = new T.Compressor({ threshold:-20, ratio:2.4, attack:0.02, release:0.3 });
  comp.connect(out);
  out.toDestination();

  /* JCReverb, not Freeverb. Freeverb builds a dozen comb and allpass filters
     and costs 226ms to construct — over half the time `build()` took, on every
     single start, and the player heard that as the music arriving late. This is
     14ms, and the tail is shaped by the filter after it rather than by the
     reverb's own dampening. */
  const verb = new T.JCReverb({ roomSize:0.82, wet:1 });
  const verbLp = new T.Filter(2000, 'lowpass');
  const verbIn = new T.Gain(1);
  verbIn.connect(verb); verb.connect(verbLp); verbLp.connect(comp);
  const send = (node, amt) => { const g = new T.Gain(amt); node.connect(g); g.connect(verbIn); return g; };

  /* Monophonic on purpose: the melody is one line, and a MonoSynth's portamento
     bends between consecutive notes, which is what legato means here. Kept
     small — at 0.1s and up it stops being a lead and starts being a theremin. */
  const lead = new T.MonoSynth({
    oscillator:{ type:'triangle' }, portamento:0.035,
    envelope:{ attack:0.12, decay:0.3, sustain:0.75, release:0.9 },
    filterEnvelope:{ attack:0.2, decay:0.6, sustain:0.5, release:1.2,
                     baseFrequency:400, octaves:2.6 },
    filter:{ type:'lowpass', rolloff:-12, Q:1 },
    volume:-13,
  });
  /* Quiet, and short-tailed. A dotted-quarter delay under a legato melody
     repeats the note you just left ON TOP of the one you moved to, and this
     melody moves by step: at feedback 0.28 / wet 0.22 the F5 of bar 12 was
     still matching the E5 of bar 13 for level, which is the tune fighting its
     own echo. The reverb carries the space; the delay only widens it. */
  const echo = new T.FeedbackDelay({ delayTime:'4n.', feedback:0.16, wet:0.12 });
  lead.connect(echo); echo.connect(comp); send(echo, 0.32);
  // a quiet sine an octave up, so the lead has an edge to find in the reverb
  const air = new T.Synth({
    oscillator:{ type:'sine' },
    envelope:{ attack:0.2, decay:0.4, sustain:0.5, release:1 }, volume:-30,
  });
  air.connect(comp); send(air, 0.5);

  // bowed: a saw with a slow attack and the top rolled well off
  const counter = new T.MonoSynth({
    oscillator:{ type:'sawtooth' }, portamento:0.02,
    envelope:{ attack:0.3, decay:0.4, sustain:0.8, release:1.1 },
    filterEnvelope:{ attack:0.4, decay:0.5, sustain:0.4, release:1,
                     baseFrequency:180, octaves:2.2 },
    filter:{ type:'lowpass', rolloff:-24, Q:1.4 },
    volume:-17,
  });
  counter.connect(comp); send(counter, 0.35);

  const bass = new T.Synth({
    oscillator:{ type:'sine' },
    envelope:{ attack:0.03, decay:0.5, sustain:0.5, release:0.8 }, volume:-9,
  });
  const bLp = new T.Filter(300, 'lowpass');
  bass.connect(bLp); bLp.connect(comp);

  const pad = new T.PolySynth(T.Synth, {
    oscillator:{ type:'fatsawtooth', count:3, spread:34 },
    envelope:{ attack:2.2, decay:1.4, sustain:0.82, release:3.5 },
    volume:-31,
  });
  const wobble = new T.AutoFilter({ frequency:0.05, depth:0.5, baseFrequency:200, octaves:2 });
  const pLp = new T.Filter(820, 'lowpass');
  const chorus = new T.Chorus({ frequency:0.25, delayTime:8, depth:0.8, wet:0.7 });
  pad.connect(wobble); wobble.connect(pLp); pLp.connect(chorus); chorus.connect(comp); send(chorus, 0.6);

  const kick = new T.MembraneSynth({
    pitchDecay:0.06, octaves:4,
    envelope:{ attack:0.002, decay:0.45, sustain:0, release:0.2 }, volume:-15,
  });
  kick.connect(comp);
  const shaker = new T.NoiseSynth({
    noise:{ type:'pink' }, envelope:{ attack:0.002, decay:0.05, sustain:0 }, volume:-30,
  });
  const shHp = new T.Filter(6000, 'highpass');
  shaker.connect(shHp); shHp.connect(comp); send(shHp, 0.3);
  const chime = new T.FMSynth({
    harmonicity:5.1, modulationIndex:11,
    oscillator:{ type:'sine' }, modulation:{ type:'sine' },
    envelope:{ attack:0.002, decay:1.6, sustain:0, release:1.2 },
    modulationEnvelope:{ attack:0.002, decay:0.3, sustain:0, release:0.3 },
    volume:-28,
  });
  chime.connect(comp); send(chime, 0.8);
  const rim = new T.NoiseSynth({
    noise:{ type:'white' }, envelope:{ attack:0.001, decay:0.04, sustain:0 }, volume:-32,
  });
  const rimF = new T.Filter(1600, 'bandpass'); rimF.Q.value = 2.6;
  rim.connect(rimF); rimF.connect(comp); send(rimF, 0.4);

  const hit = { kick:t => kick.triggerAttackRelease('C1', '4n', t),
                shaker:t => shaker.triggerAttackRelease('32n', t),
                chime:t => chime.triggerAttackRelease('E6', '2n', t),
                rim:t => rim.triggerAttackRelease('32n', t) };

  const tr = T.getTransport();
  const P = tr.PPQ;
  const parts = [];
  const loop = p => { p.loop = true; p.loopStart = 0; p.loopEnd = ticks(BEATS, P); parts.push(p); return p; };

  loop(new T.Part((t, e) => {
    lead.triggerAttackRelease(hz(e.n), ticks(e.d * 0.96, P), t);
    air.triggerAttackRelease(hz(e.n + 12), ticks(e.d * 0.9, P), t);
  }, LEAD.map(e => ({ time: ticks(e.b, P), ...e }))));

  loop(new T.Part((t, e) => counter.triggerAttackRelease(hz(e.n), ticks(e.d * 0.96, P), t),
    COUNTER.map(e => ({ time: ticks(e.b, P), ...e }))));
  loop(new T.Part((t, e) => bass.triggerAttackRelease(hz(e.n), ticks(e.d, P), t),
    BASS.map(e => ({ time: ticks(e.b, P), ...e }))));
  // pads change every two bars up to bar 12 and every bar after, so they follow
  // the chord list rather than a fixed grid
  loop(new T.Part((t, e) => pad.triggerAttackRelease(e.pad.map(hz), ticks(e.len * BPB * 0.96, P), t),
    CHORDS.reduce((acc, c, i) => {
      const prev = acc[acc.length - 1];
      if (prev && prev.name === c.name && prev.len < 2) prev.len++;
      else acc.push({ time: ticks(i * BPB, P), pad: c.padMidi, name: c.name, len: 1 });
      return acc;
    }, [])));

  for (const k of KIT)
    loop(new T.Part(t => { if (!k.fill || ramp(level) >= 0.5) hit[k.inst](t); },
      k.beats.map(b => ({ time: ticks(b, P) }))));

  return { out, parts, lfos:[wobble, chorus],
    nodes:[out, comp, verb, verbLp, verbIn, lead, echo, air, counter, bass, bLp, pad,
           wobble, pLp, chorus, kick, shaker, shHp, chime, rim, rimF] };
}

/* Builds the voices on the first call and KEEPS them. Rebuilding cost ~400ms
   of blocked main thread every time the music started — at a level start, with
   the game already busy, that is heard as the music arriving late. Pause and
   resume, and coming back to a biome, now cost nothing. `dispose()` is the
   real teardown. */
export function start({ level: lv = level } = {}){
  const T = tone();
  level = lv;
  // an OfflineContext is already "running" as far as rendering goes, and
  // Tone.start() on one is meaningless — tools/music.js renders through here
  if (!T.getContext().isOffline) T.start();
  if (!rig) rig = build();
  else if (playing) return;
  playing = true;
  for (const l of rig.lfos) l.start();
  const tr = T.getTransport();
  tr.bpm.value = spec.bpm + spec.bpmUp * ramp(level);
  tr.timeSignature = BPB;   // the transport is shared, so each track claims its metre
  tr.position = 0;                 // every piece starts from its own bar one
  for (const p of rig.parts) p.start(0);
  if (tr.state !== 'started') tr.start('+0.05');
}

/** Build the voices without playing. The first build of a track costs a few
    hundred ms of blocked main thread; doing it while a menu is up means the
    player never waits for it. Safe before any user gesture — constructing Tone
    nodes does not need one, only starting audio does. */
export function warm(){
  if (!rig) rig = build();
}

/* `keepTransport` is for a theme change. Tone's transport is global and shared,
   and stopping it here only for the next track to start it again in the same
   tick makes it recompute an offset that lands a hair below zero — Tone then
   throws ("Value must be within [0, Infinity]", "Start time must be strictly
   greater than previous"). Leaving it running and letting the incoming track
   seek to 0 is both correct and quieter: no track restarts the clock, it just
   takes it over. A caller stopping the music for real gets the clock stopped.

   The voices are left built — see start(). */
export function stop({ keepTransport = false } = {}){
  if (!rig || !playing) return;
  playing = false;
  const T = tone();
  for (const p of rig.parts) p.stop();
  for (const l of rig.lfos) l.stop();
  if (!keepTransport) T.getTransport().stop();
}

/** Tear the voices down for real. The game never needs this — it is for a host
    that is finished with the track, and for the offline renderer, which builds
    into a context that lives only for the length of one render. */
export function dispose(){
  if (!rig) return;
  stop();
  for (const p of rig.parts) p.dispose();
  for (const n of rig.nodes) n.dispose();
  rig = null;
}

export function setVolume(v){
  vol = Math.max(0, Math.min(1, v));
  if (rig) rig.out.volume.rampTo(unitToDb(vol) + MIX, 0.08);
}

export function setLevel(n){
  level = n;
  if (rig) tone().getTransport().bpm.rampTo(spec.bpm + spec.bpmUp * ramp(level), 1.5);
}
