/* =======================================================================
   HIGH SCORE BOARD

   Every row is one RUN, not one player: the same tag appears as often as it has
   beaten itself. What keeps the list from filling with noise is the submit rule
   — a run is only sent when it beat this device's own best, the `isBest` flag
   endGame already computes for the NEW HIGH SCORE banner.

   A tag is a name, not an account. Nothing proves it is yours, the same way
   nothing stopped you typing someone else's initials into an arcade cabinet.

   Nothing here may ever block the game: every call is fire-and-forget, a failed
   submit queues and retries at next boot, and the board falls back to its last
   cached copy. Unfilled SCORE_API hides the whole feature.
   ======================================================================= */
const scoresOn = () => !!(SCORE_API.url && SCORE_API.key);

const LS_TAG   = 'capyTag';
const LS_QUEUE = 'capyScoreQueue';
const LS_CACHE = 'capyBoardCache';

const lsGet = (k, fb) => { try { return JSON.parse(store.get(k)) ?? fb; } catch(e){ return fb; } };
const lsSet = (k, v)  => store.set(k, JSON.stringify(v));

/* Tags are normalised here as well as in submit_score, so what the player
   is shown in the input matches the row that comes back from the server. */
function cleanTag(s){
  return String(s || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim().slice(0, TAG_MAX);
}
const validTag = t => /^[A-Z0-9 _-]{2,12}$/.test(t);

let myTag = '';
myTag = cleanTag(store.get(LS_TAG, ''));

/* Server-supplied text goes through here before it reaches innerHTML. The
   tag regex already rules out every HTML character, so this is the second
   lock on the same door — worth it, since these strings come from whoever
   else has played the game. */
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/* =======================================================================
   TRANSPORT
   ======================================================================= */
const apiHeaders = () => ({
  'apikey': SCORE_API.key,
  'Authorization': 'Bearer ' + SCORE_API.key,
  'Content-Type': 'application/json',
});

async function boardFetch(){
  const url = SCORE_API.url + '/rest/v1/runs' +
              '?select=tag,score,level,combo,created_at' +
              '&order=score.desc&limit=' + BOARD_LIMIT;
  const res = await fetch(url, { headers: apiHeaders() });
  if (!res.ok) throw new Error('board ' + res.status + ' ' + await res.text());
  return await res.json();
}

async function runPost(run){
  const res = await fetch(SCORE_API.url + '/rest/v1/rpc/submit_score', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      p_tag: run.tag, p_score: run.score,
      p_level: run.level, p_combo: run.combo, p_secs: run.secs,
    }),
  });
  if (!res.ok) throw new Error('submit ' + res.status + ' ' + await res.text());
}

/* A run that could not be sent is kept and retried at next boot. The queue
   is capped: someone who plays a long offline session should not come back
   to fifty pending posts, and only their best one is interesting anyway. */
function queueRun(run){
  const q = lsGet(LS_QUEUE, []);
  q.push(run);
  lsSet(LS_QUEUE, q.slice(-5));
}
async function flushQueue(){
  if (!scoresOn()) return;
  const q = lsGet(LS_QUEUE, []);
  if (!q.length) return;
  const left = [];
  for (const run of q){
    try { await runPost(run); }
    catch(e){ left.push(run); }
  }
  lsSet(LS_QUEUE, left);
}

async function submitRun(run){
  try { await runPost(run); return true; }
  catch(e){ console.warn('[scores] submit failed, queued', e); queueRun(run); return false; }
}

/* =======================================================================
   THE BOARD PANEL
   ======================================================================= */
let boardMode = 'all';       // 'all' = every run, 'best' = one row per tag
let boardRows = lsGet(LS_CACHE, { rows: [], at: 0 });
let boardReturn = null;      // panel to go back to when the board closes

function bestPerTag(rows){
  const seen = new Set();
  return rows.filter(r => {
    const t = r.tag;
    if (seen.has(t)) return false;
    seen.add(t);
    return true;                       // rows arrive score-desc, so the first is the best
  });
}

function renderBoard(){
  const rows = boardMode === 'best' ? bestPerTag(boardRows.rows) : boardRows.rows;
  if (!rows.length){
    ui.scoreList.innerHTML = '<div class="scoreempty">No scores yet. Be the first.</div>';
    return;
  }
  let html = '';
  rows.forEach((r, i) => {
    const mine = myTag && r.tag === myTag;
    html += '<div class="scorerow' + (mine ? ' me' : '') + '">' +
              '<span class="scorerank">' + (i + 1) + '</span>' +
              '<span class="scoretag">' + esc(r.tag) + '</span>' +
              '<span class="scorelvl">Lv ' + (r.level || 1) + '</span>' +
              '<span class="scorept">' + Number(r.score).toLocaleString() + '</span>' +
            '</div>';
  });
  ui.scoreList.innerHTML = html;
}

function boardStatus(msg){ ui.scoreStatus.textContent = msg; }

async function refreshBoard(){
  if (!scoresOn()) return;
  boardStatus('Loading…');
  try {
    const rows = await boardFetch();
    boardRows = { rows, at: Date.now() };
    lsSet(LS_CACHE, boardRows);
    renderBoard();
    boardStatus(rows.length + (rows.length === 1 ? ' run' : ' runs') + ' · live');
  } catch(e){
    console.warn('[scores] board fetch failed', e);
    renderBoard();
    boardStatus(boardRows.at
      ? 'Offline · showing the last board from ' + new Date(boardRows.at).toLocaleString()
      : 'Could not reach the score board.');
  }
}

function openBoard(from){
  boardReturn = from || ui.startPanel;
  renderBoard();                      // cache first, so the panel is never empty
  showPanel(ui.scorePanel);
  refreshBoard();
}
function closeBoard(){
  showPanel(boardReturn || ui.startPanel);
}
function setBoardMode(m){
  boardMode = m;
  ui.boardAll.classList.toggle('on', m === 'all');
  ui.boardBest.classList.toggle('on', m === 'best');
  renderBoard();
}

/* =======================================================================
   THE GAME OVER PROMPT

   Shown only on a personal best, so a bad run never asks for anything.
   ======================================================================= */
function showTagPrompt(){
  ui.tagRow.style.display = 'block';
  ui.tagInput.value = myTag;
  ui.tagNote.textContent = myTag
    ? 'Submitting as ' + myTag + ' — change it if you like.'
    : 'Pick a tag. Everyone sees it on the board.';
  ui.btnTagSubmit.disabled = false;
  ui.btnTagSubmit.textContent = 'SUBMIT SCORE';
}
function hideTagPrompt(){ ui.tagRow.style.display = 'none'; }

async function submitFromPrompt(){
  const tag = cleanTag(ui.tagInput.value);
  if (!validTag(tag)){
    ui.tagNote.textContent = 'Tags are 2–12 characters: letters, numbers, space, _ or -';
    ui.tagInput.focus();
    return;
  }
  myTag = tag;
  store.set(LS_TAG, tag);

  ui.btnTagSubmit.disabled = true;
  ui.btnTagSubmit.textContent = 'SENDING…';
  const ok = await submitRun({
    tag, score: game.score, level: game.level,
    combo: game.bestCombo, secs: Math.round(game.elapsed),
  });
  ui.btnTagSubmit.textContent = ok ? 'SUBMITTED' : 'SAVED — WILL RETRY';
  ui.tagNote.textContent = ok
    ? 'On the board as ' + tag + '.'
    : 'No connection. It will go up next time you play.';
  boardRows = { rows: [], at: 0 };     // force a real fetch next time the board opens
}

/* =======================================================================
   WIRING
   ======================================================================= */
if (!scoresOn()){
  ui.btnBoard.style.display = 'none';
  ui.btnBoardOver.style.display = 'none';
}
ui.btnBoard.addEventListener('click', () => openBoard(ui.startPanel));
ui.btnBoardOver.addEventListener('click', () => openBoard(ui.overPanel));
ui.btnBoardClose.addEventListener('click', closeBoard);
ui.boardAll.addEventListener('click', () => setBoardMode('all'));
ui.boardBest.addEventListener('click', () => setBoardMode('best'));
ui.btnTagSubmit.addEventListener('click', submitFromPrompt);
ui.tagInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitFromPrompt(); });

flushQueue();
