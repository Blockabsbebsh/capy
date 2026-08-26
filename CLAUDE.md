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

- **No build step.** `index.html` loads plain `<script>` tags, and there is no
  bundler. Do not introduce one, or a runtime dependency, without asking — the
  point is that the repo is directly servable.
- **Exactly ONE module script, and it is the music.** `js/music/index.js` is
  `type="module"`; everything else is a classic script and must stay one. The
  game's globals live in one shared lexical environment (below), which is why
  nothing is namespaced — converting the game to modules would break all of it
  at once. The music is modules because the five tracks are self-contained
  pieces with no need of that scope, and it publishes `window.Music` for
  `js/audio.js` to reach. Do not add a second one without the same argument.
- **Relative paths, all-lowercase filenames.** Pages is case-sensitive.
- **Script order is load-bearing.** Top-level `const`/`let` in classic scripts
  share one global lexical environment (which is why nothing needs namespacing)
  but are TDZ-bound, so reordering the tags can break boot silently.
- Scripts stay at the **end of `<body>`**: `hud.js` calls `getElementById` at
  parse time.

## Layout

`index.html` — CSS, markup, ordered script tags.
`vendor/three.min.js` — three.js r160 UMD, inlined verbatim. Do not edit.
`vendor/tone.js` — Tone.js 15.1.22 UMD (MIT), inlined verbatim. Do not edit.
`js/music/` — the five biome tracks, as ES modules. `js/music/README.md`
is their contract; `lib.js` is the notation they share.
`assets/capybara.glb`, `assets/icons/src/` — art, the source of truth.
`assets/icons/*.png`, `js/capymodel.js` — GENERATED. Do not hand-edit.
`tools/icons.py`, `tools/glb2json.mjs` — the offline converters.
`tools/routes.js` + `tools/routeeditor.*` — the route editor, which reads and
writes `js/routes.js`.
`supabase/` — the score board schema, applied by Supabase and not by the game.

Load order, which is also roughly the dependency order:

| File | Holds |
|---|---|
| `config.js` | Tuning constants, `TYPES`, `POWERS`, `UPGRADES`, `THEMES`, `TOUCH`, `REDUCED` |
| `icons.js` | `ICON_SRC` + `icon()` — the `<img>` for every perk and power-up icon |
| `audio.js` | The `Audio` IIFE — synth primitives, every SFX, and the bridge to `window.Music` |
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
| `routes.js` | `ROUTES` — the route library, as data. Edited by `tools/routes.js` |
| `formations.js` | The spawn director: placing a route, the ribbon, route-clear scoring |
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
| `music/index.js` | MODULE, and last. Imports the five tracks, publishes `window.Music` |

## Testing

No unit-test framework. The harness is `tools/shoot.js` (67 assertions) and
`tools/music.js` (which drives `tools/music.html`, not the game page — rendering
audio needs no WebGL), run against a real browser:

```sh
npm i playwright-core          # not committed; chromium is preinstalled
pip install pillow numpy scipy # only for tools/icons.py
python3 -m http.server 8765 &
node tools/shoot.js --check                  # assertions, non-zero on failure
node tools/music.js --wav                    # the five tracks; also run --level 6+
node tools/music.js --only meadow --wav      # one track, while writing it
node tools/shoot.js --fmt                    # autopilot-walks every route + feast route
node tools/shoot.js --touch                  # touch steering against a modelled thumb
node tools/shoot.js --icons                  # every icon at the size it is drawn at
node tools/shoot.js --biome hell,night       # screenshot biomes
node tools/shoot.js --capy                   # capybara turnaround
node tools/shoot.js --play                   # menu + gameplay + hat fit
python3 tools/icons.py --check               # every icon PNG still matches its art
node tools/routes.js --check                 # the route library parses and is valid
node tools/routes.js --rewrite               # round-trip proof: `git diff` must be empty
node tools/routes.js                         # the route editor, on :8766
```

- **`--fmt` is the clearability proof.** Run it after touching a route,
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

Five Tone.js modules under `js/music/`, one per biome. Each file owns its own
instruments, effects, harmony and scheduling; `js/music/README.md` is the
contract and each file's header comment is the piece's reasoning.

- **Each biome is a written piece, not a reskin.** Parts are data, one string
  per bar; the melody is a phrase that repeats. Picking notes at random from a
  pentatonic pool is why it never used to sound like a tune.
- **Rhythm is authored in BEATS, not on a step grid.** `pitch/beats` tokens, and
  `bars()` throws if a bar does not add up. A shared step grid forces every part
  onto one subdivision, which is how a piece ends up wall-to-wall eighth notes.
- **A track builds its nodes in `start()`, never at module load.** `Tone.Offline`
  swaps the global context for the duration of its callback, so anything built
  at load belongs to the wrong context and renders silence. That is also what
  lets `tools/music.js` measure the real `start()` path rather than a copy.
- **One track plays at a time.** Tone has a single global transport; each track
  claims its own tempo and metre on `start()`.
- **Level fills a piece in; it never rewrites it.** Tempo creeps up, `+`-suffixed
  drum layers join at the halfway point — so **run `--level 6` or higher too**,
  or fill-layer bugs stay invisible.
- **Verify the data and the audio separately** (`tools/music.js` does both), and
  never try to read pitches back out of a mix — a square wave's 7th harmonic
  and the kick's sweep both read as notes nobody wrote.
- **A note is checked against every bar it SOUNDS over, not the one it starts
  in.** A tie across a barline is what makes a note long enough to clash, and
  the chord it clashes with is the next one — so checking only the starting bar
  is blind in exactly the place the fault lives. It hid eighteen semitone
  clashes across the five tracks, and they were audible as "the progressions
  sound wrong". The two melodic lines are checked against each other for the
  same interval, which the pad check cannot see.
- **A tie may only follow the note it ties.** `bars()` throws on a tie after a
  rest: it would lengthen a note that already stopped, so instead of a longer
  note you get that note overlapping everything written after it.
- **The pitch check measures INTO a note, not at its onset** — a quarter in, or
  120ms, whichever is sooner. At the onset it reads the attack transient rather
  than the pitch. It is a fairer place to look, not a lenient one: when it
  still fails there, the tail really is burying the note and **the fix is the
  mix**. Night's lead delay was repeating each note on top of the next one, and
  a saw bass's fifth harmonic is a major third — on a C that is an E, a
  semitone under an F in the tune. Both were found this way.
- **A bright pad will bury the tune.** Every "wrong note" that harness has ever
  flagged was a mix problem, not a data problem. Pads and basses are dark on
  purpose; the lead is the only thing allowed to be bright.
- **The five carry per-track `MIX` trims, and `MUSIC_TRIM` in `audio.js` sets
  music against SFX.** Music and SFX are two AudioContexts now, so nothing
  balances them automatically. Both numbers are derived from measured RMS and
  the arithmetic is written at each one; re-derive rather than nudge.

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

## The route editor

`node tools/routes.js` serves the editor and the game on one origin and writes
`js/routes.js` in place. Read the header of that file before changing it.

- **`js/routes.js` is the only copy of the library, and the editor writes it
  directly.** There is no export step and no second store to sync — git is the
  undo, which is the whole reason the tool is allowed to write source.
- **The writer owns the array body and nothing else.** Everything above
  `const ROUTES = [` and below the closing `];` is preserved byte for byte,
  and a `//` block directly above a route — no blank line — is that route's
  note. Anything else inside the array is lost on the next save, so the file is
  written in exactly one style. `--rewrite` plus an empty `git diff` is the
  proof, and it is worth running after touching the writer.
- **What is drawn is what lands.** The game adds a rotation and a scale to the
  arena radius and nothing else, so the editor's picture is the contract rather
  than an approximation of one. That is new: the tool this replaced drew shapes
  that the director then chained, anchored and re-scaled.
- **The editor page runs the GAME's arithmetic for anything the game computes**
  — `stepTime`, `fmtReach`, `fmtSpeed`, `beside`, `REVEAL_AHEAD` — because a
  checker that drifts from the game is worse than none, since it is believed.
  Its readability findings are the editor's OWN, deliberately: the game no
  longer scores routes at all, so there is nothing to be in step with.
- **It cannot prove a route is walkable and does not claim to.** Gaps come out
  of `stepTime`, so a route is clearable by construction; whether a PERSON can
  read and walk it is what `node tools/shoot.js --fmt` answers. Run it before
  keeping a new route.
- **A warning is a reading, not a rule.** Shipped routes carry them — a weave
  trips the near-reversal check at every beat, because that IS the weave. Only
  the structural errors block a save, and those are the ones the director has
  no error path for.
- **`?route=<id>` pins the director to one route** and ignores its unlock
  level, which is what the editor's TEST button opens. An unknown id plays a
  normal game rather than no game.
- **ROTATE is a preview and is never saved.** The game rolls a fresh angle
  every emit, so "how does this read turned 140°" is a question the author has
  to be able to ask — it is the one thing about a route that is not in the data.

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
- **Running timers live in the top-right stack, not across the middle.** The
  combo bar and the power-up bar are glances; centred above the dash button
  they were drawn over the arena on a phone and over the ribbon on a desktop —
  the two things that change every frame, on top of the thing you have to read.
  Anything else with a countdown belongs in `#statusStack` with them, and it
  has to stay last in that column: an idle timer is still laid out, because a
  fade cannot use `display:none`.
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
- **Both pointers clamp their TARGET into the field, and that is what makes a
  round rim pleasant.** Point past the edge and you ask for the nearest point
  ON the edge, so the capybara arrives and stops; without it the controller
  drives into the wall and holds there. The rim code in `updateCapybara` is
  then only a safety net for the keys, a dash and a sinkhole bounce — and it
  removes only the OUTWARD component of velocity. Do not reflect it: on a
  circle a reflection is a bounce off a tangent, which shoves you sideways
  along a wall you walked into straight. That is the saw-tooth.
- **A steering scheme needs evidence, and `--touch` is where it goes.** Three
  have been removed for lack of it. `updateCapybara` and `tryDash` know nothing
  about input devices; keep it that way.
- **ONE reach for both axes.** They were fitted separately, and the reason was
  that the arena was 2:1 and only its width strained. A circular field is as
  deep as it is wide, and fitted apart they came out 1 and 1.35 — a 0.74x skew,
  worse than anything the rectangle produced. Taking the larger satisfies both
  constraints and makes the skew exactly **zero**, measured, at every viewport.
- **`LIFT_REACH` is 1, not 1.35.** The lift used to take screen room on the
  promise of a 1.35 depth scale, which left too little below the finger for the
  near rim, which forced the scale to actually BE 1.35. A true 1:1 is what
  `input.js` calls load-bearing; the lift should not be the thing spending it.
- **The touch map is near 1:1, and the thumb-strain floor is OFF** (`?strain=1`
  puts it back). It was the only thing scaling the two axes differently, and it
  charged twice for the reach it bought: a diagonal walked up to **18.1° off the
  line it was aimed at**, and — the part a player actually feels — every pixel
  of finger travel moved the capybara nearly **twice as far sideways as the
  ground under the finger**, so a small correction was a big one. Play-tested as
  "small movements could easily over adjust" against "it just goes where you
  point". `--touch` reports the anisotropy per viewport; it cannot price the
  floor's *benefit*, since it models slide speed, noise and latency and has no
  notion of stretch, which is why a phone had to settle it.
- **What that costs is reach, and it is a real trade.** The thumb box grows from
  185px wide to about 320px on a 390px screen. An index finger on the free hand
  — play-tested as the better grip — does not care; a one-handed thumb might.
  `--touch` still asserts every corner is reachable and aimable, which is the
  floor under the trade.
- **Judge steering on the ANGLE `--touch` prints, never on the ratio**, which
  passes through 1.0 and reads as agreement in both directions. It is 0° now on
  every viewport; if it moves off zero, something took the two axes apart again.
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
- **A route is emitted exactly as it was drawn.** The library in `js/routes.js`
  is the whole deck; the director picks one, rotates it to a random angle,
  scales it to `ARENA.r` and prices the steps. There is no runtime
  construction. What that replaced chained two to five smaller shapes per
  route, and it measured badly: the joins averaged a **105° turn against 65°
  inside a shape**, and **46% of them exceeded the system's own near-reversal
  threshold against 2% inside a shape**. The randomness a player saw was the
  seams. It also bought little — 60% of late-game routes were a single shape
  anyway. Do not reintroduce it without measuring the joins first.
- **Routes are authored in a UNIT DISC, and that is why the arena is a circle.**
  A rotation on a circle is exact: every distance, angle and proportion
  survives, so one authored route is 360 that all still fit and none has to be
  clamped, squashed or redrawn. On a rectangle — or any ellipse — a rotation
  shears the figure and has to be clamped back in, which is a different route
  at every angle and provably nothing. `--check` asserts every route stays
  inside the field at 24 angles apiece.
- **Length is AUTHORED, paced by `min`.** Short routes early, longer ones
  layered on top, and nothing is ever taken out of the pool — so a three-beat
  route still comes up at level 60, which is the best-feeling thing in the game
  and what made level 11 relentless when it went missing. There is no
  distribution to tune. `--check` asserts nothing long early, long available
  late, and short routes still most of the mix.
- **The approach to the first beat is priced like any other step.** `at[0]` is
  `stepTime` from wherever the capybara is, less the fall time, so a route may
  be dropped at any angle without anchoring. The old chainer slid each shape
  sideways to meet the walk instead — which worked for 8 of 19 shapes and
  pinned the other 11 to the middle of the arena, since `slackX` came out zero
  for anything wider than `span 0.93`.
- **Readability is authored, not searched.** The game used to score each route
  and walk the cleanest of fourteen candidates, because chaining made them
  noisy. Drawn routes do not need it: crossings fell from 0.46 a route to 0.11
  and dot-crowding to 0.00. `--check` keeps both as regression checks, plus the
  one that matters — **no route ever retraces its own line** (worst turn under
  155°). A weave turning hard at every beat is the route, not a fault; a turn
  near 180° draws one stroke for two steps and is never readable.
- **Hazards are placed at emit time, never written into a route.** A route with
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
- **The ribbon is a window that SLIDES, not a picture drawn once** (`revealPath`
  sets targets, `updatePaths` eases toward them every frame). Nearest beats
  brightest, the far edge of the window dimmer, nothing beyond, and it slides
  on every beat that lands.
- **Dots and lines share ONE window, and nothing cuts in or out.** They used to
  run to different depths (9 and 5), which drew dots hanging several beats past
  any line — "random dots in the distance" while you were still on the first
  few. And every piece was switched rather than faded, so the window slid like
  a shutter. Both are asserted by `--check`, driven at a fixed 1/60 because a
  fade cannot be seen at the harness's five frames a second.
- **A feast draws no ribbon, and that is deliberate.** The window only shows
  `REVEAL_AHEAD` beats and slides on resolved formation beats — a feast
  resolves none, so its twenty-melon trail stopped a third of the way across
  and stayed there. The melons arrive in order with their own landing rings,
  which is a trail that keeps up; the routing is untouched.
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
- **A draft can end without a pick.** SKIP is a real answer, since every perk is
  a trade; `skipUpgrade` and `takeUpgrade` share `closeDraft`, because whichever
  way a draft ends the level it was for still has to start. `offerUpgrades`
  returns false rather than opening an empty panel when the pool is dry.
- **A perk shows a number only where the player can see its effect.** Melon
  Lover's +60% lands on a score they read; Long Snout's +0.22 and Quick Paws'
  −25% are unverifiable from play and were noise on the card.
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
- **`fitCamera` fits the WHOLE platform — width AND depth — as large as both
  allow.** It used to fit width only and floor the zoom at 1, which was right
  for a field two units wide for every one deep: depth never ran out first, so
  it was never checked, and the floor kept desktop framing byte-identical. On a
  circle depth is what runs out first, and unchecked the near rim landed BELOW
  the bottom of the window with the opening beats of a route off screen. It
  bisects on zoom rather than stepping up until it fits — stepping overshoots
  by its step every pass, measured as a field a sixth smaller than it needed to
  be. Monotone in zoom, so twenty halvings land exactly, and it runs on resize
  only. `touchLift` is recomputed in the same pass.
- **On touch the whole frame rides UP so the thumb gets a band below the field**
  (`raiseFrame`). It is a lens shift, which translates the projection rigidly
  and leaves the size the fit just chose alone; sliding the rig back raises the
  image by moving further away and pays for it in platform depth. Where the HUD
  band cannot cover the shift the platform gives way too, but only down to
  `CATCH_MIN_PX`. The band asked for is a `HAND_TOLERANCE` short of the whole
  field — at the full depth the platform framed too high. Anything that reframes
  a phone has to keep `most` within that of `ideal` in `refreshTouchMap`, or the
  hand covers the near half of the arena again.
- **The sky is a strip, not a screen**: 3.2% of screen height on desktop, 16.5%
  on a phone, painted by `makeSkyTexture` and sized by `skyBand()`. Do not put
  sky ornaments in `skyRig` as 3D objects — everything there projects to NDC y
  1.5–1.8 and has never been on screen at any aspect.
- `patch.material` **is** `mat.grassDark`. Mutating it in
  `refreshThemeEnvironment` fights the per-frame lerp in `updateThemeMix`, which
  is why that lerp is meadow-only.
- **The drawn floor and the playable field are the same circle**, `PATCH_R`
  being `ARENA.r` plus a rim of `ARENA.pad`. They used to be a rectangle inside
  an ellipse of 2.6x the area, whose corners stuck out of the grass — so
  "clear of the arena" meant three different things and a prop could hide in
  the gap. Everything that keeps a thing inside the field goes through
  `arenaClamp`/`insideArena`/`arenaRandom` in config.js; do not open-code it.
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

## Tooling

`pkill -f "http.server 8765"` matches its own command line and kills the shell.
Use `pkill -f "http[.]server 8765"`.

## Working agreements

- Branch, commit, push, **and open a pull request.** The PR is the review step —
  fine to open without asking, since it can simply be closed. Never merge it.
- Do not change gameplay behaviour during visual or refactor work; list anything
  suspicious separately rather than fixing it inline.
- Do not put model identifiers in commits, PRs, or code comments.
