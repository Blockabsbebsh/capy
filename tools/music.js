#!/usr/bin/env node
/* Music harness: checks the five tracks, and can write them out as WAVs.
 *
 * The music is the one part of this game that cannot be verified by looking at
 * it, so it is verified two ways, each for what it is actually good for:
 *
 *   the DATA  — every written note, checked symbolically: in key, in range, and
 *               not fighting the chord underneath it. Notes cannot be read back
 *               out of a mix reliably (a square wave's 7th harmonic reads as an
 *               out-of-key pitch; the kick's downward sweep reads as a bass
 *               note), so nothing here guesses at pitch from audio.
 *   the AUDIO — rendered offline through the tracks' real start() path and
 *               measured for what audio does tell you: clipping, per-track
 *               loudness, and — via a Goertzel filter at the expected
 *               fundamental — that the written note is really sounding at the
 *               written time, rather than a semitone off or silent.
 *
 * A human still has to say whether the tune is any good. `--wav` is for that.
 *
 *   npm i playwright-core            # not committed; chromium is preinstalled
 *   python3 -m http.server 8765 &
 *   node tools/music.js              # checks; exits non-zero on failure
 *   node tools/music.js --wav        # + write .shots/music-<id>.wav
 *   node tools/music.js --wav --level 10 --seconds 40
 *   node tools/music.js --wav --only meadow
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? dflt : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true);
};
const URL     = flag('url', 'http://localhost:8765/tools/music.html');
const OUT     = flag('out', path.join(__dirname, '..', '.shots'));
const BROWSER = flag('browser', process.env.CHROMIUM_PATH
                 || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const LEVEL   = +(flag('level', 1));
/* Default: render exactly one loop of whatever track is being measured. The
   five loops run from 26s to 51s, and a fixed window would compare 100% of the
   boss fight against 60% of the pond — which is a loudness reading of the
   window, not of the piece. */
const SECONDS = flag('seconds', null) === null ? null : +flag('seconds');
const ONLY    = flag('only', null);

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { console.error('playwright-core is not installed. Run: npm i playwright-core'); process.exit(2); }

const NOTE = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const name = m => NOTE[m % 12] + (Math.floor(m / 12) - 1);
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

/* The registers each part has to stay in. The lead sits above the pad and below
   shrill; the counter-line sits under the lead, which is the only thing that
   stops two melodies reading as one thick one. */
const LEAD_RANGE    = [69, 91];
/* The floor is E3, not G3: what this check is really for is keeping the
   counter-line UNDER the lead and out of the melody's way, and Night's is a
   bowed voice that descends past G3 on purpose. Overlapping the top of the
   bass range is normal — a bass line and a low counter-line share register. */
const COUNTER_RANGE = [52, 79];
const BASS_RANGE    = [33, 60];

// single-frequency DFT: is `freq` present in x[start..start+len)?
function goertzel(x, start, len, freq, rate){
  const w = 2 * Math.PI * freq / rate, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < len; i++){
    const win = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / len);
    const s = x[start + i] * win + c * s1 - s2;
    s2 = s1; s1 = s;
  }
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) / len;
}

function wavFile(pcm, rate){
  const n = pcm.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), 44 + i * 2);
  return buf;
}

const fail = [];
const ok = (label, cond, detail = '') => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`);
  if (!cond) fail.push(label);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: BROWSER,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio',
           // the live pass needs a context that will actually run
           '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.MusicHarness);

  // bars() throws at module load on a bar that does not add up, so a bad
  // pattern surfaces here as a failed load rather than as a shifted phrase
  // --only loads just the one track, so a track still being written does not
  // stop the finished ones being checked
  const specs = (ONLY && ONLY !== true)
    ? [await page.evaluate(id => window.MusicHarness.spec(id), ONLY)]
    : await page.evaluate(() => window.MusicHarness.specs());

  /* ---------------- the data ---------------- */
  console.log('written parts:');
  for (const T of specs){
    const lead = T.parts.lead, counter = T.parts.counter, bass = T.parts.bass;
    const padNotes = T.chords.flatMap(c => c.padMidi.map(n => ({ n })));
    const all = [...lead, ...counter, ...bass, ...padNotes,
                 ...T.chords.map(c => ({ n: c.bassMidi }))];

    const offKey = all.filter(e => !T.keyPitchClasses.includes(e.n % 12)).map(e => name(e.n));
    ok(`${T.id}: every note in ${T.key}`, offKey.length === 0, offKey.join(' '));

    const badRange = [
      ...lead.filter(e => e.n < LEAD_RANGE[0] || e.n > LEAD_RANGE[1]).map(e => 'lead ' + name(e.n)),
      ...counter.filter(e => e.n < COUNTER_RANGE[0] || e.n > COUNTER_RANGE[1]).map(e => 'counter ' + name(e.n)),
      ...bass.filter(e => e.n < BASS_RANGE[0] || e.n > BASS_RANGE[1]).map(e => 'bass ' + name(e.n)),
    ];
    ok(`${T.id}: parts in register`, badRange.length === 0, badRange.join(' '));

    /* A melody note a semitone from a chord tone under it is the one interval
       that reads as a mistake rather than as colour. Sustained notes only: a
       short passing note through a clash is ordinary voice leading.

       EVERY bar the note sounds over, not just the one it starts in. That is
       the whole check: an earlier version looked only at the starting bar and
       so was blind to a note tied ACROSS a barline into the next chord, which
       is exactly where this goes wrong — the tie is what makes the note long
       enough to matter. It missed eighteen of them across the five tracks, and
       they were audible. */
    const clash = [];
    for (const [who, part] of [['lead', lead], ['counter', counter]]){
      for (const e of part){
        if (e.d < 1) continue;
        const first = Math.floor(e.b / T.beatsPerBar);
        const last  = Math.floor((e.b + e.d - 1e-9) / T.beatsPerBar);
        for (let bar = first; bar <= last; bar++){
          const ch = T.chords[bar % T.chords.length];
          // how much of the note actually sounds inside this bar; a hair over
          // the barline is a graceful overlap, not a clash
          const ov = Math.min(e.b + e.d, (bar + 1) * T.beatsPerBar)
                   - Math.max(e.b, bar * T.beatsPerBar);
          if (ov < 0.5) continue;
          for (const p of ch.padMidi){
            const d = Math.abs(e.n - p) % 12;
            if (d === 1 || d === 11)
              clash.push(`${who} ${name(e.n)}@${e.b} vs ${ch.name} ${name(p)}`
                         + (bar !== first ? ' [tied in]' : ''));
          }
        }
      }
    }
    ok(`${T.id}: no sustained semitone clashes`, clash.length === 0, clash.slice(0, 6).join(', '));

    /* And the two melodic lines against each other. Two voices a semitone apart
       and sounding together is the same fault one octave sideways, and nothing
       was looking for it — the pad check cannot see it because neither note is
       in the pad. */
    const cross = [];
    for (const a of lead) for (const b of counter){
      const ov = Math.min(a.b + a.d, b.b + b.d) - Math.max(a.b, b.b);
      if (ov < 0.5) continue;
      const d = Math.abs(a.n - b.n) % 12;
      if (d === 1 || d === 11)
        cross.push(`${name(a.n)}@${a.b} vs ${name(b.n)}@${b.b}`);
    }
    ok(`${T.id}: the two lines never rub a semitone`, cross.length === 0, cross.slice(0, 6).join(', '));

    // the brief: at least 8 bars, ideally 16, before the tune repeats itself
    const half = T.bars / 2, mid = half * T.beatsPerBar;
    const shape = es => es.map(e => `${e.b % mid},${e.n},${e.d}`).join(' ');
    ok(`${T.id}: ${T.bars}-bar melody, second half is not the first`,
       shape(lead.filter(e => e.b < mid)) !== shape(lead.filter(e => e.b >= mid)),
       `${lead.length} notes`);

    // a real progression, not a drone: a chord change at least every 2 bars
    const held = [];
    let run = 1;
    for (let i = 1; i <= T.chords.length; i++){
      const same = T.chords[i % T.chords.length].name === T.chords[i - 1].name;
      if (same) run++; else { if (run > 2) held.push(`${T.chords[i - 1].name} x${run}`); run = 1; }
    }
    ok(`${T.id}: chords move at least every 2 bars`, held.length === 0, held.join(' '));
    ok(`${T.id}: ${new Set(T.chords.map(c => c.name)).size} distinct chords`,
       new Set(T.chords.map(c => c.name)).size >= 5, T.chords.map(c => c.name).join(' '));

    /* The counter-line has to be a second voice, not a doubling. What makes it
       one is that it MOVES at different times: sharing a bar is fine, sharing
       every onset is one thick melody. Landing together on some beats is the
       point — that is where the two lines agree — so this asks for half, not
       all. Note onsets, not sounding notes: a counter-line entering while the
       lead rings is ordinary counterpoint, not a doubling. */
    const leadHits = new Set(lead.map(e => Math.round(e.b * 8)));
    const free = counter.filter(e => !leadHits.has(Math.round(e.b * 8))).length;
    ok(`${T.id}: counter-line moves independently of the lead`,
       counter.length >= 8 && free / counter.length >= 0.5,
       `${free}/${counter.length} onsets fall off the lead's`);

    ok(`${T.id}: has percussion`, T.drums.length >= 2, T.drums.join(' '));
  }

  /* distinctness — the point is five pieces, not five skins */
  if (!ONLY){
    console.log('distinctness:');
    const uniq = k => new Set(specs.map(t => JSON.stringify(t[k]))).size;
    ok('five different tempos', uniq('bpm') === 5, specs.map(t => t.bpm).join(' '));
    ok('five different lead voices', uniq('lead') === 5, specs.map(t => t.lead).join(' '));
    ok('five different keys', new Set(specs.map(t => t.key)).size === 5, specs.map(t => t.key).join(' | '));
    ok('five different chord loops', uniq('chords') === 5);
    ok('five different melodies', new Set(specs.map(t => JSON.stringify(t.parts.lead))).size === 5);
    ok('more than one metre', new Set(specs.map(t => t.beatsPerBar)).size > 1,
       specs.map(t => `${t.id} ${t.beatsPerBar}/4`).join(' '));
  }

  /* ---------------- the audio ---------------- */
  console.log('rendered audio:');
  if (flag('wav')) fs.mkdirSync(OUT, { recursive: true });
  const levels = [];
  for (const T of specs){
    const bpm = T.bpm + T.bpmUp * Math.min(1, Math.max(0, (LEVEL - 1) % 10 / 9));
    const loopSec = T.totalBeats * 60 / bpm;
    const seconds = SECONDS === null ? loopSec + 1.5 : SECONDS;
    const r = await page.evaluate(([id, level, seconds]) =>
      window.MusicHarness.render(id, { level, seconds }), [T.id, LEVEL, seconds]);
    if (!r){ ok(`${T.id}: renders`, false); continue; }
    const rate = r.rate;
    const raw = Buffer.from(r.pcm16, 'base64');
    const x = new Float32Array(raw.length / 2);
    for (let i = 0; i < x.length; i++) x[i] = raw.readInt16LE(i * 2) / 32767;

    let peak = 0, sum = 0;
    for (const v of x){ const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; }
    const rms = Math.sqrt(sum / x.length);
    levels.push({ id: T.id, peak, rms });
    ok(`${T.id}: no clipping`, peak < 0.99, `peak ${peak.toFixed(3)} rms ${rms.toFixed(4)}`);

    /* Every written lead note, checked where it should be sounding: the
       expected fundamental must beat both semitone neighbours. This is what
       catches a pattern that parsed but landed on the wrong beat, or a voice
       whose fundamental is missing entirely. */
    const secPerBeat = 60 / bpm;
    const T0 = 0.05;                       // start() starts the transport at +0.05
    let checked = 0; const wrong = [];
    for (const e of T.parts.lead){
      /* Measure INTO the note, not at its onset, where you would be reading the
         attack transient rather than the pitch. A quarter of the way in, or
         120ms, whichever is sooner — the cap matters because a long note's
         quarter point is most of a second in, by which time a slow release has
         taken the fundamental down with it.

         This is a fairer place to look, not a lenient one: where a tail really
         does bury the next note (Night's lead delay did, at bar 13) the check
         still fails here, and the fix is the mix. */
      const ring = e.d * secPerBeat;
      const t0 = T0 + e.b * secPerBeat + Math.min(ring * 0.25, 0.12);
      const len = Math.min(Math.floor(rate * ring * 0.5), Math.floor(rate * 0.25));
      const start = Math.floor(rate * t0);
      if (len < 1024 || start + len >= x.length) continue;
      const f = midiHz(e.n);
      const m0 = goertzel(x, start, len, f, rate);
      const up = goertzel(x, start, len, f * Math.pow(2, 1 / 12), rate);
      const dn = goertzel(x, start, len, f * Math.pow(2, -1 / 12), rate);
      checked++;
      if (!(m0 > up * 1.15 && m0 > dn * 1.15)) wrong.push(`${name(e.n)}@${e.b}`);
    }
    ok(`${T.id}: ${checked} lead notes sound at the written pitch`,
       wrong.length === 0, wrong.slice(0, 6).join(' '));

    if (flag('wav')){
      const f = path.join(OUT, `music-${T.id}.wav`);
      fs.writeFileSync(f, wavFile(x, rate));
      console.log(`       wrote ${path.relative(process.cwd(), f)}  ` +
                  `${T.bpm}bpm ${T.beatsPerBar}/4 ${T.key} ${T.lead}  ` +
                  `loop ${loopSec.toFixed(1)}s`);
    }
  }

  /* One biome must not be noticeably louder than the next — a theme change is a
     mood change, not a volume change. */
  if (levels.length === 5){
    const rs = levels.map(l => l.rms);
    const spread = Math.max(...rs) / Math.min(...rs);
    ok('tracks within 1.5x loudness of each other', spread < 1.5,
       'spread ' + spread.toFixed(2) + 'x  ' +
       levels.map(l => `${l.id} ${l.rms.toFixed(4)}`).join(' '));
  }

  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  /* Everything above measures a RENDER. This plays the music on the actual game
     page, walking the biomes the way a run does, with `lookAhead` forced to 0.

     That last part is the whole check. Tone normally schedules ~100ms early, so
     a hit built from several taps a few ms apart gets those taps as written. On
     a page busy rendering a game the scheduled time arrives already spent and
     Tone clamps it to now — and the taps collapse onto one instant. Doing that
     to a MONOPHONIC voice throws from inside the callback and takes the
     transport down with it, which is what a clap made of three triggers on one
     NoiseSynth did in the game while all sixty-odd checks above it passed.

     At lookAhead 0 every hit lands at ~now, so the collapse happens on every
     run instead of on some of them. Reproduced intermittently at the default
     and never at all on an idle page — hence this, and hence the game page
     rather than a synthetic loop. */
  console.log('live on the game page:');
  const IDS = ['meadow', 'ponds', 'bubblegum', 'night', 'hell'];
  const gameUrl = URL.replace(/tools\/music\.html.*$/, 'index.html');
  const gpage = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const gerr = [];
  gpage.on('pageerror', e => gerr.push(String(e.message)));
  gpage.on('console', m => {
    if (m.type() === 'error' && !m.text().includes('404')) gerr.push(m.text());
  });
  await gpage.goto(gameUrl, { waitUntil: 'load' });
  await gpage.waitForFunction(() => window.Music);
  await gpage.waitForTimeout(1500);
  await gpage.evaluate(() => { Tone.getContext().lookAhead = 0; });
  await gpage.evaluate(() => Audio.startMusic());
  for (let i = 0; i < 5; i++){
    const before = gerr.length;
    await gpage.evaluate(t => Audio.setMusicTheme(t), i);
    await gpage.waitForTimeout(2600);
    ok(`${IDS[i]}: plays in the game without throwing`,
       gerr.length === before, gerr.slice(before, before + 2).join(' | '));
  }
  await gpage.evaluate(() => Audio.stopMusic());
  await gpage.close();

  await browser.close();
  if (fail.length){ console.error(`\n${fail.length} check(s) failed.`); process.exit(1); }
})().catch(e => { console.error('harness failed:', e.message); process.exit(2); });
