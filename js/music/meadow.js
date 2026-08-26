/* =======================================================================
   MEADOW — "sunny afternoon"

   Key      G major (one chromatic guest: the C# of the A7 in bar 14)
   Tempo    112 BPM, 4/4, creeping to 120 across the biome's ten levels
   Form     16 bars, through-composed, then it loops
   Voices   flute-ish lead, hollow clarinet counter-line, pizzicato bass,
            warm pad, and a light kit (kick, woodblock, shaker, tambourine)

   HARMONY — one chord per bar. Bars 1-8 walk the bass down the whole G major
   scale (G F# E D C B A D), which is what makes the first half sound like it
   is strolling downhill rather than sitting on a I-vi-IV-V loop:

     1  G      2  D/F#   3  Em7    4  D
     5  C      6  G/B    7  Am7    8  D7
     9  G     10  C/E   11  Am7   12  D7
    13  Em7   14  A7    15  Cmaj7 16  D7

   The A7 in bar 14 is a secondary dominant (V of V). Its C# is the only note
   in the piece outside G major and it is there to lift the last four bars —
   without it bars 13-16 are just bars 9-12 again.

   MELODY — a rising, skipping figure stated in bars 1-4, answered higher in
   5-8, restated with the peak pushed up an octave in 9-12, and climbing to its
   top note (E6) over the A7 in 14 before coming home. Deliberately full of
   rests: the counter-line plays in them.

   COUNTER-MELODY — silent for the first four bars so the tune lands first,
   then grouped 3+3+2 in eighths against the lead's 4/4. That cross-rhythm is
   why the two lines never sound locked together even though they share a bar.
   ======================================================================= */
import { bars, grid, hz, midi, ticks, unitToDb, tone, ramp } from './lib.js';

const BPB = 4, TOTAL = 16, BEATS = BPB * TOTAL;

/* Pad voicings sit in one octave around C4 so the chords change colour rather
   than jumping register; the bass carries the movement. */
const CHORDS = [
  { name:'G',     bass:'G2',  pad:['B3','D4','G4']  },
  { name:'D/F#',  bass:'F#2', pad:['A3','D4','F#4'] },
  { name:'Em7',   bass:'E2',  pad:['G3','B3','D4']  },
  { name:'D',     bass:'D2',  pad:['F#3','A3','D4'] },
  { name:'C',     bass:'C2',  pad:['G3','C4','E4']  },
  { name:'G/B',   bass:'B2',  pad:['G3','B3','D4']  },
  { name:'Am7',   bass:'A2',  pad:['A3','C4','E4','G4'] },
  { name:'D7',    bass:'D2',  pad:['F#3','A3','C4'] },
  { name:'G',     bass:'G2',  pad:['B3','D4','G4']  },
  { name:'C/E',   bass:'E2',  pad:['G3','C4','E4']  },
  { name:'Am7',   bass:'A2',  pad:['A3','C4','E4','G4'] },
  { name:'D7',    bass:'D2',  pad:['F#3','A3','C4'] },
  { name:'Em7',   bass:'E2',  pad:['G3','B3','D4']  },
  { name:'A7',    bass:'A2',  pad:['C#4','E4','G4'] },
  { name:'Cmaj7', bass:'C2',  pad:['E4','G4','B4']  },
  { name:'D7',    bass:'D2',  pad:['F#3','A3','C4'] },
].map(c => ({ ...c, bassMidi: midi(c.bass), padMidi: c.pad.map(midi) }));

const LEAD = bars([
  './0.5 D5/0.5 G5/1  B5/1   A5/1',        //  1  G      states the motif
  'F#5/1.5 A5/0.5 B5/1 ./1',               //  2  D/F#   and rests
  'B5/0.5 A5/0.5 G5/1 E5/1 ./1',           //  3  Em7    falls back
  'F#5/1 A5/1 D5/1.5 ./0.5',               //  4  D      lands on the 5th
  'E5/0.5 G5/0.5 C6/1 B5/0.5 G5/0.5 E5/1', //  5  C      the answer, higher
  'D5/1 G5/1 B5/1.5 ./0.5',                //  6  G/B
  'C6/1 B5/0.5 A5/0.5 G5/1 E5/1',          //  7  Am7
  'F#5/1 A5/1 G5/0.5 F#5/0.5 D5/1',        //  8  D7     half-close
  './0.5 D5/0.5 G5/1 B5/1 D6/1',           //  9  G      motif again, opened up
  'C6/1.5 B5/0.5 G5/1 E5/1',               // 10  C/E
  'A5/1 C6/1 E6/1 ./1',                    // 11  Am7    reaching
  'D6/1.5 C6/0.5 A5/1 F#5/1',              // 12  D7
  'B5/1 A5/0.5 G5/0.5 E5/1 G5/1',          // 13  Em7
  'A5/1 C#6/1 E6/1.5 ./0.5',               // 14  A7     top note, on the C#
  'D6/1 B5/1 G5/1 E5/1',                   // 15  Cmaj7  stepping down
  'F#5/1 A5/1 D5/2',                       // 16  D7     open, so the loop turns
], BPB, 'meadow lead');

/* The counter-line's job is to move when the lead does NOT. The melody above
   is written almost entirely on the beat, so this line lives on the offbeat
   eighths and ties across barlines — it enters in bar 6, once the tune has been
   stated twice, and answers it rather than shadowing it. Written against the
   lead bar by bar: every entry below falls on a beat the melody leaves empty,
   which is what stops two lines reading as one thick one. */
const COUNTER = bars([
  './4', './4', './4', './4', './4',        //  1-5  the tune states itself alone
  './1.5 D5/1 B4/1 G4/0.5',                 //  6  G/B   enters on the & of 2
  '-/0.5 C5/2 A4/1 ./0.5',                  //  7  Am7
  './0.5 A4/1 F#4/2 D4/0.5',                //  8  D7
  '-/1.5 G4/1 B4/1 D5/0.5',                 //  9  G     holds through the downbeat
  '-/0.5 E5/0.5 C5/1.5 G4/1.5',             // 10  C/E
  '-/0.5 A4/1 C5/1 E5/1.5',                 // 11  Am7   climbs while the lead rests
  '-/1 A4/1.5 F#4/1.5',                     // 12  D7
  './0.5 B4/2 G4/1 E4/0.5',                 // 13  Em7
  '-/0.5 C#5/1 E5/1 G4/1.5',                // 14  A7    takes the C# too
  '-/0.5 E5/1 G4/1 B4/1.5',                 // 15  Cmaj7
  '-/0.5 A4/1 F#4/1 D4/1.5',                // 16  D7
], BPB, 'meadow counter');

/* Root, fifth, root, third — a pizzicato bounce with a hole on beat 2-and so it
   skips rather than marches. */
const BASS = bars([
  'G2/1 D3/0.5 ./0.5 G2/1 B2/1',           //  1  G
  'F#2/1 A2/0.5 ./0.5 D3/1 A2/1',          //  2  D/F#
  'E2/1 B2/0.5 ./0.5 E3/1 B2/1',           //  3  Em7
  'D2/1 A2/0.5 ./0.5 D3/1 A2/1',           //  4  D
  'C2/1 G2/0.5 ./0.5 C3/1 G2/1',           //  5  C
  'B2/1 F#3/0.5 ./0.5 B2/1 D3/1',          //  6  G/B
  'A2/1 E3/0.5 ./0.5 A2/1 C3/1',           //  7  Am7
  'D2/1 A2/0.5 ./0.5 D3/1 C3/1',           //  8  D7
  'G2/1 D3/0.5 ./0.5 G2/1 B2/1',           //  9  G
  'E2/1 B2/0.5 ./0.5 E3/1 G2/1',           // 10  C/E
  'A2/1 E3/0.5 ./0.5 A2/1 G2/1',           // 11  Am7
  'D2/1 A2/0.5 ./0.5 F#3/1 A2/1',          // 12  D7
  'E2/1 B2/0.5 ./0.5 E3/1 G2/1',           // 13  Em7
  'A2/1 E3/0.5 ./0.5 A2/1 C#3/1',          // 14  A7
  'C2/1 G2/0.5 ./0.5 C3/1 E3/1',           // 15  Cmaj7
  'D2/1 A2/0.5 ./0.5 D3/1 F#3/1',          // 16  D7   F#2 leads back into G
], BPB, 'meadow bass');

/* Sixteenth grid. `fill` layers join halfway through a biome — the piece is
   identical either way, it just gains a little more motion. */
const KIT = [
  { inst:'kick',   beats: grid('x . . . . . . . x . . . . . x .', 16, BPB, TOTAL, 'meadow kick') },
  { inst:'block',  beats: grid('. . . . x . . . . . . . x . . .', 16, BPB, TOTAL, 'meadow block') },
  { inst:'shaker', beats: grid('. . x . . . x . . . x . . x x .', 16, BPB, TOTAL, 'meadow shaker') },
  { inst:'tamb',   fill:true,
    beats: grid('. . . . . . x . . . . . . . x .', 16, BPB, TOTAL, 'meadow tamb') },
];

export const spec = {
  id:'meadow', name:'Meadow', key:'G major', keyPitchClasses:[7,9,11,0,2,4,6,1],
  bpm:112, bpmUp:8, beatsPerBar:BPB, bars:TOTAL, totalBeats:BEATS,
  lead:'flute', chords:CHORDS,
  parts:{ lead:LEAD, counter:COUNTER, bass:BASS },
  drums:KIT.map(k => k.inst + (k.fill ? '+' : '')),
};

/* Balance trim, in dB. The five pieces have very different densities — a
   sparse pond and a wall-to-wall boss fight do not land at the same loudness
   at the same fader — so each carries its own offset and `tools/music.js`
   asserts they end up within 1.5x of each other. A theme change is a mood
   change, not a volume change. */
const MIX = -2.7;

let rig = null, level = 1, vol = 0.75;

function build(){
  const T = tone();
  const out = new T.Volume(unitToDb(vol) + MIX);
  const comp = new T.Compressor({ threshold:-16, ratio:3, attack:0.005, release:0.1 });
  comp.connect(out);
  out.toDestination();

  // one reverb for the whole track, fed by sends, so the balance is per-voice
  const verb = new T.Freeverb({ roomSize:0.62, dampening:2600, wet:1 });
  const verbIn = new T.Gain(1);
  verbIn.connect(verb); verb.connect(comp);
  const send = (node, amt) => { const g = new T.Gain(amt); node.connect(g); g.connect(verbIn); return g; };

  /* Flute: nearly a sine, with just enough 2nd and 3rd harmonic to have a
     body, a slow-ish attack so it blows rather than plucks, and a small late
     vibrato. A triangle wave alone reads as a recorder, not a flute. */
  const vib = new T.Vibrato({ frequency:5.2, depth:0.055, wet:0.7 });
  const lead = new T.PolySynth(T.Synth, {
    oscillator:{ type:'custom', partials:[1, 0.22, 0.10, 0.03, 0.012] },
    envelope:{ attack:0.045, decay:0.18, sustain:0.72, release:0.34 },
    volume:-9,
  });
  lead.connect(vib); vib.connect(comp); send(vib, 0.20);

  /* Odd harmonics only — the hollow, woody clarinet colour. Kept a fifth below
     the flute's register and 6dB down so it reads as accompaniment. */
  const counter = new T.PolySynth(T.Synth, {
    oscillator:{ type:'custom', partials:[1, 0, 0.34, 0, 0.16, 0, 0.07] },
    envelope:{ attack:0.06, decay:0.2, sustain:0.66, release:0.4 },
    volume:-16,
  });
  const cLp = new T.Filter(2600, 'lowpass');
  counter.connect(cLp); cLp.connect(comp); send(cLp, 0.16);

  /* Pizzicato: a plucked string for the attack and a short sine underneath for
     the weight. A PluckSynth on its own has almost no fundamental down here. */
  const pluck = new T.PluckSynth({ attackNoise:1.4, dampening:2200, resonance:0.82, volume:-4 });
  const body = new T.Synth({
    oscillator:{ type:'triangle' },
    envelope:{ attack:0.005, decay:0.24, sustain:0, release:0.1 },
    volume:-13,
  });
  const bLp = new T.Filter(900, 'lowpass');
  pluck.connect(bLp); body.connect(bLp); bLp.connect(comp);

  const pad = new T.PolySynth(T.Synth, {
    oscillator:{ type:'triangle' },
    envelope:{ attack:0.7, decay:0.4, sustain:0.75, release:1.4 },
    volume:-26,
  });
  const chorus = new T.Chorus({ frequency:0.6, delayTime:4, depth:0.5, wet:0.5 }).start();
  const pLp = new T.Filter(1500, 'lowpass');
  pad.connect(pLp); pLp.connect(chorus); chorus.connect(comp); send(chorus, 0.35);

  const kick = new T.MembraneSynth({
    pitchDecay:0.03, octaves:5,
    envelope:{ attack:0.001, decay:0.26, sustain:0, release:0.1 }, volume:-11,
  });
  kick.connect(comp);
  // a woodblock is a very short pitched click; the filter is what stops it
  // reading as a tiny tom
  const block = new T.MembraneSynth({
    pitchDecay:0.008, octaves:2,
    envelope:{ attack:0.001, decay:0.055, sustain:0, release:0.02 }, volume:-20,
  });
  const blLp = new T.Filter(1800, 'bandpass'); blLp.Q.value = 1.6;
  block.connect(blLp); blLp.connect(comp); send(blLp, 0.12);
  const shaker = new T.NoiseSynth({
    noise:{ type:'white' },
    envelope:{ attack:0.001, decay:0.032, sustain:0 }, volume:-26,
  });
  const shHp = new T.Filter(6200, 'highpass');
  shaker.connect(shHp); shHp.connect(comp);
  const tamb = new T.MetalSynth({
    envelope:{ attack:0.001, decay:0.12, release:0.02 },
    harmonicity:4.1, modulationIndex:22, resonance:5200, octaves:1.4, volume:-34,
  });
  tamb.connect(comp);

  const hit = { kick:t => kick.triggerAttackRelease('C1', '16n', t),
                block:t => block.triggerAttackRelease('C5', '32n', t),
                shaker:t => shaker.triggerAttackRelease('32n', t),
                tamb:t => tamb.triggerAttackRelease('32n', t) };

  const tr = T.getTransport();
  const P = tr.PPQ;
  const parts = [];
  const loop = p => { p.loop = true; p.loopStart = 0; p.loopEnd = ticks(BEATS, P); parts.push(p); return p; };

  loop(new T.Part((t, e) => lead.triggerAttackRelease(hz(e.n), ticks(e.d * 0.94, P), t),
    LEAD.map(e => ({ time: ticks(e.b, P), ...e }))));

  loop(new T.Part((t, e) => counter.triggerAttackRelease(hz(e.n), ticks(e.d * 0.96, P), t),
    COUNTER.map(e => ({ time: ticks(e.b, P), ...e }))));

  loop(new T.Part((t, e) => {
    pluck.triggerAttack(hz(e.n), t);
    body.triggerAttackRelease(hz(e.n), ticks(Math.min(e.d, 0.5), P), t);
  }, BASS.map(e => ({ time: ticks(e.b, P), ...e }))));

  loop(new T.Part((t, e) => pad.triggerAttackRelease(e.pad.map(hz), ticks(BPB * 0.94, P), t),
    CHORDS.map((c, i) => ({ time: ticks(i * BPB, P), pad: c.padMidi }))));

  for (const k of KIT)
    loop(new T.Part((t) => { if (!k.fill || ramp(level) >= 0.5) hit[k.inst](t); },
      k.beats.map(b => ({ time: ticks(b, P) }))));

  /* The top octave of the tune joins for the last stretch of a biome, quietly.
     The phrase is unchanged; it only gains a sparkle. */
  loop(new T.Part((t, e) => {
    if (ramp(level) < 0.8) return;
    lead.triggerAttackRelease(hz(e.n + 12), ticks(e.d * 0.6, P), t + 0.012, 0.18);
  }, LEAD.map(e => ({ time: ticks(e.b, P), ...e }))));

  return { out, parts,
    nodes:[out, comp, verb, verbIn, vib, lead, counter, cLp, pluck, body, bLp,
           pad, chorus, pLp, kick, block, blLp, shaker, shHp, tamb] };
}

/** Build the voices, set the tempo, and start the transport. Safe to call from
    a click handler: it resumes Tone's context first. */
export function start({ level: lv = level } = {}){
  if (rig) return;
  const T = tone();
  level = lv;
  // an OfflineContext is already "running" as far as rendering goes, and
  // Tone.start() on one is meaningless — tools/music.js renders through here
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

/** 0..1, applied whether or not the track is playing. */
export function setVolume(v){
  vol = Math.max(0, Math.min(1, v));
  if (rig) rig.out.volume.rampTo(unitToDb(vol) + MIX, 0.08);
}

/** The game's level. Tempo creeps up across a biome's ten levels and the fill
    layers join at the halfway point; the written piece never changes. */
export function setLevel(n){
  level = n;
  if (rig) tone().getTransport().bpm.rampTo(spec.bpm + spec.bpmUp * ramp(level), 1.5);
}
