/* =======================================================================
   ICONS

   One drawn PNG per perk and power-up, in `assets/icons/`, and the only image
   files the game loads. They were emoji, then inline SVG; emoji went because
   the platform draws them, so the same card was a flat glyph on one machine and
   a glossy sticker on the next — which is why nothing here is text.

   They are BUILT: art lives in `assets/icons/src/` and `tools/icons.py` cuts
   the background, squares it up and quantises it. Editing a PNG here is editing
   a build artefact. The rules:

   - **Lowercase filenames, relative path.** Pages is case-sensitive, and
     `autoShield` is the one id whose file therefore cannot be the id — which is
     what `ICON_SRC` is for.
   - **A square 192px source, transparent, 3-6KB.** Drawn at 18px on the rail
     and 46px on a card, so it is always downscaled, with headroom for a 3x
     screen at the largest of those.
   - **Silhouette first, detail second.** At 18px only the outline and two or
     three blocks of colour survive. `--icons` renders every one at rail size.
   - **Nothing is fetched at call time** — see preloadIcons below.
   ======================================================================= */
const ICON_DIR = 'assets/icons/';
const ICON_SRC = {
  /* perks */
  reach:      'reach.png',        // Long Snout — a capybara head, whiskers out front
  dash:       'dash.png',         // Quick Paws — a paw print, shockwave behind it
  melon:      'melon.png',        // Melon Lover — a wedge, cut side out
  life:       'life.png',         // Second Wind — a heart with a plus in it
  hearts:     'hearts.png',       // Lucky Heart — a heart with a clover
  autoShield: 'autoshield.png',   // Auto-Shield — the bubble, with the bolt that trips it
  chain:      'chain.png',        // Chain Sweeper — two links, the second one gold
  phantom:    'phantom.png',      // Phantombara — the afterimage capybara
  sticky:     'sticky.png',       // Sticky Feet — a paw stuck in the goo
  puzzler:    'puzzler.png',      // Puzzler — one piece
  /* not a perk: the banner art for a hat unlock */
  hat:        'hat.png',          // a capybara wearing one
  /* the three falling power-ups */
  magnet:     'magnet.png',
  shield:     'shield.png',      // the blue heart crest
  slowmo:     'slowmo.png',
};

/* One wrapper, so every call site gets the same box and nothing has to know
   where the art lives. `size` is only a hint — the CSS sizes them — but the
   width/height attributes keep the icon from reflowing the row it sits in
   before it has decoded. */
function icon(id, size = 22){
  const file = ICON_SRC[id];
  // loud, not blank: a typo'd id would otherwise render as an empty gap that
  // looks like a layout bug rather than a missing icon
  if (!file){ console.error('[icons] no icon named ' + id); return ''; }
  return `<img class="ico" src="${ICON_DIR}${file}" width="${size}" height="${size}" ` +
         `alt="" aria-hidden="true" draggable="false" decoding="async">`;
}

/* Warm the cache at boot: the rail and the draft cards are built from innerHTML
   the frame they are needed, and the first draft is ten levels into a run, long
   enough that a cold fetch would read as a bug. Fire and forget. */
function preloadIcons(){
  for (const file of Object.values(ICON_SRC)) new Image().src = ICON_DIR + file;
}
preloadIcons();
