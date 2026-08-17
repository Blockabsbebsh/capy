#!/usr/bin/env node
/* Music harness: checks the five biome themes, and can write them out as WAVs.
 *
 * The music is the one part of this game that cannot be verified by looking at
 * it, so it is verified two ways, each for what it is actually good for:
 *
 *   the DATA  — every written note, checked symbolically: in key, in range, and
 *               not fighting the chord underneath it. Notes cannot be read back
 *               out of a mix reliably (a square wave's 7th harmonic reads as an
 *               out-of-key pitch; the kick's downward sweep reads as a bass
 *               note), so nothing here guesses at pitch from audio.
 *   the AUDIO — rendered offline and measured for what audio does tell you:
 *               clipping, per-theme loudness, and — via a Goertzel filter at the
 *               expected fundamental — that the written note is really sounding
 *               at the written time, rather than a semitone off or silent.
 *
 * A human still has to say whether the tune is any good. `--wav` is for that.
 *
 *   npm i playwright-core            # not committed; chromium is preinstalled
 *   python3 -m http.server 8765 &
 *   node tools/music.js              # checks; exits non-zero on failure
 *   node tools/music.js --wav        # + write .shots/music-<theme>.wav
 *   node tools/music.js --wav --level 10 --seconds 30
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? dflt : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true);
};
const URL     = flag('url', 'http://localhost:8765/index.html');
const OUT     = flag('out', path.join(__dirname, '..', '.shots'));
const BROWSER = flag('browser', process.env.CHROMIUM_PATH
                 || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const LEVEL   = +(flag('level', 1));
const SECONDS = +(flag('seconds', 20));

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch { console.error('playwright-core is not installed. Run: npm i playwright-core'); process.exit(2); }

const NOTE = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const name = m => NOTE[m % 12] + (Math.floor(m / 12) - 1);

/* What each piece is allowed to use. Written out here rather than derived from
   the data, so that a typo in a pattern cannot also redefine the key it is
   checked against. */
const KEYS = {
  meadow: { key:'G major',           pcs:[7,9,11,0,2,4,6] },
  pond:   { key:'D major',           pcs:[2,4,6,7,9,11,1] },
  candy:  { key:'A major',           pcs:[9,11,1,2,4,6,8] },
  night:  { key:'A minor (+G# of E7)', pcs:[9,11,0,2,4,5,7,8] },
  hell:   { key:'D harmonic minor',  pcs:[2,4,5,7,9,10,1] },
};
const LEAD_RANGE = [69, 90];      // the tune sits above the pad, below shrill
const BASS_RANGE = [33, 57];

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
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

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
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio'],
  });
  const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  // pat()/events() report a miscounted bar or a stray hold through console.error
  page.on('console', m => {
    if (m.type() === 'error' && m.text().includes('[audio]')) errors.push(m.text());
  });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const themes = await page.evaluate(() => Audio.musicData());

  /* ---------------- the data ---------------- */
  console.log('written parts:');
  for (const T of themes){
    const K = KEYS[T.id];
    if (!K){ ok(`${T.id}: known theme`, false); continue; }

    const lead = T.leadAt.map((e, s) => e && { ...e, s }).filter(Boolean);
    const bass = T.bassAt.map((e, s) => e && { ...e, s }).filter(Boolean);
    const all = [...lead, ...bass, ...T.chords.flatMap(c => [{ n:c.bass }, ...c.pad.map(n => ({ n }))])];

    const offKey = all.filter(e => !K.pcs.includes(e.n % 12)).map(e => name(e.n));
    ok(`${T.id}: every note in ${K.key}`, offKey.length === 0, offKey.join(' '));

    const badRange = [
      ...lead.filter(e => e.n < LEAD_RANGE[0] || e.n > LEAD_RANGE[1]).map(e => 'lead ' + name(e.n)),
      ...bass.filter(e => e.n < BASS_RANGE[0] || e.n > BASS_RANGE[1]).map(e => 'bass ' + name(e.n)),
    ];
    ok(`${T.id}: parts in register`, badRange.length === 0, badRange.join(' '));

    /* A melody note a semitone from a chord tone under it is the one interval
       that reads as a mistake rather than as colour. Sustained notes only: a
       single-step passing note through a clash is ordinary voice leading. */
    const clash = [];
    for (const e of lead){
      if (e.len < 2) continue;
      const ch = T.chords[Math.floor(e.s / T.stepsPerBar) % T.chords.length];
      for (const p of ch.pad){
        const d = Math.abs(e.n - p) % 12;
        if (d === 1 || d === 11) clash.push(`${name(e.n)} vs ${name(p)}`);
      }
    }
    ok(`${T.id}: no sustained semitone clashes`, clash.length === 0, clash.join(', '));

    // the melody has to be a phrase, not a pool: it must repeat something
    const shape = lead.map(e => e.n).join(',');
    const motif = lead.slice(0, 3).map(e => e.n).join(',');
    ok(`${T.id}: melody has ${lead.length} written notes`, lead.length >= 8, shape.slice(0, 60) + '…');
    if (!motif) fail.push(`${T.id}: empty melody`);
  }

  /* distinctness — the point of the rework is five pieces, not five skins */
  console.log('distinctness:');
  const uniq = k => new Set(themes.map(t => JSON.stringify(t[k]))).size;
  ok('five different tempos', uniq('tempo') === 5, themes.map(t => t.tempo).join(' '));
  ok('five different lead voices', uniq('lead') === 5, themes.map(t => t.lead).join(' '));
  ok('five different chord loops', uniq('chords') === 5);
  ok('five different melodies', uniq('leadAt') === 5);
  ok('more than one metre', new Set(themes.map(t => t.stepsPerBar * t.stepBeats)).size > 1,
     themes.map(t => `${t.id} ${t.stepsPerBar * t.stepBeats}/4`).join(' '));

  /* ---------------- the audio ---------------- */
  console.log('rendered audio:');
  if (flag('wav')) fs.mkdirSync(OUT, { recursive: true });
  const levels = [];
  for (let i = 0; i < themes.length; i++){
    const r = await page.evaluate(([i, level, seconds]) =>
      Audio.renderTheme({ theme: i, level, seconds }), [i, LEVEL, SECONDS]);
    if (!r){ ok(`${themes[i].id}: renders`, false); continue; }
    const T = themes[i], x = r.pcm, rate = r.rate;

    let peak = 0, sum = 0;
    for (const v of x){ const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; }
    const rms = Math.sqrt(sum / x.length);
    levels.push({ id: T.id, peak, rms });
    ok(`${T.id}: no clipping`, peak < 0.99, `peak ${peak.toFixed(3)} rms ${rms.toFixed(4)}`);

    /* Every written lead note, checked where it should be sounding: the
       expected fundamental must beat both semitone neighbours. This is what
       catches a pattern that parsed but landed on the wrong step, or a voice
       whose fundamental is missing entirely. */
    const stepDur = (60 / r.tempo) * T.stepBeats;
    let checked = 0, wrong = [];
    const lead = T.leadAt.map((e, s) => e && { ...e, s }).filter(Boolean);
    for (const e of lead){
      const swing = (T.swing && (e.s % T.stepsPerBar) % 2 === 1) ? stepDur * T.swing : 0;
      const t0 = 0.05 + e.s * stepDur + swing + 0.02;
      // stay inside the note: it rings for len * stepDur * leadDecay, and a
      // window that runs past that measures the gap and the other instruments
      const ring = e.len * stepDur * (T.leadDecay || 1);
      const len = Math.min(Math.floor(rate * ring * 0.65), Math.floor(rate * 0.22));
      const start = Math.floor(rate * t0);
      if (len < 512 || start + len >= x.length) continue;
      const f = midiHz(e.n);
      const m0 = goertzel(x, start, len, f, rate);
      const up = goertzel(x, start, len, f * Math.pow(2, 1 / 12), rate);
      const dn = goertzel(x, start, len, f * Math.pow(2, -1 / 12), rate);
      checked++;
      if (!(m0 > up * 1.15 && m0 > dn * 1.15)) wrong.push(`${name(e.n)}@${e.s}`);
    }
    ok(`${T.id}: ${checked} lead notes sound at the written pitch`,
       wrong.length === 0, wrong.slice(0, 6).join(' '));

    if (flag('wav')){
      const f = path.join(OUT, `music-${T.id}.wav`);
      fs.writeFileSync(f, wavFile(x, rate));
      console.log(`       wrote ${path.relative(process.cwd(), f)}  ` +
                  `${T.tempo}bpm ${T.stepsPerBar * T.stepBeats}/4 ${T.lead}`);
    }
  }

  /* One biome must not be noticeably louder than the next — a theme change is a
     mood change, not a volume change. */
  if (levels.length === themes.length){
    const rs = levels.map(l => l.rms);
    const spread = Math.max(...rs) / Math.min(...rs);
    ok('themes within 1.5x loudness of each other', spread < 1.5,
       'spread ' + spread.toFixed(2) + 'x  ' +
       levels.map(l => `${l.id} ${l.rms.toFixed(4)}`).join(' '));
  }

  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  if (fail.length){ console.error(`\n${fail.length} check(s) failed.`); process.exit(1); }
})().catch(e => { console.error('harness failed:', e.message); process.exit(2); });
