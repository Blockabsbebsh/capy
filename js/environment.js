/* =======================================================================
   ENVIRONMENT
   ======================================================================= */
const world = new THREE.Group();
scene.add(world);

// ground
const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), mat.grass);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
world.add(ground);

// the play "meadow" patch — slightly lighter, reads as the arena floor
const patch = new THREE.Mesh(new THREE.CircleGeometry(1, 64), mat.grassDark);
patch.rotation.x = -Math.PI/2;
patch.scale.set(ARENA.halfX + 2.4, ARENA.halfZ + 2.4, 1);
patch.position.y = 0.012;
patch.receiveShadow = true;
world.add(patch);

// sandy border ring around the play area
const border = new THREE.Mesh(new THREE.RingGeometry(0.965, 1.0, 96), mat.dirt);
border.rotation.x = -Math.PI/2;
border.scale.set(ARENA.halfX + 2.6, ARENA.halfZ + 2.6, 1);
border.position.y = 0.02;
border.receiveShadow = true;
world.add(border);

// pond behind the arena (capybaras approve)
const pond = new THREE.Mesh(new THREE.CircleGeometry(6.5, 48), mat.water);
pond.rotation.x = -Math.PI/2;
pond.position.set(-15, 0.03, -13);
pond.scale.set(1.5, 1, 1);
world.add(pond);
const pondRim = new THREE.Mesh(new THREE.RingGeometry(6.5, 7.3, 48), mat.dirt);
pondRim.rotation.x = -Math.PI/2;
pondRim.position.set(-15, 0.025, -13);
pondRim.scale.set(1.5, 1, 1);
pondRim.receiveShadow = true;
world.add(pondRim);

// --- scenery builders ---------------------------------------------------
// all the default meadow trees/bushes/rocks live in this group so a theme
// can hide them wholesale and swap in its own background dressing
const sceneryGroup = new THREE.Group();
world.add(sceneryGroup);

function makeTree(x, z, s = 1){
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.2, 8), mat.trunk);
  trunk.position.y = 1.1; trunk.castShadow = true; trunk.receiveShadow = true;
  g.add(trunk);
  const blobs = [
    { p:[0, 2.85, 0],      r:1.25, m:mat.leafA },
    { p:[0.72, 2.35, 0.3], r:0.86, m:mat.leafB },
    { p:[-0.65, 2.45, -0.3],r:0.8, m:mat.leafC },
    { p:[0.1, 3.6, -0.15], r:0.72, m:mat.leafB },
  ];
  for (const b of blobs){
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(b.r, 1), b.m);
    m.position.set(...b.p);
    m.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  g.rotation.y = Math.random() * Math.PI * 2;
  sceneryGroup.add(g);
  return g;
}
function makeBush(x, z, s = 1){
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++){
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random()*0.28, 1), i%2 ? mat.leafB : mat.leafC);
    m.position.set((Math.random()-0.5)*0.9, 0.32 + Math.random()*0.2, (Math.random()-0.5)*0.9);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  g.position.set(x, 0, z); g.scale.setScalar(s);
  sceneryGroup.add(g);
  return g;
}
function makeRock(x, z, s = 1){
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), mat.rock);
  m.position.set(x, 0.28*s, z);
  m.scale.set(s, s*0.72, s*0.9);
  m.rotation.set(Math.random(), Math.random(), Math.random());
  m.castShadow = true; m.receiveShadow = true;
  sceneryGroup.add(m);
  return m;
}

// place scenery well outside the play field
const treeSpots = [
  [-15,-4,1.15],[-12.5,-9,0.95],[13.8,-5,1.1],[16.5,-10,1.25],[-19,-16,1.4],
  [10,-16,1.3],[-6,-19,1.2],[3,-21,1.35],[19,-18,1.15],[-22,-8,1.0],
  [-13.5, 7, 1.0],[14.5, 7.5, 1.05],
];
treeSpots.forEach(([x,z,s]) => makeTree(x, z, s));
for (let i = 0; i < 22; i++){
  const a = Math.random()*Math.PI*2, r = 13 + Math.random()*16;
  const x = Math.cos(a)*r, z = Math.sin(a)*r*0.85 - 3;
  if (Math.abs(x) < 12 && z > -9 && z < 9) continue;
  (Math.random() < 0.72 ? makeBush : makeRock)(x, z, 0.7 + Math.random()*0.7);
}

// --- drifting clouds ----------------------------------------------------
const clouds = [];       // white/neutral pool — meadow, pond
const pinkClouds = [];   // pink-tinted pool — bubblegum only
function makeCloud(x, y, z, s, color = null, pool = clouds){
  const g = new THREE.Group();
  const n = 4 + Math.floor(Math.random()*3);
  // The neutral pool renders with the shared mat.cloud, which updateThemeMix
  // eases toward each theme's `cloud` colour. Building a private material here
  // instead is what left that colour with nothing to drive, so the clouds
  // stayed pure white in every biome. Pass an explicit colour to opt out and
  // get a bespoke material — the pink Bubblegum pool below does exactly that.
  const cloudMat = color === null ? mat.cloud : new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  for (let i = 0; i < n; i++){
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), cloudMat);
    m.position.set((i - n/2) * 1.25 + Math.random()*0.4, Math.random()*0.5, Math.random()*0.8);
    m.scale.setScalar(0.75 + Math.random()*0.75);
    g.add(m);
  }
  g.position.set(x, y, z); g.scale.setScalar(s);
  skyRig.add(g);
  pool.push(g);
  return g;
}
// local-to-rig space now (rig sits at camera height): keep Y modest and
// spread mainly in X/Z. Kept deliberately sparse — a handful of clouds
// reads as "sky has some texture," a dozen reads as cluttered.
for (let i = 0; i < 4; i++){
  makeCloud(-40 + Math.random()*80, 1 + Math.random()*4, -30 - Math.random()*18, 1.1 + Math.random()*1.1);
}
for (let i = 0; i < 4; i++){
  makeCloud(-40 + Math.random()*80, 1 + Math.random()*4, -30 - Math.random()*18, 1.0 + Math.random()*1.0, 0xffd3ec, pinkClouds);
}
[...clouds, ...pinkClouds].forEach(c => c.visible = false);

