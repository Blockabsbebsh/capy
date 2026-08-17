# Capybara Snack Rush

A 3D browser game: a capybara catches falling food. **three.js**, not 2D canvas.
Nearly everything is generated at runtime — meshes assembled from primitives,
textures painted onto a `<canvas>`, all audio synthesized with the Web Audio
API. There are no image or sound files in the repo.

The one exception is the capybara itself, which is an external model:
`assets/capybara.glb` is the source of truth, converted offline into
`js/capymodel.js`. See "The capybara model" below.

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
`assets/capybara.glb` — model source of truth, only ever read by the converter.
`tools/glb2json.mjs` — the offline converter.

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
| `player.js` | `capyState`, `updateCapybara` physics |
| `input.js` | Keyboard, pointer drag, virtual thumbstick |
| `events.js` | Set-piece director (missiles / feast / sinkholes) |
| `upgrades.js` | The every-5-levels perk draft |
| `gameflow.js` | `startGame`, pause/menu/`endGame`, button wiring |
| `dev.js` | `?dev=1` level switcher. Deletable in one piece. |
| `main.js` | `clock`, `animate()`, `onResize`, boot |

## The capybara rig contract

`buildCapybara()` in `models.js` returns an object the animation code reaches
into by name. It returns the rigged model (`capyrig.js`) when the model is
present and its bones validate, otherwise the procedural build. Both satisfy
the contract below, and `tools/shoot.js --check` asserts every name in it.

**The rigged build cannot hand the game bones.** `player.js` drives the rig in
game units — `legs[i].position.y = legRestY + lift`, with `legRestY` 0.21 —
while a hip bone sits at a local offset of its own, so assigning 0.21 to it
folds the model in half. Bones also carry rest rotations that an absolute
`rotation.x =` would wipe out. So `legs`, `head`, `muzzle`, `mouth` and `skull`
are **proxy objects** that only absorb those writes; `syncCapyRig()`, called
once a frame from `animate()`, composes them onto the real bones on top of each
bone's rest quaternion. `player.js` is untouched by any of this.

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

## The capybara model

`GLTFLoader` is **not** in the vendored bundle, and the add-on loaders ship as
ES modules only, so a `.glb` cannot be loaded at runtime without a build step.
`ObjectLoader` **is** in the bundle. Verify rather than trusting this file:

```sh
grep -c GLTFLoader vendor/three.min.js   # 0
grep -c ObjectLoader vendor/three.min.js # 1
```

So the model is converted **offline** and committed as a plain script that
assigns one global. No new runtime dependency, no fetch, no async at boot, and
`file://` still works.

### Updating the model

Drop the new `.glb` over `assets/capybara.glb` and re-run:

```sh
npm i three@0.160.0        # dev only, uncommitted; must match vendor/
node tools/glb2json.mjs assets/capybara.glb js/capymodel.js
```

Commit the regenerated `js/capymodel.js` (~805 KB raw, ~170 KB gzipped).

`TARGET_HEIGHT` at the top of the converter is the capybara's size in game
units, floor to the top of the head. Everything else scales off it — including
the foot-sock thresholds, which are fractions of it rather than absolute units
for exactly that reason.

The converter is not a straight `toJSON()` dump — the source `.glb` needs
several things it does not carry, and each is documented at its call site:

- **welds vertices and averages normals.** The Blender export splits every
  vertex per face, so it renders flat-shaded. Welding drops 14122 verts to
  2502 and is what produces the smooth figurine surface.
- **generates cylindrical UVs.** The mesh has no `TEXCOORD_0` at all.
- **bakes vertex colours from the skin weights.** Whichever bone owns a vertex
  picks its colour, so `_ankle`/`_toe` vertices come out near-black with no
  hand painting and no seam.
- **bakes scale and the ground offset** into the geometry and bone
  translations, so nothing carries a non-unit scale at runtime.
- **collapses the armature's export rotation** — see the gotcha below.

### Bone names are a contract

`js/capyrig.js` drives these by name. Renaming any of them in Blender makes it
refuse the model (loudly, on the console) and fall back to the procedural
capybara. Adding bones is always safe.

`head0`, `neck1`, and `leg_{front,hind}_{left,right}_{top0,bot0}`.

The model has **no jaw, muzzle or mouth bone**, so the chew animation has
nothing to drive. `muzzle`/`mouth`/`skull` are inert proxies; the capybara does
not chew. Give it a jaw bone and map it in `syncCapyRig` if that changes.

The animation in the `.glb` is discarded — it animates the armature's own
transform, which would fight the `root/bob/squash/tilt` chain. `scene.toJSON()`
omits clips anyway.

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
- No pale belly patch. On the procedural build the whole leg is darker than the
  body; on the model only the **feet** are dark, as short socks — the legs stay
  body-coloured. The model's eyes also sit high and well back on the skull,
  where a real capybara's are, not on the cheek.

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
- The `.glb` carries a Z-up→Y-up rotation on the armature node. Per the glTF
  spec a skinned mesh **ignores its own node transform**, and three honours that
  (bindMode `attached` recomputes `bindMatrixInverse` from `matrixWorld` every
  frame), so the mesh renders in bone space while that rotation sits on the node
  doing nothing to it. Measure anything through `mesh.matrixWorld` and you are
  measuring a space the mesh does not render in — and calling
  `bind(skeleton, matrixWorld)` bakes the rotation in for real and lands the
  capybara face-down. `glb2json.mjs` pushes the rotation into the bone chain so
  there is exactly one coordinate space; nothing downstream should reintroduce
  a matrix.
- `Box3.setFromObject` **caches** its result on a `SkinnedMesh`. Rescale the
  geometry and it keeps returning the old bounds. `glb2json.mjs` has `bboxOf()`
  for this; do not swap it back for `setFromObject`.
- `mat.eye` is roughness 0.25. On the procedural capybara's tiny eyes that is
  invisible; at the model's eye size it is a hard catchlight, which the art
  direction rules out. `capyrig.js` uses its own matte eye material.
- **Do not drive the foot colour from the skin weights.** It looks like the
  principled choice and it is not: the rig's ankle/toe bones are wildly
  asymmetric front to back — hind ankle at y 0.168, front ankle at y 0.018 — so
  weighting by them paints a boot half way up the hind shins while catching 5-9
  vertices per front foot, which is invisible. `paint()` masks by height
  instead; every foot is planted at y = 0 after grounding.
- **Only one route is ever live.** `fmt.live.size` gates emission, so a shape
  has to finish landing before the next is chosen. Two overlapping routes are
  not twice the challenge, they are unreadable. That gate means a record which
  never resolves would wedge the director and stop food entirely, which is
  what the `rec.age` safety valve in `updateFormations` is for.
- **Nothing assigns `hopV` directly — use `popUp()`.** Pops stack otherwise:
  assigning while already airborne relaunches from that height, and a few hits
  in quick succession put the capybara in the stratosphere. `popUp` scales by
  remaining headroom and `HOP_MAX` caps the arc outright.
- **Food arrives as formations, and every one is provably clearable.** The gap
  between consecutive beats is computed, not authored: `stepTime()` gives each
  step exactly the time needed to walk that distance at `fmtReach()` of top
  speed, so no shape can ask for more than the capybara has. Difficulty raises
  `fmtReach` (less slack per step) and shortens `fmtGap`, **not** fall speed,
  which caps at `FALL_CAP`. If you author a shape with hand-timed gaps instead,
  you reintroduce exactly the unreadable late game this replaced. Verify new
  shapes with an autopilot sweep — and have it dash only when walking cannot
  cover the step, or you are testing a bad player, not a hard shape.
- **The sky is a strip, not a screen.** The camera's pitch and the 60-unit
  ground disc leave only 3.2% of screen height as sky on a desktop aspect and
  16.5% on a phone. `makeSkyTexture` therefore draws the whole gradient, the
  sun and the clouds into that strip, sized from `skyBand()` and corrected for
  the viewport aspect (the background quad is stretched to fill, so a circle
  needs its x radius divided by the aspect). `refreshSky()` repaints on every
  resize and theme change — the strip's height and the correction both move
  with the viewport. Do not put sky ornaments in `skyRig` as 3D objects: the
  sun, halo, clouds and hell's moon all still live there and all project to
  NDC y 1.5-1.8, i.e. none of them have ever been on screen at any aspect.
- Movement is a **velocity-target** model, not an accelerator. Every input path
  (keys, pointer drag, thumbstick) answers one question — what velocity does
  the player want — and `updateCapybara` eases toward it with a different time
  constant for opening up, braking and turning (`MOVE_T_*` in `config.js`).
  Do not reintroduce a friction multiplier or a top-speed clamp: the easing
  cannot overshoot its target, and the only thing above `SPEED` is the dash.
  Driving the pointer path through *acceleration* instead is what made it a
  near-undamped spring that rang eight times around the cursor. **Anything
  that chases a moving target wants velocity, not acceleration** — the magnet
  had the identical bug independently, and orbited food past the capybara
  instead of delivering it. The homing hazards keep the acceleration model on
  purpose: overshoot is what makes them dodgeable.
- The **hop still exists but is not an input.** `tryDash` replaced `tryJump`;
  catches, respawns and shield bounces still set `hopV`, so all the pop and
  squash juice runs as before. Anything keyed off "airborne" for gameplay
  (the old `AIR_BONUS`, the catch-reach bonus, sinkhole immunity) is keyed off
  `dashT` now — keying it off `hopY` again would hand out the bonus for free
  on the arc of the previous catch.
- Hell's arena slab is **not** raised — the lava field around it is lowered.
  `patch` sits at the same height in every biome; for `hell` the background
  `ground` disc drops by `HELL_LAVA_DROP` and `hellSkirt` fills the step, so
  the slab's side face shows. Anything planted at lava level (boulders, lava
  bubbles) has to be offset by the same drop **and** kept outside the patch
  footprint via `outsidePatch`, or it stands in the lava and pokes through the
  slab.
- Eye sockets are **found**, not positioned by bounding-box fractions. The head
  has three concave dishes — sockets, nostrils, mouth line — and `capyrig.js`
  picks the sockets by discrete curvature with the midline and muzzle fenced
  off. A fractions guess put the eyes on the cheek.

## Known and deliberately unfixed

`updateThemeFX` advances the hell lava bubbles with a hardcoded `1/60` instead
of the frame delta, so they animate at different speeds on different refresh
rates. The user decided it was not worth fixing. Not a bug to "discover" again.

## Working agreements

- Branch, commit, push, **and open a pull request.** The PR is the review step —
  it is fine to open one without asking, since it can simply be closed if the
  work is not wanted. Never merge it yourself.
- Do not change gameplay behaviour while doing visual or refactor work; list
  anything suspicious separately rather than fixing it inline.
- Do not put model identifiers in commits, PRs, or code comments.
