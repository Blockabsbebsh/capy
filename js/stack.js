/* =======================================================================
   HAT
   ======================================================================= */
let currentHat = null;      // the mesh currently mounted
let currentHatDef = HATS[0];

function setHat(id){
  const def = HATS.find(h => h.id === id) || HATS[0];
  currentHatDef = def;
  if (currentHat){ capy.hatAnchor.remove(currentHat); currentHat = null; }
  if (def.build){
    currentHat = def.build();
    currentHat.traverse(o => { if (o.isMesh) o.castShadow = true; });
    capy.hatAnchor.add(currentHat);
  }
  capy.stackAnchor.position.y = 0.33 + def.top;
  try { localStorage.setItem('capyHat', def.id); } catch(e){}
}

/* =======================================================================
   HEAD STACK — food piles up on the capybara's head while a combo runs,
   wobbling like an inverted pendulum, and scatters when the combo dies.
   ======================================================================= */
const stack = { items: [] };
const STACK_MAX = 8;
const STACK_H = 0.30;

function addToStack(type){
  if (stack.items.length >= STACK_MAX) return;
  const holder = new THREE.Group();
  const parent = stack.items.length
    ? stack.items[stack.items.length - 1].holder
    : capy.stackAnchor;
  holder.position.y = stack.items.length ? STACK_H : STACK_H * 0.6;
  parent.add(holder);

  const mesh = BUILDERS[type]();
  mesh.scale.setScalar(0.4);
  mesh.position.y = STACK_H * 0.35;
  mesh.rotation.y = Math.random() * Math.PI * 2;
  mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
  holder.add(mesh);

  stack.items.push({ holder, mesh, ax:0, az:0, avx:0, avz:(Math.random()-0.5)*2.4 });
}

function updateStack(dt, accelX, accelZ){
  const K = 96, D = 7.5;
  for (let i = 0; i < stack.items.length; i++){
    const s = stack.items[i];
    // each segment springs back toward its parent's axis, kicked by the
    // capybara's acceleration — higher pieces swing wider
    const drive = 0.16 * (1 + i * 0.22);
    s.avx += (-K * s.ax - D * s.avx - accelX * drive) * dt;
    s.avz += (-K * s.az - D * s.avz - accelZ * drive) * dt;
    s.ax = THREE.MathUtils.clamp(s.ax + s.avx * dt, -0.5, 0.5);
    s.az = THREE.MathUtils.clamp(s.az + s.avz * dt, -0.5, 0.5);
    s.holder.rotation.z = -s.ax;
    s.holder.rotation.x =  s.az;
  }
}

function kickStack(amount){
  for (const s of stack.items){
    s.avx += (Math.random() - 0.5) * amount;
    s.avz += (Math.random() - 0.5) * amount;
  }
}

/* falling stack pieces (and anything else we want to throw around) */
const debris = [];
function addDebris(obj, vel){
  scene.add(obj);
  debris.push({ obj, vel, spin: new THREE.Vector3((Math.random()-0.5)*9, (Math.random()-0.5)*9, (Math.random()-0.5)*9), life: 2.4 });
}
function updateDebris(dt){
  for (let i = debris.length - 1; i >= 0; i--){
    const d = debris[i];
    d.life -= dt;
    d.vel.y += GRAV * dt;
    d.obj.position.addScaledVector(d.vel, dt);
    d.obj.rotation.x += d.spin.x * dt;
    d.obj.rotation.y += d.spin.y * dt;
    d.obj.rotation.z += d.spin.z * dt;
    if (d.obj.position.y < 0.16){
      d.obj.position.y = 0.16;
      d.vel.y *= -0.42; d.vel.x *= 0.66; d.vel.z *= 0.66;
      d.spin.multiplyScalar(0.5);
    }
    if (d.life <= 0){
      scene.remove(d.obj);
      d.obj.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
      debris.splice(i, 1);
    }
  }
}

function dropStack(){
  if (!stack.items.length) return;
  // grab every world transform before we start reparenting
  const snaps = stack.items.map(s => {
    const p = new THREE.Vector3(), q = new THREE.Quaternion();
    s.mesh.getWorldPosition(p); s.mesh.getWorldQuaternion(q);
    return { s, p, q };
  });
  for (const { s, p, q } of snaps){
    s.holder.remove(s.mesh);
    s.mesh.position.copy(p);
    s.mesh.quaternion.copy(q);
    const away = new THREE.Vector3(p.x - capyState.x, 0, p.z - capyState.z);
    if (away.lengthSq() < 0.01) away.set(Math.random()-0.5, 0, Math.random()-0.5);
    away.normalize().multiplyScalar(1.6 + Math.random() * 2.4);
    addDebris(s.mesh, new THREE.Vector3(away.x, 3.4 + Math.random() * 2.6, away.z));
    if (s.holder.parent) s.holder.parent.remove(s.holder);
  }
  burst(new THREE.Vector3(capyState.x, 1.7, capyState.z), 10, PAL.dust,
        { spread:3.4, up:2.6, size:0.1, life:0.5 });
  stack.items.length = 0;
}

function clearStack(){
  for (const s of stack.items){
    s.holder.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    if (s.holder.parent) s.holder.parent.remove(s.holder);
  }
  stack.items.length = 0;
  for (const d of [...debris]){
    scene.remove(d.obj);
    debris.splice(debris.indexOf(d), 1);
  }
}

