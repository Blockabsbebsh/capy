/* =======================================================================
   RIGGED CAPYBARA — adapter around the converted external model.

   The model is a SkinnedMesh with 28 bones (see tools/glb2json.mjs). The
   animation code in player.js was written against the hand-built capybara and
   drives it in GAME units: `legs[i].position.y = legRestY + lift` with
   legRestY = 0.21. Bone translations are nothing like that — a hip bone sits
   at a local offset of its own, and assigning 0.21 to it would fold the model
   in half. Bones also carry rest rotations, which an absolute `rotation.x =`
   would wipe out.

   So the game is never handed bones. `legs`, `head`, `muzzle`, `mouth` and
   `skull` are PROXY objects that exist only to absorb those writes; once a
   frame `syncCapyRig()` reads them and composes the result onto the real
   bones, on top of each bone's rest quaternion. player.js is untouched.

   Everything else in the contract is a real object: root/bob/squash/tilt/body
   are ordinary Groups exactly as before, and the anchors are real Groups
   parented to the head bone so hats and the food stack ride the head.
   ======================================================================= */

// Bones the retarget drives. Renaming any of these in Blender lands here.
const RIG_BONES = {
  head: 'head0',
  neck: 'neck1',
  // [hip, knee] per leg, in the order player.js phases them: FL, FR, HL, HR
  legs: [
    ['leg_front_left_top0',  'leg_front_left_bot0'],
    ['leg_front_right_top0', 'leg_front_right_bot0'],
    ['leg_hind_left_top0',   'leg_hind_left_bot0'],
    ['leg_hind_right_top0',  'leg_hind_right_bot0'],
  ],
};

const LEG_LIFT = 0.14;      // the lift amplitude player.js works in, for normalising
const HIP_SWING = 1.25;     // how much of the proxy's swing reaches the hip
const KNEE_TUCK = 0.70;     // knee flex per unit of lift
const HEAD_SHARE = 0.72;    // head bob split between head0 and neck1

let rig = null;             // retarget state, null while the procedural build is up

/* -----------------------------------------------------------------------
   Fur texture. The mesh ships with no UVs at all, so glb2json generates a
   cylindrical projection; it stretches over the legs and has a seam down the
   belly. That is survivable only because what it carries is noise — a
   structured pattern would fall apart on it. Grain is high frequency around
   the body and low along it, so it reads as strands running head to tail.
   ----------------------------------------------------------------------- */
function furTexture(){
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);

  const oct = [{ nx:64, ny:10, amp:0.55 }, { nx:24, ny:5, amp:0.30 }, { nx:9, ny:3, amp:0.15 }];
  // wrapped lattices — indices are taken modulo, so the noise tiles exactly
  const grid = oct.map(o => {
    const g = new Float32Array(o.nx * o.ny);
    for (let i = 0; i < g.length; i++) g[i] = Math.random();
    return g;
  });
  const ease = t => t * t * (3 - 2 * t);
  const at = (g, nx, ny, x, y) => g[(((y % ny) + ny) % ny) * nx + (((x % nx) + nx) % nx)];
  const noise = (k, u, v) => {
    const { nx, ny } = oct[k], g = grid[k];
    const x = u * nx, y = v * ny;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = ease(x - x0), fy = ease(y - y0);
    const a = at(g,nx,ny,x0,y0),   b = at(g,nx,ny,x0+1,y0);
    const c = at(g,nx,ny,x0,y0+1), d = at(g,nx,ny,x0+1,y0+1);
    const top = a + (b - a) * fx, bot = c + (d - c) * fx;
    return top + (bot - top) * fy;
  };

  let tot = 0;
  for (const o of oct) tot += o.amp;
  for (let y = 0; y < S; y++){
    for (let x = 0; x < S; x++){
      let n = 0;
      for (let k = 0; k < oct.length; k++) n += noise(k, x / S, y / S) * oct[k].amp;
      n /= tot;
      const g = 206 + n * 49;              // a gentle multiplier, never a stripe
      const p = (y * S + x) * 4;
      img.data[p] = img.data[p+1] = img.data[p+2] = g;
      img.data[p+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* -----------------------------------------------------------------------
   Build. Returns null (loudly) if the model or a driven bone is missing, so
   models.js can fall back to the procedural capybara rather than putting a
   broken animal on screen.
   ----------------------------------------------------------------------- */
function buildRiggedCapybara(){
  if (typeof CAPY_MODEL === 'undefined'){
    console.error('[capy] capymodel.js did not load — using the procedural capybara');
    return null;
  }

  // no images or textures in the JSON, so this resolves synchronously
  const loaded = new THREE.ObjectLoader().parse(CAPY_MODEL);

  let mesh = null;
  const bones = {};
  loaded.traverse(o => {
    if (o.isSkinnedMesh) mesh = o;
    if (o.isBone) bones[o.name] = o;
  });

  const want = [RIG_BONES.head, RIG_BONES.neck].concat(...RIG_BONES.legs);
  const missing = want.filter(n => !bones[n]);
  if (!mesh || missing.length){
    console.error('[capy] model does not meet the rig contract' +
      (missing.length ? ', missing bone(s): ' + missing.join(', ') : ', no SkinnedMesh') +
      ' — using the procedural capybara');
    return null;
  }

  mesh.material = new THREE.MeshStandardMaterial({
    color: 0xffffff,           // white: the baked vertex colours carry the hue
    vertexColors: true,
    map: furTexture(),
    roughness: 0.95,
    metalness: 0.0,            // see CLAUDE.md — nonzero kills the diffuse term
  });
  mesh.castShadow = true;      // loaders never set this
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;  // the rig moves well outside its bind-pose bounds

  /* --- contract group chain, identical to the procedural build ---------- */
  const root   = new THREE.Group();
  const bob    = new THREE.Group();
  const squash = new THREE.Group();
  const tilt   = new THREE.Group();
  const body   = new THREE.Group();
  root.add(bob); bob.add(squash); squash.add(tilt); tilt.add(body);
  body.add(loaded);
  root.updateMatrixWorld(true);

  /* --- where is the head? ----------------------------------------------
     Measured off the mesh rather than hardcoded, so the anchors and eyes
     follow the model if it is ever re-exported at different proportions. */
  const head = bones[RIG_BONES.head];
  const headIdx = mesh.skeleton.bones.indexOf(head);
  const pos = mesh.geometry.attributes.position;
  const nor = mesh.geometry.attributes.normal;
  const si = mesh.geometry.attributes.skinIndex;
  const sw = mesh.geometry.attributes.skinWeight;

  // glb2json collapses the armature's export rotation, so geometry space, bone
  // space and the rig group's local space are all the same frame — positions
  // below are read straight off the attribute with no matrix in the way.
  const headVerts = [];
  const headBox = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++){
    let w = 0;
    for (const k of ['X', 'Y', 'Z', 'W']){
      if (si['get' + k](i) === headIdx) w += sw['get' + k](i);
    }
    if (w > 0.5){
      headVerts.push(i);
      headBox.expandByPoint(v.fromBufferAttribute(pos, i));
    }
  }

  // nearest head vertex to a target point, nudged out along its own normal —
  // this lands the eyes inside the sculpted dimples instead of guessing
  const onHead = (target, out = 0.004) => {
    let best = -1, bestD = Infinity;
    for (const i of headVerts){
      const d = v.fromBufferAttribute(pos, i).distanceToSquared(target);
      if (d < bestD){ bestD = d; best = i; }
    }
    const p = new THREE.Vector3().fromBufferAttribute(pos, best);
    const n = new THREE.Vector3().fromBufferAttribute(nor, best).normalize();
    return { p: p.addScaledVector(n, out), n };
  };

  const midX = (headBox.min.x + headBox.max.x) * 0.5;
  const hb = { w: headBox.max.x - headBox.min.x,
               h: headBox.max.y - headBox.min.y,
               d: headBox.max.z - headBox.min.z };

  /* --- eyes -------------------------------------------------------------
     Small, flat and dark, no catchlight — the art direction is explicit that
     a glossy highlight reads as cartoon rather than figurine. The mesh has the
     sockets sculpted but carries no colour of its own.

     The sockets are FOUND, not guessed at from bounding-box fractions: this
     capybara's eyes sit high and well back on the skull (they are set up like
     a real capybara's, near the top of the head), which is nowhere near where
     a "60% up, 72% forward" guess lands. Concavity is the discrete Laplacian
     projected on the normal — positive where the surface dishes inward. The
     head has three such dishes: the eye sockets, the nostrils and the mouth
     line, so the search is fenced off the midline and above the muzzle, which
     leaves only the eyes. */
  const nbr = new Map();
  const link = (a, b) => { if (!nbr.has(a)) nbr.set(a, new Set()); nbr.get(a).add(b); };
  const index = mesh.geometry.index;
  for (let t = 0; t < index.count; t += 3){
    const a = index.getX(t), b = index.getX(t+1), c = index.getX(t+2);
    link(a,b); link(b,a); link(b,c); link(c,b); link(c,a); link(a,c);
  }
  const vtx = new THREE.Vector3(), nvec = new THREE.Vector3(), acc = new THREE.Vector3();
  const socketOf = side => {
    const cand = [];
    for (const i of headVerts){
      vtx.fromBufferAttribute(pos, i);
      if (Math.sign(vtx.x - midX) !== side) continue;
      if (Math.abs(vtx.x - midX) < hb.w * 0.35) continue;   // skip nostrils
      if (vtx.y < headBox.min.y + hb.h * 0.35) continue;               // skip the mouth
      if (vtx.y > headBox.max.y - hb.h * 0.10) continue;               // skip the ears
      const ring = nbr.get(i);
      if (!ring || ring.size < 3) continue;
      acc.set(0, 0, 0);
      for (const j of ring) acc.add(nvec.fromBufferAttribute(pos, j));
      acc.divideScalar(ring.size).sub(vtx);
      cand.push({ d: acc.dot(nvec.fromBufferAttribute(nor, i)), p: vtx.clone() });
    }
    cand.sort((a, b) => b.d - a.d);
    const top = cand.slice(0, 5);                 // average the dish, not one vertex
    const c = new THREE.Vector3();
    for (const t of top) c.add(t.p);
    return top.length ? c.divideScalar(top.length) : null;
  };

  const eyes = [];
  const EYE_R = Math.min(hb.w, hb.h) * 0.072;
  // deliberately NOT mat.eye: that is roughness 0.25, which at this size puts a
  // hard catchlight on the eye and tips the whole thing from figurine to
  // cartoon. Matte and nearly flush with the socket instead.
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1b110b, roughness: 0.85, metalness: 0 });
  for (const sx of [-1, 1]){
    // fall back to a bounding-box guess only if the sculpt has no dish at all
    const target = socketOf(sx) || new THREE.Vector3(
      sx * hb.w * 0.5,
      headBox.min.y + hb.h * 0.68,
      headBox.min.z + hb.d * 0.20);
    const { p, n } = onHead(target, 0.001);
    const e = new THREE.Mesh(new THREE.SphereGeometry(EYE_R, 16, 12), eyeMat);
    e.scale.set(1, 1, 0.34);
    loaded.add(e);             // place it in rig space, then hand it to the bone
    e.position.copy(p);
    e.lookAt(p.clone().add(n));
    loaded.updateMatrixWorld(true);
    head.attach(e);            // attach keeps the world placement we just solved
    eyes.push(e);
  }

  /* --- head mount -------------------------------------------------------
     hatAnchor / stackAnchor hang off this. It sits at the crown, world-aligned
     rather than bone-aligned, because stack.js writes `stackAnchor.position.y`
     and hats are modelled upright from y = 0.
     Taken as the highest point ON THE MIDLINE, not the highest head vertex and
     not a centroid: the ears are the tallest thing on the head and would drag
     the anchor sideways, and averaging drags it forward into the muzzle, which
     leaves hats hovering off the brow. */
  const crown = new THREE.Vector3(midX, -Infinity, 0);
  for (const i of headVerts){
    v.fromBufferAttribute(pos, i);
    if (Math.abs(v.x - midX) < hb.w * 0.14 && v.y > crown.y) crown.copy(v);
  }
  crown.x = midX;
  crown.y -= hb.h * 0.05;      // sink a little into the fur so brims don't hover

  const headMount = new THREE.Group();
  loaded.add(headMount);
  headMount.position.copy(crown);
  loaded.updateMatrixWorld(true);
  head.attach(headMount);      // rides the head bone, but stays world-aligned

  const hatAnchor = new THREE.Group();
  headMount.add(hatAnchor);
  const stackBaseY = 0.03;
  const stackAnchor = new THREE.Group();
  stackAnchor.position.y = stackBaseY;
  headMount.add(stackAnchor);

  /* --- proxies ----------------------------------------------------------
     Written by player.js, read by syncCapyRig. Deliberately not in the scene
     graph: they are a data channel, not geometry. */
  const legRestY = 0.21;
  const legs = [];
  for (let i = 0; i < 4; i++){
    const p = new THREE.Object3D();
    p.position.y = legRestY;
    legs.push(p);
  }
  const headProxy = new THREE.Object3D();
  // The model has no jaw, muzzle or mouth bone, so the chew animation has
  // nothing to drive. These absorb its writes and go nowhere. player.js keeps
  // running unchanged; the capybara simply does not chew.
  const muzzle = new THREE.Object3D();
  const mouth  = new THREE.Object3D();
  const skull  = new THREE.Object3D();

  /* --- retarget state ---------------------------------------------------
     Each driven bone remembers its rest quaternion and the swing axes,
     expressed in its PARENT's space. Composing `delta * rest` then rotates
     about a stable world-aligned axis without destroying the rest pose. */
  const axesOf = b => {
    const inv = b.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    return {
      x: new THREE.Vector3(1, 0, 0).applyQuaternion(inv),
      z: new THREE.Vector3(0, 0, 1).applyQuaternion(inv),
    };
  };
  const track = b => ({ bone: b, rest: b.quaternion.clone(), ax: axesOf(b) });

  rig = {
    legs: RIG_BONES.legs.map(([hip, knee]) => ({ hip: track(bones[hip]), knee: track(bones[knee]) })),
    head: track(head),
    neck: track(bones[RIG_BONES.neck]),
    proxies: { legs, head: headProxy },
    q: new THREE.Quaternion(),
    q2: new THREE.Quaternion(),
  };

  return { root, bob, squash, tilt, body,
           head: headProxy, legs, eyes, torso: mesh,
           muzzle, mouth, skull,
           hatAnchor, stackAnchor, legRestY, stackBaseY };
}

/* -----------------------------------------------------------------------
   Per-frame retarget. Called from animate(); a no-op when the procedural
   capybara is in use.
   ----------------------------------------------------------------------- */
function syncCapyRig(){
  if (!rig) return;
  const { q, q2 } = rig;

  for (let i = 0; i < 4; i++){
    const p = rig.proxies.legs[i], L = rig.legs[i];
    const swing = p.rotation.x;
    const lift = (p.position.y - 0.21) / LEG_LIFT;   // 0 planted .. 1 fully raised

    q.setFromAxisAngle(L.hip.ax.x, swing * HIP_SWING + lift * 0.18);
    L.hip.bone.quaternion.multiplyQuaternions(q, L.hip.rest);

    q.setFromAxisAngle(L.knee.ax.x, -lift * KNEE_TUCK);
    L.knee.bone.quaternion.multiplyQuaternions(q, L.knee.rest);
  }

  const h = rig.proxies.head;
  for (const [part, share] of [[rig.head, HEAD_SHARE], [rig.neck, 1 - HEAD_SHARE]]){
    q.setFromAxisAngle(part.ax.x, h.rotation.x * share);
    q2.setFromAxisAngle(part.ax.z, h.rotation.z * share);
    q.multiply(q2);
    part.bone.quaternion.multiplyQuaternions(q, part.rest);
  }
}
