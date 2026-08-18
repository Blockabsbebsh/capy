/* =======================================================================
   DEV LEVEL SWITCHER (testing aid — not part of normal play)
   Toggle with DEV_MODE below, or by adding ?dev=1 to the URL.
   ======================================================================= */
const DEV_MODE = /[?&]dev=1\b/.test(location.search);
// one biome every THEME_EVERY levels — see themeFor
const DEV_LEVELS = [
  { level:1,  label:'1 · Meadow' },
  { level:11, label:'11 · Pond' },
  { level:21, label:'21 · Candy' },
  { level:31, label:'31 · Night' },
  { level:41, label:'41 · Hell' },
];
function jumpToLevel(n){
  if (game.state === 'menu') startGame();
  game.level = n;
  game.devLock = true;
  game.elapsed = 0;
  applyDifficulty();
  const th = themeFor(n);
  applyTheme(th, true);
  Audio.setMusicTheme(THEMES.indexOf(th));
  clearItems(); clearHoles(); resetFormations();
  refreshHUD();
  [...ui.testLevelButtons.children].forEach(b =>
    b.classList.toggle('active', Number(b.dataset.level) === n));
}
/* =======================================================================
   ROW LEVEL SECURITY SELF-CHECK

   The board looks identical whether or not RLS holds — it reads and writes
   correctly either way — so the only way to know is to try the thing that
   must fail: an anon INSERT straight into the table, bypassing submit_score
   and every guard in it.

   Supabase's SQL Editor cannot answer this. It runs as the table owner and
   bypasses RLS entirely, so it reports success no matter how the policies
   are set. The question is only meaningful from a browser holding the
   publishable key, which is exactly what this page is.

   It runs a READ first. Without that, a wrong URL answers 404 to the write
   and reads as "refused" — a false pass, which is the worst possible result
   for a security check. A write is only evidence once a read has proved we
   are talking to the right project at all.
   ======================================================================= */
async function rlsCheck(out){
  const set = (t, c) => { out.textContent = t; out.style.color = c; };
  if (!scoresOn()){
    set('SCORE_API is blank — the board is switched off, nothing to check.', '#ffb347');
    return;
  }
  set('Checking…', '#e6c090');

  let read = 0;
  try {
    const r = await fetch(SCORE_API.url + '/rest/v1/runs?select=tag&limit=1', { headers: apiHeaders() });
    read = r.status;
  } catch(e){ read = 0; }
  if (read !== 200){
    set('INCONCLUSIVE — the board itself did not answer (read ' +
        (read || 'network error') + '). Fix SCORE_API first; a write test ' +
        'proves nothing until reads work.', '#ffb347');
    showBanner('RLS CHECK INCONCLUSIVE', '#ffb347');
    return;
  }

  let write = 0;
  try {
    const r = await fetch(SCORE_API.url + '/rest/v1/runs', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ tag: 'RLSCHECK', score: 999999, secs: 999 }),
    });
    write = r.status;
  } catch(e){ write = 0; }

  if (write === 401 || write === 403){
    set('PASS — read 200, direct write refused (' + write + '). ' +
        'submit_score is the only way in.', '#9fe07a');
    showBanner('RLS OK — DIRECT WRITES REFUSED', '#9fe07a');
  } else if (write >= 200 && write < 300){
    set('FAIL — anon inserted straight into the table (' + write + '). Every ' +
        'guard in submit_score is bypassable. Re-run the migration, then ' +
        "delete the row: delete from public.runs where tag = 'RLSCHECK';", '#ff5d73');
    showBanner('RLS FAIL — ANON CAN WRITE', '#ff5d73');
  } else {
    set('INCONCLUSIVE — unexpected answer to the write (' +
        (write || 'network error') + '). Not proof of anything either way.', '#ffb347');
    showBanner('RLS CHECK INCONCLUSIVE', '#ffb347');
  }
}

if (DEV_MODE){
  /* The panel is markup inside #hud, and #hud sets z-index:15, which makes it
     a stacking context — so the panel's own z-index:50 is only meaningful
     among #hud's children and can never lift it above #startPanel at 20. It
     also inherits #hud's opacity:0 while the menu is up. On a desktop the
     start card is capped at 520px so the panel sits beside it and neither
     problem shows; on a phone the card is 96vw and buries it completely.
     Reparenting to <body> takes it out of that stacking context entirely. */
  document.body.appendChild(ui.testLevelPanel);
  ui.testLevelPanel.style.position = 'fixed';
  ui.testLevelPanel.style.zIndex = '60';
  ui.testLevelPanel.style.display = 'block';
  DEV_LEVELS.forEach(({level, label}) => {
    const b = document.createElement('button');
    b.className = 'testlevel-btn';
    b.textContent = label;
    b.dataset.level = level;
    b.addEventListener('click', () => jumpToLevel(level));
    ui.testLevelButtons.appendChild(b);
  });

  /* Built here rather than in index.html so dev.js stays deletable in one
     piece, per CLAUDE.md. The result needs far more width than the level
     panel has, so it gets its own box. */
  const out = document.createElement('div');
  out.style.cssText = 'position:fixed; left:8px; bottom:8px; z-index:22; ' +
    'max-width:min(78vw,340px); padding:9px 11px; border-radius:10px; ' +
    'background:rgba(20,14,10,.92); border:1px solid rgba(255,205,140,.35); ' +
    'font-size:11.5px; line-height:1.45; color:#e6c090; display:none;';
  document.body.appendChild(out);

  const rls = document.createElement('button');
  rls.className = 'testlevel-btn';
  rls.textContent = 'RLS CHECK';
  rls.addEventListener('click', () => {
    out.style.display = 'block';
    rlsCheck(out);
  });
  ui.testLevelButtons.appendChild(rls);
}

