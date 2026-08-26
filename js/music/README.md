# The five biome tracks

One ES module per biome, each a complete piece of music built from Tone.js
synths and effects. No audio files anywhere — every sound here is synthesised
at runtime, which is the same rule the rest of this repo's audio follows.

| File | Piece | Key | Tempo | Form |
|---|---|---|---|---|
| `meadow.js` | Meadow | G major | 112 | 16 bars, 4/4 |
| `ponds.js` | Lilypad Ponds | D Lydian | 76 | 16 bars, 4/4 |
| `bubblegum.js` | Bubblegum | F major | 150 | 16 bars, 4/4 |
| `night.js` | Night | A minor | 88 | 16 bars, 4/4 |
| `hell.js` | Hell | D harmonic minor | 168 | 24 bars, 6/8 |

Each has a chord progression that moves every one or two bars, a melody that
runs its full form before repeating, a counter-melody written to move on beats
the melody leaves empty, and its own kit. The reasoning for each — what the
progression is doing, why a particular bar is there — is in a header comment in
the file itself.

## Using one on its own

```html
<script src="vendor/tone.js"></script>
<script type="module">
  import { start, stop, setVolume } from './js/music/meadow.js';
  document.querySelector('button').onclick = () => { setVolume(0.8); start(); };
</script>
```

- `start({ level })` — builds the voices and starts the transport. Safe to call
  from a click; it resumes Tone's context itself. Calling it twice is a no-op.
- `stop()` — stops and disposes everything the track built.
- `setVolume(v)` — 0..1, and it works whether or not the track is playing.
- `setLevel(n)` — optional, and specific to this game: the piece is unchanged,
  but the tempo creeps up across a biome's ten levels and the extra percussion
  joins at the halfway point.
- `spec` — the piece as data (key, tempo, chords, every written note). This is
  what `tools/music.js` checks, and it is how the music is verified as WRITTEN
  rather than by trying to read pitches back out of a mix.

Tone.js is expected as the global `Tone`, from `vendor/tone.js`. That is the UMD
bundle: Tone's ESM build is 555 files with bare-specifier dependencies and would
need a bundler, and this repo deliberately does not have one.

Only one track should play at a time — Tone has a single global transport, and
they all schedule on it.

`lib.js` is shared: the note notation the five are written in, and nothing else.
Keeping the parser in one place means a miscounted bar is caught the same way in
all five, and it throws at module load rather than quietly shifting a phrase off
the beat.
