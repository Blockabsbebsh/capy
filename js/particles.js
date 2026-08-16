/* =======================================================================
   PARTICLES  (single InstancedMesh, per-instance color)
   ======================================================================= */
const PMAX = 520;
const pGeo = new THREE.BoxGeometry(1, 1, 1);
const pMat = new THREE.MeshStandardMaterial({ roughness:0.7, metalness:0.0 });
const particles = new THREE.InstancedMesh(pGeo, pMat, PMAX);
particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
particles.frustumCulled = false;
particles.castShadow = false;
scene.add(particles);

const pPool = [];
for (let i = 0; i < PMAX; i++){
  pPool.push({ alive:false, pos:new THREE.Vector3(), vel:new THREE.Vector3(),
               rot:new THREE.Euler(), spin:new THREE.Vector3(), life:0, maxLife:1, size:0.1, drag:0.99 });
}
const _dummy = new THREE.Object3D();
const _col = new THREE.Color();

function burst(pos, count, colors, opts = {}){
  const spread = opts.spread ?? 5.5;
  const up     = opts.up ?? 5.0;
  const size   = opts.size ?? 0.12;
  const life   = opts.life ?? 0.75;
  let spawned = 0;
  for (let i = 0; i < pPool.length && spawned < count; i++){
    const p = pPool[i];
    if (p.alive) continue;
    p.alive = true;
    p.pos.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3));
    const a = Math.random()*Math.PI*2, e = Math.random();
    p.vel.set(Math.cos(a)*spread*e, up*(0.35 + Math.random()*0.9), Math.sin(a)*spread*e);
    p.rot.set(Math.random()*6, Math.random()*6, Math.random()*6);
    p.spin.set((Math.random()-0.5)*14, (Math.random()-0.5)*14, (Math.random()-0.5)*14);
    p.maxLife = life * (0.65 + Math.random()*0.7);
    p.life = p.maxLife;
    p.size = size * (0.55 + Math.random()*0.9);
    p.drag = opts.drag ?? 0.985;
    p.color = colors[(Math.random()*colors.length)|0];
    spawned++;
  }
}

function updateParticles(dt){
  for (let i = 0; i < pPool.length; i++){
    const p = pPool[i];
    if (!p.alive){ _dummy.position.set(0, -999, 0); _dummy.scale.setScalar(0.0001); }
    else {
      p.life -= dt;
      if (p.life <= 0){ p.alive = false; _dummy.position.set(0,-999,0); _dummy.scale.setScalar(0.0001); }
      else {
        p.vel.y += GRAV * dt * 0.62;
        p.vel.multiplyScalar(Math.pow(p.drag, dt*60));
        p.pos.addScaledVector(p.vel, dt);
        if (p.pos.y < 0.05){ p.pos.y = 0.05; p.vel.y *= -0.35; p.vel.x *= 0.7; p.vel.z *= 0.7; }
        p.rot.x += p.spin.x*dt; p.rot.y += p.spin.y*dt; p.rot.z += p.spin.z*dt;
        const t = p.life / p.maxLife;
        const s = p.size * (0.35 + 0.65 * Math.min(1, t*1.6));
        _dummy.position.copy(p.pos);
        _dummy.rotation.copy(p.rot);
        _dummy.scale.setScalar(s);
        _col.setHex(p.color);
        particles.setColorAt(i, _col);
      }
    }
    _dummy.updateMatrix();
    particles.setMatrixAt(i, _dummy.matrix);
  }
  particles.instanceMatrix.needsUpdate = true;
  if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
}
// prime instance colors so the buffer exists
for (let i = 0; i < PMAX; i++) particles.setColorAt(i, _col.setHex(0xffffff));

const PAL = {
  burger:     [0xe0a44a, 0xd0913c, 0x633a22, 0xffc63c, 0x76c043],
  watermelon: [0xff4f68, 0xff8098, 0x2f8f3e, 0xffd0d8, 0x2a1a12],
  chili:      [0xd63628, 0xff7a4d, 0xffb27a],
  soap:       [0x9fd8ef, 0xffffff, 0xdff4ff],
  dust:       [0x9c8256, 0x8ec54f, 0xc9a06a],
  heart:      [0xff3d68, 0xff8fae, 0xffd6e2, 0xffffff],
};

