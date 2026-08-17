# The capybara model, rig and art direction

Read this before touching `assets/capybara.glb`, `tools/glb2json.mjs`,
`js/capymodel.js`, `js/capyrig.js`, or the sculpting in `js/models.js`.
Nothing here matters for any other work, which is why it is not in `CLAUDE.md`.

## Why the model is converted offline

`GLTFLoader` is **not** in the vendored bundle and the add-on loaders are ES
modules only, so a `.glb` cannot be loaded at runtime without a build step.
`ObjectLoader` **is** in the bundle. Verify rather than trusting this file:

```sh
grep -c GLTFLoader vendor/three.min.js   # 0
grep -c ObjectLoader vendor/three.min.js # 1
```

So the model is converted offline into a plain script assigning one global. No
runtime dependency, no fetch, no async at boot, and `file://` still works.

## Updating the model

Drop the new `.glb` over `assets/capybara.glb` and re-run:

```sh
npm i three@0.160.0        # dev only, uncommitted; must match vendor/
node tools/glb2json.mjs assets/capybara.glb js/capymodel.js
```

Commit the regenerated `js/capymodel.js` (~805 KB raw, ~170 KB gzipped).

`TARGET_HEIGHT` at the top of the converter is the capybara's height in game
units, floor to the top of the head; everything else scales off it, including
the foot-sock thresholds, which are fractions of it for exactly that reason.

The converter is not a plain `toJSON()` dump — the source `.glb` lacks several
things it needs, and each is documented at its call site: it welds vertices and
averages normals (the Blender export splits every vertex per face, so it renders
flat-shaded), generates cylindrical UVs (there is no `TEXCOORD_0` at all), bakes
vertex colours from the skin weights, bakes scale and the ground offset into the
geometry, and collapses the armature's export rotation.

## Bone names are a contract

`capyrig.js` drives these by name. Renaming any in Blender makes it refuse the
model (loudly, on the console) and fall back to the procedural capybara. Adding
bones is always safe.

`head0`, `neck1`, and `leg_{front,hind}_{left,right}_{top0,bot0}`.

There is **no jaw, muzzle or mouth bone**, so the chew animation has nothing to
drive: `muzzle`/`mouth`/`skull` are inert proxies and the capybara does not
chew. Give it a jaw bone and map it in `syncCapyRig` if that changes.

The animation in the `.glb` is discarded — it animates the armature's own
transform, which would fight the `root/bob/squash/tilt` chain. `scene.toJSON()`
omits clips anyway.

## The rig contract

`buildCapybara()` in `models.js` returns the rigged model when the bones
validate, otherwise the procedural build. Both satisfy the contract below, and
`tools/shoot.js --check` asserts every name in it.

**The rigged build cannot hand the game bones.** `player.js` drives the rig in
game units — `legs[i].position.y = legRestY + lift`, `legRestY` being 0.21 —
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

## Gotchas

- **The `.glb` carries a Z-up→Y-up rotation on the armature node.** Per the
  glTF spec a skinned mesh **ignores its own node transform**, and three honours
  that (bindMode `attached` recomputes `bindMatrixInverse` from `matrixWorld`
  every frame), so the mesh renders in bone space while that rotation sits on
  the node doing nothing to it. Measure anything through `mesh.matrixWorld` and
  you are measuring a space the mesh does not render in — and calling
  `bind(skeleton, matrixWorld)` bakes the rotation in for real and lands the
  capybara face-down. `glb2json.mjs` pushes the rotation into the bone chain so
  there is exactly one coordinate space; nothing downstream should reintroduce
  a matrix.
- `Box3.setFromObject` **caches** its result on a `SkinnedMesh`. Rescale the
  geometry and it keeps returning the old bounds. `glb2json.mjs` has `bboxOf()`
  for this; do not swap it back for `setFromObject`.
- **Do not drive the foot colour from the skin weights.** It looks like the
  principled choice and it is not: the rig's ankle/toe bones are wildly
  asymmetric front to back — hind ankle at y 0.168, front ankle at y 0.018 — so
  weighting by them paints a boot half way up the hind shins while catching 5-9
  vertices per front foot, which is invisible. `paint()` masks by height
  instead; every foot is planted at y = 0 after grounding.
- **Eye sockets are found, not positioned by bounding-box fractions.** The head
  has three concave dishes — sockets, nostrils, mouth line — and `capyrig.js`
  picks the sockets by discrete curvature with the midline and muzzle fenced
  off. A fractions guess put the eyes on the cheek.
- `mat.eye` is roughness 0.25. On the procedural capybara's tiny eyes that is
  invisible; at the model's eye size it is a hard catchlight, which the art
  direction below rules out. `capyrig.js` uses its own matte eye material.

## Art direction

Smooth stylised figurine, calibrated against a reference the user supplied.
Learned the hard way:

- One continuously sculpted surface. Two overlapping convex primitives leave a
  shading crease exactly where they meet, and that crease is what makes a model
  read as "assembled from parts". `sculptBlob()` in `models.js` deforms a sphere
  along Z with a per-slice profile to avoid it.
- Unbroken back-to-head line with a soft dip at the neck — *not* a head lifted
  clear of the shoulders. The chest profile has to stay tall enough to actually
  meet the skull, or the join is a hard step.
- Small flat dark eyes, no catchlight. Glossy highlights read as cartoon
  character rather than figurine.
- No pale belly patch. On the procedural build the whole leg is darker than the
  body; on the model only the **feet** are dark, as short socks — the legs stay
  body-coloured. The model's eyes also sit high and well back on the skull,
  where a real capybara's are, not on the cheek.
