/* =======================================================================
   BUBBLEGUM — "eating candy"

   Key      F major, with three chromatic guests (see below)
   Tempo    150 BPM, 4/4, creeping to 156 across the biome's ten levels
   Form     16 bars, one chord per bar, then it loops (~25s)
   Voices   bright detuned-square lead, a bubbly pluck riff, a punchy filtered
            bass, a dark pad, and four-on-the-floor with claps and hats

   HARMONY — one chord per bar, and it keeps moving:

     1  F    2  Am    3  Bb   4  C
     5  Dm   6  Bb    7  Gm7  8  C7
     9  F   10  A7   11  Dm  12  Db
    13  Bb  14  Bbm  15  F/C 16  C7

   Bars 1-8 are diatonic and do the work. Bars 10-14 are where the sugar rush
   goes slightly wrong on purpose, and all three moves are cartoon staples:

     A7  (bar 10)  V of vi — a bright chromatic lift on the C#
     Db  (bar 12)  bVI, a semitone slide down off the Dm before it
     Bbm (bar 14)  the IV of bar 13 turned minor under the SAME melody shape,
                   which is the "aww" gag — one note moves, D to Db

   MELODY — sixteenth bursts against held notes and real rests, never a
   continuous run: the gaps are where it reads as bouncy rather than frantic.
   Bars 13 and 14 are deliberately the same figure, the second one flattened.

   COUNTER-MELODY — a two-note pluck riff on the & of 2 and the & of 4, which
   are beats the lead never uses, so the two interlock instead of colliding.
   ======================================================================= */
import { bars, grid, hz, midi, ticks, unitToDb, tone, ramp } from './lib.js';

const BPB = 4, TOTAL = 16, BEATS = BPB * TOTAL;

const CHORDS = [
  { name:'F',   bass:'F2',  pad:['A3','C4','F4']  },
  { name:'Am',  bass:'A2',  pad:['A3','C4','E4']  },
  { name:'Bb',  bass:'Bb2', pad:['Bb3','D4','F4'] },
  { name:'C',   bass:'C3',  pad:['C4','E4','G4']  },
  { name:'Dm',  bass:'D3',  pad:['A3','D4','F4']  },
  { name:'Bb',  bass:'Bb2', pad:['Bb3','D4','F4'] },
  { name:'Gm7', bass:'G2',  pad:['G3','Bb3','D4','F4'] },
  { name:'C7',  bass:'C3',  pad:['Bb3','C4','E4'] },
  { name:'F',   bass:'F2',  pad:['A3','C4','F4']  },
  { name:'A7',  bass:'A2',  pad:['C#4','E4','G4'] },   // the C# lift
  { name:'Dm',  bass:'D3',  pad:['A3','D4','F4']  },
  { name:'Db',  bass:'Db3', pad:['Db4','F4','Ab4'] },  // bVI, a semitone slide
  { name:'Bb',  bass:'Bb2', pad:['Bb3','D4','F4'] },
  { name:'Bbm', bass:'Bb2', pad:['Bb3','Db4','F4'] },  // ...and the same chord, sad
  { name:'F/C', bass:'C3',  pad:['A3','C4','F4']  },
  { name:'C7',  bass:'C3',  pad:['Bb3','C4','E4'] },
].map(c => ({ ...c, bassMidi: midi(c.bass), padMidi: c.pad.map(midi) }));

const LEAD = bars([
  'F5/0.5 A5/0.5 C6/1 ./0.5 A5/0.5 C6/1',      //  1  F
  'E6/0.75 C6/0.25 A5/1 ./0.5 E5/0.5 A5/1',    //  2  Am
  'D6/0.5 F6/0.5 D6/1 Bb5/1 ./1',              //  3  Bb
  'C6/0.5 D6/0.5 E6/1 ./0.5 C6/0.5 G5/1',      //  4  C
  'A5/0.5 D6/0.5 F6/1 ./0.5 D6/0.5 A5/1',      //  5  Dm
  'Bb5/0.75 D6/0.25 F6/1 D6/1 Bb5/1',          //  6  Bb
  'G5/0.5 Bb5/0.5 D6/1 ./0.5 F6/0.5 D6/1',     //  7  Gm7
  'C6/0.5 Bb5/0.5 G5/1 E5/1 ./1',              //  8  C7   half-close, and a rest
  'F5/0.5 A5/0.5 C6/1 ./0.5 F6/0.5 C6/1',      //  9  F
  'C#6/0.75 E6/0.25 C#6/1 A5/1 ./1',           // 10  A7   sits on the C#
  'D6/0.5 F6/0.5 D6/1 A5/1 F5/1',              // 11  Dm
  'Db6/0.5 Ab5/0.5 F5/1 ./0.5 Ab5/0.5 Db6/1',  // 12  Db
  'Bb5/0.5 D6/0.5 F6/1 D6/1 Bb5/1',            // 13  Bb   the figure...
  'Bb5/0.5 Db6/0.5 F6/1 Db6/1 Bb5/1',          // 14  Bbm  ...and the gag: D -> Db
  'C6/0.5 A5/0.5 F5/1 ./0.5 A5/0.5 C6/1',      // 15  F/C
  'E6/0.5 D6/0.5 C6/1 G5/1 Bb5/1',             // 16  C7   the Bb pulls back to F
], BPB, 'bubblegum lead');

/* Short, hard, and only on the & of 2 and the & of 4 — the two eighths the
   melody above never starts on. Interlocking beats doubling. */
const COUNTER = bars([
  './4', './4',                                //  1-2  the lead alone first
  './1.5 Bb4/0.5 ./1.5 D5/0.5',                //  3  Bb
  './1.5 C5/0.5 ./1.5 E5/0.5',                 //  4  C
  './1.5 A4/0.5 ./1.5 F5/0.5',                 //  5  Dm
  './1.5 D5/0.5 ./1.75 Bb4/0.25',              //  6  Bb   a sixteenth late
  './1.5 G4/0.5 ./1.5 Bb4/0.5',                //  7  Gm7
  './1.5 E5/0.5 ./0.75 G4/0.75 C5/0.5',        //  8  C7   fills the lead's rest
  './1.5 A4/0.5 ./1.5 C5/0.5',                 //  9  F
  './1.5 C#5/0.5 ./1.5 E5/0.5',                // 10  A7
  './1.5 F5/0.5 ./0.5 D5/0.5 ./0.5 A4/0.5',    // 11  Dm
  './1.5 Ab4/0.5 ./1.5 F5/0.5',                // 12  Db
  './1.5 D5/0.5 ./0.5 F5/0.5 ./0.5 D5/0.5',    // 13  Bb
  './1.5 Db5/0.5 ./1.5 F5/0.5',                // 14  Bbm  follows the flat too
  './1.5 C5/0.5 ./1.5 A4/0.5',                 // 15  F/C
  './1.5 G4/0.5 ./0.75 Bb4/0.75 G4/0.5',       // 16  C7
], BPB, 'bubblegum counter');

/* Root, root, fifth, root, third — a hard eighth-note bounce with the offbeats
   punched out, so it drives without turning into a continuous eighth run. */
const BASS = bars([
  'F2/0.5 ./0.5 F2/0.5 C3/0.5 ./0.5 F2/0.5 A2/0.5 ./0.5',      //  1  F
  'A2/0.5 ./0.5 A2/0.5 E3/0.5 ./0.5 A2/0.5 C3/0.5 ./0.5',      //  2  Am
  'Bb2/0.5 ./0.5 Bb2/0.5 F3/0.5 ./0.5 Bb2/0.5 D3/0.5 ./0.5',   //  3  Bb
  'C3/0.5 ./0.5 C3/0.5 G3/0.5 ./0.5 C3/0.5 E3/0.5 ./0.5',      //  4  C
  'D3/0.5 ./0.5 D3/0.5 A3/0.5 ./0.5 D3/0.5 F3/0.5 ./0.5',      //  5  Dm
  'Bb2/0.5 ./0.5 Bb2/0.5 F3/0.5 ./0.5 Bb2/0.5 D3/0.5 ./0.5',   //  6  Bb
  'G2/0.5 ./0.5 G2/0.5 D3/0.5 ./0.5 G2/0.5 Bb2/0.5 ./0.5',     //  7  Gm7
  'C3/0.5 ./0.5 C3/0.5 G3/0.5 ./0.5 Bb2/0.5 C3/0.5 ./0.5',     //  8  C7
  'F2/0.5 ./0.5 F2/0.5 C3/0.5 ./0.5 F2/0.5 A2/0.5 ./0.5',      //  9  F
  'A2/0.5 ./0.5 A2/0.5 E3/0.5 ./0.5 A2/0.5 C#3/0.5 ./0.5',     // 10  A7
  'D3/0.5 ./0.5 D3/0.5 A3/0.5 ./0.5 D3/0.5 F3/0.5 ./0.5',      // 11  Dm
  'Db3/0.5 ./0.5 Db3/0.5 Ab3/0.5 ./0.5 Db3/0.5 F3/0.5 ./0.5',  // 12  Db
  'Bb2/0.5 ./0.5 Bb2/0.5 F3/0.5 ./0.5 Bb2/0.5 D3/0.5 ./0.5',   // 13  Bb
  'Bb2/0.5 ./0.5 Bb2/0.5 F3/0.5 ./0.5 Bb2/0.5 Db3/0.5 ./0.5',  // 14  Bbm
  'C3/0.5 ./0.5 C3/0.5 F3/0.5 ./0.5 C3/0.5 A2/0.5 ./0.5',      // 15  F/C
  'C3/0.5 ./0.5 C3/0.5 G3/0.5 ./0.5 Bb2/0.5 C3/0.5 ./0.5',     // 16  C7
], BPB, 'bubblegum bass');

const KIT = [
  { inst:'kick', beats: grid('x . . . x . . . x . . . x . . .', 16, BPB, TOTAL, 'candy kick') },
  { inst:'clap', beats: grid('. . . . x . . . . . . . x . . .', 16, BPB, TOTAL, 'candy clap') },
  { inst:'hat',  beats: grid('. . x . . . x . . . x . . . x .', 16, BPB, TOTAL, 'candy hat') },
  { inst:'pop',  fill:true,
    beats: grid('. . . . . . . x . . . . . . x .', 16, BPB, TOTAL, 'candy pop') },
];

export const spec = {
  id:'bubblegum', name:'Bubblegum', key:'F major',
  // F major, plus Db/C# (the A7, the Db and the Bbm) and Ab (the Db and Bbm)
  keyPitchClasses:[5,7,9,10,0,2,4,1,8],
  bpm:150, bpmUp:6, beatsPerBar:BPB, bars:TOTAL, totalBeats:BEATS,
  lead:'square', chords:CHORDS,
  parts:{ lead:LEAD, counter:COUNTER, bass:BASS },
  drums:KIT.map(k => k.inst + (k.fill ? '+' : '')),
};

/* Balance trim, in dB. The five pieces have very different densities — a
   sparse pond and a wall-to-wall boss fight do not land at the same loudness
   at the same fader — so each carries its own offset and `tools/music.js`
   asserts they end up within 1.5x of each other. A theme change is a mood
   change, not a volume change. */
const MIX = 2.15;

let rig = null, level = 1, vol = 0.75;

function build(){
  const T = tone();
  const out = new T.Volume(unitToDb(vol) + MIX);
  // harder knee than the other tracks: this one is meant to be squashed
  const comp = new T.Compressor({ threshold:-14, ratio:4, attack:0.003, release:0.08 });
  comp.connect(out);
  out.toDestination();

  const verb = new T.Freeverb({ roomSize:0.45, dampening:4200, wet:1 });
  const verbIn = new T.Gain(1);
  verbIn.connect(verb); verb.connect(comp);
  const send = (node, amt) => { const g = new T.Gain(amt); node.connect(g); g.connect(verbIn); return g; };

  /* Three detuned squares. A single square is a chiptune bleep; the spread is
     what makes it a synth lead, and the lowpass is what keeps a 150bpm stream
     of them from turning into hiss. */
  const lead = new T.PolySynth(T.Synth, {
    oscillator:{ type:'fatsquare', count:3, spread:24 },
    envelope:{ attack:0.004, decay:0.1, sustain:0.55, release:0.12 },
    volume:-15,
  });
  const lLp = new T.Filter(5200, 'lowpass'); lLp.Q.value = 0.6;
  const bite = new T.Distortion(0.12); bite.wet.value = 0.3;
  lead.connect(lLp); lLp.connect(bite); bite.connect(comp); send(bite, 0.12);

  // short FM blips — the bubble in bubblegum
  const counter = new T.PolySynth(T.FMSynth, {
    harmonicity:2, modulationIndex:9,
    oscillator:{ type:'triangle' }, modulation:{ type:'square' },
    envelope:{ attack:0.002, decay:0.14, sustain:0, release:0.08 },
    modulationEnvelope:{ attack:0.001, decay:0.06, sustain:0, release:0.05 },
    volume:-17,
  });
  counter.connect(comp); send(counter, 0.18);

  /* A filter envelope, not an amplitude one, is what makes a synth bass punch:
     the note opens bright and closes dark inside a sixteenth. */
  const bass = new T.MonoSynth({
    oscillator:{ type:'sawtooth' },
    envelope:{ attack:0.004, decay:0.14, sustain:0.35, release:0.06 },
    /* Peaks at ~505Hz, not ~1030. A sawtooth's FIFTH harmonic is a major third
       two octaves up, so the C3 in bar 15 was putting a strong E5 a semitone
       under the melody's F5 and buzzing against it — the same fault CLAUDE.md
       records for the old Hell bass. The sweep is what makes it punchy; how
       far up it sweeps is not. */
    filterEnvelope:{ attack:0.002, decay:0.09, sustain:0.18, release:0.05,
                     baseFrequency:110, octaves:2.2, exponent:2 },
    filter:{ type:'lowpass', rolloff:-24, Q:2 },
    volume:-12,
  });
  bass.connect(comp);

  const pad = new T.PolySynth(T.Synth, {
    oscillator:{ type:'fatsawtooth', count:2, spread:18 },
    envelope:{ attack:0.12, decay:0.4, sustain:0.6, release:0.5 },
    volume:-32,
  });
  /* 620Hz with a steep rolloff. At 900 the third harmonic of the pad's D4 came
     through at 881Hz — an A5, a semitone under the Bb5 the melody holds in bar
     6. Pads are dark here on purpose; the lead is the only bright thing. */
  const pLp = new T.Filter({ frequency:620, type:'lowpass', rolloff:-24 });
  const chorus = new T.Chorus({ frequency:1.2, delayTime:3, depth:0.6, wet:0.55 }).start();
  pad.connect(pLp); pLp.connect(chorus); chorus.connect(comp); send(chorus, 0.2);

  const kick = new T.MembraneSynth({
    pitchDecay:0.028, octaves:6,
    envelope:{ attack:0.001, decay:0.22, sustain:0, release:0.06 }, volume:-7,
  });
  kick.connect(comp);
  const clapN = new T.NoiseSynth({
    noise:{ type:'white' }, envelope:{ attack:0.001, decay:0.11, sustain:0 }, volume:-16,
  });
  const clapF = new T.Filter(1500, 'bandpass'); clapF.Q.value = 1.1;
  clapN.connect(clapF); clapF.connect(comp); send(clapF, 0.3);
  const hat = new T.NoiseSynth({
    noise:{ type:'white' }, envelope:{ attack:0.001, decay:0.028, sustain:0 }, volume:-22,
  });
  const hatF = new T.Filter(8000, 'highpass');
  hat.connect(hatF); hatF.connect(comp);
  /* A bubble pop: a very short blip with barely any pitch sweep, through a
     high-Q bandpass. The resonance is what makes it a pop rather than a click —
     MembraneSynth's sweep only goes downwards (octaves is clamped positive), so
     the character has to come from the filter. */
  const pop = new T.MembraneSynth({
    pitchDecay:0.004, octaves:0.6,
    envelope:{ attack:0.001, decay:0.06, sustain:0, release:0.02 }, volume:-14,
  });
  const popF = new T.Filter(1900, 'bandpass'); popF.Q.value = 5.5;
  pop.connect(popF); popF.connect(comp); send(popF, 0.25);

  const hit = {
    kick:t => kick.triggerAttackRelease('C1', '16n', t),
    // three taps a few ms apart is a clap; one is a snare
    clap:t => { for (let i = 0; i < 3; i++) clapN.triggerAttackRelease('32n', t + i * 0.009); },
    hat:t => hat.triggerAttackRelease('64n', t),
    pop:t => pop.triggerAttackRelease('C5', '64n', t),
  };

  const tr = T.getTransport();
  const P = tr.PPQ;
  const parts = [];
  const loop = p => { p.loop = true; p.loopStart = 0; p.loopEnd = ticks(BEATS, P); parts.push(p); return p; };

  loop(new T.Part((t, e) => lead.triggerAttackRelease(hz(e.n), ticks(e.d * 0.88, P), t),
    LEAD.map(e => ({ time: ticks(e.b, P), ...e }))));
  loop(new T.Part((t, e) => counter.triggerAttackRelease(hz(e.n), ticks(e.d * 0.8, P), t),
    COUNTER.map(e => ({ time: ticks(e.b, P), ...e }))));
  loop(new T.Part((t, e) => bass.triggerAttackRelease(hz(e.n), ticks(e.d * 0.85, P), t),
    BASS.map(e => ({ time: ticks(e.b, P), ...e }))));
  loop(new T.Part((t, e) => pad.triggerAttackRelease(e.pad.map(hz), ticks(BPB * 0.92, P), t),
    CHORDS.map((c, i) => ({ time: ticks(i * BPB, P), pad: c.padMidi }))));

  for (const k of KIT)
    loop(new T.Part(t => { if (!k.fill || ramp(level) >= 0.5) hit[k.inst](t); },
      k.beats.map(b => ({ time: ticks(b, P) }))));

  loop(new T.Part((t, e) => {
    if (ramp(level) < 0.8) return;
    lead.triggerAttackRelease(hz(e.n - 12), ticks(e.d * 0.7, P), t, 0.2);   // down, not up: it is bright enough
  }, LEAD.map(e => ({ time: ticks(e.b, P), ...e }))));

  return { out, parts,
    nodes:[out, comp, verb, verbIn, lead, lLp, bite, counter, bass, pad, pLp,
           chorus, kick, clapN, clapF, hat, hatF, pop, popF] };
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
