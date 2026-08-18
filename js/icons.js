/* =======================================================================
   ICONS

   Inline SVG for every perk and every power-up, replacing the emoji these
   used to be. Emoji were never really ours: each platform draws its own, so
   the same card was a flat glyph on one machine and a glossy 3D sticker on the
   next, half of them in colours that fought the card they sat on — and 🛡 in
   particular renders as a thin outline on Windows and a solid blue shield on a
   Mac. These are drawn once, in the game's own palette, and look identical
   everywhere.

   Kept to the same rules as the rest of the repo: no image files, nothing
   fetched, no dependency. A 24x24 viewBox, flat fills, no strokes thinner than
   1.5 units — anything finer disappears at the 15px the perk rail draws them
   at. Each is a silhouette first and a detail second, for the same reason: the
   rail is small and the shape has to carry it.
   ======================================================================= */
const ICON_BODY = {
  /* Long Snout — a muzzle in profile with the reach arc in front of it */
  reach: `<path d="M2 13.5c0-3 2.6-5 6-5 2.2 0 3.6.5 5.4 1.6 1.2.7 2 1.6 2 2.9s-.8 2.2-2 2.9C11.6 17 10.2 17.5 8 17.5c-3.4 0-6-2-6-4z" fill="#e8b98d"/>
    <ellipse cx="13.2" cy="12.2" rx="1.15" ry="1" fill="#4a2c1c"/>
    <ellipse cx="13.2" cy="14.9" rx="1.15" ry="1" fill="#4a2c1c"/>
    <path d="M17.6 7.4a7.6 7.6 0 0 1 0 12.2" stroke="#ffe1a8" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".85"/>
    <path d="M20.6 5.2a11 11 0 0 1 0 16.6" stroke="#ffe1a8" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".45"/>`,

  /* Quick Paws — a paw print with the shockwave ring breaking behind it */
  dash: `<ellipse cx="14" cy="15.5" rx="5" ry="4.2" fill="#ffd07a"/>
    <ellipse cx="9.4" cy="9.6" rx="1.9" ry="2.4" fill="#ffd07a"/>
    <ellipse cx="14" cy="8.2" rx="2" ry="2.5" fill="#ffd07a"/>
    <ellipse cx="18.6" cy="9.6" rx="1.9" ry="2.4" fill="#ffd07a"/>
    <path d="M6 5.5C3.4 8 3.4 16 6 18.5" stroke="#9fe07a" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M2.6 8C1.3 10 1.3 14 2.6 16" stroke="#9fe07a" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".6"/>`,

  /* Melon Lover — a wedge, cut side out */
  melon: `<path d="M3 19.5A17 17 0 0 1 20.5 3v3.2A13.8 13.8 0 0 0 6.2 19.5z" fill="#2f8f3e"/>
    <path d="M6.2 19.5A13.8 13.8 0 0 1 20.5 6.2v13.3z" fill="#ff4f68"/>
    <circle cx="16" cy="12.4" r="1.05" fill="#2a1a12"/>
    <circle cx="12.4" cy="16.2" r="1.05" fill="#2a1a12"/>
    <circle cx="17.4" cy="16.6" r="1.05" fill="#2a1a12"/>`,

  /* Second Wind — a heart with a plus cut out of it */
  life: `<path d="M12 21S3 15.2 3 9.6A4.6 4.6 0 0 1 12 7.4 4.6 4.6 0 0 1 21 9.6C21 15.2 12 21 12 21z" fill="#ff3d68"/>
    <rect x="10.7" y="8.6" width="2.6" height="8" rx="1.1" fill="#fff6e6"/>
    <rect x="8" y="11.3" width="8" height="2.6" rx="1.1" fill="#fff6e6"/>`,

  /* Lucky Heart — a heart already falling, with a sparkle off it */
  hearts: `<path d="M11 19.5S3.4 14.6 3.4 9.8A3.9 3.9 0 0 1 11 7.9a3.9 3.9 0 0 1 7.6 1.9c0 4.8-7.6 9.7-7.6 9.7z" fill="#ff3d68"/>
    <path d="M19.4 2.8l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill="#ffe1a8"/>`,

  /* Auto-Shield — a shield with the bolt that trips it */
  autoShield: `<path d="M12 2.4l8.4 3v6.2c0 4.6-3.4 8.6-8.4 10-5-1.4-8.4-5.4-8.4-10V5.4z" fill="#8fe9ff"/>
    <path d="M12 4.7l6.2 2.2v4.7c0 3.5-2.5 6.6-6.2 7.8-3.7-1.2-6.2-4.3-6.2-7.8V6.9z" fill="#2f9fc4"/>
    <path d="M12.8 7.2l-3.6 5.4h2.4l-.8 4.4 3.8-5.8h-2.4z" fill="#eaffff"/>`,

  /* Chain Sweeper — two links, the second one gold and lit */
  chain: `<rect x="1.6" y="7.6" width="11.6" height="8.8" rx="4.4" stroke="#dfe6ee" stroke-width="2.8" fill="none"/>
    <rect x="10.8" y="7.6" width="11.6" height="8.8" rx="4.4" stroke="#ffd33d" stroke-width="2.8" fill="none"/>
    <path d="M18.8 2.6l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" fill="#ffe14d"/>
    <path d="M5.4 17.6l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="#ffe14d" opacity=".7"/>`,

  /* Phantombara — the afterimage: a capybara-ish shape with a wavy hem */
  phantom: `<path d="M12 2.6c4.5 0 7.4 3 7.4 7v11.8l-2.5-1.8-2.4 1.8-2.5-1.8-2.5 1.8-2.4-1.8-2.5 1.8V9.6c0-4 2.9-7 7.4-7z" fill="#cdeeff"/>
    <ellipse cx="9.3" cy="9.6" rx="1.25" ry="1.55" fill="#3f6f8f"/>
    <ellipse cx="14.7" cy="9.6" rx="1.25" ry="1.55" fill="#3f6f8f"/>
    <ellipse cx="12" cy="13.4" rx="2.3" ry="1.5" fill="#9fd4ee"/>`,

  /* Sticky Feet — a planted footprint */
  sticky: `<path d="M7.4 12.6c0-3.4 2-6.2 4.6-6.2s4.6 2.8 4.6 6.2c0 2.3-1.2 3.4-1.2 5.2 0 1.6-1.3 2.6-3.4 2.6s-3.4-1-3.4-2.6c0-1.8-1.2-2.9-1.2-5.2z" fill="#e8c887"/>
    <ellipse cx="7.2" cy="5.2" rx="1.7" ry="2" fill="#e8c887"/>
    <ellipse cx="11.2" cy="3.3" rx="1.6" ry="1.9" fill="#e8c887"/>
    <ellipse cx="15" cy="3.6" rx="1.5" ry="1.8" fill="#e8c887"/>
    <ellipse cx="17.9" cy="5.6" rx="1.4" ry="1.7" fill="#e8c887"/>`,

  /* Puzzler — one piece, tab out and socket in */
  puzzler: `<path d="M4 4h6.2a2 2 0 0 1 1.9 2.6 1.9 1.9 0 1 0 3.7 0A2 2 0 0 1 17.7 4H20v6.2a2 2 0 0 1-2.6 1.9 1.9 1.9 0 1 0 0 3.7A2 2 0 0 1 20 17.7V20h-6.2a2 2 0 0 1-1.9-2.6 1.9 1.9 0 1 0-3.7 0A2 2 0 0 1 6.3 20H4z" fill="#c9a6e8"/>`,

  /* --- the three falling power-ups ------------------------------------- */
  magnet: `<path d="M5 4h4.6v8.4a2.4 2.4 0 0 0 4.8 0V4H19v8.4a7 7 0 0 1-14 0z" fill="#e23b44"/>
    <rect x="5" y="16.4" width="4.6" height="4" fill="#f2f4f7"/>
    <rect x="14.4" y="16.4" width="4.6" height="4" fill="#f2f4f7"/>`,
  shield: `<path d="M12 2.4l8.4 3v6.2c0 4.6-3.4 8.6-8.4 10-5-1.4-8.4-5.4-8.4-10V5.4z" fill="#8fe9ff"/>
    <path d="M12 4.7l6.2 2.2v4.7c0 3.5-2.5 6.6-6.2 7.8-3.7-1.2-6.2-4.3-6.2-7.8V6.9z" fill="#2f9fc4"/>`,
  slowmo: `<path d="M5.6 2.6h12.8v3.1L13.4 12l5 6.3v3.1H5.6v-3.1l5-6.3-5-6.3z" fill="#bff4ff"/>
    <path d="M8.4 5.4h7.2L12 10.2z" fill="#4fb3d9"/>
    <path d="M12 13.8l3.6 4.8H8.4z" fill="#4fb3d9"/>`,
};

/* One wrapper, so every call site gets the same box and nothing has to know
   about SVG. `size` is only a hint — the CSS sizes them — but setting it keeps
   the icon from flashing at its intrinsic size on first paint. */
function icon(id, size = 22){
  const body = ICON_BODY[id];
  // loud, not blank: a typo'd id would otherwise render as an empty gap that
  // looks like a layout bug rather than a missing icon
  if (!body){ console.error('[icons] no icon named ' + id); return ''; }
  return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" ` +
         `aria-hidden="true" focusable="false">${body}</svg>`;
}
