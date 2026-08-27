/* =======================================================================
   MUSIC LIB — note notation, and the two or three things every track needs.

   The five tracks own their own instruments, effects, harmony and scheduling;
   what lives here is only the notation they are all WRITTEN in, so that a
   miscounted bar is caught the same way in all five.

   Rhythm is authored in beats, not on a fixed step grid. A step grid forces
   every part onto the same subdivision, which is exactly how a piece ends up
   as wall-to-wall eighth notes — the thing the brief asks us not to do. Beats
   let the lead breathe in dotted quarters while the bass walks in eighths.

   NOTATION — one string per bar, tokens separated by spaces, `pitch/beats`:

       G4/1      G4, one beat
       F#5/0.5   F#5, half a beat
       Bb3/1.5   dotted quarter
       ./2       two beats of rest
       -/1       tie: extend the previous note by one beat, across a barline

   `bars()` asserts every bar sums to exactly the metre. That check is the
   whole point of authoring in bars: a bar that is an eighth short does not
   sound wrong on its own, it shifts every later bar off the beat and reads as
   "the tune goes weird in the middle".
   ======================================================================= */

const NAMES = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };

/** 'F#4' -> 66. Middle C is C4 = 60. */
export function midi(name){
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note name: ${name}`);
  return NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
}

/** MIDI number -> Hz. Tone takes frequencies directly, which keeps the tracks
    free of any dependency on Tone's own note-name parsing. */
export const hz = m => 440 * Math.pow(2, (m - 69) / 12);

const SPELL = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const noteName = m => SPELL[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

/**
 * Bars of tokens -> flat events `{b, n, d}`: beat from the top of the loop,
 * MIDI number, duration in beats. Throws on a bar that does not add up.
 */
export function bars(list, beatsPerBar, label){
  const out = [];
  let at = 0, tied = false;      // is the previous token a note this may tie to?
  list.forEach((bar, i) => {
    let sum = 0;
    for (const tok of bar.trim().split(/\s+/)){
      if (!tok) continue;
      const slash = tok.lastIndexOf('/');
      if (slash < 1) throw new Error(`[${label}] bar ${i + 1}: bad token "${tok}"`);
      const head = tok.slice(0, slash);
      const d = Number(tok.slice(slash + 1));
      if (!(d > 0)) throw new Error(`[${label}] bar ${i + 1}: bad length in "${tok}"`);
      if (head === '.'){ tied = false; }
      else if (head === '-'){
        const prev = out[out.length - 1];
        if (!prev) throw new Error(`[${label}] bar ${i + 1}: tie with nothing to tie to`);
        /* A tie may only follow the note it ties. After a rest it would extend a
           note that already stopped, which does not sound like a longer note —
           it sounds like that note overlapping everything written after it. */
        if (!tied) throw new Error(`[${label}] bar ${i + 1}: tie after a rest`);
        prev.d += d;
      } else {
        tied = true;
        out.push({ b: at + sum, n: midi(head), d });
      }
      sum += d;
    }
    if (Math.abs(sum - beatsPerBar) > 1e-9)
      throw new Error(`[${label}] bar ${i + 1}: ${sum} beats, expected ${beatsPerBar}`);
    at += beatsPerBar;
  });
  return out;
}

/**
 * A drum pattern -> beat positions. One string per bar, `stepsPerBar` tokens,
 * 'x' hits and anything else rests. Patterns repeat to fill `totalBars`, so a
 * one-bar groove is written once.
 */
export function grid(pattern, stepsPerBar, beatsPerBar, totalBars, label){
  const src = Array.isArray(pattern) ? pattern : [pattern];
  const per = beatsPerBar / stepsPerBar;
  const out = [];
  for (let bar = 0; bar < totalBars; bar++){
    const toks = src[bar % src.length].trim().split(/\s+/);
    if (toks.length !== stepsPerBar)
      throw new Error(`[${label}] bar ${bar % src.length + 1}: ${toks.length} steps, expected ${stepsPerBar}`);
    toks.forEach((t, s) => { if (t === 'x') out.push(bar * beatsPerBar + s * per); });
  }
  return out;
}

/** Beats -> a Tone time string in ticks. Exact, and stays tempo-relative, which
    "1.5 * 4n" style expressions and raw seconds both fail to be. */
export const ticks = (beats, ppq) => Math.round(beats * ppq) + 'i';

/** Linear 0..1 from the game -> dB for Tone. Squared so that a slider feels
    even; -Infinity at zero so a muted track is actually silent. */
export function unitToDb(v){
  const x = Math.max(0, Math.min(1, v));
  return x <= 0.0001 ? -Infinity : 20 * Math.log10(x * x);
}

/** The global Tone, loaded by `vendor/tone.js` as a plain script. Tone's ESM
    build is 555 files with bare-specifier deps, so it needs a bundler; the UMD
    bundle needs none, which is what keeps this repo directly servable. */
export function tone(){
  const T = globalThis.Tone;
  if (!T) throw new Error('Tone.js is not loaded — include vendor/tone.js first');
  return T;
}

/** Where in a biome's ten levels we are, 0 at the first and 1 at the last.
    Tempo creep and fill layers both hang off this; the written piece does not
    change, it only fills in. */
export function ramp(level, span = 10){
  return Math.min(1, Math.max(0, ((level - 1) % span) / (span - 1)));
}

/**
 * Wrap a Part callback so the times it is handed are strictly increasing.
 *
 * Tone throws "Start time must be strictly greater than previous start time" if
 * a MONOPHONIC voice is started twice at the same instant — and a busy page
 * makes that happen without anyone writing it. Tone schedules ahead; when the
 * main thread is late the scheduled time has already passed and Tone clamps it
 * to now, so hits written milliseconds apart arrive together. A tambourine on
 * six eighths, or a clap built from three taps, then kills the transport.
 *
 * One Part drives one voice, so per-Part monotonic time is per-voice monotonic
 * time. The nudge is 2ms, which is inaudible and only ever applied to hits that
 * were already late.
 *
 * `ctx` must be the context the Part was built in — see the note inside.
 */
export function monotonic(fn, ctx){
  let last = -Infinity;
  return (t, ...rest) => {
    /* Push the time out of the PAST first. Keeping our own requests increasing
       is not enough on its own: Tone clamps any past time to `now` itself, and
       it does that to each hit separately, so two requests 2ms apart that are
       both already spent land on the same instant anyway — which is the very
       thing this exists to prevent.

       `ctx` is the context captured when the Part was BUILT, and it has to be:
       Tone.Offline restores the global context before it renders, so asking for
       the current one at event time hands you the LIVE clock during an offline
       render. Flooring offline events against a live clock parked seconds ahead
       pushes every note past the end of the render, and the render comes out
       silent. Nothing is late in a render anyway, so offline is exempt. */
    if (ctx && !ctx.isOffline){
      const floor = ctx.currentTime + 0.001;
      if (t < floor) t = floor;
    }
    if (!(t > last + 0.002)) t = last + 0.002;
    last = t;
    return fn(t, ...rest);
  };
}
