#!/usr/bin/env node
/* =======================================================================
   ROUTE EDITOR — the shape library, editable

   `js/shapes.js` is the deck the spawn director chains routes out of, and it
   is plain data: nineteen shapes of two to seven normalised beats. Editing it
   by hand means holding an arena in your head, which is exactly the thing a
   picture is for — every shape in this file was drawn on graph paper first.

   So: this serves the repo AND an editor over the same origin, reads the real
   `js/shapes.js`, and writes it straight back. There is no separate copy of
   the data and no build step — the game loads the same file it always did, so
   a saved shape is live on the next reload. The editor page runs the GAME's
   own arithmetic for its checks (it loads config.js and formations.js), so
   the step times and the readability score it reports are the ones the
   director will actually use, not a second implementation that can drift.

     node tools/routes.js              # serve, http://localhost:8766/
     node tools/routes.js --check      # validate the library, non-zero on error
     node tools/routes.js --rewrite    # parse and write back — `git diff` must
                                       # come out empty, which is the round-trip
                                       # proof for the writer below

   THE ROUND TRIP IS THE WHOLE CONTRACT. Everything above `const FMT_SHAPES = [`
   and below the closing `];` is preserved byte for byte; only the array body is
   regenerated. A `//` comment block sitting directly above a shape — no blank
   line between — is that shape's note, and comes back as a comment. Anything
   else inside the array (a stray block comment, a note under a blank line) is
   NOT preserved, which is why the file is written in exactly one style.
   ======================================================================= */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'js', 'shapes.js');

/* ------------------------------------------------------------------ read -
   The array is evaluated rather than parsed: it is a JS literal in a file we
   generate ourselves, so a real evaluator is both shorter and more honest than
   a half-parser that would disagree with the browser about a trailing comma.
   The notes are line-scanned separately and matched by id. */
function readShapes(){
  const src = fs.readFileSync(FILE, 'utf8');
  const lines = src.split('\n');
  const start = lines.findIndex(l => /^const FMT_SHAPES = \[/.test(l));
  const end = lines.findIndex((l, i) => i > start && /^\];/.test(l));
  if (start < 0 || end < 0)
    throw new Error(`${FILE}: no "const FMT_SHAPES = [ … ];" block at column 0`);

  const body = lines.slice(start, end + 1).join('\n');
  const shapes = new Function(body.replace(/^const /, 'var ') + '\nreturn FMT_SHAPES;')();

  /* Notes: `//` lines run together directly above a `{ id:'…'` line. A blank
     line breaks the run, so a comment that belongs to the array rather than to
     one shape does not get glued onto whichever shape happens to follow it. */
  let pending = [];
  const notes = {};
  for (const line of lines.slice(start + 1, end)){
    const c = line.match(/^\s*\/\/ ?(.*)$/);
    if (c){ pending.push(c[1].trimEnd()); continue; }
    const id = line.match(/^\s*\{\s*id\s*:\s*'([^']*)'/);
    if (id){ if (pending.length) notes[id[1]] = pending.join('\n'); pending = []; continue; }
    if (!line.trim()) pending = [];
  }
  for (const s of shapes) s.note = notes[s.id] || '';
  return { shapes, header: lines.slice(0, start + 1), footer: lines.slice(end) };
}

/* ----------------------------------------------------------------- write -
   Two decimals and no trailing zeros for a coordinate, one kept for `span`
   because it is a fraction of the arena and reads as one. The file's own
   formatting is whatever comes out of here — it was canonicalised the first
   time this ran, which is what makes `--rewrite` + an empty `git diff` a real
   proof rather than a comparison against hand-wrapped lines nobody can
   reproduce. */
const num = v => String(Math.round(v * 100) / 100);
const spanText = v => {
  const t = (Math.round(v * 100) / 100).toFixed(2).replace(/0$/, '');
  return t.endsWith('.') ? t + '0' : t;
};

/* One shape: its note as a `//` block, the fields on one line, then the beats
   wrapped at the width the rest of the repo is written to. */
const WRAP = 76;

function shapeText(s){
  const out = [];
  for (const line of String(s.note || '').split('\n'))
    if (line.trim()) out.push('  // ' + line.trim());
  out.push(`  { id:'${s.id}', min:${s.min}, span:${spanText(s.span)}, ` +
           (s.depth != null ? `depth:${spanText(s.depth)}, ` : '') +
           `weight:${s.weight}, beats:[`);

  const beats = s.beats.map(b =>
    `{x:${num(b.x)},z:${num(b.z)}${b.dash ? ',dash:true' : ''}}`);
  const rows = [];
  let row = '';
  for (const b of beats){
    if (row && row.length + b.length + 2 > WRAP){ rows.push(row); row = ''; }
    row += (row ? ', ' : '') + b;
  }
  rows.push(row);
  rows.forEach((r, i) => out.push('    ' + r + (i === rows.length - 1 ? ' ] },' : ',')));
  return out.join('\n');
}

function writeShapes(shapes){
  const { header, footer } = readShapes();
  const body = shapes.map(shapeText).join('\n\n');
  const text = header.join('\n') + '\n' + body + '\n' + footer.join('\n');
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, FILE);                 // atomic: never a half-written deck
  return text;
}

/* ------------------------------------------------------------ validation -
   Structure only. Whether a shape READS well is geometry, and the editor page
   answers that with the game's own routeNoise rather than a second copy of it
   living here — but nothing that would break the director at parse or emit
   time is allowed onto disk, since the game has no error path for it. */
const ID_RE = /^[a-z][a-z0-9]*$/;
function validate(shapes){
  const errs = [];
  const bad = (i, msg) => errs.push(`shape ${i + 1}${shapes[i] && shapes[i].id ?
                                     ` (${shapes[i].id})` : ''}: ${msg}`);
  if (!Array.isArray(shapes) || !shapes.length) return ['the library is empty'];
  const seen = new Set();
  shapes.forEach((s, i) => {
    if (!s || typeof s !== 'object') return bad(i, 'not an object');
    if (!ID_RE.test(s.id || '')) bad(i, `id ${JSON.stringify(s.id)} is not lowercase a-z0-9`);
    else if (seen.has(s.id)) bad(i, `duplicate id ${s.id}`);
    seen.add(s.id);
    if (!Number.isInteger(s.min) || s.min < 1 || s.min > 99) bad(i, 'min must be 1-99');
    if (!(s.span > 0.05 && s.span <= 1)) bad(i, 'span must be 0.05-1');
    // depth is optional — absent means FMT_DEPTH, which is where every shape
    // sat before z was adjustable. The editor omits it when it matches, so the
    // default lives in formations.js only and cannot drift into this file.
    if (s.depth != null && !(s.depth > 0.05 && s.depth <= 1))
      bad(i, 'depth must be 0.05-1, or absent for the default');
    if (!Number.isInteger(s.weight) || s.weight < 1 || s.weight > 6) bad(i, 'weight must be 1-6');
    if (!Array.isArray(s.beats) || s.beats.length < 2) bad(i, 'needs at least 2 beats');
    else if (s.beats.length > 12) bad(i, 'more than 12 beats — FOOD_CAP is 18 for a whole route');
    else s.beats.forEach((b, j) => {
      for (const k of ['x', 'z'])
        if (!Number.isFinite(b[k]) || Math.abs(b[k]) > 1)
          bad(i, `beat ${j + 1}: ${k} must be a number in -1..1`);
    });
    if (s.note != null && typeof s.note !== 'string') bad(i, 'note must be text');
  });
  return errs;
}

/* Everything the writer accepts, and nothing it does not: a PUT body is JSON
   from a page, so the shapes that reach disk are rebuilt field by field. */
function clean(shapes){
  return shapes.map(s => ({
    id: String(s.id || '').trim(),
    min: Math.round(Number(s.min)),
    span: Math.round(Number(s.span) * 100) / 100,
    ...(Number.isFinite(Number(s.depth))
        ? { depth: Math.round(Number(s.depth) * 100) / 100 } : {}),
    weight: Math.round(Number(s.weight)),
    note: String(s.note || '').replace(/\r/g, ''),
    beats: (Array.isArray(s.beats) ? s.beats : []).map(b => {
      const o = { x: Math.round(Number(b.x) * 100) / 100,
                  z: Math.round(Number(b.z) * 100) / 100 };
      if (b.dash) o.dash = true;
      return o;
    }),
  }));
}

/* ---------------------------------------------------------------- server -
   The repo is served alongside the editor so both live on one origin: the
   TEST button opens the real game at ?shape=<id>, which only works if the
   game is a same-origin URL away. */
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png',
  '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.glb':'model/gltf-binary',
  '.ico':'image/x-icon', '.md':'text/plain; charset=utf-8', '.wav':'audio/wav' };

function send(res, code, body, type){
  res.writeHead(code, { 'content-type': type || 'text/plain; charset=utf-8',
                        'cache-control': 'no-store' });
  res.end(body);
}
const sendJSON = (res, code, o) => send(res, code, JSON.stringify(o), 'application/json');

function serveFile(res, file){
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'not found');
    send(res, 200, buf, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
}

function serve(port){
  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(url.pathname);

    if (p === '/api/shapes' && req.method === 'GET'){
      try { return sendJSON(res, 200, { shapes: readShapes().shapes, file: 'js/shapes.js' }); }
      catch (e){ return sendJSON(res, 500, { error: String(e.message) }); }
    }
    if (p === '/api/shapes' && req.method === 'PUT'){
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', () => {
        let shapes;
        try { shapes = clean(JSON.parse(body).shapes); }
        catch (e){ return sendJSON(res, 400, { error: 'bad JSON: ' + e.message }); }
        const errs = validate(shapes);
        if (errs.length) return sendJSON(res, 400, { error: errs.join('\n'), errors: errs });
        try { writeShapes(shapes); }
        catch (e){ return sendJSON(res, 500, { error: String(e.message) }); }
        console.log(`  wrote js/shapes.js — ${shapes.length} shapes`);
        // read back, so the page ends up holding exactly what is on disk
        return sendJSON(res, 200, { ok: true, shapes: readShapes().shapes });
      });
      return;
    }

    if (p === '/' || p === '/editor') return serveFile(res, path.join(__dirname, 'routeeditor.html'));

    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'forbidden');
    fs.stat(file, (err, st) => {
      if (err || st.isDirectory()) return send(res, 404, 'not found');
      serveFile(res, file);
    });
  }).listen(port, () => {
    console.log(`route editor   http://localhost:${port}/`);
    console.log(`the game       http://localhost:${port}/index.html`);
    console.log(`editing        ${path.relative(process.cwd(), FILE)}  (git is the undo)`);
  });
}

/* ------------------------------------------------------------------ main -*/
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i < 0 ? dflt : argv[i + 1];
};

if (argv.includes('--check') || argv.includes('--rewrite')){
  const { shapes } = readShapes();
  const errs = validate(shapes);
  for (const s of shapes){
    const dash = s.beats.filter(b => b.dash).length;
    console.log(`  ${s.id.padEnd(10)} min ${String(s.min).padStart(2)}  ` +
                `weight ${s.weight}  span ${s.span}` +
                (s.depth != null ? `  depth ${s.depth}` : '') +
                `  ${s.beats.length} beats` +
                (dash ? `  ${dash} dash` : ''));
  }
  console.log(`  ${shapes.length} shapes`);
  if (errs.length){ console.error('FAIL\n  ' + errs.join('\n  ')); process.exit(1); }
  if (argv.includes('--rewrite')){
    writeShapes(shapes);
    console.log('  rewritten — `git diff js/shapes.js` should be empty');
  }
  console.log('ok');
} else {
  serve(Number(arg('--port', 8766)));
}
