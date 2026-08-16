# Capybara Snack Rush

A 3D browser game: a capybara catches falling food. **three.js**, not 2D canvas.
Everything is generated at runtime — every mesh is assembled from primitives,
every texture is painted onto a `<canvas>`, all audio is synthesized with the
Web Audio API. There are no image, model, or sound files in the repo.

Deploys to GitHub Pages from `main`. Live at
`https://gabrieliusskuminas-crypto.github.io/Capy/`.

## Hard constraints

- **No build step, no ES modules.** `index.html` loads plain `<script>` tags.
  Do not introduce a bundler, `type="module"`, or a package.json runtime dep
  without asking first — the whole point is that the repo is directly servable.
- **Relative paths, all-lowercase filenames.** Pages is case-sensitive.
- **Script order is load-bearing.** Top-level `const`/`let` in classic scripts
  share one global lexical environment (which is why nothing needs namespacing
  or `window.` prefixes), but they are TDZ-bound. Reordering the tags in
  `index.html` can break boot silently. The order is listed in `index.html`
  with a comment saying so.
- Scripts must stay at the **end of `<body>`**: `hud.js` does
  `document.getElementById` at parse time.

## Layout

`index.html` — CSS, markup, and the ordered script tags.
`vendor/three.min.js` — three.js r160 UMD, inlined verbatim. Do not edit.

Load order, which is also roughly the dependency order:

| File | Holds |
|---|---|
| `config.js` | Tuning constants, `TYPES`, `POWERS`, `UPGRADES`, `THEMES`, `TOUCH`, `REDUCED` |
| `audio.js` | The `Audio` IIFE — synth primitives, procedural music, every SFX |
| `scene.js` | Renderer, scene, sky texture, camera + `fitCamera`, lights, `skyRig` |
| `materials.js` | `M()` helper and the flat `mat` library |
| `theme.js` | `curTheme`, the theme colour lerp (`applyTheme`/`updateThemeMix`) |
| `environment.js` | Ground, arena `patch`, `border`, pond, scenery, clouds |
| `biomes.js` | Canvas textures, per-biome props, `refreshThemeEnvironment`, `updateThemeFX` |
| `models.js` | `roundedBoxGeo`, `sculptBlob`, the capybara, food/hazard/hat builders |
| `particles.js` | InstancedMesh pool, `burst`, `PAL` |
| `items.js` | Falling item lifecycle: spawn, fall, `onCatch`, `onMiss` |
| `sinkholes.js` | Hole telegraph/open/close, `holeAt` |
| `stack.js` | Hat mounting, the head food-stack, debris |
| `state.js` | The `game` object, difficulty curve, hat unlocks, combo |
| `powers.js` | Shield bubble, magnet/slowmo/shield activation |
| `hud.js` | `$`, `ui`, HUD rendering, `popup`, `showBanner`, `flash` |
| `player.js` | `capyState`, `updateCapybara` physics |
| `input.js` | Keyboard, pointer drag, virtual thumbstick |
| `events.js` | Set-piece director (missiles / feast / sinkholes) |
| `upgrades.js` | The every-5-levels perk draft |
| `gameflow.js` | `startGame`, pause/menu/`endGame`, button wiring |
| `dev.js` | `?dev=1` level switcher. Deletable in one piece. |
| `main.js` | `clock`, `animate()`, `onResize`, boot |

## The capybara rig contract

`buildCapybara()` in `models.js` returns an object the animation code reaches
into by name. Anything replacing the model must supply all of it:

- Group chain `root → bob → squash → tilt → body`. `bob` takes hop height,
  `squash` takes squash-and-stretch scale, `tilt` takes lean/yaw. Losing this
  chain loses hopping, landing squash and steering lean.
- `head` — a Group, gets idle bob rotation.
- `legs[]` — four meshes, driven for the walk cycle.
- `legRestY` — resting Y for the legs, read by `updateCapybara`.
- `muzzle`, `mouth`, `skull` — driven by the chewing animation. Their rest
  positions live in `player.js` as `MUZZLE_Y` / `MOUTH_Y` and must be retuned
  whenever the head moves.
- `hatAnchor` — hats are parented here.
- `stackAnchor` + `stackBaseY` — the food stack mounts here; `stack.js` sets
  `stackAnchor.position.y = capy.stackBaseY + hat.top`.
- `eyes[]`, `torso` — currently unused by other files, kept for API stability.

## Loading an external model

`GLTFLoader` is **not** in the vendored bundle, and the add-on loaders ship as
ES modules only, so it cannot be dropped in without abandoning the no-build
setup. Verify before planning around it:

```sh
grep -c GLTFLoader vendor/three.min.js   # 0
grep -c ObjectLoader vendor/three.min.js # 1
```

What *is* in the bundle: `ObjectLoader`, `BufferGeometryLoader`,
`MaterialLoader`, `AnimationMixer`, `SkinnedMesh`. So the no-build path for an
external model is to convert it to three.js JSON **offline** (a throwaway Node
script using GLTFLoader + `.toJSON()`), commit the JSON, and load it at runtime
with `THREE.ObjectLoader` — zero new runtime dependencies. Skeletal animation
would work through that path too.

Loading is async, so the model will not exist at boot. Keep the procedural
capybara as the placeholder and swap it in when the file arrives. Loaders do
not set `castShadow`; do it manually or the model looks unglued.

## Art direction

Style is smooth stylised-figurine, calibrated against a reference the user
supplied. The things that matter, learned the hard way:

- One continuously sculpted surface. Two overlapping convex primitives leave a
  shading crease exactly where they meet, and that crease is what makes a model
  read as "assembled from parts". `sculptBlob()` in `models.js` deforms a sphere
  along Z with a per-slice profile to avoid it.
- Unbroken back-to-head line with a soft dip at the neck — *not* a head lifted
  clear of the shoulders. The chest profile has to stay tall enough to actually
  meet the skull or the join is a hard step.
- Small flat dark eyes, no catchlight. Glossy highlights read as cartoon
  character rather than figurine.
- Legs distinctly darker than the body; no pale belly patch.

## Testing

There is no test suite. Verify in a real browser — `tools/shoot.js` wraps it:

```sh
npm i playwright-core          # not committed; chromium is preinstalled
python3 -m http.server 8765 &
node tools/shoot.js --check                  # assertions, exits non-zero on failure
node tools/shoot.js --biome hell,night       # screenshot biomes
node tools/shoot.js --capy                   # capybara turnaround
```

Screenshots land in `.shots/` (gitignored). Read them back — visual work cannot
be verified any other way.

## Gotchas that have already cost time

- `animate()` rewrites `camera.position` every frame from `camFit`/`CAM_LOOK`.
  To move the camera for a screenshot, mutate those, not the camera.
- `pkill -f "http.server 8765"` matches its own command line and kills the
  shell. Use `pkill -f "http[.]server 8765"`.
- `patch.material` **is** `mat.grassDark`. Mutating it in
  `refreshThemeEnvironment` fights the per-frame lerp in `updateThemeMix`,
  which is why that lerp is now meadow-only.
- `clearThemeFX` disposes everything it walks. Module-level shared geometry and
  materials must set `userData.shared = true` to be skipped.
- Tiled canvas textures must be genuinely periodic. A curve drawn full-width
  is not periodic unless its height *and slope* match at both edges; band
  spacing must divide the tile height exactly.
- `metalness` > 0 on a `MeshStandardMaterial` with no environment map kills the
  diffuse term and leaves a bare specular highlight — surfaces go near-black on
  one side and shiny on the other.

## Known and deliberately unfixed

`updateThemeFX` advances the hell lava bubbles with a hardcoded `1/60` instead
of the frame delta, so they animate at different speeds on different refresh
rates. The user decided it was not worth fixing. Not a bug to "discover" again.

## Working agreements

- Branch, commit, push. **Do not open a pull request unless asked.**
- Do not change gameplay behaviour while doing visual or refactor work; list
  anything suspicious separately rather than fixing it inline.
- Do not put model identifiers in commits, PRs, or code comments.
