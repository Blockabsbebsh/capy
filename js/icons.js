/* =======================================================================
   ICONS

   One drawn PNG per perk and per power-up, in `assets/icons/`. They used to be
   emoji, then inline SVG drawn here in the game's palette; they are now
   painted artwork, which is the one thing neither of the others could be. The
   reason emoji went is still the reason nothing here is text: emoji are drawn
   by the platform, so the same card was a flat glyph on one machine and a
   glossy sticker on the next, and 🛡 in particular came out as a thin outline
   on Windows.

   These are the only image files the game loads, and the rules they answer to:

   - **Lowercase filenames, relative path.** Pages is case-sensitive, and
     `autoShield` is the one id whose file therefore cannot simply be the id —
     `ICON_SRC` is where that is written down rather than guessed at.
   - **A square source, 128px, transparent.** Drawn at 15px on the perk rail
     and 28px on a draft card, so the source is downscaled everywhere and the
     browser filters it; a source at the display size would be soft on any
     retina screen.
   - **Silhouette first, detail second.** The rail is small: at 15px what
     survives is the outline and the two or three biggest blocks of colour.
     Verified with `--icons`, which renders every one of them at rail size.
   - **Nothing is fetched at call time.** `preloadIcons()` runs at boot, so an
     icon that first appears mid-run — a power chip, a level-10 draft card —
     is already decoded and cannot flash in.
   ======================================================================= */
const ICON_DIR = 'assets/icons/';
const ICON_SRC = {
  /* perks */
  reach:      'reach.png',        // Long Snout — a capybara muzzle in profile
  dash:       'dash.png',         // Quick Paws — a paw print, shockwave behind it
  melon:      'melon.png',        // Melon Lover — a wedge, cut side out
  life:       'life.png',         // Second Wind — a heart with a plus in it
  hearts:     'hearts.png',       // Lucky Heart — a heart with a clover
  autoShield: 'autoshield.png',   // Auto-Shield — the bubble, with the bolt that trips it
  chain:      'chain.png',        // Chain Sweeper — two links, the second one gold
  phantom:    'phantom.png',      // Phantombara — the afterimage capybara
  sticky:     'sticky.png',       // Sticky Feet — a paw stuck in the goo
  puzzler:    'puzzler.png',      // Puzzler — one piece
  /* the three falling power-ups */
  magnet:     'magnet.png',
  shield:     'shield.png',
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

/* Warm the cache at boot. The perk rail and the draft cards are built from
   innerHTML the frame they are needed, and the first draft is ten levels into
   a run — long enough that a cold fetch there would read as a bug, not a
   load. Fire and forget: a failure here costs nothing the <img> would not
   have cost anyway. */
function preloadIcons(){
  for (const file of Object.values(ICON_SRC)) new Image().src = ICON_DIR + file;
}
preloadIcons();
