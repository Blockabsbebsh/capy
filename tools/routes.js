#!/usr/bin/env node
/* =======================================================================
   ROUTE EDITOR — the route library, editable

   `js/routes.js` is the deck the spawn director emits from, and it is plain
   data: routes of three to fourteen beats in a unit disc. Editing it by hand
   means holding an arena in your head, which is exactly the thing a picture is
   for — and now that a route lands exactly as drawn, the picture is the whole
   contract rather than an approximation of one.

   So: this serves the repo AND an editor over the same origin, reads the real
   `js/routes.js`, and writes it straight back. There is no separate copy of
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

   THE ROUND TRIP IS THE WHOLE CONTRACT. Everything above `const ROUTES = [`
   and below the closing `];` is preserved byte for byte; only the array body is
   regenerated. A `//` comment block sitting directly above a route — no blank
   line between — is that route's note, and comes back as a comment. Anything
   else inside the array (a stray block comment, a note under a blank line) is
   NOT preserved, which is why the file is written in exactly one style.
   ======================================================================= */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'js', 'routes.js');

/* ------------------------------------------------------------------ parse -
   A hand-written reader for exactly the grammar `shapeText` below writes:
   an array of `{ id:'…', min:N, weight:N, beats:[ {x:N,z:N[,dash:true]}, … ] }`
   objects. This used to be `new Function(body)()` — quicker to write, since a
   real evaluator IS a parser for this — but the "note" field is free text a
   page PUTs in and this file re-reads, and it lands in the array as a `//`
   comment. A `//` comment ends at any of `\n`, a bare `\r`, or the Unicode
   U+2028/U+2029 separators — `clean()` strips those from a note before it is
   written, but nothing should also depend on that being the only guard, since
   this reader runs on whatever is actually on disk (hand-edited, or written by
   an older build). So: no evaluator. Comment-only lines are dropped before
   parsing (notes are extracted from them separately, below, unparsed either
   way), and everything else is tokenised as data — numbers, single-quoted
   strings, `true` — never executed, so no text a note can carry becomes code. */
function parseRouteArray(text){
  let i = 0;
  const n = text.length;
  const ws = () => { while (i < n && /\s/.test(text[i])) i++; };
  const fail = msg => { throw new Error(`${msg} at offset ${i}: ${JSON.stringify(text.slice(i, i + 24))}`); };
  const expect = ch => { ws(); if (text[i] !== ch) fail(`expected '${ch}'`); i++; };
  function value(){
    ws();
    const c = text[i];
    if (c === '{') return object();
    if (c === '[') return array();
    if (c === "'") return string();
    if (text.startsWith('true', i)){ i += 4; return true; }
    if (/[-\d]/.test(c)) return number();
    fail('unexpected token');
  }
  function string(){
    expect("'");
    let s = '';
    while (text[i] !== "'"){
      if (i >= n) fail('unterminated string');
      s += text[i++];
    }
    i++;
    return s;
  }
  function number(){
    const start = i;
    if (text[i] === '-') i++;
    while (i < n && /[\d.]/.test(text[i])) i++;
    const v = Number(text.slice(start, i));
    if (!Number.isFinite(v)) fail('bad number');
    return v;
  }
  function array(){
    expect('[');
    const out = [];
    ws();
    if (text[i] === ']'){ i++; return out; }
    for (;;){
      out.push(value());
      ws();
      if (text[i] === ','){ i++; ws(); if (text[i] === ']'){ i++; break; } continue; }
      if (text[i] === ']'){ i++; break; }
      fail("expected ',' or ']'");
    }
    return out;
  }
  function object(){
    expect('{');
    const out = {};
    ws();
    if (text[i] === '}'){ i++; return out; }
    for (;;){
      ws();
      const start = i;
      while (i < n && /[a-zA-Z0-9_]/.test(text[i])) i++;
      const key = text.slice(start, i);
      if (!key) fail('expected object key');
      expect(':');
      out[key] = value();
      ws();
      if (text[i] === ','){ i++; ws(); if (text[i] === '}'){ i++; break; } continue; }
      if (text[i] === '}'){ i++; break; }
      fail("expected ',' or '}'");
    }
    return out;
  }
  ws();
  const result = array();
  ws();
  if (i !== n) fail('trailing content after the array');
  return result;
}

function readShapes(){
  const src = fs.readFileSync(FILE, 'utf8');
  const lines = src.split('\n');
  const start = lines.findIndex(l => /^const ROUTES = \[/.test(l));
  const end = lines.findIndex((l, i) => i > start && /^\];/.test(l));
  if (start < 0 || end < 0)
    throw new Error(`${FILE}: no "const ROUTES = [ … ];" block at column 0`);

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

  /* The data: the same lines with every comment-only line dropped, so the
     parser above never sees one — a note's text, whatever it contains, is
     never in the string this function tokenises. */
  const dataLines = lines.slice(start + 1, end).filter(l => !/^\s*\/\//.test(l));
  let shapes;
  try { shapes = parseRouteArray('[' + dataLines.join('\n') + ']'); }
  catch (e){ throw new Error(`${FILE}: could not parse the ROUTES array — ${e.message}`); }

  for (const s of shapes) s.note = notes[s.id] || '';
  return { shapes, header: lines.slice(0, start + 1), footer: lines.slice(end) };
}

/* ----------------------------------------------------------------- write -
   Two decimals and no trailing zeros for a coordinate. The file's own
   formatting is whatever comes out of here — it was canonicalised the first
   time this ran, which is what makes `--rewrite` + an empty `git diff` a real
   proof rather than a comparison against hand-wrapped lines nobody can
   reproduce. */
const num = v => String(Math.round(v * 100) / 100);

/* One shape: its note as a `//` block, the fields on one line, then the beats
   wrapped at the width the rest of the repo is written to. */
const WRAP = 76;

function shapeText(s){
  const out = [];
  for (const line of String(s.note || '').split('\n'))
    if (line.trim()) out.push('  // ' + line.trim());
  out.push(`  { id:'${s.id}', min:${s.min}, weight:${s.weight}, beats:[`);

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
   Structure only. Whether a route READS well is geometry, and the editor page
   answers that with a drawing rather than a rule living here — but nothing
   that would break the director at parse or emit time is allowed onto disk,
   since the game has no error path for it. The disc check is the one that
   carries weight: a beat inside the unit disc is inside the arena at every
   rotation, and that promise is what lets a route be dropped at any angle. */
const ID_RE = /^[a-z][a-z0-9]*$/;
const MAX_BEATS = 18;
function validate(shapes){
  const errs = [];
  const bad = (i, msg) => errs.push(`route ${i + 1}${shapes[i] && shapes[i].id ?
                                     ` (${shapes[i].id})` : ''}: ${msg}`);
  if (!Array.isArray(shapes) || !shapes.length) return ['the library is empty'];
  const seen = new Set();
  shapes.forEach((s, i) => {
    if (!s || typeof s !== 'object') return bad(i, 'not an object');
    if (!ID_RE.test(s.id || '')) bad(i, `id ${JSON.stringify(s.id)} is not lowercase a-z0-9`);
    else if (seen.has(s.id)) bad(i, `duplicate id ${s.id}`);
    seen.add(s.id);
    if (!Number.isInteger(s.min) || s.min < 1 || s.min > 99) bad(i, 'min must be 1-99');
    if (!Number.isInteger(s.weight) || s.weight < 1 || s.weight > 6) bad(i, 'weight must be 1-6');
    if (!Array.isArray(s.beats) || s.beats.length < 2) bad(i, 'needs at least 2 beats');
    /* One length limit, in one place, and it is the ribbon's: past about
       eighteen beats a route has more dots than the field can separate. There
       is nothing else to keep it in step with — the old deck carried three
       different numbers for this because a route was assembled at runtime out
       of pieces and each stage guessed at its own ceiling. */
    else if (s.beats.length > MAX_BEATS) bad(i, `more than ${MAX_BEATS} beats`);
    else s.beats.forEach((b, j) => {
      for (const k of ['x', 'z'])
        if (!Number.isFinite(b[k])) return bad(i, `beat ${j + 1}: ${k} must be a number`);
      /* THE UNIT DISC is the contract with the game: a beat inside it is a beat
         inside the arena at every rotation, which is what lets a route be
         dropped at any angle without being clamped into a different figure. */
      if (Math.hypot(b.x, b.z) > 1.0001)
        bad(i, `beat ${j + 1}: outside the disc (${Math.hypot(b.x, b.z).toFixed(2)} > 1)`);
    });
    if (s.note != null && typeof s.note !== 'string') bad(i, 'note must be text');
  });
  return errs;
}

/* Everything the writer accepts, and nothing it does not: a PUT body is JSON
   from a page, so the shapes that reach disk are rebuilt field by field.
   A note is written back as a `//` comment (see shapeText below), and a `//`
   comment ends at ANY ECMAScript LineTerminator — not just `\n`, but also a
   bare `\r` and the Unicode U+2028/U+2029 separators. Strip all four, or a
   note carrying one reopens the file to arbitrary trailing text landing in
   the array as code once read back. */
function clean(shapes){
  return shapes.map(s => ({
    id: String(s.id || '').trim(),
    min: Math.round(Number(s.min)),
    weight: Math.round(Number(s.weight)),
    note: String(s.note || '').replace(/[\r\u2028\u2029]/g, ''),
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

/* Loopback keeps other MACHINES out; it does nothing against other things on
   THIS one — any page already open in a browser, any extension, any other
   local process, can reach 127.0.0.1 exactly as the editor page does, and
   none of that goes through same-origin restrictions (those protect what a
   page can READ back, not whether the request fires). So `/api/routes`
   requires a token generated fresh in memory each launch and handed only to
   the page this server itself serves — nothing else can know it. The Origin
   check below is a second, weaker layer on top of that, not instead of it: a
   browser won't let page JS forge its own Origin header, but a bare local
   script talking raw HTTP can set that header to anything, so it is the
   token that is load-bearing here, not the Origin. */
function serve(port){
  const TOKEN = crypto.randomBytes(24).toString('hex');
  const originOK = o => !o || o === `http://127.0.0.1:${port}` || o === `http://localhost:${port}`;

  function serveEditor(res){
    fs.readFile(path.join(__dirname, 'routeeditor.html'), 'utf8', (err, html) => {
      if (err) return send(res, 404, 'not found');
      const tag = '<script src="/tools/routeeditor.js"></script>';
      const withToken = html.replace(tag,
        `<script>window.ROUTE_TOKEN=${JSON.stringify(TOKEN)};</script>\n${tag}`);
      send(res, 200, withToken, MIME['.html']);
    });
  }

  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(url.pathname);

    if (p === '/api/routes'){
      if (!originOK(req.headers.origin) || req.headers['x-route-token'] !== TOKEN)
        return send(res, 403, 'forbidden');

      if (req.method === 'GET'){
        try { return sendJSON(res, 200, { routes: readShapes().shapes, file: 'js/routes.js' }); }
        catch (e){ return sendJSON(res, 500, { error: String(e.message) }); }
      }
      if (req.method === 'PUT'){
        let body = '';
        req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
        req.on('end', () => {
          let shapes;
          try { shapes = clean(JSON.parse(body).routes); }
          catch (e){ return sendJSON(res, 400, { error: 'bad JSON: ' + e.message }); }
          const errs = validate(shapes);
          if (errs.length) return sendJSON(res, 400, { error: errs.join('\n'), errors: errs });
          try { writeShapes(shapes); }
          catch (e){ return sendJSON(res, 500, { error: String(e.message) }); }
          console.log(`  wrote js/routes.js — ${shapes.length} routes`);
          // read back, so the page ends up holding exactly what is on disk
          return sendJSON(res, 200, { ok: true, routes: readShapes().shapes });
        });
        return;
      }
      return send(res, 405, 'method not allowed');
    }

    if (p === '/' || p === '/editor') return serveEditor(res);

    /* This otherwise hands out any file under ROOT with no allowlist, and a
       dot-prefixed path is repo plumbing, never a game asset: `.git` in
       particular holds the full history, including anything ever committed
       and since removed from HEAD — serving it was never a choice anyone
       made, just a static server with no denylist reaching further than
       intended. */
    if (p.split('/').some(seg => seg.startsWith('.'))) return send(res, 403, 'forbidden');

    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'forbidden');
    fs.stat(file, (err, st) => {
      if (err || st.isDirectory()) return send(res, 404, 'not found');
      serveFile(res, file);
    });
  }).listen(port, '127.0.0.1', () => {
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
    console.log(`  ${s.id.padEnd(12)} min ${String(s.min).padStart(2)}  ` +
                `weight ${s.weight}  ${String(s.beats.length).padStart(2)} beats` +
                (dash ? `  ${dash} dash` : ''));
  }
  console.log(`  ${shapes.length} routes`);
  if (errs.length){ console.error('FAIL\n  ' + errs.join('\n  ')); process.exit(1); }
  if (argv.includes('--rewrite')){
    writeShapes(shapes);
    console.log('  rewritten — `git diff js/routes.js` should be empty');
  }
  console.log('ok');
} else {
  serve(Number(arg('--port', 8766)));
}
