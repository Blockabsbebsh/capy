/* Theme-specific scenery. The original meadow remains intact; later themes
   replace its visual boundary and add their own readable landmarks. */
const themeFX = new THREE.Group();
scene.add(themeFX);
const themeFxState = { points:null, pointsMat:null, fireflies:[], bubbles:[], stars:null, lava:[], sparkles:[], bubbles2:[] };

function clearThemeFX(){
  while (themeFX.children.length){
    const o = themeFX.children.pop();
    o.traverse?.(q => {
      if (q.geometry) q.geometry.dispose();
      if (q.material && q.material.dispose) q.material.dispose();
    });
  }
  themeFxState.points = null; themeFxState.pointsMat = null;
  themeFxState.fireflies.length = 0; themeFxState.bubbles.length = 0;
  themeFxState.lava.length = 0; themeFxState.sparkles.length = 0;
  themeFxState.bubbles2.length = 0;
  // stars live in skyRig now, persistent across theme switches — just
  // hide them here, refreshThemeEnvironment shows them again for 'night'
  if (themeFxState.stars) themeFxState.stars.visible = false;
}

function makeFlatBlob(x,z,sx,sz,material,y=0.04){
  const m = new THREE.Mesh(new THREE.CircleGeometry(1,48), material);
  m.rotation.x = -Math.PI/2; m.scale.set(sx,sz,1); m.position.set(x,y,z);
  m.receiveShadow = true; themeFX.add(m); return m;
}

function makeLilyPad(x,z,s=1,rot=0){
  const g = new THREE.Group(); g.position.set(x,0.06,z); g.rotation.y=rot; g.scale.setScalar(s);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(1,48,0,Math.PI*1.82), new THREE.MeshStandardMaterial({color:0x6fae73,roughness:0.9}));
  pad.rotation.x=-Math.PI/2; pad.scale.set(1.55,1.0,1); pad.receiveShadow=true; g.add(pad);
  const vein = new THREE.Mesh(new THREE.PlaneGeometry(1.4,0.025), new THREE.MeshBasicMaterial({color:0x3e7651,transparent:true,opacity:0.55}));
  vein.rotation.x=-Math.PI/2; vein.position.y=0.012; vein.rotation.z=rot; g.add(vein);
  themeFX.add(g); return g;
}

/* Lily-pad ground texture for the main pond arena — applied to the SAME
   shared `patch` mesh every other biome uses (see the "hell" and "candy"
   textures below), instead of a separate custom-geometry object. Using a
   texture on the existing plain-circle patch — like every other biome —
   avoids the class of bugs a bespoke mesh kept introducing (tilted
   silhouette from rotating a non-uniformly-scaled group, geometry that
   didn't match the collision ellipse, etc). */
const lilyPadTex = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#5fa869'; g.fillRect(0,0,512,512);
  // radial veins fanning from just off-center, like a real lily pad
  const cx = 256, cy = 256;
  g.strokeStyle = 'rgba(62,118,81,0.55)'; g.lineWidth = 5;
  for (let i = 0; i < 11; i++){
    const a = (i/11) * Math.PI * 1.9 + 0.3;
    g.beginPath(); g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a)*230, cy + Math.sin(a)*230);
    g.stroke();
  }
  // mottled highlight patches for texture
  for (let i = 0; i < 40; i++){
    const a = Math.random()*Math.PI*2, r = Math.random()*220;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(140,200,140,0.18)' : 'rgba(50,95,65,0.16)';
    g.beginPath(); g.arc(cx+Math.cos(a)*r, cy+Math.sin(a)*r, 8+Math.random()*22, 0, Math.PI*2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

/* Water ripple texture for the pond biome's open water — a bump map
   (grayscale height, not color) of concentric ring sets, so the surface
   catches light unevenly instead of reading as a single flat color.
   Tiled seamlessly via the same wraparound-draw trick used for the lava
   and candy backgrounds. Used as a bumpMap, not a color map, so it adds
   surface variation without changing the water's actual tint. */
const waterRippleTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0,0,256,256);   // neutral gray = no bump
  // more ring-sets, higher contrast, and a touch of dark on the trough
  // side of each ring (not just a bright crest) — a bump map only reads
  // as "rippled" once there's real light/dark contrast to catch the sun,
  // and the old 0.10-alpha rings were too faint to ever show up.
  for (let i=0;i<22;i++){
    const x=Math.random()*256, y=Math.random()*256;
    const rings = 3+((Math.random()*4)|0);
    for (let r=1;r<=rings;r++){
      const crest = 0.30 - r*0.03, trough = 0.16 - r*0.018;
      for (let dx=-256; dx<=256; dx+=256) for (let dy=-256; dy<=256; dy+=256){
        g.strokeStyle = `rgba(255,255,255,${Math.max(0,crest)})`;
        g.lineWidth = 2;
        g.beginPath(); g.arc(x+dx,y+dy, r*7, 0, Math.PI*2); g.stroke();
        g.strokeStyle = `rgba(0,0,0,${Math.max(0,trough)})`;
        g.lineWidth = 1.5;
        g.beginPath(); g.arc(x+dx,y+dy, r*7+2.2, 0, Math.PI*2); g.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5,5);
  return tex;
})();

function makeGumdrop(x,z,s=1){
  const colors=[0xf08bb8,0xc58ae6,0xffb36b,0x83c7df];
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.72,32,24),
    new THREE.MeshStandardMaterial({color:colors[(Math.random()*colors.length)|0],roughness:0.28,metalness:0.06}));
  body.scale.set(1.05,1.25,0.92); body.castShadow=true; g.add(body);
  // a small bright highlight so it reads as glossy candy, not a matte ball
  const gloss = new THREE.Mesh(new THREE.SphereGeometry(0.16,10,8),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.55}));
  gloss.position.set(0.28,0.62,0.5); g.add(gloss);
  g.position.set(x,0.52*s,z); g.scale.setScalar(s);
  g.rotation.y = Math.random()*Math.PI*2;
  themeFX.add(g); return g;
}

/* Candy-cane "tree" — a bent, red/white striped pole, used in place of the
   default meadow trees for the Bubblegum biome (see treeSpots below). */
const candyCaneTex = (() => {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#fff7fa'; g.fillRect(0,0,32,32);
  g.strokeStyle = '#e8425f'; g.lineWidth = 11;
  for (let i=-32;i<64;i+=16){ g.beginPath(); g.moveTo(i,32); g.lineTo(i+32,0); g.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1,4);
  return tex;
})();
function makeCandyCane(x,z,s=1){
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,0,0), new THREE.Vector3(0,1.7,0),
    new THREE.Vector3(0.1,2.35,0), new THREE.Vector3(0.55,2.55,0), new THREE.Vector3(0.95,2.25,0),
  ]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve,28,0.16,10,false),
    new THREE.MeshStandardMaterial({map:candyCaneTex,roughness:0.35}));
  tube.castShadow = true; g.add(tube);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17,12,10), new THREE.MeshStandardMaterial({color:0xfff7fa,roughness:0.3}));
  cap.position.copy(curve.getPoint(1)); g.add(cap);
  g.position.set(x,0,z); g.scale.setScalar(s); g.rotation.y = Math.random()*Math.PI*2;
  themeFX.add(g); return g;
}

function makeObsidian(x,z,s=1){
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(0.85,1),
    new THREE.MeshStandardMaterial({color:0x171316,roughness:0.55,metalness:0.35,emissive:0x230e08,emissiveIntensity:0.4}));
  m.position.set(x,0.65*s,z); m.scale.set(0.85*s,1.45*s,0.8*s);
  m.rotation.set(Math.random()*0.5,Math.random()*Math.PI,Math.random()*0.35);
  m.castShadow=true; themeFX.add(m); return m;
}

/* Hell arena surface: obsidian/basalt rock with glowing lava fissures
   baked into a texture on the shared `patch` mesh (same pattern as every
   other biome's ground texture). A canvas texture is used instead of 3D
   tube-geometry lines because the tubes had no relationship to the
   patch's actual boundary — nothing stopped a curve control point from
   landing outside the arena, which is exactly what happened. Painting
   the fissures directly onto the surface that IS the arena guarantees
   they can never extend past it. */
const obsidianTex = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  // base: mottled dark basalt, not flat black
  g.fillStyle = '#15100f'; g.fillRect(0,0,512,512);
  for (let i = 0; i < 90; i++){
    const x = Math.random()*512, y = Math.random()*512, r = 10+Math.random()*38;
    const shade = 18 + Math.random()*22;
    g.fillStyle = `rgba(${shade+8},${shade},${shade+4},${0.25+Math.random()*0.35})`;
    g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
  }
  // angular basalt-column facets (polygon slivers)
  g.strokeStyle = 'rgba(60,45,40,0.4)'; g.lineWidth = 2;
  for (let i = 0; i < 26; i++){
    g.beginPath();
    const cx = Math.random()*512, cy = Math.random()*512, n = 5+((Math.random()*3)|0);
    for (let k=0;k<n;k++){
      const a = (k/n)*Math.PI*2, r = 16+Math.random()*14;
      g[k===0?'moveTo':'lineTo'](cx+Math.cos(a)*r, cy+Math.sin(a)*r);
    }
    g.closePath(); g.stroke();
  }
  // glowing lava fissures — a branching crack network with organic jitter
  // and tapering width, instead of a few smooth, uniform-width polylines
  // (which read as deliberate zig-zag shapes rather than real cracks).
  // Confined entirely within the canvas (= entirely within the arena,
  // guaranteed) since it's baked into this same texture.
  function jitterPath(x0, y0, x1, y1, roughness, depth){
    if (depth <= 0) return [[x0,y0],[x1,y1]];
    const mx = (x0+x1)/2, my = (y0+y1)/2;
    const dx = x1-x0, dy = y1-y0, len = Math.hypot(dx,dy) || 1;
    // perpendicular offset, scaled down each recursion so cracks stay
    // jagged up close but don't wander wildly over long spans
    const off = (Math.random()-0.5) * roughness * len * 0.5;
    const nx = -dy/len, ny = dx/len;
    const px = mx + nx*off, py = my + ny*off;
    const left = jitterPath(x0,y0,px,py, roughness, depth-1);
    const right = jitterPath(px,py,x1,y1, roughness, depth-1);
    return left.slice(0,-1).concat(right);
  }
  function drawStroke(pts, w, color){
    g.lineJoin='round'; g.lineCap='round';
    g.strokeStyle = color; g.lineWidth = w;
    g.beginPath(); pts.forEach(([x,y],i)=>g[i===0?'moveTo':'lineTo'](x,y)); g.stroke();
  }
  function fissure(x0,y0,x1,y1, w, branchChance){
    const pts = jitterPath(x0,y0,x1,y1, 0.9, 4);
    drawStroke(pts, w*3.2, 'rgba(255,110,35,0.3)');   // soft outer glow
    drawStroke(pts, w*1.5, '#ff6a1f');                // bright core
    drawStroke(pts, w*0.55, '#ffe08a');                // hot white-orange center line
    // occasional side branches, thinner, spawned partway along the main crack
    if (branchChance > 0){
      const n = pts.length;
      for (let i = 2; i < n-2; i += 3){
        if (Math.random() < branchChance){
          const [bx,by] = pts[i];
          const a = Math.random()*Math.PI*2;
          const blen = 30 + Math.random()*70;
          fissure(bx, by, bx+Math.cos(a)*blen, by+Math.sin(a)*blen, w*0.55, 0);
        }
      }
    }
  }
  fissure(30,190, 460,150, 5.5, 0.3);
  fissure(50,350, 470,340, 5, 0.3);
  fissure(235,50, 225,480, 4.5, 0.28);
  fissure(90,440, 360,380, 4, 0.25);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

/* Background lava field beyond the arena — bright, animated, tiled so
   the movement (see updateThemeFX) reads as slowly roiling lava rather
   than a static image. */
const lavaGroundTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128,128,10,128,128,180);
  grd.addColorStop(0, '#ffcf6a'); grd.addColorStop(0.35, '#ff7a1f'); grd.addColorStop(0.7, '#c23a10'); grd.addColorStop(1,'#5c1204');
  g.fillStyle = grd; g.fillRect(0,0,256,256);
  // draw each blob NINE times (a 3x3 wraparound grid) so any blob that
  // straddles a tile edge is mirrored on the opposite edge too — this is
  // what makes a RepeatWrapping texture actually seamless. Without this,
  // a circle near x=250 gets cut off with nothing continuing it at x=0,
  // which reads as a hard seam — and since this texture's offset is
  // animated for the scrolling effect, that seam visibly sweeps across
  // the screen instead of sitting still.
  for (let i=0;i<60;i++){
    const x=Math.random()*256, y=Math.random()*256, r=6+Math.random()*20;
    g.fillStyle = Math.random()<0.5 ? 'rgba(255,220,140,0.35)' : 'rgba(90,20,5,0.35)';
    for (let dx=-256; dx<=256; dx+=256) for (let dy=-256; dy<=256; dy+=256){
      g.beginPath(); g.arc(x+dx,y+dy,r,0,Math.PI*2); g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5,5);
  return tex;
})();

/* Bubblegum background field (the big `ground` circle beyond the arena)
   — pastel swirl-and-dot pattern, tiled, so the open background reads as
   "candy landscape" rather than flat pink. Same tiled-texture approach
   as the lava ground above. */
const candyBgTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e7a7ca'; g.fillRect(0,0,256,256);
  // same wraparound trick as the lava texture above, so dots don't get
  // cut off at the tile edge — that hard edge was the visible seam
  // running through the middle of the background
  for (let i=0;i<18;i++){
    const x=Math.random()*256, y=Math.random()*256, r=10+Math.random()*24;
    g.fillStyle = Math.random()<0.5 ? 'rgba(255,224,240,0.4)' : 'rgba(200,150,190,0.35)';
    for (let dx=-256; dx<=256; dx+=256) for (let dy=-256; dy<=256; dy+=256){
      g.beginPath(); g.arc(x+dx,y+dy,r,0,Math.PI*2); g.fill();
    }
  }
  // horizontal swirl strokes: drawn full-width edge-to-edge already, so
  // they tile cleanly on X; duplicate vertically so they wrap on Y too
  g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 6;
  for (let i=-1;i<5;i++){
    g.beginPath();
    const y0 = i*70 - 20;
    g.moveTo(-20, y0);
    g.bezierCurveTo(80, y0+40, 170, y0-40, 276, y0);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6,6);
  return tex;
})();

/* Lava bubbles — small bright blobs on the background lava field that
   rise, pulse, and pop, for the "movement" the lava was missing */
function makeLavaBubbles(){
  for (let i = 0; i < 22; i++){
    const a = Math.random()*Math.PI*2, r = 12 + Math.random()*26;
    const x = Math.cos(a)*r, z = Math.sin(a)*r*0.75 - 3;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.18+Math.random()*0.22, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent:true, opacity:0.85 }));
    m.position.set(x, 0.05, z);
    themeFX.add(m);
    themeFxState.bubbles2.push({ m, x0:x, z0:z, phase: Math.random()*6.28, speed: 0.6+Math.random()*0.8, life: 0 });
  }
}

// shared sprinkle materials + geometry, built once — makeSprinkles() used
// to allocate a brand new material per capsule (42 materials for 42
// meshes), which is wasted GPU program/state overhead for identical
// flat-color materials. Reusing 4 shared materials + 1 shared geometry
// across all instances is free visually and much cheaper to draw.
const sprinkleMats = [0xf06b9a,0x6c8fe8,0xffc64a,0x74c98d].map(c =>
  new THREE.MeshStandardMaterial({color:c, roughness:0.6}));
const sprinkleGeo = new THREE.CapsuleGeometry(0.045,0.14,3,6);
function makeSprinkles(){
  const group=new THREE.Group();
  for(let i=0;i<42;i++){
    const a=Math.random()*Math.PI*2, r=Math.sqrt(Math.random())*8.2;
    const x=Math.cos(a)*r, z=Math.sin(a)*r*0.48;
    const m=new THREE.Mesh(sprinkleGeo, sprinkleMats[i%4]);
    m.position.set(x,0.055,z); m.rotation.y=Math.random()*Math.PI; m.rotation.x=Math.PI/2;
    group.add(m);
  }
  themeFX.add(group);
}

function makeCandyBubbles(){
  for(let i=0;i<10;i++){
    const m=new THREE.Mesh(new THREE.SphereGeometry(0.35+Math.random()*0.5,16,12),
      new THREE.MeshStandardMaterial({color:[0xffffff,0xffd5ef,0xc9b5ff][i%3],transparent:true,opacity:0.35,roughness:0.05,metalness:0.05}));
    m.position.set(-12+Math.random()*24,7+Math.random()*12,-18-Math.random()*18);
    themeFX.add(m); themeFxState.bubbles.push({m,phase:Math.random()*6.28,speed:0.35+Math.random()*0.35});
  }
}

function makeNightSky(){
  const pos=[];
  const sizes=[];
  // 900 stars, wide spread — skyRig now only follows the camera's
  // position (not rotation, see skyRig comment), so a generous spread is
  // safe and won't visibly swim as the camera pans
  for(let i=0;i<900;i++){
    const x=(Math.random()-0.5)*160, y=0.5+Math.random()*22, z=-25-Math.random()*70;
    pos.push(x,y,z);
    sizes.push(0.08+Math.random()*0.16);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('size',new THREE.Float32BufferAttribute(sizes,1));
  const pm=new THREE.PointsMaterial({color:0xffffff,size:0.22,transparent:true,opacity:0.95,sizeAttenuation:true,fog:false});
  const pts=new THREE.Points(geo,pm);
  skyRig.add(pts);
  pts.visible = false;
  themeFxState.stars=pts;
}
makeNightSky();      // built once and kept — refreshThemeEnvironment just toggles it

function makeFireflies(){
  // scattered across the *background* ground, not the playable arena
  // (|x|<9, |z|<4.5 was inside the play field and got in the way of catching).
  // Bigger, brighter, more of them, plus a soft glow halo around each core
  // dot so they read clearly instead of as faint pinpricks.
  for(let i=0;i<70;i++){
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.075,10,8),
      new THREE.MeshBasicMaterial({color:0xfff8c0,transparent:true,opacity:0.95}));
    g.add(core);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.22,10,8),
      new THREE.MeshBasicMaterial({color:0xfff29a,transparent:true,opacity:0.28,depthWrite:false}));
    g.add(halo);
    let x,z;
    do {
      x = (Math.random()*2-1)*26;
      z = (Math.random()*2-1)*20 - 4;
    } while (Math.abs(x) < 11 && z > -6.5 && z < 6.5);
    g.position.set(x,0.25+Math.random()*1.6,z);
    themeFX.add(g);
    themeFxState.fireflies.push({m:core,halo,phase:Math.random()*6.28,speed:1+Math.random()*2,baseY:g.position.y,x0:x,z0:z,group:g});
  }
}

function makeLamp(x,z,s=1){
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,2.6,8), new THREE.MeshStandardMaterial({color:0x2a2418,roughness:0.6}));
  post.position.y = 1.3; g.add(post);
  const headBase = new THREE.Mesh(new THREE.ConeGeometry(0.3,0.22,8), new THREE.MeshStandardMaterial({color:0x2a2418,roughness:0.6}));
  headBase.position.y = 2.75; g.add(headBase);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22,12,10),
    new THREE.MeshBasicMaterial({color:0xffe8a0,transparent:true,opacity:0.9}));
  glow.position.y = 2.55; g.add(glow);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.55,12,10),
    new THREE.MeshBasicMaterial({color:0xffdf8a,transparent:true,opacity:0.18,depthWrite:false}));
  halo.position.y = 2.55; g.add(halo);
  const light = new THREE.PointLight(0xffdf9a, 1.1, 7, 1.8);
  light.position.y = 2.55; g.add(light);
  g.position.set(x,0,z); g.scale.setScalar(s);
  themeFX.add(g); return g;
}

function makeHellMoon(){
  const c=document.createElement('canvas'); c.width=256; c.height=256;
  const g=c.getContext('2d'); g.clearRect(0,0,256,256);
  g.fillStyle='#ff7a2f'; g.beginPath(); g.arc(128,128,112,0,Math.PI*2); g.fill();
  g.fillStyle='#6b130e';
  g.beginPath(); g.ellipse(88,102,15,25,0.2,0,Math.PI*2); g.ellipse(168,102,15,25,-0.2,0,Math.PI*2); g.fill();
  g.fillStyle='#ffd36b'; g.beginPath(); g.arc(90,96,5,0,Math.PI*2); g.arc(166,96,5,0,Math.PI*2); g.fill();
  g.strokeStyle='#3a0908'; g.lineWidth=10; g.beginPath(); g.arc(128,128,58,0.1,Math.PI-0.1); g.stroke();
  g.fillStyle='#ffdf7a'; for(let i=0;i<5;i++) g.fillRect(93+i*18,136+(i%2)*3,10,16);
  g.fillStyle='#8a2415'; g.beginPath(); g.ellipse(128,61,32,17,0,0,Math.PI*2); g.fill();
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
  sunDisc.material.map=tex; sunDisc.material.needsUpdate=true;
}

/* Candy-swirl ground texture for the Bubblegum arena — soft pastel polka
   dots and swirl streaks on a pink base, tiled across the arena patch. */
const candyGroundTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f2c4d9'; g.fillRect(0,0,256,256);
  const dotColors = ['#ffe0ee','#e7a7ca','#ffd5a8','#c9e8f2'];
  // same wraparound trick as candyBgTex: draw each dot at all 4 tile
  // offsets so nothing gets sliced off at the repeat seam. Without this,
  // any dot straddling the edge of the 256x256 tile got hard-clipped —
  // visible as a sharp cut running across the play field once the
  // texture repeated (repeat.set(2, 1.4) below).
  for (let i=0;i<26;i++){
    g.fillStyle = dotColors[i%dotColors.length];
    g.globalAlpha = 0.55;
    const r = 8+Math.random()*16;
    const x = Math.random()*256, y = Math.random()*256;
    for (let dx=-256; dx<=256; dx+=256) for (let dy=-256; dy<=256; dy+=256){
      g.beginPath(); g.arc(x+dx, y+dy, r, 0, Math.PI*2); g.fill();
    }
  }
  g.globalAlpha = 0.35; g.strokeStyle = '#ffffff'; g.lineWidth = 5;
  // swirl strokes already run full tile-width edge-to-edge (clean on X);
  // duplicate one tile-height above/below so they also wrap cleanly on Y
  for (let i=-1;i<7;i++){
    for (const yOff of [0, 256]){
      g.beginPath();
      const y0 = i*46 + yOff;
      g.moveTo(-20, y0);
      g.bezierCurveTo(70, y0+30, 180, y0-30, 276, y0);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1.4);
  return tex;
})();

/* Night arena floor: a soft glowing pattern so the play field's boundary
   reads clearly even in near-darkness — otherwise the arena is nearly
   the same value as the background and hard to place at a glance. Uses
   an emissive map (glows regardless of scene lighting, same technique as
   the Hell obsidian fissures) rather than relying on ambient light to
   pick out a flat color. */
const nightGroundTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1c3128'; g.fillRect(0,0,256,256);
  // faint moss-glow speckle field
  for (let i=0;i<70;i++){
    const x=Math.random()*256, y=Math.random()*256, r=2+Math.random()*5;
    g.fillStyle = `rgba(140,200,170,${0.15+Math.random()*0.25})`;
    g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
  }
  // subtle concentric glow rings radiating from center, like a soft
  // clearing lit from within — gives the arena a clear visual center
  const cx=128, cy=128;
  for (let r=30; r<170; r+=32){
    g.strokeStyle = `rgba(150,210,255,${0.14 - r*0.0004})`;
    g.lineWidth = 6;
    g.beginPath(); g.arc(cx,cy,r,0,Math.PI*2); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

function refreshThemeEnvironment(th){
  clearThemeFX();
  const mode=th.arena;
  ground.material = mode==='pond' ? mat.water : mat.grass;
  patch.material = mat.grassDark;
  patch.material.roughness = 1; patch.material.metalness = 0;   // hell overrides below, everything else uses this default
  patch.material.map = null; patch.material.needsUpdate = true; // candy/pond/hell re-add their own texture below
  patch.material.emissiveMap = null; patch.material.emissive.setHex(0x000000); patch.material.emissiveIntensity = 1; // hell re-adds its glow below
  border.visible = mode==='meadow';
  pond.visible = mode==='meadow';
  pondRim.visible = mode==='meadow';
  clouds.forEach(c=>c.visible = mode==='meadow' || mode==='pond');
  pinkClouds.forEach(c=>c.visible = mode==='candy');
  sceneryGroup.visible = mode==='meadow' || mode==='night';   // hidden for pond/candy/hell, which supply their own dressing
  if (themeFxState.stars) themeFxState.stars.visible = mode==='night';

  // helper: true if (x,z) lands outside the *playable* arena, with a
  // margin — used so background decorations never spawn on top of you.
  // 'pond' uses an elliptical arena (see updateCapybara), everything else
  // uses the rectangular ARENA bounds.
  function outsideArena(x, z, margin = 1.4){
    if (mode === 'pond'){
      // match the ACTUAL visible patch size (ARENA.halfX/halfZ + 2.4, same
      // as every other biome now — see the uniform-scale fix), not the
      // older, smaller collision-only ellipse. Using the smaller ellipse
      // here let lily pads spawn in the gap between it and the larger
      // visible patch, where they'd land on/under the patch and never
      // actually show — which is why the background read as sparse
      // despite plenty being spawned.
      const rx = ARENA.halfX + 2.4 + margin, rz = ARENA.halfZ + 2.4 + margin;
      return (x*x)/(rx*rx) + (z*z)/(rz*rz) > 1;
    }
    return Math.abs(x) > ARENA.halfX + margin || Math.abs(z) > ARENA.halfZ + margin;
  }
  function randomOutside(rx, rz, margin){
    let x, z, tries = 0;
    do { x = (Math.random()*2-1)*rx; z = (Math.random()*2-1)*rz; tries++; }
    while (!outsideArena(x, z, margin) && tries < 20);
    return [x, z];
  }

  if(mode==='pond'){
    // dedicated material (not the shared mat.water, which the small
    // decorative Meadow pond also uses) so the ripple bump map only
    // shows up here — otherwise it'd leak onto Meadow's pond too
    ground.material = new THREE.MeshStandardMaterial({
      color:0x4fb3d9, roughness:0.12, metalness:0.25, transparent:true, opacity:0.85,
      bumpMap: waterRippleTex, bumpScale: 0.18,
    });
    ground.scale.setScalar(1.35);
    // same pattern as every other biome: texture the shared `patch` mesh,
    // sized to match ARENA exactly, same as every other theme — kept
    // uniform across all 5 biomes now instead of each one having its own
    // slightly different scale, which made the arenas look inconsistent
    // in size from level to level
    patch.scale.set(ARENA.halfX + 2.4, ARENA.halfZ + 2.4, 1);
    patch.material.map = lilyPadTex; patch.material.color.setHex(0xffffff);
    patch.material.needsUpdate = true;
    border.visible=false;
    // lots more mini lily pads scattered across the open water — kept
    // clear of the main pad so they never overlap the play field. Spread
    // tightened from the previous 30x22 toward the camera's typical
    // visible range so more of them actually land on screen instead of
    // scattering into the far distance where they're barely visible.
    for(let i=0;i<48;i++){
      const [x,z] = randomOutside(20, 16, 1.2);
      makeLilyPad(x, z, 0.35+Math.random()*0.7, Math.random()*6.28);
    }
    // small mist puffs at the water horizon
    for(let i=0;i<14;i++){
      const m=new THREE.Mesh(new THREE.SphereGeometry(1.1+Math.random()*1.4,12,8),
        new THREE.MeshBasicMaterial({color:0xd8f1ea,transparent:true,opacity:0.08,depthWrite:false}));
      m.position.set(-24+Math.random()*48,2.5+Math.random()*2,-22-Math.random()*18); themeFX.add(m);
    }
    // sparkle speckles on the open water — a cheap shader-free ripple:
    // small bright dots that drift and fade, animated in updateThemeFX
    for(let i=0;i<26;i++){
      const [x,z] = randomOutside(24, 17, 0.5);
      const m=new THREE.Mesh(new THREE.CircleGeometry(0.11+Math.random()*0.1,8),
        new THREE.MeshBasicMaterial({color:0xeaffed,transparent:true,opacity:0.5,depthWrite:false}));
      m.rotation.x=-Math.PI/2; m.position.set(x,0.045,z); themeFX.add(m);
      themeFxState.sparkles.push({m,phase:Math.random()*6.28,speed:0.6+Math.random()*0.8});
    }
  } else if(mode==='candy'){
    // background field beyond the arena gets its own tiled pastel pattern,
    // same approach as the lava ground — a plain recolored grass material
    // read as flat pink with nothing going on
    ground.material = new THREE.MeshBasicMaterial({ map: candyBgTex });
    ground.scale.setScalar(1);
    patch.scale.set(ARENA.halfX + 2.4, ARENA.halfZ + 2.4, 1); patch.material.color.setHex(0xffffff);
    patch.material.map = candyGroundTex; patch.material.needsUpdate = true;
    border.visible=false; makeSprinkles(); makeCandyBubbles();
    // gumdrops kept outside the play field so they never sit under falling food
    for(let i=0;i<12;i++){
      const [x,z] = randomOutside(15, 9, 1.3);
      makeGumdrop(x, z, 0.55+Math.random()*0.65);
    }
    // candy canes replace the meadow's trees for this biome
    treeSpots.forEach(([x,z,s]) => makeCandyCane(x, z, s*1.7));
  } else if(mode==='night'){
    patch.scale.set(ARENA.halfX + 2.4, ARENA.halfZ + 2.4, 1); patch.material.color.setHex(0xffffff);
    patch.material.map = nightGroundTex;
    patch.material.emissiveMap = nightGroundTex;
    patch.material.emissive.setHex(0x8fc8b0);
    patch.material.emissiveIntensity = 0.5;
    patch.material.needsUpdate = true;
    border.visible=false; makeFireflies();
    if (themeFxState.stars) themeFxState.stars.visible = true;
    sunDisc.material.map=null; sunDisc.material.needsUpdate=true;
    sunDisc.material.color.setHex(0xdde9ff); sunHalo.material.color.setHex(0xa9c6ff);
    // a few lamp posts along the background for extra ambient light sources
    [[-10,-7],[9,-8],[-8,6],[10,7]].forEach(([x,z]) => makeLamp(x,z,1.1));
  } else if(mode==='hell'){
    // background beyond the arena: a genuinely bright, animated lava
    // field, not a near-black tint on the water material
    ground.material = new THREE.MeshBasicMaterial({ map: lavaGroundTex });
    ground.scale.setScalar(1);
    // arena surface: obsidian/basalt with lava fissures baked into the
    // texture, so they're physically part of the arena and can never
    // extend past its edge the way the old free-floating tube curves did
    patch.scale.set(ARENA.halfX + 2.4, ARENA.halfZ + 2.4, 1);
    patch.material.map = obsidianTex; patch.material.color.setHex(0xffffff);
    patch.material.roughness = 0.4; patch.material.metalness = 0.3;
    patch.material.emissiveMap = obsidianTex;
    patch.material.emissive.setHex(0xff5a1f);
    patch.material.emissiveIntensity = 0.55;
    patch.material.needsUpdate = true;
    border.visible=false;
    // obsidian boulders replace the meadow's trees in the background
    treeSpots.forEach(([x,z,s]) => makeObsidian(x, z, s*0.9));
    for(let i=0;i<8;i++){
      const [x,z] = randomOutside(16, 10, 1.2);
      makeObsidian(x, z, 0.7+Math.random()*1.0);
    }
    makeLavaBubbles();
    makeHellMoon();
  } else {
    ground.material=mat.grass; ground.scale.setScalar(1);
    patch.scale.set(ARENA.halfX+2.4,ARENA.halfZ+2.4,1);
    patch.material.color.copy(mat.grassDark.color);
    border.visible=true; pond.visible=true; pondRim.visible=true;
    sunDisc.material.map=null; sunDisc.material.needsUpdate=true;
  }

  if(mode!=='hell' && mode!=='night'){
    sunDisc.material.map=null; sunDisc.material.needsUpdate=true;
  }
}

function updateThemeFX(t){
  for(const b of themeFxState.bubbles){
    b.m.position.y += Math.sin(t*b.speed+b.phase)*0.003;
    b.m.position.x += Math.sin(t*0.45+b.phase)*0.006;
  }
  for(const f of themeFxState.fireflies){
    const k=0.35+0.65*(0.5+0.5*Math.sin(t*f.speed+f.phase));
    f.m.material.opacity=0.2+k*0.8;
    f.halo.material.opacity=0.08+k*0.32;
    // gentle drifting wander so they read as alive, not static dots
    f.group.position.x = f.x0 + Math.sin(t*0.3+f.phase)*0.6;
    f.group.position.z = f.z0 + Math.cos(t*0.25+f.phase*1.3)*0.6;
    f.group.position.y = f.baseY + Math.sin(t*f.speed*0.6+f.phase)*0.25;
  }
  if(themeFxState.stars && themeFxState.stars.visible) themeFxState.stars.material.opacity=0.72+0.18*Math.sin(t*0.9);
  for(const s of themeFxState.sparkles){
    const k=0.5+0.5*Math.sin(t*s.speed+s.phase);
    s.m.material.opacity = 0.15+k*0.55;
  }
  // hell: slowly scroll the lava texture so the background field looks
  // like it's actually flowing, plus rising/popping bubbles on top of it
  if (curTheme.arena === 'hell'){
    lavaGroundTex.offset.set((t*0.015)%1, (t*0.01)%1);
    // pulse the arena's fissure glow so it reads as living lava, not a
    // static painted-on pattern
    patch.material.emissiveIntensity = 0.5 + 0.25*Math.sin(t*1.8);
    for (const b of themeFxState.bubbles2){
      b.life += 1/60;
      const cycle = (b.life * b.speed + b.phase) % 4;
      // 0-3: rise and swell, 3-4: pop and reset
      if (cycle < 3){
        const k = cycle / 3;
        b.m.position.y = 0.05 + k*0.35;
        b.m.scale.setScalar(0.6 + k*0.8);
        b.m.material.opacity = 0.85 * (1 - k*0.3);
      } else {
        b.m.scale.setScalar(1.4 + (cycle-3)*2);
        b.m.material.opacity = 0.85 * (1 - (cycle-3));
      }
    }
  }
  // pond: gently scroll the ripple bump map so the water surface looks
  // like it's actually moving rather than a static texture
  if (curTheme.arena === 'pond'){
    waterRippleTex.offset.set((t*0.008)%1, (t*0.006)%1);
  }
}

