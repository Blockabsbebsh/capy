# Capybara Snack Rush

A 3D browser game: a capybara catches falling food. **three.js**, not 2D canvas.
Nearly everything is generated at runtime — meshes assembled from primitives,
textures painted onto a `<canvas>`, all audio synthesized with the Web Audio
API. There are no image or sound files in the repo. The one exception is the
capybara: `assets/capybara.glb`, converted offline into `js/capymodel.js`.

Deploys to GitHub Pages from `main`. Live at
`https://gabrieliusskuminas-crypto.github.io/Capy/`.

`GAME.md` describes the mechanics. This file is about the code.

**This file keeps rules, not reasoning.** Each one is a constraint that has
already cost time. The long-form "why" lives in a comment at the call site and
in the PR history — go there when a rule looks wrong, before overruling it.

## Hard constraints

- **No build step, no ES modules.** `index.html` loads plain `<script>` tags.
  Do not introduce a bundler, `type="module"`, or a runtime dependency without
  asking — the point is that the repo is directly servable.
- **Relative paths, all-lowercase filenames.** Pages is case-sensitive.
- **Script order is load-bearing.** Top-level `const`/`let` in classic scripts
  share one global lexical environment (which is why nothing needs namespacing)
  but are TDZ-bound, so reordering the tags in `index.html` can break boot
  silently.
- Scripts stay at the **end of `<body>`**: `hud.js` calls `getElementById` at
  parse time.

## Layout

`index.html` — CSS, markup, ordered script tags.
`vendor/three.min.js` — three.js r160 UMD, inlined verbatim. Do not edit.
`assets/capybara.glb` — model source of truth, only read by the converter.
`tools/glb2json.mjs` — the offline converter.
`supabase/migrations/` — the score board schema. Applied by Supabase, not by the game.

Load order, which is also roughly the dependency order:

| File | Holds |
|---|---|
| `config.js` | Tuning constants, `TYPES`, `POWERS`, `UPGRADES`, `THEMES`, `TOUCH`, `REDUCED` |
| `icons.js` | `ICON_BODY` + `icon()` — inline SVG for every perk and power-up |
| `audio.js` | The `Audio` IIFE — synth primitives, the five written themes, every SFX |
| `scene.js` | Renderer, scene, sky texture + `skyBand`/`refreshSky`, camera + `fitCamera`, lights |
| `materials.js` | `M()` helper and the flat `mat` library |
| `theme.js` | `curTheme`, the theme colour lerp (`applyTheme`/`updateThemeMix`) |
| `environment.js` | Ground, arena `patch`, `border`, pond, scenery, clouds |
| `biomes.js` | Canvas textures, per-biome props, `refreshThemeEnvironment`, `updateThemeFX` |
| `capymodel.js` | GENERATED. The converted model as one `const`. Do not hand-edit. |
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
| `player.js` | `capyState`, `updateCapybara` physics, `tryDash`, `popUp` |
| `perks.js` | Perk mechanics: dash shockwave, ghosts, reach aura, golden routes, Puzzler |
| `input.js` | Keyboard, pointer drag, virtual thumbstick |
| `events.js` | Set-piece director (missiles / feast / sinkholes) |
| `upgrades.js` | The every-10-levels perk draft, ordinary + one-per-run |
| `gameflow.js` | `startGame`, pause/menu/`endGame`, button wiring |
| `dev.js` | `?dev=1` level switcher. Deletable in one piece. |
| `main.js` | `clock`, `animate()`, `onResize`, boot |

## Testing

No test suite. Verify in a real browser — `tools/shoot.js` wraps it:

```sh
npm i playwright-core          # not committed; chromium is preinstalled
python3 -m http.server 8765 &
node tools/shoot.js --check                  # assertions, non-zero on failure
node tools/music.js --wav                    # check the five themes, write WAVs
node tools/shoot.js --fmt                    # autopilot-walks every shape + feast route
node tools/shoot.js --biome hell,night       # screenshot biomes
node tools/shoot.js --capy                   # capybara turnaround
node tools/shoot.js --play                   # menu + gameplay + hat fit
```

`--fmt` is the clearability proof: every shape at its unlock level, at level 24
(where `fmtReach` tops out) and again under Sticky Feet, plus every feast route.
Run it after touching a shape, `stepTime`, movement, or anything that scales
speed. Its autopilot reads `rec.pts` — the ribbon — not spawned items: a
react-only autopilot has one fall of lead time and fails shapes that are
legitimately given more, and it must dash only when walking cannot cover the
step (with distance and time floors, or it dashes off a beat already underfoot
and you are measuring a bad player).

Screenshots land in `.shots/` (gitignored). **Read them back** — visual work
cannot be verified any other way.

Headless rendering runs at ~5fps under swiftshader, and `animate()` clamps
`dt`, so wall-clock timing tests are meaningless. For anything about rates,
physics or balance, drive `updateCapybara`/`updateItems`/`updateFormations`
directly at a fixed `1/60` step instead of waiting on real time.

## Music

- **Each biome is a written piece, not a reskin.** Parts are data — one string
  per bar, one token per step (`74` a note, `-` a hold, `.` a rest) — and the
  melody is a phrase that repeats. It used to pick notes at random from a
  pentatonic pool every eighth, which is why it never sounded like a tune.
- **Level fills a piece in; it never rewrites it.** Tempo creeps up over the ten
  levels of a biome, and `+`-suffixed drum layers join at the halfway point.
- **Verify music twice, each way for what it can tell you.** `tools/music.js`
  checks the *data* symbolically (in key, in register, no sustained semitone
  clash with the chord) and the *rendered audio* for clipping, per-theme loudness
  and — via a Goertzel filter at the expected fundamental — that the written note
  really sounds at the written time. Do not try to read pitches back out of a
  mix: a square wave's 7th harmonic and the kick's downward sweep both read as
  notes that were never written.
- **A bright pad will bury the tune.** Every "wrong note" that harness has ever
  flagged was a mix problem, not a data problem: a sawtooth pad's third harmonic
  landing a semitone under the melody (Hell, measured at 2.4x the melody's own
  level), and a saw bass whose filter opened to 700Hz. Pads and basses are dark
  on purpose — the lead is the only thing allowed to be bright.
- **Run `--level 6` or higher as well as the default.** The fill layers only
  exist above the halfway ramp, and a drum pattern keyed to a name with no
  instrument behind it threw on every fill hit — silently fine at level 1.

## High scores

- **Static hosting is not the constraint people assume.** Pages only declines to
  run code for us; the page it serves still makes network calls like any other.
  The board is Supabase over plain `fetch` — no SDK, no bundler, no dependency.
- **`SCORE_API.key` is the publishable key and belongs in public source.** Row
  level security is what protects the data. A `sb_secret_` key or the database
  password in `config.js` would hand the project away — they are never needed
  here, because the game only ever reads the board and calls `submit_score`.
- **Blank either `SCORE_API` field and the feature turns itself off.** The menu
  button hides, nothing is fetched. That is the offline story and the reason
  `--check` needs no network.
- **The network may never block the game.** Submits are fire-and-forget, a
  failed one is queued and retried at boot, and the board renders its cached
  copy before it fetches. A dead Supabase project must cost nothing but a
  greyed-out board.
- **One row per run, not per player** — the board shows every score, including
  the same tag many times. What keeps it short is the submit rule: a run is only
  offered when it beat that device's own best, which is the `isBest` flag
  `endGame` already computes. Move that gate and the table fills with noise.
- **A tag is not an account.** Nothing proves one is yours, deliberately —
  it is arcade initials, not a login. Do not add ownership to it without
  deciding you want accounts, because that is what it becomes.
- **Escape anything from the server before it reaches `innerHTML`.** Tags are
  written by other players. `submit_score`'s regex already excludes every HTML
  character; `esc()` is the second lock, and both should stay.

## UI rules

- **No emoji in the interface.** Every perk and power-up icon is inline SVG in
  `icons.js`, drawn in the game's palette: emoji are drawn by the platform, so
  the same card was a flat glyph on one machine and a glossy sticker on the next,
  and 🛡 in particular came out as a thin outline on Windows. Add an icon there
  and reference it by id — `icon()` logs a missing id rather than rendering a gap.
- **`refreshHUD` runs every frame, so it writes only what changed.** Use
  `setText`/`setHTML`/`setStyle`; a bare `textContent =` is a DOM mutation even
  when the string is identical, and the power chip's icon markup was being
  reparsed sixty times a second.
- **The perk rail rebuilds only when the SET of perks changes** (`railKey`). The
  Auto-Shield countdown is the one thing written per frame, through a cached
  element rather than a query.

## Gameplay rules

- **Movement is a velocity-target model, not an accelerator.** Every input path
  (keys, pointer drag, thumbstick) answers one question — what velocity does the
  player want — and `updateCapybara` eases toward it with separate time constants
  for opening up, braking and turning (`MOVE_T_*`). Do not reintroduce a friction
  multiplier or a top-speed clamp; the easing cannot overshoot, and the only thing
  above `SPEED` is the dash.
- **There is one pointer scheme per device, deliberately.** An input-offset
  (relative drag) alternative was built, shipped behind a title-screen toggle,
  and removed again: play-tested against drag-to-follow it measured the same, so
  it was a second code path and a second thing to explain for nothing. A new
  scheme needs evidence it beats the existing one, not just that it works. If one
  is ever added back, it feeds `capyState.stickX/stickZ` like the thumbstick —
  `updateCapybara` and `tryDash` should never learn about input devices.
- **`game.up.speed` is the only thing that scales movement.** Sticky Feet halves
  it, and `fmtSpeed` reads the same field, which is what keeps routes walkable at
  half speed. Anything that changes how fast the capybara moves goes here, or
  formations will be timed against a speed the player does not have.
- **Anything chasing a moving target wants velocity, not acceleration.** As
  acceleration it is an undamped spring: the pointer path rang around the
  cursor, and the magnet orbited food past the capybara instead of delivering
  it. The homing hazards keep acceleration *on purpose* — the overshoot is what
  makes them dodgeable.
- **Nothing assigns `hopV` directly — use `popUp()`.** Assigning it while
  airborne relaunches from that height, so pops stack into the stratosphere.
  `popUp` scales by remaining headroom; `HOP_MAX` caps the arc.
- **The hop is not an input.** `tryDash` replaced `tryJump`; catches, respawns
  and shield bounces still pop the capybara for juice. Anything gameplay-facing
  that means "airborne" keys off `dashT`, never `hopY` — off `hopY` it fires
  free on the arc of the previous catch.
- **Every formation is provably clearable.** `stepTime()` computes each gap
  from the distance and the capybara's speed; gaps are never hand-authored.
  Difficulty raises `fmtReach` and shortens `fmtGap` — **not** fall speed,
  which caps at `FALL_CAP`. Verify new shapes with `--fmt` (above).
- **A `dash` beat must fall back to walking time when the player has no dash.**
  Dash timing is *shorter* than the walk, so a dash-gated beat is the one thing
  Sticky Feet could make literally unclearable rather than merely slower — hence
  the `!game.run.sticky` in `emitFormation`.
- **A countdown that goes NaN never expires.** `activatePower` multiplied `P.dur`
  by a `game.up` field that a perk rewrite had deleted, so every duration was
  NaN, `t <= 0` was never true, and slow-mo, shield and magnet ran for the whole
  run. Deleting a field from `game.up` means auditing its readers; `--check`
  asserts each power expires on its own clock.
- **`updateItems` iterates a snapshot and skips `it.gone`.** One resolution can
  now remove several items — catching a power-up with Overcharged wipes every
  hazard in the air — and a live reverse index over a shrinking array reads past
  its end as soon as something below the cursor disappears.
- **A route is read off dots, not lines.** `buildPath` marks every landing spot,
  largest and brightest first, tapers the segments along the route and hides them
  as their beats land. The arena is twice as wide as it is deep, so any shape
  that crosses it more than once draws several near-parallel streaks in the same
  band: a new shape that traverses repeatedly must step in **z** as it goes (see
  `pendulum`, `pincer`) or it is unreadable however it is drawn.
- **`shieldUp()` and `absorbHit()` are the only protection test.** Two things can
  be protecting the player (the power-up bubble and Auto-Shield) and they end
  differently — the power-up is spent by a hit, Auto-Shield holds its two seconds
  — so nothing should test `game.shield` directly any more.
- **Overtime difficulty is spent on density, never on speed.** Every curve caps
  by about level 24; `overtime()` keeps climbing past it and goes to hazard rate,
  set-piece size and cadence, and hazard steering. Fall speed still caps at
  `FALL_CAP` and `fmtReach` still caps at 0.78 — a route that cannot be read, or
  cannot be walked, is not difficulty.
- **A perk made pointless by this run is never offered.** `dead(game)` on an
  upgrade keeps it out of the pool (Quick Paws with no dash), and the card is
  struck through if it is ever shown. Offering a dead perk wastes one of three
  slots, which is worse than offering nothing.
- **A route's golden multiple is fixed when it is emitted.** `rec.gold` is read
  once into the record, the ribbon and every item in it, so the payout cannot
  disagree with what the player was shown mid-route.
- **One run perk per run, total.** The gold slot closes as soon as any `RUN_PERK`
  is taken (`hasRunPerk`), not just the one that was taken — they are balanced as
  a single trade, and stacking all three cost one life for the lot.
- **Only one route is live at a time.** `fmt.live.size` gates emission; two
  overlapping routes are unreadable, not twice the challenge. That gate means a
  record that never resolves would wedge the director and stop food entirely,
  which is what `rec.age` guards against.

## Rendering and scene rules

- `animate()` rewrites `camera.position` every frame from `camFit`/`CAM_LOOK`.
  To move the camera, mutate those — not the camera.
- **The sky is a strip, not a screen**: 3.2% of screen height on a desktop
  aspect, 16.5% on a phone. `makeSkyTexture` draws the gradient, sun and clouds
  into that strip, sized by `skyBand()` and corrected for viewport aspect (the
  background quad is stretched to fill, so a circle needs its x radius divided
  by the aspect). `refreshSky()` repaints on resize and theme change. Do not put
  sky ornaments in `skyRig` as 3D objects — everything there projects to NDC y
  1.5–1.8 and has never been on screen at any aspect.
- `patch.material` **is** `mat.grassDark`. Mutating it in
  `refreshThemeEnvironment` fights the per-frame lerp in `updateThemeMix`,
  which is why that lerp is meadow-only.
- **Hell's slab is not raised** — the lava field is lowered by
  `HELL_LAVA_DROP`, with `hellSkirt` filling the step. Anything at lava level
  must be offset by the same drop *and* kept outside the patch footprint via
  `outsidePatch`.
- `clearThemeFX` disposes everything it walks. Module-level shared geometry and
  materials must set `userData.shared = true`.
- **Ghosts are clones of one template**, so they share its geometry and material:
  removing one must not dispose anything it walks, and per-ghost fading is
  impossible — the wind-down is scale. The ghost material is *shaded* and writes
  depth on purpose; flat and depth-writeless, the capybara rendered as a cluster
  of soap bubbles.
- **The ghost template is the model's own geometry in a plain `Mesh`** — the .glb
  in its bind pose, which is the same rest pose the retarget composes onto, and
  placed by the live mesh's transform relative to `capy.root` rather than by hand.
  No cloned skeleton, so an afterimage cannot animate along with the capybara
  that left it. It falls back to the procedural build for the same reason
  `buildCapybara` does.
- Tiled canvas textures must be genuinely periodic: a full-width curve is not,
  unless its height *and slope* match at both edges, and band spacing must
  divide the tile height exactly.
- `metalness` > 0 on a `MeshStandardMaterial` with no environment map kills the
  diffuse term — surfaces go near-black on one side and shiny on the other.

## The capybara

**Touching `capybara.glb`, `glb2json.mjs`, `capymodel.js`, `capyrig.js`, or the
sculpting in `models.js`? Read `MODEL.md` first** — the conversion pipeline, the
bone-name contract, the proxy/bone retarget and the art direction all live
there, and every one of them has already cost a day. Two that bite hardest:
the rig hands the game **proxy objects, never bones**, and the `.glb`'s armature
rotation must stay collapsed into the bone chain — reintroduce a matrix and the
capybara lands face-down.

`buildCapybara()` falls back to a procedural build if the bones do not validate,
so a silently wrong model looks like a downgrade rather than a crash;
`--check` asserts the rig contract for exactly that reason.

## Known and deliberately unfixed

`updateThemeFX` advances the hell lava bubbles with a hardcoded `1/60` rather
than the frame delta, so they animate at different speeds on different refresh
rates. Decided not worth fixing. Not a bug to "discover" again.

## Tooling

`pkill -f "http.server 8765"` matches its own command line and kills the shell.
Use `pkill -f "http[.]server 8765"`.

## Working agreements

- Branch, commit, push, **and open a pull request.** The PR is the review step —
  fine to open without asking, since it can simply be closed. Never merge it.
- Do not change gameplay behaviour during visual or refactor work; list anything
  suspicious separately rather than fixing it inline.
- Do not put model identifiers in commits, PRs, or code comments.
