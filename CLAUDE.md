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

Load order, which is also roughly the dependency order:

| File | Holds |
|---|---|
| `config.js` | Tuning constants, `TYPES`, `POWERS`, `UPGRADES`, `THEMES`, `TOUCH`, `REDUCED` |
| `audio.js` | The `Audio` IIFE — synth primitives, procedural music, every SFX |
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
| `powers.js` | Shield bubble, magnet/slowmo/shield activation |
| `hud.js` | `$`, `ui`, HUD rendering, `popup`, `showBanner`, `flash` |
| `player.js` | `capyState`, `updateCapybara` physics, `tryDash`, `popUp` |
| `input.js` | Keyboard, pointer drag, virtual thumbstick |
| `events.js` | Set-piece director (missiles / feast / sinkholes) |
| `upgrades.js` | The every-5-levels perk draft |
| `gameflow.js` | `startGame`, pause/menu/`endGame`, button wiring |
| `dev.js` | `?dev=1` level switcher. Deletable in one piece. |
| `main.js` | `clock`, `animate()`, `onResize`, boot |

## Testing

No test suite. Verify in a real browser — `tools/shoot.js` wraps it:

```sh
npm i playwright-core          # not committed; chromium is preinstalled
python3 -m http.server 8765 &
node tools/shoot.js --check                  # assertions, non-zero on failure
node tools/shoot.js --biome hell,night       # screenshot biomes
node tools/shoot.js --capy                   # capybara turnaround
node tools/shoot.js --play                   # menu + gameplay + hat fit
```

Screenshots land in `.shots/` (gitignored). **Read them back** — visual work
cannot be verified any other way.

Headless rendering runs at ~5fps under swiftshader, and `animate()` clamps
`dt`, so wall-clock timing tests are meaningless. For anything about rates,
physics or balance, drive `updateCapybara`/`updateItems`/`updateFormations`
directly at a fixed `1/60` step instead of waiting on real time.

## Gameplay rules

- **Movement is a velocity-target model, not an accelerator.** Every input path
  (keys, drag, thumbstick) answers one question — what velocity does the player
  want — and `updateCapybara` eases toward it with separate time constants for
  opening up, braking and turning (`MOVE_T_*`). Do not reintroduce a friction
  multiplier or a top-speed clamp; the easing cannot overshoot, and the only
  thing above `SPEED` is the dash.
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
  which caps at `FALL_CAP`. Verify new shapes with an autopilot sweep, and have
  it dash only when walking cannot cover the step, or you are testing a bad
  player rather than a hard shape.
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
