/* =======================================================================
   SINKHOLES
   Telegraphed by a pulsing red ring, then the ground drops away for
   HOLE_LIFE seconds before it grows back. Walk in and you lose a life.
   ======================================================================= */
const holes = [];
/* 5s, down from 15 in two steps. A hole outlived the set-piece that opened it by
   a wide margin — two or three were still sitting in the arena while the next
   several routes ran through the space, so the sinkhole stopped being an event
   and became terrain. Shorter also means fewer routes get their beats stranded
   inside one (see rec.blocked in formations.js). */
const HOLE_LIFE = 5;       // seconds a hole stays open
const HOLE_WARN = 1.4;     // telegraph time before it opens

function spawnHole(x, z, r){
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const warn = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.66, r, 36).rotateX(-Math.PI/2),
    new THREE.MeshBasicMaterial({ color:0xff4a3a, transparent:true, opacity:0.7, depthWrite:false })
  );
  warn.position.y = 0.07;
  g.add(warn);

  // the pit itself is drawn as layered ground decals — at this camera angle
  // the offset inner disc reads convincingly as depth
  const pit = new THREE.Group();
  const hellHole = curTheme.arena === 'hell';
  const pondHole = curTheme.arena === 'pond';
  const rimMat = hellHole ? new THREE.MeshStandardMaterial({color:0x5d1710,roughness:0.9,emissive:0x2a0703,emissiveIntensity:0.7})
                           : (pondHole ? new THREE.MeshStandardMaterial({color:0x4b8f7e,roughness:0.9}) : mat.holeRim);
  const darkMat = hellHole ? new THREE.MeshBasicMaterial({color:0xff4a16})
                            : (pondHole ? new THREE.MeshBasicMaterial({color:0x173f52}) : mat.holeDark);
  const deepMat = hellHole ? new THREE.MeshBasicMaterial({color:0x210504})
                            : (pondHole ? new THREE.MeshBasicMaterial({color:0x0b2832}) : mat.holeDeep);
  const rim = new THREE.Mesh(new THREE.RingGeometry(r * 0.97, r * 1.2, 36).rotateX(-Math.PI/2), rimMat);
  rim.position.y = 0.05;
  const dark = new THREE.Mesh(new THREE.CircleGeometry(r, 36).rotateX(-Math.PI/2), darkMat);
  dark.position.y = 0.055;
  const deep = new THREE.Mesh(new THREE.CircleGeometry(r * 0.7, 30).rotateX(-Math.PI/2), deepMat);
  deep.position.set(0, 0.06, -r * 0.17);
  pit.add(rim, dark, deep);
  pit.scale.setScalar(0.01);
  if (pondHole) pit.scale.z = 0.48; // elongated tear in the giant lily pad
  pit.visible = false;
  g.add(pit);

  scene.add(g);
  holes.push({ g, warn, pit, x, z, r, state:'warn', t:0, open:0 });
}

// pick a spot that is clear of the capybara and of other holes
function spawnHoleSafe(){
  if (holes.length >= 5) return;
  const r = 1.35 + Math.random() * 0.5;
  for (let tries = 0; tries < 40; tries++){
    const x = (Math.random()*2 - 1) * (ARENA.halfX - r * 0.7);
    const z = (Math.random()*2 - 1) * (ARENA.halfZ - r * 0.4);
    if (Math.hypot(x - capyState.x, z - capyState.z) < r + 3.0) continue;
    let clash = false;
    for (const h of holes){
      if (Math.hypot(x - h.x, z - h.z) < r + h.r + 1.2){ clash = true; break; }
    }
    if (clash) continue;
    spawnHole(x, z, r);
    return;
  }
}

function removeHole(h){
  scene.remove(h.g);
  h.warn.material.dispose(); h.warn.geometry.dispose();
  h.pit.children.forEach(c => c.geometry.dispose());
  const i = holes.indexOf(h);
  if (i >= 0) holes.splice(i, 1);
}
function clearHoles(){ [...holes].forEach(removeHole); }

const easeOutBack = t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

function updateHoles(dt){
  for (let i = holes.length - 1; i >= 0; i--){
    const h = holes[i];
    h.t += dt;

    if (h.state === 'warn'){
      const p = Math.abs(Math.sin(h.t * 9));
      h.warn.material.opacity = 0.28 + p * 0.55;
      h.warn.scale.setScalar(0.9 + p * 0.14);
      if (h.t >= HOLE_WARN){
        h.state = 'open'; h.t = 0;
        h.warn.visible = false;
        h.pit.visible = true;
        Audio.rumble();
        game.shake = Math.max(game.shake, 0.3);
        burst(new THREE.Vector3(h.x, 0.2, h.z), 22, PAL.dust, { spread:5.4, up:5.2, size:0.15, life:0.9 });
      }
    } else if (h.state === 'open'){
      h.open = Math.min(1, h.open + dt * 2.6);
      h.pit.scale.setScalar(Math.max(0.01, easeOutBack(h.open)));
      if (h.t >= HOLE_LIFE){ h.state = 'close'; h.t = 0; }
    } else { // closing — the ground grows back
      h.open = Math.max(0, h.open - dt * 1.6);
      h.pit.scale.setScalar(Math.max(0.01, h.open));
      if (h.open <= 0.02){ removeHole(h); continue; }
    }
  }
}

// only a fully-formed hole can swallow you
function holeAt(x, z){
  for (const h of holes){
    if (h.state === 'warn' || h.open < 0.55) continue;
    if (Math.hypot(x - h.x, z - h.z) < h.r * 0.78) return h;
  }
  return null;
}

