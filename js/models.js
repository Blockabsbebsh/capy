/* =======================================================================
   ROUNDED-BOX GEOMETRY
   A superellipsoid: take a sphere and push its vertices toward the cube.
   `soft` = 1 is a plain sphere, ~0.35 is a chunky rounded box.
   ======================================================================= */
function roundedBoxGeo(w, h, d, soft = 0.45, seg = 22){
  const g = new THREE.SphereGeometry(0.5, seg, Math.max(8, Math.round(seg * 0.6)));
  const pos = g.attributes.position;
  const f = x => Math.sign(x) * Math.pow(Math.abs(x), soft);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++){
    v.fromBufferAttribute(pos, i).multiplyScalar(2);      // unit sphere
    pos.setXYZ(i, f(v.x) * w * 0.5, f(v.y) * h * 0.5, f(v.z) * d * 0.5);
  }
  g.computeVertexNormals();
  return g;
}

/* =======================================================================
   CAPYBARA  (all primitives, hand-assembled) — faces the camera (+Z)
   ======================================================================= */
function buildCapybara(){
  const root  = new THREE.Group();   // world position
  const bob   = new THREE.Group();   // hop / bounce offset
  const squash= new THREE.Group();   // squash & stretch scaling
  const tilt  = new THREE.Group();   // lean into movement
  root.add(bob); bob.add(squash); squash.add(tilt);

  const body = new THREE.Group();
  tilt.add(body);

  // --- one single soft "loaf" for the whole body, instead of three
  // separate torso/rump/shoulder boxes — reference art reads as one
  // continuous rounded blob with no visible segment lines, so `soft` is
  // pushed close to 1 (near-sphere) and the piece is sized to cover the
  // full body on its own. Sits low and wide, chibi-proportioned.
  const torso = new THREE.Mesh(roundedBoxGeo(1.46, 1.02, 1.92, 0.94, 26), mat.fur);
  torso.position.set(0, 0.52, -0.14);
  torso.castShadow = true; torso.receiveShadow = true;
  body.add(torso);

  // a gentle hip bump blended into the back of the loaf so the
  // hindquarters still read very slightly higher than the shoulders
  const rump = new THREE.Mesh(roundedBoxGeo(1.14, 0.88, 0.60, 0.96), mat.fur);
  rump.position.set(0, 0.58, -0.86);
  rump.castShadow = true; rump.receiveShadow = true;
  body.add(rump);

  // pale belly patch, low and wide under the loaf
  const belly = new THREE.Mesh(roundedBoxGeo(1.16, 0.30, 1.55, 0.92), mat.furLight);
  belly.position.set(0, 0.16, -0.16);
  body.add(belly);

  // --- head: small, blunt, and fused close against the body with
  // (deliberately) no visible neck seam — chibi capybaras barely show
  // any neck at all, the head just sits directly on the front of the loaf
  const head = new THREE.Group();
  head.position.set(0, 0.84, 0.76);
  body.add(head);

  const skull = new THREE.Mesh(roundedBoxGeo(0.72, 0.56, 0.72, 0.9), mat.fur);
  skull.castShadow = true; skull.receiveShadow = true;
  head.add(skull);

  // short, blunt little muzzle — much shorter and rounder than a
  // realistic capybara snout, for the cute chibi silhouette
  const muzzle = new THREE.Mesh(roundedBoxGeo(0.56, 0.36, 0.38, 0.88), mat.fur);
  muzzle.position.set(0, -0.10, 0.40);
  muzzle.castShadow = true;
  head.add(muzzle);

  const chin = new THREE.Mesh(roundedBoxGeo(0.48, 0.18, 0.32, 0.88), mat.furLight);
  chin.position.set(0, -0.25, 0.38);
  head.add(chin);

  // small dark nose pad sitting on top of the muzzle tip
  const nose = new THREE.Mesh(roundedBoxGeo(0.30, 0.16, 0.14, 0.7), mat.nose);
  nose.position.set(0, 0.00, 0.60);
  head.add(nose);
  for (const sx of [-1, 1]){
    const nl = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), mat.eye);
    nl.position.set(0.085*sx, 0.01, 0.65);
    nl.scale.set(1, 1.3, 0.6);
    head.add(nl);
  }

  // mouth line, tucked under the muzzle
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.05), mat.nose);
  mouth.position.set(0, -0.22, 0.58);
  head.add(mouth);

  // eyes: small, sleepy, half-lidded ovals — flattened rather than round
  // spheres, closer to the calm/content look in reference art, with a
  // much smaller highlight instead of a big cartoon shine
  const eyes = [];
  for (const sx of [-1, 1]){
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), mat.eye);
    e.position.set(0.27*sx, 0.15, 0.14);
    e.scale.set(1, 0.62, 0.55);
    head.add(e);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), mat.eyeShine);
    sh.position.set(0.29*sx, 0.175, 0.185);
    head.add(sh);
    eyes.push(e);
  }

  // tiny rounded ears tucked close against the top of the skull — kept
  // small and close-set, real (and chibi) capybara ears barely poke up
  for (const sx of [-1, 1]){
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), mat.furDark);
    ear.position.set(0.24*sx, 0.30, -0.20);
    ear.scale.set(0.8, 0.62, 0.5);
    ear.rotation.z = 0.25 * sx;
    ear.castShadow = true;
    head.add(ear);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mat.snout);
    inner.position.set(0.245*sx, 0.30, -0.15);
    inner.scale.set(0.7, 0.9, 0.5);
    head.add(inner);
  }

  // mount point for hats / the stack, at the top of the skull
  const hatAnchor = new THREE.Group();
  hatAnchor.position.set(0, 0.28, 0.0);
  head.add(hatAnchor);
  const stackAnchor = new THREE.Group();
  stackAnchor.position.set(0, 0.30, 0.0);
  head.add(stackAnchor);

  // --- tiny stub legs, mostly tucked out of sight under the loaf —
  // reference art reads as essentially legless, sitting low to the
  // ground, so these are much smaller and lower than a realistic build
  const legs = [];
  const legGeo = roundedBoxGeo(0.26, 0.22, 0.26, 0.85, 14);
  const legPos = [[-0.44, 0.42], [0.44, 0.42], [-0.46, -0.58], [0.46, -0.58]];
  for (const [lx, lz] of legPos){
    const l = new THREE.Mesh(legGeo, mat.furDark);
    l.position.set(lx, 0.11, lz);
    l.castShadow = true;
    body.add(l);
    legs.push(l);
  }

  // near-invisible nub tail — real capybaras barely have one
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), mat.furDark);
  tail.position.set(0, 0.62, -1.02);
  tail.scale.set(1, 0.9, 0.5);
  body.add(tail);

  return { root, bob, squash, tilt, body, head, legs, eyes, torso,
           muzzle, mouth, skull, hatAnchor, stackAnchor };
}

const capy = buildCapybara();
capy.root.position.set(0, 0, 1.0);
scene.add(capy.root);

// soft contact shadow blob under the capybara (sells grounding during hops)
const blobShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.95, 32),
  new THREE.MeshBasicMaterial({ color:0x2c3a1c, transparent:true, opacity:0.28, depthWrite:false })
);
blobShadow.rotation.x = -Math.PI/2;
blobShadow.position.y = 0.03;
scene.add(blobShadow);

/* =======================================================================
   FOOD / HAZARD MODELS
   ======================================================================= */
function buildBurger(){
  const g = new THREE.Group();
  const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.18, 18), mat.bunBot);
  bot.position.y = -0.24; g.add(bot);

  const lettuce = new THREE.Mesh(new THREE.IcosahedronGeometry(0.44, 1), mat.lettuce);
  lettuce.scale.set(1, 0.16, 1); lettuce.position.y = -0.12; g.add(lettuce);

  const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.17, 18), mat.patty);
  patty.position.y = 0.0; g.add(patty);

  const cheese = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.045, 0.74), mat.cheese);
  cheese.position.y = 0.11; cheese.rotation.y = Math.PI/4; g.add(cheese);

  const top = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14, 0, Math.PI*2, 0, Math.PI/2), mat.bunTop);
  top.scale.set(1, 0.78, 1); top.position.y = 0.15; g.add(top);
  const topFill = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 18), mat.bunTop);
  topFill.position.y = 0.16; g.add(topFill);

  for (let i = 0; i < 6; i++){
    const a = (i/6) * Math.PI*2 + 0.4;
    const r = 0.17 + Math.random()*0.12;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat.sesame);
    s.position.set(Math.cos(a)*r, 0.15 + Math.sqrt(Math.max(0, 0.42*0.42 - r*r))*0.78, Math.sin(a)*r);
    s.scale.set(1.3, 0.7, 1);
    g.add(s);
  }
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; } });
  return g;
}

function buildWatermelon(){
  // A pie-sector wedge: nested cylinder sectors at different radii, so the
  // flesh / pale rind / dark skin are separate shells with no z-fighting.
  const g = new THREE.Group();
  const slice = new THREE.Group();
  const TH = Math.PI * 0.60;                 // wedge sweep
  const T0 = -TH / 2;                        // sector centred on local +Z
  const TK = 0.28;                           // slice thickness
  const R  = 0.565;

  // dark green skin: one solid sector — the whole outer shell of the slice
  const skin = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, TK, 28, 1, false, T0, TH), mat.melonSkin);
  slice.add(skin);

  // CylinderGeometry leaves the theta gap open, so the two straight sides of
  // the wedge need their own walls — flesh from the axis out, rind at the tip
  for (const s of [0, 1]){
    const a = T0 + s * TH;
    const wall = (w, r, m) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, TK, 0.014), m);
      p.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      p.rotation.y = a - Math.PI / 2;      // local +X points radially out
      slice.add(p);
    };
    wall(0.492, 0.246, mat.melonFlesh);
    wall(0.076, 0.530, mat.melonRind);
  }

  // the two cut faces get layered sector discs: pale rind, then pink flesh
  for (const side of [1, -1]){
    // CircleGeometry sweeps from +X, the cylinder sector from +Z — hence the
    // quarter-turn offset, mirrored for the face pointing the other way.
    const start = side > 0 ? (T0 - Math.PI / 2) : (Math.PI / 2 - TH / 2);
    const rotX = side > 0 ? -Math.PI / 2 : Math.PI / 2;

    const pale = new THREE.Mesh(new THREE.CircleGeometry(0.532, 26, start, TH), mat.melonRind);
    pale.rotation.x = rotX;
    pale.position.y = side * (TK * 0.5 + 0.002);
    slice.add(pale);

    const flesh = new THREE.Mesh(new THREE.CircleGeometry(0.492, 26, start, TH), mat.melonFlesh);
    flesh.rotation.x = rotX;
    flesh.position.y = side * (TK * 0.5 + 0.005);
    slice.add(flesh);

    // seeds pressed into the flesh
    for (let i = 0; i < 5; i++){
      const a = T0 + TH * (0.18 + Math.random() * 0.64);
      const r = 0.16 + Math.random() * 0.24;
      const sd = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), mat.melonSeed);
      sd.position.set(Math.sin(a) * r, side * (TK * 0.5 + 0.012), Math.cos(a) * r);
      sd.scale.set(0.85, 0.4, 1.3);
      sd.rotation.y = -a;
      slice.add(sd);
    }
  }

  slice.rotation.x = -Math.PI / 2;   // apex down, green arc up, cut face to camera
  slice.rotation.z = 0.18;
  slice.position.y = -0.26;
  g.add(slice);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function buildChili(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 8, 14), mat.chili);
  body.scale.set(1, 1, 0.9);
  body.position.y = -0.02;
  g.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 12), mat.chili);
  tip.position.y = -0.42; tip.rotation.x = Math.PI; tip.rotation.z = 0.2;
  g.add(tip);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.26, 8), mat.stem);
  stem.position.y = 0.42; stem.rotation.z = -0.25;
  g.add(stem);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.12, 8), mat.stem);
  crown.position.y = 0.32; crown.rotation.x = Math.PI;
  g.add(crown);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function buildSoap(){
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), mat.soap);
  bar.scale.set(0.86, 0.42, 0.6);
  g.add(bar);
  const emboss = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 18), mat.soapText);
  emboss.position.y = 0.2; emboss.rotation.x = -Math.PI/2;
  g.add(emboss);
  for (let i = 0; i < 4; i++){
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09 + Math.random()*0.07, 10, 8), mat.bubble);
    b.position.set((Math.random()-0.5)*0.9, 0.28 + Math.random()*0.34, (Math.random()-0.5)*0.7);
    g.add(b);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/* ------------------------------ power-ups ------------------------------ */
function auraRing(color){
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 8, 26),
    new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.75 }));
  r.rotation.x = Math.PI / 2;
  r.name = 'aura';
  return r;
}

function buildMagnet(){
  const g = new THREE.Group();
  const horse = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.11, 10, 22, Math.PI), mat.magnetBody);
  g.add(horse);
  for (const sx of [-1, 1]){
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 12), mat.magnetTip);
    tip.position.set(0.26 * sx, -0.1, 0);
    g.add(tip);
  }
  g.rotation.z = Math.PI;            // opening points down
  const wrap = new THREE.Group();
  wrap.add(g);
  wrap.add(auraRing(0xff6b7a));
  wrap.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return wrap;
}

function buildShieldPickup(){
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat.shieldCore);
  g.add(core);
  const bub = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 14), mat.shieldSkin);
  g.add(bub);
  g.add(auraRing(0x7fe3ff));
  g.traverse(o => { if (o.isMesh && o !== bub) o.castShadow = true; });
  return g;
}

function buildHourglass(){
  const g = new THREE.Group();
  for (const s of [1, -1]){
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.3, 16, 1, true), mat.glassCyan);
    cone.position.y = 0.15 * s;
    cone.rotation.x = s > 0 ? Math.PI : 0;
    g.add(cone);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 16), mat.glassFrame);
    cap.position.y = 0.31 * s;
    g.add(cap);
  }
  const sand = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.16, 12), mat.sand);
  sand.position.y = -0.2;
  g.add(sand);
  g.add(auraRing(0x9ef0ff));
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/* A heart: two lobes and a cone, glowing from the inside so it stays legible
   against every theme — including the dark ones. */
function buildHeart(){
  const g = new THREE.Group();
  const core = new THREE.Group();
  for (const sx of [-1, 1]){
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), mat.heart);
    lobe.position.set(0.13 * sx, 0.13, 0);
    core.add(lobe);
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.255, 0.36, 18), mat.heart);
  tip.position.y = -0.09;
  tip.rotation.x = Math.PI;
  core.add(tip);
  core.rotation.x = -0.35;                  // tilt so the lobes face the camera
  g.add(core);

  // inner glow shell + halo, so it reads as "special" while falling
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat.heartGlow);
  glow.name = 'glow';
  g.add(glow);
  const ring = auraRing(0xff5f86);
  g.add(ring);
  core.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

const BUILDERS = {
  burger:buildBurger, watermelon:buildWatermelon, chili:buildChili, soap:buildSoap,
  magnet:buildMagnet, shield:buildShieldPickup, slowmo:buildHourglass, heart:buildHeart,
};

/* --------------------------------- hats -------------------------------- */
function buildYuzuHat(){
  const g = new THREE.Group();
  const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), mat.yuzu);
  fruit.position.y = 0.17; fruit.scale.y = 0.9;
  g.add(fruit);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.08, 6), mat.stem);
  stem.position.y = 0.33;
  g.add(stem);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat.leafC);
  leaf.position.set(0.08, 0.35, 0);
  leaf.scale.set(1, 0.22, 0.5);
  leaf.rotation.z = -0.4;
  g.add(leaf);
  return g;
}
function buildStrawHat(){
  const g = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.05, 22), mat.straw);
  brim.position.y = 0.04;
  g.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.24, 20), mat.straw);
  crown.position.y = 0.17;
  g.add(crown);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.035, 8, 22), mat.hatBand);
  band.position.y = 0.09; band.rotation.x = Math.PI / 2;
  g.add(band);
  return g;
}
function buildPartyHat(){
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.52, 16), mat.party);
  cone.position.y = 0.26;
  g.add(cone);
  for (let i = 0; i < 7; i++){
    const a = i * 1.9, h = 0.06 + (i % 3) * 0.13;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat.partyDot);
    const rr = 0.22 * (1 - h / 0.52);
    dot.position.set(Math.cos(a) * rr, h + 0.03, Math.sin(a) * rr);
    g.add(dot);
  }
  const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), mat.partyDot);
  pom.position.y = 0.55;
  g.add(pom);
  return g;
}
function buildCrown(){
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.16, 20, 1, true), mat.gold);
  band.position.y = 0.08;
  band.material.side = THREE.DoubleSide;
  g.add(band);
  for (let i = 0; i < 6; i++){
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 8), mat.gold);
    spike.position.set(Math.cos(a) * 0.24, 0.22, Math.sin(a) * 0.24);
    g.add(spike);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.033, 0), i % 2 ? mat.gemRed : mat.gemBlue);
    gem.position.set(Math.cos(a) * 0.24, 0.32, Math.sin(a) * 0.24);
    g.add(gem);
  }
  return g;
}
function buildDuckFriend(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(roundedBoxGeo(0.3, 0.26, 0.4, 0.75), mat.duck);
  body.position.y = 0.14;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), mat.duck);
  head.position.set(0, 0.32, 0.1);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 10), mat.beak);
  beak.position.set(0, 0.3, 0.22);
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  for (const sx of [-1, 1]){
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), mat.eye);
    e.position.set(0.06 * sx, 0.36, 0.19);
    g.add(e);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 8), mat.duck);
  tail.position.set(0, 0.2, -0.2); tail.rotation.x = -1.9;
  g.add(tail);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

const HATS = [
  { id:'none',  name:'Bare Head',   score:0,    top:0.00, build:null },
  { id:'yuzu',  name:'Yuzu',        score:400,  top:0.36, build:buildYuzuHat },
  { id:'straw', name:'Straw Hat',   score:1200, top:0.30, build:buildStrawHat },
  { id:'party', name:'Party Hat',   score:2500, top:0.60, build:buildPartyHat },
  { id:'crown', name:'Crown',       score:5000, top:0.36, build:buildCrown },
  { id:'duck',  name:'Duck Friend', score:9000, top:0.46, build:buildDuckFriend },
];

