/* =======================================================================
   HELL — "boss fight, but it is a capybara"

   Key      D harmonic minor (D E F G A Bb C#), with one guest: the Eb of the
            Neapolitan in bar 10
   Tempo    168 BPM in 6/8 — so three quarter-beats to the bar, two groups of
            three eighths, a gallop. Creeps to 176 across the biome's levels.
   Form     24 bars, then it loops (~26s). 16 would be short at this tempo.
   Voices   overdriven organ lead, brass stabs, a growling bass, a dark reed
            pad, and a kit that never lets up

   6/8 is the joke and the drive at once: it is the metre of a chase, and it is
   the only track here not in four, which is what makes the biome change land.

   HARMONY — the harmonic minor's own augmented second (Bb to C#) is both the
   spooky interval and the funny one, so most of the drama is already in the
   key. The diminished chords are diatonic to it; only the Eb is an outsider.

      1  Dm    2  Dm     3  Gm     4  A7
      5  Dm    6  Bb     7  C#dim7 8  A7
      9  Dm   10  Eb    11  Gm    12  Edim7      <- Eb is the Neapolitan, bII
     13  A7   14  A7    15  Dm    16  Dm
     17  Bb   18  Gm    19  C#dim7 20 Dm
     21  Gm   22  C#dim7 23 Dm    24  A7

   Bars 9-14 are the set piece: Dm to Eb is a semitone shove upwards that has
   no business being there, and the Edim7 four bars later walks it back into
   the A7. C#dim7 (C# E G Bb) is two tritones stacked and is entirely in key.

   MELODY — a gallop riff, but every bar ends in a rest. That rest is what the
   brass answers into, and it is why this reads as call-and-response rather
   than as a wall.

   COUNTER-MELODY — two-note brass stabs on the last beat of the bar, in the
   hole the lead leaves. Bar 16 is the exception: the lead drops out for a bar
   and a half and the brass takes the bar on its own.
   ======================================================================= */
import { bars, grid, hz, midi, ticks, unitToDb, tone, ramp } from './lib.js';

const BPB = 3, TOTAL = 24, BEATS = BPB * TOTAL;    // 6/8: three quarter-beats

const V = {
  Dm:      ['D4','F4','A4'],
  Gm:      ['D4','G4','Bb4'],
  A7:      ['C#4','E4','G4'],
  Bb:      ['D4','F4','Bb4'],
  Cdim:    ['E4','G4','Bb4'],           // C#dim7, rootless — the bass has the C#
  Eb:      ['Eb4','G4','Bb4'],
  Edim:    ['E4','G4','Bb4','Db5'],
};
const CHORDS = [
  { name:'Dm',      bass:'D2',  pad:V.Dm   },   //  1
  { name:'Dm',      bass:'D2',  pad:V.Dm   },   //  2
  { name:'Gm',      bass:'G2',  pad:V.Gm   },   //  3
  { name:'A7',      bass:'A2',  pad:V.A7   },   //  4
  { name:'Dm',      bass:'D2',  pad:V.Dm   },   //  5
  { name:'Bb',      bass:'Bb2', pad:V.Bb   },   //  6
  { name:'C#dim7',  bass:'C#3', pad:V.Cdim },   //  7
  { name:'A7',      bass:'A2',  pad:V.A7   },   //  8
  { name:'Dm',      bass:'D2',  pad:V.Dm   },   //  9
  { name:'Eb',      bass:'Eb3', pad:V.Eb   },   // 10  the Neapolitan
  { name:'Gm',      bass:'G2',  pad:V.Gm   },   // 11
  { name:'Edim7',   bass:'E2',  pad:V.Edim },   // 12
  { name:'A7',      bass:'A2',  pad:V.A7   },   // 13
  { name:'A7',      bass:'A2',  pad:V.A7   },   // 14
  { name:'Dm',      bass:'D2',  pad:V.Dm   },   // 15
  { name:'Dm',      bass:'D2',  pad:V.Dm   },   // 16
  { name:'Bb',      bass:'Bb2', pad:V.Bb   },   // 17
  { name:'Gm',      bass:'G2',  pad:V.Gm   },   // 18
  { name:'C#dim7',  bass:'C#3', pad:V.Cdim },   // 19
  { name:'Dm',      bass:'D2',  pad:V.Dm   },   // 20
  { name:'Gm',      bass:'G2',  pad:V.Gm   },   // 21
  { name:'C#dim7',  bass:'C#3', pad:V.Cdim },   // 22
  { name:'Dm',      bass:'D2',  pad:V.Dm   },   // 23
  { name:'A7',      bass:'A2',  pad:V.A7   },   // 24  turnaround
].map(c => ({ ...c, bassMidi: midi(c.bass), padMidi: c.pad.map(midi) }));

/* The `./0.25 X/0.25` figure is a stutter on the repeated note — the gallop's
   kick. Every bar ends in a rest, which is where the brass answers. */
const LEAD = bars([
  'D5/0.5 ./0.25 D5/0.25 F5/0.5 A5/1 ./0.5',    //  1  Dm   the riff
  'A5/0.5 ./0.25 A5/0.25 D6/0.5 A5/1 ./0.5',    //  2  Dm
  'Bb5/0.5 A5/0.5 G5/0.5 Bb5/1 ./0.5',          //  3  Gm
  'A5/0.5 C#6/0.5 E6/1 ./1',                    //  4  A7   up to the leading tone
  'D5/0.5 ./0.25 D5/0.25 F5/0.5 A5/1 ./0.5',    //  5  Dm
  'Bb5/0.5 ./0.25 Bb5/0.25 D6/0.5 F6/1 ./0.5',  //  6  Bb
  'E6/0.5 Db6/0.5 Bb5/0.5 G5/1 ./0.5',          //  7  C#dim7  down the diminished
  'A5/0.5 C#6/0.5 A5/0.5 E5/1 ./0.5',           //  8  A7
  'D6/0.5 ./0.25 D6/0.25 A5/0.5 F5/1 ./0.5',    //  9  Dm
  'Eb6/0.5 D6/0.5 Bb5/0.5 G5/1 ./0.5',          // 10  Eb   the shove upwards
  'G5/0.5 Bb5/0.5 D6/1 Bb5/0.5 ./0.5',          // 11  Gm
  'E6/0.5 Db6/0.5 Bb5/0.5 G5/0.5 E5/1',         // 12  Edim7  and back down
  'A5/0.5 ./0.25 A5/0.25 C#6/0.5 E6/1 ./0.5',   // 13  A7
  'E6/0.5 C#6/0.5 A5/0.5 G5/1 ./0.5',           // 14  A7
  'F5/0.5 A5/0.5 D6/1 A5/0.5 ./0.5',            // 15  Dm
  'D6/1.5 ./1.5',                               // 16  Dm   stops dead
  'F6/0.5 D6/0.5 Bb5/0.5 D6/1 ./0.5',           // 17  Bb   second half, higher
  'D6/0.5 Bb5/0.5 G5/0.5 Bb5/1 ./0.5',          // 18  Gm
  'Bb5/0.5 G5/0.5 E5/0.5 Db6/1 ./0.5',          // 19  C#dim7
  'D6/0.5 A5/0.5 F5/0.5 D5/1 ./0.5',            // 20  Dm
  'G5/0.5 Bb5/0.5 D6/0.5 F6/1 ./0.5',           // 21  Gm   the climb
  'E6/0.5 Db6/0.5 Bb5/0.5 G5/1 ./0.5',          // 22  C#dim7
  'F6/0.5 E6/0.5 D6/0.5 A5/1 ./0.5',            // 23  Dm
  'C#6/0.5 E6/0.5 C#6/0.5 A5/1 ./0.5',          // 24  A7   and round again
], BPB, 'hell lead');

const COUNTER = bars([
  './3', './3',                                 //  1-2  riff alone
  './2 D4/0.5 G4/0.5',                          //  3  Gm
  './2 C#4/0.5 E4/0.5',                         //  4  A7
  './2 D4/0.5 F4/0.5',                          //  5  Dm
  './2 Bb3/0.5 D4/0.5',                         //  6  Bb
  './2 G4/0.5 Bb4/0.5',                         //  7  C#dim7
  './2 E4/0.5 C#4/0.5',                         //  8  A7
  './2 A4/0.5 F4/0.5',                          //  9  Dm
  './2 Bb4/0.5 G4/0.5',                         // 10  Eb
  './2.5 D5/0.5',                               // 11  Gm     one stab only
  './2.5 C#5/0.5',                              // 12  Edim7
  './2 E4/0.5 G4/0.5',                          // 13  A7
  './2 C#4/0.5 A3/0.5',                         // 14  A7
  './2.5 A4/0.5',                               // 15  Dm
  './1.5 D4/0.5 F4/0.5 A4/0.5',                 // 16  Dm     the brass takes it
  './2 F4/0.5 D4/0.5',                          // 17  Bb
  './2 Bb3/0.5 D4/0.5',                         // 18  Gm
  './2 G4/0.5 E4/0.5',                          // 19  C#dim7
  './2 A3/0.5 D4/0.5',                          // 20  Dm
  './2 D4/0.5 G4/0.5',                          // 21  Gm
  './2 Bb4/0.5 G4/0.5',                         // 22  C#dim7
  './2 A4/0.5 D5/0.5',                          // 23  Dm
  './2 G4/0.5 E4/0.5',                          // 24  A7
], BPB, 'hell counter');

/* Root, stutter, fifth, root, fifth, rest. The rest on the last eighth is what
   keeps it a gallop instead of a drone. */
const BASS = bars([
  'D2/0.5 ./0.25 D2/0.25 A2/0.5 D2/0.5 A2/0.5 ./0.5',        //  1  Dm
  'D2/0.5 ./0.25 D2/0.25 A2/0.5 D2/0.5 A2/0.5 ./0.5',        //  2
  'G2/0.5 ./0.25 G2/0.25 D3/0.5 G2/0.5 D3/0.5 ./0.5',        //  3  Gm
  'A2/0.5 ./0.25 A2/0.25 E3/0.5 A2/0.5 E3/0.5 ./0.5',        //  4  A7
  'D2/0.5 ./0.25 D2/0.25 A2/0.5 D2/0.5 A2/0.5 ./0.5',        //  5  Dm
  'Bb2/0.5 ./0.25 Bb2/0.25 F3/0.5 Bb2/0.5 F3/0.5 ./0.5',     //  6  Bb
  'C#3/0.5 ./0.25 C#3/0.25 G3/0.5 C#3/0.5 G3/0.5 ./0.5',     //  7  C#dim7
  'A2/0.5 ./0.25 A2/0.25 E3/0.5 A2/0.5 E3/0.5 ./0.5',        //  8  A7
  'D2/0.5 ./0.25 D2/0.25 A2/0.5 D2/0.5 A2/0.5 ./0.5',        //  9  Dm
  'Eb3/0.5 ./0.25 Eb3/0.25 Bb3/0.5 Eb3/0.5 Bb3/0.5 ./0.5',   // 10  Eb
  'G2/0.5 ./0.25 G2/0.25 D3/0.5 G2/0.5 D3/0.5 ./0.5',        // 11  Gm
  'E2/0.5 ./0.25 E2/0.25 Bb2/0.5 E2/0.5 Bb2/0.5 ./0.5',      // 12  Edim7
  'A2/0.5 ./0.25 A2/0.25 E3/0.5 A2/0.5 E3/0.5 ./0.5',        // 13  A7
  'A2/0.5 ./0.25 A2/0.25 E3/0.5 A2/0.5 E3/0.5 ./0.5',        // 14  A7
  'D2/0.5 ./0.25 D2/0.25 A2/0.5 D2/0.5 A2/0.5 ./0.5',        // 15  Dm
  'D2/0.5 ./0.25 D2/0.25 A2/0.5 D3/0.5 A2/0.5 ./0.5',        // 16  Dm
  'Bb2/0.5 ./0.25 Bb2/0.25 F3/0.5 Bb2/0.5 F3/0.5 ./0.5',     // 17  Bb
  'G2/0.5 ./0.25 G2/0.25 D3/0.5 G2/0.5 D3/0.5 ./0.5',        // 18  Gm
  'C#3/0.5 ./0.25 C#3/0.25 G3/0.5 C#3/0.5 G3/0.5 ./0.5',     // 19  C#dim7
  'D2/0.5 ./0.25 D2/0.25 A2/0.5 D2/0.5 A2/0.5 ./0.5',        // 20  Dm
  'G2/0.5 ./0.25 G2/0.25 D3/0.5 G2/0.5 D3/0.5 ./0.5',        // 21  Gm
  'C#3/0.5 ./0.25 C#3/0.25 G3/0.5 C#3/0.5 G3/0.5 ./0.5',     // 22  C#dim7
  'D2/0.5 ./0.25 D2/0.25 A2/0.5 D2/0.5 A2/0.5 ./0.5',        // 23  Dm
  'A2/0.5 ./0.25 A2/0.25 E3/0.5 A2/0.5 C#3/0.5 ./0.5',       // 24  A7  leads home
], BPB, 'hell bass');

/* Twelve sixteenths to the 6/8 bar. The tambourine on all six eighths is the
   thing that never stops; the crash runs an eight-bar pattern so it marks the
   form rather than the bar. */
const KIT = [
  { inst:'kick',  beats: grid('x . . . . . x . . x . .', 12, BPB, TOTAL, 'hell kick') },
  { inst:'snare', beats: grid('. . . . . . x . . . . .', 12, BPB, TOTAL, 'hell snare') },
  { inst:'tamb',  beats: grid('x . x . x . x . x . x .', 12, BPB, TOTAL, 'hell tamb') },
  { inst:'crash', beats: grid([
      'x . . . . . . . . . . .', '. . . . . . . . . . . .',
      '. . . . . . . . . . . .', '. . . . . . . . . . . .',
      '. . . . . . . . . . . .', '. . . . . . . . . . . .',
      '. . . . . . . . . . . .', '. . . . . . . . . . . .'], 12, BPB, TOTAL, 'hell crash') },
  { inst:'tom', fill:true,
    beats: grid('. . . x . . . . . x . .', 12, BPB, TOTAL, 'hell tom') },
];

export const spec = {
  id:'hell', name:'Hell', key:'D harmonic minor',
  keyPitchClasses:[2,4,5,7,9,10,1,3],           // + Eb, the Neapolitan
  bpm:168, bpmUp:8, beatsPerBar:BPB, bars:TOTAL, totalBeats:BEATS,
  lead:'organ', chords:CHORDS,
  parts:{ lead:LEAD, counter:COUNTER, bass:BASS },
  drums:KIT.map(k => k.inst + (k.fill ? '+' : '')),
};

/* Balance trim, in dB. The five pieces have very different densities — a
   sparse pond and a wall-to-wall boss fight do not land at the same loudness
   at the same fader — so each carries its own offset and `tools/music.js`
   asserts they end up within 1.5x of each other. A theme change is a mood
   change, not a volume change. */
const MIX = 1.8;

let rig = null, level = 1, vol = 0.75;

function build(){
  const T = tone();
  const out = new T.Volume(unitToDb(vol) + MIX);
  const comp = new T.Compressor({ threshold:-15, ratio:4, attack:0.003, release:0.09 });
  comp.connect(out);
  out.toDestination();

  const verb = new T.Freeverb({ roomSize:0.55, dampening:3000, wet:1 });
  const verbIn = new T.Gain(1);
  verbIn.connect(verb); verb.connect(comp);
  const send = (node, amt) => { const g = new T.Gain(amt); node.connect(g); g.connect(verbIn); return g; };

  /* An overdriven organ. The lowpass sits AFTER the distortion on purpose:
     distortion generates harmonics above whatever you feed it, so filtering
     first just makes a duller thing to distort. */
  const lead = new T.PolySynth(T.Synth, {
    oscillator:{ type:'fatsawtooth', count:2, spread:14 },
    envelope:{ attack:0.006, decay:0.12, sustain:0.6, release:0.1 },
    volume:-19,
  });
  const grit = new T.Distortion(0.42); grit.wet.value = 0.55;
  const lLp = new T.Filter(3400, 'lowpass'); lLp.Q.value = 0.7;
  lead.connect(grit); grit.connect(lLp); lLp.connect(comp); send(lLp, 0.16);

  // brass stabs: a saw with a hard attack and a fast close
  const counter = new T.PolySynth(T.Synth, {
    oscillator:{ type:'sawtooth' },
    envelope:{ attack:0.012, decay:0.16, sustain:0.35, release:0.12 },
    volume:-20,
  });
  const cLp = new T.Filter(1900, 'lowpass'); cLp.Q.value = 1.2;
  counter.connect(cLp); cLp.connect(comp); send(cLp, 0.2);

  /* 240Hz, and this is load-bearing (CLAUDE.md has the long version): a saw
     bass on A2 opened up puts its sixth harmonic at ~660Hz, a semitone under
     the melody's F5, and it buzzes over the tune on every gallop. An oompah
     bass at this tempo wants weight, not harmonics. */
  const bass = new T.MonoSynth({
    oscillator:{ type:'sawtooth' },
    envelope:{ attack:0.004, decay:0.12, sustain:0.4, release:0.05 },
    filterEnvelope:{ attack:0.002, decay:0.07, sustain:0.3, release:0.04,
                     baseFrequency:90, octaves:1.4, exponent:2 },
    filter:{ type:'lowpass', rolloff:-24, Q:1.6 },
    volume:-11,
  });
  const bLp = new T.Filter(240, 'lowpass');
  bass.connect(bLp); bLp.connect(comp);

  /* Triangle, not sawtooth, and cut at 520Hz — the same lesson as the bass. A
     saw pad's third harmonic is a third of its fundamental, and this pad is
     voiced around D4, which put a strong tone a semitone under the melody. A
     triangle's third partial is a ninth of the fundamental, ~10dB down; the
     darkness comes from the cutoff, not from the waveform. */
  const pad = new T.PolySynth(T.Synth, {
    oscillator:{ type:'triangle' },
    envelope:{ attack:0.08, decay:0.3, sustain:0.7, release:0.4 },
    volume:-24,
  });
  const pLp = new T.Filter(520, 'lowpass');
  pad.connect(pLp); pLp.connect(comp);

  const kick = new T.MembraneSynth({
    pitchDecay:0.024, octaves:6,
    envelope:{ attack:0.001, decay:0.2, sustain:0, release:0.05 }, volume:-8,
  });
  kick.connect(comp);
  const snare = new T.NoiseSynth({
    noise:{ type:'white' }, envelope:{ attack:0.001, decay:0.12, sustain:0 }, volume:-17,
  });
  const snF = new T.Filter(2000, 'bandpass'); snF.Q.value = 0.9;
  snare.connect(snF); snF.connect(comp); send(snF, 0.22);
  const tamb = new T.MetalSynth({
    envelope:{ attack:0.001, decay:0.09, release:0.02 },
    harmonicity:4.6, modulationIndex:26, resonance:5000, octaves:1.3, volume:-33,
  });
  tamb.connect(comp);
  const crash = new T.MetalSynth({
    envelope:{ attack:0.001, decay:1.4, release:0.4 },
    harmonicity:6.2, modulationIndex:38, resonance:3800, octaves:2.2, volume:-30,
  });
  crash.connect(comp); send(crash, 0.5);
  const tom = new T.MembraneSynth({
    pitchDecay:0.05, octaves:3,
    envelope:{ attack:0.002, decay:0.16, sustain:0, release:0.04 }, volume:-19,
  });
  tom.connect(comp);

  const hit = { kick:t => kick.triggerAttackRelease('C1', '32n', t),
                snare:t => snare.triggerAttackRelease('16n', t),
                tamb:t => tamb.triggerAttackRelease('64n', t),
                crash:t => crash.triggerAttackRelease('2n', t),
                tom:t => tom.triggerAttackRelease('G2', '32n', t) };

  const tr = T.getTransport();
  const P = tr.PPQ;
  const parts = [];
  const loop = p => { p.loop = true; p.loopStart = 0; p.loopEnd = ticks(BEATS, P); parts.push(p); return p; };

  loop(new T.Part((t, e) => lead.triggerAttackRelease(hz(e.n), ticks(e.d * 0.9, P), t),
    LEAD.map(e => ({ time: ticks(e.b, P), ...e }))));
  loop(new T.Part((t, e) => counter.triggerAttackRelease(hz(e.n), ticks(e.d * 0.85, P), t),
    COUNTER.map(e => ({ time: ticks(e.b, P), ...e }))));
  loop(new T.Part((t, e) => bass.triggerAttackRelease(hz(e.n), ticks(e.d * 0.9, P), t),
    BASS.map(e => ({ time: ticks(e.b, P), ...e }))));
  loop(new T.Part((t, e) => pad.triggerAttackRelease(e.pad.map(hz), ticks(BPB * 0.95, P), t),
    CHORDS.map((c, i) => ({ time: ticks(i * BPB, P), pad: c.padMidi }))));

  for (const k of KIT)
    loop(new T.Part(t => { if (!k.fill || ramp(level) >= 0.5) hit[k.inst](t); },
      k.beats.map(b => ({ time: ticks(b, P) }))));

  // an octave below the riff for the last stretch of the biome: more weight,
  // not more brightness, because there is quite enough of that already
  loop(new T.Part((t, e) => {
    if (ramp(level) < 0.8) return;
    lead.triggerAttackRelease(hz(e.n - 12), ticks(e.d * 0.8, P), t, 0.25);
  }, LEAD.map(e => ({ time: ticks(e.b, P), ...e }))));

  return { out, parts,
    nodes:[out, comp, verb, verbIn, lead, grit, lLp, counter, cLp, bass, bLp,
           pad, pLp, kick, snare, snF, tamb, crash, tom] };
}

export function start({ level: lv = level } = {}){
  if (rig) return;
  const T = tone();
  level = lv;
  if (!T.getContext().isOffline) T.start();
  rig = build();
  const tr = T.getTransport();
  tr.bpm.value = spec.bpm + spec.bpmUp * ramp(level);
  tr.timeSignature = BPB;
  tr.position = 0;
  for (const p of rig.parts) p.start(0);
  if (tr.state !== 'started') tr.start('+0.05');
}

export function stop(){
  if (!rig) return;
  const T = tone();
  for (const p of rig.parts){ p.stop(); p.dispose(); }
  T.getTransport().stop();
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
