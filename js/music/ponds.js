/* =======================================================================
   LILYPAD PONDS — "dreamy, floaty, relaxed"

   Key      D Lydian (D E F# G# A B C#) — the G# is the raised 4th, and it is
            the whole reason this does not sound like plain D major
   Tempo    76 BPM, 4/4, creeping to 80 across the biome's ten levels
   Form     16 bars, one chord every TWO bars, then it loops (~50s)
   Voices   bell lead, soft glass counter-line, sub bass, wide pad,
            and a kit of a soft kick, a rim, water drips and a shaker

   HARMONY — slow, one chord per two bars, so nothing feels hurried:

     1-2   Dmaj9     9-10  G#m7b5
     3-4   E/D      11-12  F#m7
     5-6   Bm11     13-14  Emaj9
     7-8   Amaj9    15-16  A6/9

   The E major in bars 3-4 over a held D bass is the Lydian sound in one
   gesture; the G#m7b5 in 9-10 is the raised 4th turned into a chord of its
   own, which is where the piece floats furthest from home. Nothing resolves
   hard — A6/9 back to Dmaj9 is a settle, not a cadence.

   MELODY — long notes, tied across barlines, and a rest in almost every bar.
   Sparse is the texture: at 76 BPM there is room for the reverb to be part of
   the arrangement rather than a coat of paint over it.

   COUNTER-MELODY — under the bells, moving about half as often, and written so
   every entry lands on a beat the melody leaves empty. It is one long descent
   from D4 down to G#3 and back, which is slow enough that you hear it as the
   water rather than as a second tune.
   ======================================================================= */
import { bars, grid, hz, midi, ticks, unitToDb, tone, ramp } from './lib.js';

const BPB = 4, TOTAL = 16, BEATS = BPB * TOTAL;

/* Each chord is written twice because it lasts two bars — the harness reads
   this array as one entry per bar, and so does the pad part. */
const CH = (name, bass, pad) => [{ name, bass, pad }, { name, bass, pad }];
const CHORDS = [
  ...CH('Dmaj9',   'D2',  ['F#3','A3','C#4','E4']),   //  1-2  home
  ...CH('E/D',     'D2',  ['G#3','B3','E4','F#4']),   //  3-4  II over a D pedal
  ...CH('Bm11',    'B2',  ['F#3','A3','B3','E4']),    //  5-6
  ...CH('Amaj9',   'A2',  ['C#4','E4','B4']),         //  7-8
  ...CH('G#m7b5',  'G#2', ['B3','D4','F#4','G#4']),   //  9-10 the #4 as a chord
  ...CH('F#m7',    'F#2', ['A3','C#4','E4','F#4']),   // 11-12
  ...CH('Emaj9',   'E2',  ['G#3','B3','E4','F#4']),   // 13-14
  ...CH('A6/9',    'A2',  ['C#4','E4','F#4','B4']),   // 15-16 settles, never cadences
].map(c => ({ ...c, bassMidi: midi(c.bass), padMidi: c.pad.map(midi) }));

const LEAD = bars([
  './1 F#5/1 A5/2',                        //  1  Dmaj9
  '-/1 E5/1.5 ./1.5',                      //  2         the A rings over the bar
  './0.5 G#5/1.5 F#5/2',                   //  3  E/D    the Lydian G#, up front
  '-/1 B5/2 ./1',                          //  4
  './1 A5/1 F#5/2',                        //  5  Bm11
  '-/1.5 D5/1.5 E5/1',                     //  6
  '-/1 C#6/2 ./1',                         //  7  Amaj9  highest point so far
  './1 B5/1 A5/2',                         //  8
  '-/2 F#5/2',                             //  9  G#m7b5 furthest from home
  '-/1 D5/1 B5/2',                         // 10
  './1 C#6/1 A5/2',                        // 11  F#m7
  '-/1.5 E5/1.5 ./1',                      // 12
  './0.5 B5/1.5 G#5/2',                    // 13  Emaj9
  '-/1 F#5/1 E5/2',                        // 14
  '-/1 C#6/1 E6/2',                        // 15  A6/9   the top note
  '-/1 B5/1 A5/2',                         // 16         settles back
], BPB, 'ponds lead');

/* Half the melody's rate, a fifth below it, and every entry on a beat the
   melody leaves empty — see the per-bar arithmetic in the header. */
const COUNTER = bars([
  './4', './4',                            //  1-2  bells alone
  'D4/3 F#4/1',                            //  3  E/D
  '-/2 E4/2',                              //  4
  '-/1.5 D4/2.5',                          //  5  Bm11
  '-/2.5 B3/1.5',                          //  6
  '-/1.5 F#4/2.5',                         //  7  Amaj9
  '-/2.5 E4/1.5',                          //  8
  '-/1 B3/3',                              //  9  G#m7b5
  '-/2.5 D4/1.5',                          // 10
  '-/1.5 A3/2.5',                          // 11  F#m7   bottom of the descent
  '-/2.5 C#4/1.5',                         // 12
  '-/1 B3/3',                              // 13  Emaj9
  '-/2.5 G#3/1.5',                         // 14
  '-/1.5 C#4/2.5',                         // 15  A6/9   climbing back
  '-/2.5 E4/1.5',                          // 16
], BPB, 'ponds counter');

// roots, long and low, with a bar's worth of silence under every second chord
const BASS = bars([
  'D2/3 ./1',   'A2/2 ./2',                //  1-2  Dmaj9
  'D2/3 ./1',   'F#2/2 ./2',               //  3-4  E/D — the pedal holds
  'B2/3 ./1',   'F#2/2 ./2',               //  5-6  Bm11
  'A2/3 ./1',   'E2/2 ./2',                //  7-8  Amaj9
  'G#2/3 ./1',  'D2/2 ./2',                //  9-10 G#m7b5
  'F#2/3 ./1',  'C#3/2 ./2',               // 11-12 F#m7
  'E2/3 ./1',   'B2/2 ./2',                // 13-14 Emaj9
  'A2/3 ./1',   'E2/2 ./2',                // 15-16 A6/9
], BPB, 'ponds bass');

/* The drips are a four-bar pattern rather than a one-bar one: a drip that
   lands in the same place every bar is a hi-hat. */
const KIT = [
  { inst:'kick', beats: grid('x . . . . . . . . . . . . . . .', 16, BPB, TOTAL, 'ponds kick') },
  { inst:'rim',  beats: grid('. . . . . . . . x . . . . . . .', 16, BPB, TOTAL, 'ponds rim') },
  { inst:'drip', beats: grid([
      '. . . . . . x . . . . . . . . .',
      '. . . . . . . . . . x . . . . .',
      '. . . x . . . . . . . . . . x .',
      '. . . . . . . . . x . . . . . .'], 16, BPB, TOTAL, 'ponds drip') },
  { inst:'shaker', fill:true,
    beats: grid('. . x . . . x . . . x . . . x .', 16, BPB, TOTAL, 'ponds shaker') },
];

export const spec = {
  id:'ponds', name:'Lilypad Ponds', key:'D Lydian', keyPitchClasses:[2,4,6,8,9,11,1],
  bpm:76, bpmUp:4, beatsPerBar:BPB, bars:TOTAL, totalBeats:BEATS,
  lead:'bell', chords:CHORDS,
  parts:{ lead:LEAD, counter:COUNTER, bass:BASS },
  drums:KIT.map(k => k.inst + (k.fill ? '+' : '')),
};

/* Balance trim, in dB. The five pieces have very different densities — a
   sparse pond and a wall-to-wall boss fight do not land at the same loudness
   at the same fader — so each carries its own offset and `tools/music.js`
   asserts they end up within 1.5x of each other. A theme change is a mood
   change, not a volume change. */
const MIX = 1.2;

let rig = null, level = 1, vol = 0.75;

function build(){
  const T = tone();
  const out = new T.Volume(unitToDb(vol) + MIX);
  const comp = new T.Compressor({ threshold:-18, ratio:2.6, attack:0.01, release:0.25 });
  comp.connect(out);
  out.toDestination();

  // the reverb is the room this piece is played in, so it is long and it is fed
  // by everything except the bass, which only muddies it
  const verb = new T.Freeverb({ roomSize:0.9, dampening:1800, wet:1 });
  const verbIn = new T.Gain(1);
  verbIn.connect(verb); verb.connect(comp);
  const send = (node, amt) => { const g = new T.Gain(amt); node.connect(g); g.connect(verbIn); return g; };

  /* FM at a near-3:1 ratio with a short envelope on the modulator is a struck
     bar — kalimba at low index, glass bell as it rises. The inharmonic ratio
     (3.01, not 3) is what stops it ringing like a test tone. */
  const lead = new T.PolySynth(T.FMSynth, {
    harmonicity:3.01, modulationIndex:6.5,
    oscillator:{ type:'sine' }, modulation:{ type:'sine' },
    envelope:{ attack:0.004, decay:1.1, sustain:0.12, release:1.6 },
    modulationEnvelope:{ attack:0.002, decay:0.28, sustain:0, release:0.3 },
    volume:-11,
  });
  /* A dotted-eighth delay against a 4/4 melody is the classic "water" trick:
     the repeats land between the notes rather than under them. */
  const echo = new T.PingPongDelay({ delayTime:'8n.', feedback:0.32, wet:0.28 });
  lead.connect(echo); echo.connect(comp); send(echo, 0.5);

  const counter = new T.PolySynth(T.AMSynth, {
    harmonicity:2, oscillator:{ type:'sine' }, modulation:{ type:'triangle' },
    envelope:{ attack:0.35, decay:0.5, sustain:0.6, release:1.8 },
    volume:-19,
  });
  const cLp = new T.Filter(1500, 'lowpass');
  counter.connect(cLp); cLp.connect(comp); send(cLp, 0.4);

  // a sine sub with a long tail: the bottom of the pond, felt more than heard
  const bass = new T.Synth({
    oscillator:{ type:'sine' },
    envelope:{ attack:0.06, decay:0.6, sustain:0.45, release:1.2 },
    volume:-8,
  });
  const bLp = new T.Filter(320, 'lowpass');
  bass.connect(bLp); bLp.connect(comp);

  /* Dark on purpose (CLAUDE.md: a bright pad buries the tune). The slow
     auto-filter is where the drift comes from — a static pad under a sparse
     melody just sits there. */
  const pad = new T.PolySynth(T.Synth, {
    oscillator:{ type:'fatsawtooth', count:3, spread:26 },
    envelope:{ attack:1.6, decay:1, sustain:0.8, release:3 },
    volume:-30,
  });
  const wobble = new T.AutoFilter({ frequency:0.07, depth:0.55, baseFrequency:260, octaves:2.2 }).start();
  const pLp = new T.Filter(1100, 'lowpass');
  const chorus = new T.Chorus({ frequency:0.35, delayTime:6, depth:0.7, wet:0.6 }).start();
  pad.connect(wobble); wobble.connect(pLp); pLp.connect(chorus); chorus.connect(comp); send(chorus, 0.55);

  const kick = new T.MembraneSynth({
    pitchDecay:0.05, octaves:4,
    envelope:{ attack:0.002, decay:0.4, sustain:0, release:0.2 }, volume:-16,
  });
  kick.connect(comp);
  const rim = new T.NoiseSynth({
    noise:{ type:'pink' }, envelope:{ attack:0.001, decay:0.05, sustain:0 }, volume:-30,
  });
  const rimF = new T.Filter(1400, 'bandpass'); rimF.Q.value = 2.4;
  rim.connect(rimF); rimF.connect(comp); send(rimF, 0.4);
  /* A drip is a very short, very fast downward pitch sweep — the fall is what
     makes it a drop of water rather than a beep. MembraneSynth's pitchDecay is
     exactly that sweep, so it is the drip, tuned three octaves up. */
  const drip = new T.MembraneSynth({
    pitchDecay:0.012, octaves:3.5,
    envelope:{ attack:0.001, decay:0.13, sustain:0, release:0.05 }, volume:-24,
  });
  const dripF = new T.Filter(2600, 'bandpass'); dripF.Q.value = 1.2;
  drip.connect(dripF); dripF.connect(comp); send(dripF, 0.7);
  const shaker = new T.NoiseSynth({
    noise:{ type:'white' }, envelope:{ attack:0.002, decay:0.045, sustain:0 }, volume:-34,
  });
  const shHp = new T.Filter(7000, 'highpass');
  shaker.connect(shHp); shHp.connect(comp); send(shHp, 0.25);

  const hit = { kick:t => kick.triggerAttackRelease('C1', '8n', t),
                rim:t => rim.triggerAttackRelease('32n', t),
                drip:t => drip.triggerAttackRelease('A4', '32n', t),
                shaker:t => shaker.triggerAttackRelease('32n', t) };

  const tr = T.getTransport();
  const P = tr.PPQ;
  const parts = [];
  const loop = p => { p.loop = true; p.loopStart = 0; p.loopEnd = ticks(BEATS, P); parts.push(p); return p; };

  loop(new T.Part((t, e) => lead.triggerAttackRelease(hz(e.n), ticks(e.d * 0.9, P), t),
    LEAD.map(e => ({ time: ticks(e.b, P), ...e }))));
  loop(new T.Part((t, e) => counter.triggerAttackRelease(hz(e.n), ticks(e.d * 0.95, P), t),
    COUNTER.map(e => ({ time: ticks(e.b, P), ...e }))));
  loop(new T.Part((t, e) => bass.triggerAttackRelease(hz(e.n), ticks(e.d, P), t),
    BASS.map(e => ({ time: ticks(e.b, P), ...e }))));
  // the pad changes every two bars, so it is triggered off the chord list
  loop(new T.Part((t, e) => pad.triggerAttackRelease(e.pad.map(hz), ticks(BPB * 2 * 0.96, P), t),
    CHORDS.filter((_, i) => i % 2 === 0)
          .map((c, i) => ({ time: ticks(i * BPB * 2, P), pad: c.padMidi }))));

  for (const k of KIT)
    loop(new T.Part(t => { if (!k.fill || ramp(level) >= 0.5) hit[k.inst](t); },
      k.beats.map(b => ({ time: ticks(b, P) }))));

  // an octave of shimmer over the bells for the last stretch of the biome
  loop(new T.Part((t, e) => {
    if (ramp(level) < 0.8) return;
    lead.triggerAttackRelease(hz(e.n + 12), ticks(e.d * 0.5, P), t + 0.02, 0.14);
  }, LEAD.map(e => ({ time: ticks(e.b, P), ...e }))));

  return { out, parts,
    nodes:[out, comp, verb, verbIn, lead, echo, counter, cLp, bass, bLp, pad,
           wobble, pLp, chorus, kick, rim, rimF, drip, dripF, shaker, shHp] };
}

export function start({ level: lv = level } = {}){
  if (rig) return;
  const T = tone();
  level = lv;
  if (!T.getContext().isOffline) T.start();
  rig = build();
  const tr = T.getTransport();
  tr.bpm.value = spec.bpm + spec.bpmUp * ramp(level);
  tr.timeSignature = BPB;   // the transport is shared, so each track claims its metre
  tr.position = 0;                 // every piece starts from its own bar one
  for (const p of rig.parts) p.start(0);
  if (tr.state !== 'started') tr.start('+0.05');
}

/* `keepTransport` is for a theme change. Tone's transport is global and shared,
   and stopping it here only for the next track to start it again in the same
   tick makes it recompute an offset that lands a hair below zero — Tone then
   throws ("Value must be within [0, Infinity]", "Start time must be strictly
   greater than previous"). Leaving it running and letting the incoming track
   seek to 0 is both correct and quieter: no track restarts the clock, it just
   takes it over. A caller stopping the music for real gets the clock stopped. */
export function stop({ keepTransport = false } = {}){
  if (!rig) return;
  const T = tone();
  for (const p of rig.parts){ p.stop(); p.dispose(); }
  if (!keepTransport) T.getTransport().stop();
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
