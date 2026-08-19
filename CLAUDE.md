# Capybara Snack Rush

A 3D browser game: a capybara catches falling food. **three.js**, not 2D canvas.
Nearly everything is generated at runtime — meshes from primitives, textures
painted onto a `<canvas>`, all audio synthesized. No sound files at all; the
only images are art nobody would want generated (the capybara `.glb` and the
perk icons).

Deploys to GitHub Pages from `main`. Live at
`https://gabrieliusskuminas-crypto.github.io/Capy/`.

`GAME.md` is the mechanics. `MODEL.md` is the capybara. `supabase/README.md` is
the score board's database. This file is the code.

**This file keeps rules, not reasoning** — a rule here is a constraint that
already cost time, stated with the symptom so it is not overruled in thirty
seconds. The reasoning lives in a comment at the call site, which is usually
fuller than anything here; go there before overruling. **Before adding a rule,
check whether the call site already says it. If it does, don't** — this file
only grows, and every line of restated code comment dilutes the ones that bite.

## Hard constraints

- **No build step, no ES modules.** `index.html` loads plain `<script>` tags.
  Do not introduce a bundler, `type="module"`, or a runtime dependency without
  asking — the point is that the repo is directly servable.
- **Relative paths, all-lowercase filenames.** Pages is case-sensitive.
- **Script order is load-bearing.** Top-level `const`/`let` in classic scripts
  share one global lexical environment (which is why nothing needs namespacing)
  but are TDZ-bound, so reordering the tags can break boot silently.
- Scripts stay at the **end of `<body>`**: `hud.js` calls `getElementById` at
  parse time.

## Layout

`index.html` — CSS, markup, ordered script tags.
`vendor/three.min.js` — three.js r160 UMD, inlined verbatim. Do not edit.
`assets/capybara.glb`, `assets/icons/src/` — art, the source of truth.
`assets/icons/*.png`, `js/capymodel.js` — GENERATED. Do not hand-edit.
`tools/icons.py`, `tools/glb2json.mjs` — the offline converters.
`supabase/` — the score board schema, applied by Supabase and not by the game.

Load order, which is also roughly the dependency order:

| File | Holds |
|---|---|
| `config.js` | Tuning constants, `TYPES`, `POWERS`, `UPGRADES`, `THEMES`, `TOUCH`, `REDUCED` |
| `icons.js` | `ICON_SRC` + `icon()` — the `<img>` for every perk and power-up icon |
| `audio.js` | The `Audio` IIFE — synth primitives, the five written themes, every SFX |
| `scene.js` | Renderer, scene, sky texture + `skyBand`/`refreshSky`, camera + `fitCamera`, `refreshTouchMap` |
| `materials.js` | `M()` helper and the flat `mat` library |
| `theme.js` | `curTheme`, the theme colour lerp (`applyTheme`/`updateThemeMix`) |
| `environment.js` | Ground, arena `patch`, `border`, pond, scenery, clouds |
| `biomes.js` | Canvas textures, per-biome props, `refreshThemeEnvironment`, `updateThemeFX` |
| `capymodel.js` | GENERATED. The converted model as one `const`. |
| `capyrig.js` | `buildRiggedCapybara`, the proxy/bone retarget, `syncCapyRig`, fur texture |
| `models.js` | `roundedBoxGeo`, `sculptBlob`, the procedural capybara, food/hazard/hat builders |
| `particles.js` | InstancedMesh pool, `burst`, `PAL` |
| `items.js` | Falling item lifecycle: spawn, fall, `onCatch`, `onMiss` |
| `sinkholes.js` | Hole telegraph/open/close, `holeAt` |
| `stack.js` | Hat mounting, the head food-stack, debris |
| `state.js` | The `game` object, difficulty curve, hat unlocks, combo |
| `formations.js` | The spawn director: shapes, the route ribbon, route-clear scoring |
| `powers.js` | Shield bubble, `shieldUp`/`absorbHit`, Auto-Shield, power activation |
| `hud.js` | `$`, `ui`, HUD rendering, the perk rail, `popup`, `showBanner`, `flash` |
| `scores.js` | The high score board: `SCORE_API` transport, tag prompt, board panel |
| `player.js` | `capyState`, `updateCapybara` physics, `tryDash`, `popUp`, the steer mark |
| `perks.js` | Perk mechanics: dash shockwave, ghosts, reach aura, golden routes, Puzzler |
| `input.js` | Keyboard, and the pointer steering both devices share |
| `events.js` | Set-piece director (missiles / feast / sinkholes) |
| `upgrades.js` | The every-10-levels perk draft, ordinary + one-per-run |
| `gameflow.js` | `startGame`, pause/menu/`endGame`, button wiring |
| `dev.js` | `?dev=1` level switcher + the RLS self-check. Deletable in one piece. |
| `main.js` | `clock`, `animate()`, `onResize`, boot |

## Testing

No unit-test framework. The harness is `tools/shoot.js` (47 assertions) and
`tools/music.js`, run against a real browser:

```sh
npm i playwright-core          # not committed; chromium is preinstalled
pip install pillow numpy scipy # only for tools/icons.py
python3 -m http.server 8765 &
node tools/shoot.js --check                  # assertions, non-zero on failure
node tools/music.js --wav                    # the five themes; also run --level 6+
node tools/shoot.js --fmt                    # autopilot-walks every shape + feast route
node tools/shoot.js --touch                  # touch steering against a modelled thumb
node tools/shoot.js --icons                  # every icon at the size it is drawn at
node tools/shoot.js --biome hell,night       # screenshot biomes
node tools/shoot.js --capy                   # capybara turnaround
node tools/shoot.js --play                   # menu + gameplay + hat fit
python3 tools/icons.py --check               # every icon PNG still matches its art
```

- **`--fmt` is the clearability proof.** Run it after touching a shape,
  `stepTime`, movement, or anything that scales speed. Why its autopilot is
  written the way it is, is at the top of that block in `shoot.js`.
- **Read screenshots back**, and take the one where the bug could not hide.
  Visual work cannot be verified any other way, and a leftover drop shadow
  survived three read-backs because every view of it was brown on brown.
- **Headless Chromium has no browser chrome, so a class of mobile bug is
  invisible to it.** The HIGH SCORES button was untappable on a real iPhone
  while `--check` passed and a touch-emulated repro at four phone viewports
  reported the tap firing. Anything at the bottom edge of the screen needs a
  real phone; the harness can only say it is not a layout or wiring fault.
- **Wall-clock timing tests are meaningless here** — ~5fps under swiftshader,
  and `animate()` clamps `dt`. For rates, physics or balance, drive
  `updateCapybara`/`updateItems`/`updateFormations` at a fixed `1/60`.

## Music

- **Each biome is a written piece, not a reskin.** Parts are data, one string
  per bar; the melody is a phrase that repeats. Picking notes at random from a
  pentatonic pool is why it never used to sound like a tune.
- **Level fills a piece in; it never rewrites it.** Tempo creeps up, `+`-suffixed
  drum layers join at the halfway point — so **run `--level 6` or higher too**,
  or fill-layer bugs stay invisible.
- **Verify the data and the audio separately** (`tools/music.js` does both), and
  never try to read pitches back out of a mix — a square wave's 7th harmonic
  and the kick's sweep both read as notes nobody wrote.
- **A bright pad will bury the tune.** Every "wrong note" that harness has ever
  flagged was a mix problem, not a data problem. Pads and basses are dark on
  purpose; the lead is the only thing allowed to be bright.

## High scores

Operations, RLS proof and moderation SQL are in `supabase/README.md`.

- **`SCORE_API.key` is the publishable key and belongs in public source.** RLS
  is what protects the data. A `sb_secret_` key or the database password in
  `config.js` would hand the project away, and neither is ever needed — the
  game only reads the board and calls `submit_score`.
- **Blank either `SCORE_API` field and the feature turns itself off.** That is
  the offline story and the reason `--check` needs no network.
- **The network may never block the game.** Submits are fire-and-forget, a
  failed one is queued and retried at boot, the board renders its cached copy
  before it fetches. A dead Supabase project costs nothing but a grey board.
- **One row per run, not per player.** What keeps the board short is the submit
  rule — a run is only offered when it beat that device's own best (`isBest`).
  Move that gate and the table fills with noise.
- **A tag is not an account.** Nothing proves one is yours, deliberately. Adding
  ownership turns it into accounts; decide that first.
- **Escape anything from the server before it reaches `innerHTML`.** Tags are
  written by other players. `submit_score`'s regex and `esc()` are two locks and
  both should stay.

## UI rules

- **Full-height overlays are sized in `svh`, never `vh`.** On iOS Safari `vh`
  resolves against the LARGE viewport, so a panel capped in `vh` runs its bottom
  stripe under Safari's toolbar — visible, but every tap there hits browser
  chrome. Only bites when a control sits at the bottom edge, which is where
  anything new inherits it.
- **No emoji in the interface.** Platforms draw their own, so the same card was
  a flat glyph on one machine and a glossy sticker on the next. Icons are drawn
  PNGs referenced by id from `icons.js`; `--check` fails on an id nobody drew.
- **`assets/icons/*.png` is BUILT** from `assets/icons/src/` by `tools/icons.py`
  — hand-editing one edits a build artefact. Filenames are lowercase (Pages is
  case-sensitive) and all one square size, both asserted by `--check`. The size
  is a display decision: 192px, because the biggest thing drawing one is a 46px
  card at 3x DPR. How the background cut works is in the script's docstring.
- **A leftover shadow or backdrop only shows on a colour the art never uses** —
  which is what `--icons` writes `icons-cut.png` for. Look at the magenta plate
  before believing a cut, never the in-game shots.
- **`--icons` parks the pointer at 1,1 first.** Clicking START leaves the mouse
  where the button was, a draft card opens under it and screenshots in
  `:hover` — reported as a bug in the perk tiers twice over.
- **`showBanner` and `popup` take an icon id**, which is how the last emoji
  left the interface. Both write `innerHTML` when given one, and every caller
  passes a literal — player-written text would have to be escaped first.
- **`refreshHUD` runs every frame, so it writes only what changed.** Use
  `setText`/`setHTML`/`setStyle`; a bare `textContent =` is a DOM mutation even
  when the string is identical. The perk rail rebuilds only when the SET of
  perks changes (`railKey`).

## Gameplay rules

- **Movement is a velocity-target model, not an accelerator.** Every input path
  answers one question — what velocity does the player want — and
  `updateCapybara` eases toward it (`MOVE_T_*`). Do not reintroduce a friction
  multiplier or a top-speed clamp; the only thing above `SPEED` is the dash.
- **Both pointers name a PLACE, not a speed**, and both write
  `capyState.dragX/dragZ`. A velocity thumbstick shipped for months and was why
  routes were unplayable on a phone. Only the keys say a direction. On touch the
  capybara stands ABOVE the fingertip, and the finger map is derived from the
  projected arena, never dialled in — the constraint order and the measurements
  behind all of it are in `input.js` and `refreshTouchMap`.
- **A steering scheme needs evidence, and `--touch` is where it goes.** Three
  have been removed for lack of it. `updateCapybara` and `tryDash` know nothing
  about input devices; keep it that way.
- **`game.up.speed` is the only thing that scales movement.** Sticky Feet halves
  it and `fmtSpeed` reads the same field, which is what keeps routes walkable at
  half speed. Anything else that changes speed times formations against a speed
  the player does not have.
- **Anything chasing a moving target wants velocity, not acceleration.** As
  acceleration it is an undamped spring — the pointer rang around the cursor and
  the magnet orbited food past the capybara. Homing hazards keep acceleration
  *on purpose*; the overshoot is what makes them dodgeable.
- **Nothing assigns `hopV` directly — use `popUp()`.** Assigning it while
  airborne relaunches from that height and pops stack into the stratosphere.
- **The hop is not an input.** Anything gameplay-facing meaning "airborne" keys
  off `dashT`, never `hopY` — off `hopY` it fires free on the previous catch's arc.
- **Every formation is provably clearable.** `stepTime()` computes each gap from
  distance and speed; gaps are never hand-authored. Difficulty raises `fmtReach`
  and shortens `fmtGap` — **not** fall speed, which caps at `FALL_CAP`.
- **A route is several shapes chained, not one.** Length is how late difficulty
  grows: ~5 food beats at level 1 to the `FOOD_CAP` of 18. Each shape is
  anchored where the last one ended, so the join is an ordinary step `stepTime`
  prices like any other and no shape had to be redesigned to be long.
- **Hazards are placed at emit time, never written into a shape.** A shape with
  baked-in decoys is a hand you learn, and it carried the same two whether the
  route was five beats or twenty. The cap is the player-facing rule — **one
  hazard per six food items** — and `beside()` puts each one off the walking
  line by `HAZARD_CLEAR`, clear of every beat, or does not place it at all.
  `--check` asserts the ratio and the clearance; both would fail silently,
  since a decoy inside catch range still looks like a decoy on the ribbon.
- **Long Snout reaches for FOOD only** — `catchReach(good)`. Applied to
  everything the perk got worse the more you took, because hazard density
  climbs with level and with every heart banked. Hazard clearance is therefore
  a fixed distance, which is what lets `HAZARD_CLEAR` be one number.
- **A `dash` beat falls back to walking time when the player has no dash.** Dash
  timing is *shorter*, so it is the one thing Sticky Feet could make literally
  unclearable rather than merely slower (`!game.run.sticky` in `emitFormation`).
- **Overtime difficulty is spent on density, never on speed.** Every curve caps
  by about level 24; `overtime()` climbs past it into hazard rate, set-piece
  size and cadence. A route that cannot be read, or walked, is not difficulty.
- **A route is read off dots, not lines.** The arena is twice as wide as it is
  deep, so a shape that crosses it more than once draws near-parallel streaks in
  one band: traverse repeatedly and it must step in **z** as it goes (see
  `pendulum`, `pincer`) or it is unreadable however it is drawn. Since routes
  chain, the lines are only drawn `LINE_AHEAD` steps out — over eighteen beats
  they lay over each other and the picture is a tangle — and the dot taper is
  front-loaded over `TAPER`, because a gradient spread across eighteen beats
  tells you nothing about which of two neighbours comes first.
- **Only one route is live at a time** (`fmt.live.size`). Two overlapping routes
  are unreadable, not twice the challenge — and a record that never resolves
  would wedge the director and stop food entirely, hence `rec.age`.
- **A route's golden multiple is fixed when it is emitted** (`rec.gold`), so the
  payout cannot disagree with what the player was shown mid-route.
- **`shieldUp()` and `absorbHit()` are the only protection test.** Two things
  can be protecting the player and they end differently; nothing should test
  `game.shield` directly.
- **One run perk per run, total.** The gold slot closes as soon as *any*
  `RUN_PERK` is taken — they are balanced as a single trade.
- **A perk made pointless by this run is never offered** (`dead(game)`).
  Offering a dead perk wastes one of three slots, which is worse than nothing.
- **A countdown that goes NaN never expires.** `activatePower` once multiplied
  `P.dur` by a `game.up` field a perk rewrite had deleted, so every power ran
  for the whole run. Deleting a field from `game.up` means auditing its readers.
- **`updateItems` iterates a snapshot and skips `it.gone`.** One resolution can
  remove several items, and a live reverse index over a shrinking array reads
  past its end as soon as something below the cursor disappears.

## Rendering and scene rules

- `animate()` rewrites `camera.position` every frame from `camFit`/`CAM_LOOK`.
  To move the camera, mutate those — not the camera.
- **`fitCamera` fits the arena's WIDTH, and on a tall screen also pitches.** The
  width fit alone left a portrait phone a 371x92px strip, putting the catch
  radius at 14px up the screen. The pitch interpolates on aspect and the wide
  end reproduces the original pose exactly, so desktop framing is byte-identical
  — do not make it unconditional. `touchLift` is recomputed in the same pass.
- **The sky is a strip, not a screen**: 3.2% of screen height on desktop, 16.5%
  on a phone, painted by `makeSkyTexture` and sized by `skyBand()`. Do not put
  sky ornaments in `skyRig` as 3D objects — everything there projects to NDC y
  1.5–1.8 and has never been on screen at any aspect.
- `patch.material` **is** `mat.grassDark`. Mutating it in
  `refreshThemeEnvironment` fights the per-frame lerp in `updateThemeMix`, which
  is why that lerp is meadow-only.
- **Hell's slab is not raised** — the lava field is lowered by `HELL_LAVA_DROP`,
  with `hellSkirt` filling the step. Anything at lava level needs the same
  offset *and* `outsidePatch`.
- **Meadow is the only biome drawing the pond and the default scenery at once**,
  so anything wrong with the pair shows in exactly one place — which is how
  trees stood in the water for as long as they did. `outsidePond` is the
  exclusion, measured off the meshes; `--check` asserts it because the scatter
  is random per load. The pond rings are rotated flat, so their world-z extent
  is `scale.y`.
- `clearThemeFX` disposes everything it walks. Module-level shared geometry and
  materials must set `userData.shared = true`.
- **Ghosts are clones of one template** and share its geometry and material, so
  removing one must dispose nothing, and per-ghost fading is impossible — the
  wind-down is scale. The material is *shaded* and writes depth on purpose;
  flat and depth-writeless, the capybara was a cluster of soap bubbles.
- Tiled canvas textures must be genuinely periodic: a full-width curve is not
  unless its height *and slope* match at both edges, and band spacing must
  divide the tile height exactly.
- `metalness` > 0 on a `MeshStandardMaterial` with no environment map kills the
  diffuse term — surfaces go near-black on one side and shiny on the other.

## The capybara

**Touching `capybara.glb`, `glb2json.mjs`, `capymodel.js`, `capyrig.js`, or the
sculpting in `models.js`? Read `MODEL.md` first.** Two that bite hardest: the
rig hands the game **proxy objects, never bones**, and the `.glb`'s armature
rotation must stay collapsed into the bone chain — reintroduce a matrix and the
capybara lands face-down.

`buildCapybara()` falls back to a procedural build if the bones do not validate,
so a silently wrong model looks like a downgrade rather than a crash. `--check`
asserts the rig contract for exactly that reason.

## Known and deliberately unfixed

- `updateThemeFX` advances the hell lava bubbles at a hardcoded `1/60` rather
  than the frame delta, so they animate at different speeds on different refresh
  rates. Not worth fixing. Not a bug to "discover" again.
- **Touch steering is good, not perfect** — it reads as slightly finicky, and
  the anisotropy is now the named cause rather than a suspect. `--touch` reports
  it per viewport: the two reach scales are computed independently and land at
  **1.90x on a 390x844 portrait, worth up to 18.1 degrees** between the angle
  aimed and the angle walked, which is invisible on a straight line and is most
  of what the shapes here ask for. The strain floor is its only source.
- **`?iso=1` drops that floor — it is the A/B, and the harness cannot settle
  it.** `--touch` models slide speed, placement noise and look latency, and has
  no notion of stretch, which is precisely what the floor buys off. So it prices
  the floor's cost and none of its benefit: iso comes out at 1.13x / 3.5°, the
  same item rate, and 20% of routes cleared against 16%, for a thumb box that
  grows 185px wide to 320px. For a thumb that width is the whole trade. **For an
  index finger — play-tested as the better grip — there is no trade**, and the
  harness's verdict is the entire answer. Still off by default: it wants a phone
  to confirm it, which is the one thing nothing here can do.

## Tooling

`pkill -f "http.server 8765"` matches its own command line and kills the shell.
Use `pkill -f "http[.]server 8765"`.

## Working agreements

- Branch, commit, push, **and open a pull request.** The PR is the review step —
  fine to open without asking, since it can simply be closed. Never merge it.
- Do not change gameplay behaviour during visual or refactor work; list anything
  suspicious separately rather than fixing it inline.
- Do not put model identifiers in commits, PRs, or code comments.
