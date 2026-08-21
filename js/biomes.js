/* Theme-specific scenery. The original meadow remains intact; later themes
   replace its visual boundary and add their own readable landmarks. */
const themeFX = new THREE.Group();
scene.add(themeFX);
const themeFxState = { points:null, pointsMat:null, fireflies:[], bubbles:[], stars:null, lava:[], sparkles:[], bubbles2:[] };

function clearThemeFX(){
  while (themeFX.children.length){
    const o = themeFX.children.pop();
    // Anything flagged shared is owned by the module, not this group, and is
    // reused next time the biome comes back. Disposing it here forced three.js
    // to re-upload the geometry and recompile the shaders on the way back in.
    o.traverse?.(q => {
      if (q.geometry && !q.geometry.userData.shared) q.geometry.dispose();
      if (q.material && q.material.dispose && !q.material.userData.shared) q.material.dispose();
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

function makeLilyPad(x,z,s=1,rot=0){
  const g = new THREE.Group(); g.position.set(x,0.06,z); g.rotation.y=rot; g.scale.setScalar(s);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(1,48,0,Math.PI*1.82), new THREE.MeshStandardMaterial({color:0x6fae73,roughness:0.9}));
  pad.rotation.x=-Math.PI/2; pad.scale.set(1.55,1.0,1); pad.receiveShadow=true; g.add(pad);
  const vein = new THREE.Mesh(new THREE.PlaneGeometry(1.4,0.025), new THREE.MeshBasicMaterial({color:0x3e7651,transparent:true,opacity:0.55}));
  vein.rotation.x=-Math.PI/2; vein.position.y=0.012; vein.rotation.z=rot; g.add(vein);
  themeFX.add(g); return g;
}

/* ---------------------------------------------------------------------------
   `paint(drawSize, scale)` hands back a canvas of drawSize*scale pixels that is
   pre-scaled, so every drawing call still works in drawSize coordinates —
   resolution without rescaling hundreds of hand-tuned numbers.

   `finish()` sets anisotropic filtering, which matters more here than raw
   resolution: the camera looks across the arena at a shallow angle, and without
   it the GPU picks an over-blurred mip for the far half of the floor. That is
   what read as grain.
--------------------------------------------------------------------------- */
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
function paint(drawSize, scale){
  const c = document.createElement('canvas');
  c.width = c.height = drawSize * scale;
  const g = c.getContext('2d');
  g.scale(scale, scale);
  return [c, g];
}
function finish(c, { srgb = true, repeat = null } = {}){
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = ANISO;
  if (repeat){
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

/* Lily-pad ground texture for the pond arena — applied to the SAME shared
   `patch` mesh every other biome uses, not a bespoke mesh. The custom geometry
   this replaced kept introducing its own bugs: a tilted silhouette from
   rotating a non-uniformly-scaled group, geometry that missed the collision
   ellipse. */
const lilyPadTex = (() => {
  const [c, g] = paint(512, 2);            // 1024px, drawn in 512-space
  const cx = 256, cy = 256, R = 256;
  // a domed base rather than a flat fill, so the pad reads as a surface
  const base = g.createRadialGradient(cx, cy - 24, 60, cx, cy, R);
  base.addColorStop(0, '#63ad6e');
  base.addColorStop(0.6, '#5fa869');
  base.addColorStop(1, '#4f9060');
  g.fillStyle = base; g.fillRect(0,0,512,512);

  /* Venation. Real ribs fan out in gentle arcs, thick at the hub, tapering to
     nothing at the margin, with finer forks between — and LIGHTER than the pad,
     the way a raised rib catches light. Eleven hard straight dark spokes read
     as a drawn asterisk, not a leaf. */
  g.lineCap = 'round'; g.lineJoin = 'round';
  const ribPath = (a0, len, curve, steps = 26) => {
    const pts = [];
    for (let i = 0; i <= steps; i++){
      const t = i / steps;
      const a = a0 + curve * t * t;          // bend grows along the rib
      pts.push([cx + Math.cos(a) * len * t, cy + Math.sin(a) * len * t]);
    }
    return pts;
  };
  const taper = (pts, w0, rgb, alpha, dx = 0, dy = 0) => {
    for (let i = 1; i < pts.length; i++){
      const t = i / (pts.length - 1);
      g.strokeStyle = `rgba(${rgb},${(alpha * (1 - t * 0.3)).toFixed(3)})`;
      g.lineWidth = Math.max(0.7, w0 * Math.pow(1 - t, 0.55));
      g.beginPath(); g.moveTo(pts[i-1][0] + dx, pts[i-1][1] + dy);
      g.lineTo(pts[i][0] + dx, pts[i][1] + dy); g.stroke();
    }
  };
  const ribs = [];
  for (let i = 0; i < 13; i++){
    const a0 = (i / 13) * Math.PI * 2 + 0.25;
    const curve = (i % 2 ? 0.17 : -0.14) + (Math.random() - 0.5) * 0.1;
    ribs.push(ribPath(a0, R * (0.84 + Math.random() * 0.08), curve));
  }
  ribs.forEach(p => taper(p, 7.5, '52,96,66', 0.42, 2.2, 2.2));   // relief shadow
  ribs.forEach(p => taper(p, 7.0, '156,206,150', 0.70));          // lit rib
  for (const p of ribs){                                          // finer forks
    for (const at of [0.44, 0.64, 0.81]){
      if (Math.random() > 0.75) continue;
      const [bx, by] = p[Math.floor(at * (p.length - 1))];
      const dir = Math.random() < 0.5 ? 1 : -1;
      const from = Math.atan2(by - cy, bx - cx);
      const len = R * (0.09 + Math.random() * 0.12);
      const sub = [];
      for (let k = 0; k <= 12; k++){
        const t = k / 12, a = from + dir * (0.45 + 0.35 * t);
        sub.push([bx + Math.cos(a) * len * t, by + Math.sin(a) * len * t]);
      }
      taper(sub, 3.0, '156,206,150', 0.5);
    }
  }
  // mottled patches for texture — kept faint so they sit under the venation
  // rather than competing with it
  for (let i = 0; i < 40; i++){
    const a = Math.random()*Math.PI*2, r = Math.random()*220;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(140,200,140,0.10)' : 'rgba(50,95,65,0.09)';
    g.beginPath(); g.arc(cx+Math.cos(a)*r, cy+Math.sin(a)*r, 6+Math.random()*14, 0, Math.PI*2); g.fill();
  }
  // slightly deeper margin so the pad has an edge instead of fading out
  const margin = g.createRadialGradient(cx, cy, R * 0.8, cx, cy, R);
  margin.addColorStop(0, 'rgba(48,92,62,0)');
  margin.addColorStop(1, 'rgba(44,86,58,0.5)');
  g.fillStyle = margin; g.fillRect(0,0,512,512);
  return finish(c);
})();

/* The upturned rim of a giant Victoria lily: a short vertical wall with a
   rolled lip, which is what makes the pad read as giant rather than big and
   flat. It doubles as a visible arena boundary, which used to have to be
   inferred from a change of colour. Built once and toggled by visibility (the
   themeFX group is rebuilt per visit, this is not). It sits at the patch
   radius, outside the movement bounds, so it never blocks the player. */
const lilyRim = new THREE.Group();
{
  const rimMat = new THREE.MeshStandardMaterial({ color:0x74b878, roughness:0.86, side:THREE.DoubleSide });
  const h = 0.44;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.0, h, 96, 1, true), rimMat);
  wall.position.y = h / 2;
  wall.castShadow = true; wall.receiveShadow = true;
  lilyRim.add(wall);
  // UNSCALED units: the group below scales the rim by 11 on X and 6.6 on Z, so
  // this comes out an order of magnitude fatter than it looks. Half the old
  // 0.075 keeps a readable rolled edge without reading as a wall of its own.
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.0375, 10, 96), rimMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = h;
  lip.castShadow = true;
  lilyRim.add(lip);
  lilyRim.scale.set(PATCH_R, 1, PATCH_R);   // matches `patch`
  lilyRim.visible = false;
  world.add(lilyRim);
}

/* The arena patch is the same ellipse in every biome. Background dressing that
   lands inside it grows out of the arena floor instead of the field beyond —
   which the pond had to guard against and the raised hell slab shows up too. */
// one radius, because the drawn floor is a circle now — this was an ellipse
// test with two half-axes that are the same number
function outsidePatch(x, z, margin = 0){
  return Math.hypot(x, z) > PATCH_R + margin;
}

/* Hell's slab sat exactly level with the lava, so it read as a pattern printed
   on it. The slab itself is untouched — the shared `patch` mesh at the same
   size and height as every biome, so nothing about where the capybara stands or
   where food lands moves. What moves is the field AROUND it: the background
   disc drops by HELL_LAVA_DROP and this skirt fills the step, so the side face
   shows and the eye reads the slab as raised. Toggled by visibility. */
const HELL_LAVA_DROP = 0.4;
const hellSkirt = new THREE.Group();
{
  const h = HELL_LAVA_DROP + patch.position.y;     // lava level up to the slab face
  // Top radius 1.0 sits under the patch edge; the narrower base undercuts the
  // slab so the side face turns away from the sun and reads as a shadowed cut
  // rather than more floor. A shade lighter than the basalt — matched, side and
  // top read as one black mass and the step disappears again.
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 0.965, h, 96, 1, true),
    new THREE.MeshStandardMaterial({ color:0x2a1e1b, roughness:0.95, metalness:0 })
  );
  wall.position.y = patch.position.y - h / 2;
  wall.receiveShadow = true;
  hellSkirt.add(wall);
  /* Cooled crust pooled at the foot of the slab — a contact shadow, which the
     lava cannot get any other way: its material is MeshBasic and receives no
     real shadow. Two plain rings of falling opacity rather than one vertex-alpha
     ramp, which is tidier but leaves a hard circle where that path is not
     taken; stepped opacity always draws. */
  for (const [r0, r1, a] of [[0.995, 1.06, 0.34], [1.06, 1.15, 0.16]]){
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r0, r1, 96).rotateX(-Math.PI/2),
      new THREE.MeshBasicMaterial({ color:0x1a0c07, transparent:true, opacity:a, depthWrite:false })
    );
    ring.position.y = -HELL_LAVA_DROP + 0.012;
    hellSkirt.add(ring);
  }
  hellSkirt.scale.set(PATCH_R, 1, PATCH_R);   // matches `patch`
  hellSkirt.visible = false;
  world.add(hellSkirt);
}

/* Water ripple bump map for the pond's open water: grayscale height, not
   colour, so the surface catches light unevenly instead of reading flat. Tiled
   with the same wraparound-draw trick as the lava and candy backgrounds. */
const waterRippleTex = (() => {
  const [c, g] = paint(256, 2);            // 512px, drawn in 256-space
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
  return finish(c, { srgb:false, repeat:[5,5] });
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
  const [c, g] = paint(32, 8);             // 256px, drawn in 32-space
  g.fillStyle = '#fff7fa'; g.fillRect(0,0,32,32);
  g.strokeStyle = '#e8425f'; g.lineWidth = 11;
  for (let i=-32;i<64;i+=16){ g.beginPath(); g.moveTo(i,32); g.lineTo(i+32,0); g.stroke(); }
  return finish(c, { srgb:false, repeat:[1,4] });   // no colourspace was set here originally
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

// y0 is the height of the surface the boulder is standing in — the hell field
// sits HELL_LAVA_DROP below world zero, and a boulder left at zero floats.
function makeObsidian(x,z,s=1,y0=0){
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(0.85,1),
    new THREE.MeshStandardMaterial({color:0x171316,roughness:0.55,metalness:0.35,emissive:0x230e08,emissiveIntensity:0.4}));
  m.position.set(x,y0+0.65*s,z); m.scale.set(0.85*s,1.45*s,0.8*s);
  m.rotation.set(Math.random()*0.5,Math.random()*Math.PI,Math.random()*0.35);
  m.castShadow=true; themeFX.add(m); return m;
}

/* Hell arena surface: basalt with glowing fissures baked into a texture on the
   shared `patch` mesh. A canvas texture rather than tube geometry because the
   tubes had no relationship to the patch boundary — nothing stopped a control
   point landing outside the arena, which is exactly what happened. Painted onto
   the surface that IS the arena, a fissure cannot leave it. */
const obsidianTex = (() => {
  const [c, g] = paint(512, 2);            // 1024px, drawn in 512-space
  // base: mottled dark basalt, not flat black
  g.fillStyle = '#15100f'; g.fillRect(0,0,512,512);
  for (let i = 0; i < 90; i++){
    const x = Math.random()*512, y = Math.random()*512, r = 10+Math.random()*38;
    const shade = 18 + Math.random()*22;
    g.fillStyle = `rgba(${shade+8},${shade},${shade+4},${0.25+Math.random()*0.35})`;
    g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
  }
  // Columnar-basalt plates: cell centres on a jittered grid, each outlined as
  // an irregular polygon, so the rock reads as packed columns seen from above
  // rather than a few loose polygon slivers floating on noise.
  g.lineJoin = 'round';
  for (let gx = -1; gx < 9; gx++) for (let gy = -1; gy < 9; gy++){
    const px = gx*64 + 32 + (Math.random()-0.5)*34;
    const py = gy*64 + 32 + (Math.random()-0.5)*34;
    const n = 5 + ((Math.random()*3)|0);
    const poly = [];
    for (let k = 0; k < n; k++){
      const a = (k/n)*Math.PI*2 + Math.random()*0.3, r = 24 + Math.random()*13;
      poly.push([px + Math.cos(a)*r, py + Math.sin(a)*r]);
    }
    const trace = (dx, dy) => {
      g.beginPath();
      poly.forEach(([x,y],i) => g[i===0?'moveTo':'lineTo'](x+dx, y+dy));
      g.closePath(); g.stroke();
    };
    g.strokeStyle = 'rgba(9,6,6,0.55)';  g.lineWidth = 2.4; trace(0,0);      // seam
    g.strokeStyle = 'rgba(96,78,70,0.30)'; g.lineWidth = 1.1; trace(-1,-1);  // lit lip
  }

  /* Lava fissures. A crack in cooled basalt is a GAP between plates: mostly
     straight, kinking sharply at plate boundaries rather than wobbling, widest
     mid-run, tapering to a hairline at both ends, glowing from inside a dark
     recess. Midpoint-displaced polylines at constant width read as squiggles
     sitting on the rock instead of splits in it. */
  // A crack runs from one junction to another. Walking freely and steering
  // away from the rim made every crack curve inward and meet in the middle,
  // which read as a twig. Going node-to-node instead lets them close into
  // cells, which is what actually makes a surface look plated.
  function crackBetween(x0,y0,x1,y1,segs,wander){
    const pts = [[x0,y0]];
    const perp = Math.atan2(y1-y0, x1-x0) + Math.PI/2;
    for (let i = 1; i <= segs; i++){
      const t = i/segs;
      // offset sideways off the straight run, pinned to 0 at both ends so the
      // crack still lands exactly on its junctions
      const off = i === segs ? 0 : (Math.random()-0.5) * wander * Math.sin(Math.PI*t);
      pts.push([x0 + (x1-x0)*t + Math.cos(perp)*off,
                y0 + (y1-y0)*t + Math.sin(perp)*off]);
    }
    return pts;
  }
  function strokeCrack(pts, wMax){
    const n = pts.length - 1;
    // hairline at both ends, fattest around the middle of the run
    const wAt = t => Math.max(0.35, wMax * Math.pow(Math.sin(Math.PI*t), 0.7));
    g.lineCap = 'round'; g.lineJoin = 'round';
    const pass = (mul, rgb, alpha) => {
      for (let i = 1; i <= n; i++){
        const t = i/n;
        g.strokeStyle = `rgba(${rgb},${alpha})`;
        g.lineWidth = wAt(t)*mul;
        g.beginPath(); g.moveTo(pts[i-1][0],pts[i-1][1]); g.lineTo(pts[i][0],pts[i][1]); g.stroke();
      }
    };
    pass(5.0, '255,96,20',   0.09);   // heat bloom washing the rock nearby
    pass(2.9, '255,120,30',  0.16);
    pass(1.9, '18,9,7',      0.95);   // the gap itself, in shadow
    pass(1.1, '255,86,16',   1);      // lava down in the gap
    pass(0.45,'255,226,150', 1);      // white-hot centre
  }
  // Junctions: an inner ring of nodes plus nodes out at the rim. Linking the
  // inner ones into a loop encloses a central plate; spurs out to the rim
  // break the surrounding rock into further cells.
  const node = (r, a) => [256 + Math.cos(a)*r, 256 + Math.sin(a)*r];
  const inner = [], rim = [];
  for (let i = 0; i < 5; i++){
    const a = (i/5)*Math.PI*2 + 0.4;
    inner.push(node(88 + Math.random()*46, a + (Math.random()-0.5)*0.35));
  }
  for (let i = 0; i < 7; i++){
    const a = (i/7)*Math.PI*2 + 0.15;
    rim.push(node(232 + Math.random()*22, a + (Math.random()-0.5)*0.3));
  }
  for (let i = 0; i < inner.length; i++){
    const [ax,ay] = inner[i], [bx,by] = inner[(i+1)%inner.length];
    strokeCrack(crackBetween(ax,ay,bx,by, 6, 40), 4.6);
  }
  for (const [rx,ry] of rim){
    // run each rim node to whichever junction it actually sits nearest
    let best = inner[0], bd = Infinity;
    for (const n of inner){
      const d = Math.hypot(n[0]-rx, n[1]-ry);
      if (d < bd){ bd = d; best = n; }
    }
    strokeCrack(crackBetween(best[0],best[1], rx,ry, 7, 52), 5.4);
  }
  return finish(c);
})();

/* Background lava field beyond the arena — bright, animated, tiled so
   the movement (see updateThemeFX) reads as slowly roiling lava rather
   than a static image. */
const lavaGroundTex = (() => {
  const [c, g] = paint(256, 2);            // 512px, drawn in 256-space
  const grd = g.createRadialGradient(128,128,10,128,128,180);
  grd.addColorStop(0, '#ffcf6a'); grd.addColorStop(0.35, '#ff7a1f'); grd.addColorStop(0.7, '#c23a10'); grd.addColorStop(1,'#5c1204');
  g.fillStyle = grd; g.fillRect(0,0,256,256);
  // draw each blob NINE times (a 3x3 wraparound grid) so anything straddling a
  // tile edge is mirrored on the opposite edge — this is what makes a
  // RepeatWrapping texture actually seamless. Without it a blob near x=250 is
  // cut off with nothing continuing it at x=0, and since this texture's offset
  // is animated, that seam visibly sweeps across the screen.
  for (let i=0;i<60;i++){
    const x=Math.random()*256, y=Math.random()*256, r=6+Math.random()*20;
    g.fillStyle = Math.random()<0.5 ? 'rgba(255,220,140,0.35)' : 'rgba(90,20,5,0.35)';
    for (let dx=-256; dx<=256; dx+=256) for (let dy=-256; dy<=256; dy+=256){
      g.beginPath(); g.arc(x+dx,y+dy,r,0,Math.PI*2); g.fill();
    }
  }
  return finish(c, { repeat:[5,5] });
})();

/* Bubblegum background field (the big `ground` circle beyond the arena)
   — pastel swirl-and-dot pattern, tiled, so the open background reads as
   "candy landscape" rather than flat pink. Same tiled-texture approach
   as the lava ground above. */
const candyBgTex = (() => {
  const [c, g] = paint(256, 2);            // 512px, drawn in 256-space
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
  // Same periodic-sine bands as candyGroundTex, and for the same reason: the
  // bezier this used to draw was full-width but not actually periodic, so its
  // height jumped at every tile boundary. At repeat.set(6, 6) that scattered
  // faint steps across the whole background field.
  g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 6;
  const bgBands = 4, bgGap = 256 / bgBands;
  for (let i = 0; i < bgBands; i++){
    const y0 = i * bgGap;
    g.beginPath();
    for (let x = 0; x <= 256; x += 4){
      const y = y0 + Math.sin((x / 256) * Math.PI * 2) * 18;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  return finish(c, { repeat:[6,6] });
})();

/* Lava bubbles — small bright blobs on the background lava field that
   rise, pulse, and pop, for the "movement" the lava was missing */
function makeLavaBubbles(){
  for (let i = 0; i < 22; i++){
    const a = Math.random()*Math.PI*2, r = 12 + Math.random()*26;
    const x = Math.cos(a)*r, z = Math.sin(a)*r*0.75 - 3;
    // the near arc of the smallest radius still reaches over the arena slab,
    // where a bubble would rise straight up through the basalt
    if (!outsidePatch(x, z, 0.8)) continue;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.18+Math.random()*0.22, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent:true, opacity:0.85 }));
    // they rise from the lava surface, which is HELL_LAVA_DROP below zero
    const y0 = 0.05 - HELL_LAVA_DROP;
    m.position.set(x, y0, z);
    themeFX.add(m);
    themeFxState.bubbles2.push({ m, x0:x, z0:z, y0, phase: Math.random()*6.28, speed: 0.6+Math.random()*0.8, life: 0 });
  }
}

// shared sprinkle materials + geometry, built once: a new material per capsule
// was 42 identical flat-colour materials and 42 GPU state changes. Which is why
// clearThemeFX must not dispose them — hence the shared flag.
const sprinkleMats = [0xf06b9a,0x6c8fe8,0xffc64a,0x74c98d].map(c =>
  new THREE.MeshStandardMaterial({color:c, roughness:0.6}));
const sprinkleGeo = new THREE.CapsuleGeometry(0.045,0.14,3,6);
sprinkleGeo.userData.shared = true;
sprinkleMats.forEach(m => m.userData.shared = true);
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
  const [c, g] = paint(256, 2);            // 512px, drawn in 256-space
  g.clearRect(0,0,256,256);
  g.fillStyle='#ff7a2f'; g.beginPath(); g.arc(128,128,112,0,Math.PI*2); g.fill();
  g.fillStyle='#6b130e';
  g.beginPath(); g.ellipse(88,102,15,25,0.2,0,Math.PI*2); g.ellipse(168,102,15,25,-0.2,0,Math.PI*2); g.fill();
  g.fillStyle='#ffd36b'; g.beginPath(); g.arc(90,96,5,0,Math.PI*2); g.arc(166,96,5,0,Math.PI*2); g.fill();
  g.strokeStyle='#3a0908'; g.lineWidth=10; g.beginPath(); g.arc(128,128,58,0.1,Math.PI-0.1); g.stroke();
  g.fillStyle='#ffdf7a'; for(let i=0;i<5;i++) g.fillRect(93+i*18,136+(i%2)*3,10,16);
  g.fillStyle='#8a2415'; g.beginPath(); g.ellipse(128,61,32,17,0,0,Math.PI*2); g.fill();
  const tex = finish(c);
  sunDisc.material.map=tex; sunDisc.material.needsUpdate=true;
}

/* Candy-swirl ground texture for the Bubblegum arena — soft pastel polka
   dots and swirl streaks on a pink base, tiled across the arena patch. */
const candyGroundTex = (() => {
  const [c, g] = paint(256, 4);            // 1024px, drawn in 256-space
  // Deliberately deeper than candyBgTex, the pale field beyond the arena, so
  // the play area reads as a distinct mat. This used to arrive by accident as
  // the theme's ground colour multiplying the whole texture; baked in properly
  // it keeps the contrast without crushing the pattern underneath.
  g.fillStyle = '#db80ac'; g.fillRect(0,0,256,256);
  const dotColors = ['#e793bc','#d16da0','#e78b85','#b698c0'];
  // same wraparound trick as candyBgTex: any dot straddling the edge of the
  // 256x256 tile got hard-clipped, which showed as a sharp cut across the play
  // field once the texture repeated.
  for (let i=0;i<26;i++){
    g.fillStyle = dotColors[i%dotColors.length];
    g.globalAlpha = 0.55;
    const r = 8+Math.random()*16;
    const x = Math.random()*256, y = Math.random()*256;
    for (let dx=-256; dx<=256; dx+=256) for (let dy=-256; dy<=256; dy+=256){
      g.beginPath(); g.arc(x+dx, y+dy, r, 0, Math.PI*2); g.fill();
    }
  }
  g.globalAlpha = 0.30; g.strokeStyle = '#ffd9ec'; g.lineWidth = 5;
  /* Swirl bands as a sine whose period is exactly the tile width, spaced so a
     whole number fit the tile height — both axes genuinely periodic, so the
     bands run on unbroken across every repeat. The bezier this replaced ran
     edge to edge but nothing made its height AND slope match at x=0 and x=256,
     so every tile boundary stepped the bands vertically — a hard seam down the
     middle of the arena at repeat.set(2, 1.4). */
  const bands = 6, gap = 256 / bands;
  for (let i = 0; i < bands; i++){
    const y0 = i * gap;
    g.beginPath();
    for (let x = 0; x <= 256; x += 4){
      const y = y0 + Math.sin((x / 256) * Math.PI * 2) * 13;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  return finish(c, { repeat:[2, 1.4] });
})();

/* Night arena floor: a soft glowing pattern so the field's boundary reads in
   near-darkness, where it is otherwise nearly the same value as the background.
   An emissive map (glows regardless of scene lighting, same as the Hell
   fissures) rather than relying on ambient light to pick out a flat colour. */
const nightGroundTex = (() => {
  const [c, g] = paint(512, 2);            // 1024px, drawn in 512-space
  const cx = 256, cy = 256, R = 256;
  g.fillStyle = '#16281f'; g.fillRect(0,0,512,512);

  /* Damp mossy ground, lit unevenly. The concentric circles this used to draw
     did define the arena, but they read as a target painted on the grass, and
     anything radial has the same problem — weighting moss toward the rim just
     turns the bullseye into a doughnut. So there is no radial structure at all:
     the arena reads because the whole floor glows against darker ground. */
  // one broad off-centre wash, like moonlight coming in from one side
  const wash = g.createRadialGradient(cx - 70, cy - 90, 30, cx - 70, cy - 90, R * 1.25);
  wash.addColorStop(0,   'rgba(126,196,172,0.20)');
  wash.addColorStop(0.5, 'rgba(96,166,154,0.09)');
  wash.addColorStop(1,   'rgba(30,60,60,0)');
  g.fillStyle = wash; g.fillRect(0,0,512,512);

  // moss clumps scattered evenly over the whole floor (sqrt keeps them
  // area-uniform instead of bunching toward the middle), in a range of sizes
  // so the field looks patchy rather than evenly stippled
  for (let i=0;i<64;i++){
    const a = Math.random()*Math.PI*2, r = R * Math.sqrt(Math.random()) * 0.98;
    const px = cx + Math.cos(a)*r, py = cy + Math.sin(a)*r;
    const spread = 10 + Math.random()*34;
    const bright = 0.14 + Math.random()*0.3;
    for (let k=0;k<3+((Math.random()*5)|0);k++){
      const bx = px + (Math.random()-0.5)*spread, by = py + (Math.random()-0.5)*spread;
      const br = 4 + Math.random()*14;
      const blob = g.createRadialGradient(bx,by,0,bx,by,br);
      blob.addColorStop(0, `rgba(168,236,200,${bright.toFixed(3)})`);
      blob.addColorStop(1, 'rgba(120,200,170,0)');
      g.fillStyle = blob;
      g.beginPath(); g.arc(bx,by,br,0,Math.PI*2); g.fill();
    }
  }
  // a scatter of brighter spores on top
  for (let i=0;i<170;i++){
    const x=Math.random()*512, y=Math.random()*512, r=1+Math.random()*2.6;
    g.fillStyle = `rgba(158,224,192,${0.14+Math.random()*0.3})`;
    g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
  }

  return finish(c);
})();

/* Ground materials for the biomes that replace the meadow's grass. Built once
   and reused: refreshThemeEnvironment runs on every theme change AND on every
   new game / return to menu, so allocating these inline leaked one material
   per visit, each holding onto a compiled shader program. */
const pondGroundMat = new THREE.MeshStandardMaterial({
  color:0x4fb3d9, roughness:0.12, metalness:0.25, transparent:true, opacity:0.85,
  bumpMap: waterRippleTex, bumpScale: 0.18,
});
const candyGroundMat = new THREE.MeshBasicMaterial({ map: candyBgTex });
const lavaGroundMat = new THREE.MeshBasicMaterial({ map: lavaGroundTex });

function refreshThemeEnvironment(th){
  clearThemeFX();
  const mode=th.arena;
  ground.material = mode==='pond' ? mat.water : mat.grass;
  patch.material = mat.grassDark;
  patch.material.roughness = 1; patch.material.metalness = 0;   // hell overrides below, everything else uses this default
  patch.material.map = null; patch.material.needsUpdate = true; // candy/pond/hell re-add their own texture below
  patch.material.emissiveMap = null; patch.material.emissive.setHex(0x000000); patch.material.emissiveIntensity = 1; // hell re-adds its glow below
  // Only hell drops its background field away from the arena slab (see
  // hellSkirt); everywhere else the field is level with it, as before.
  ground.position.y = mode==='hell' ? -HELL_LAVA_DROP : 0;
  border.visible = mode==='meadow';
  pond.visible = mode==='meadow';
  pondRim.visible = mode==='meadow';
  lilyRim.visible = mode==='pond';
  hellSkirt.visible = mode==='hell';
  clouds.forEach(c=>c.visible = mode==='meadow' || mode==='pond');
  pinkClouds.forEach(c=>c.visible = mode==='candy');
  sceneryGroup.visible = mode==='meadow' || mode==='night';   // hidden for pond/candy/hell, which supply their own dressing
  if (themeFxState.stars) themeFxState.stars.visible = mode==='night';

  // helper: true if (x,z) lands outside the arena, with a margin, so background
  // decorations never spawn on top of you. One circle for every biome now — the
  // drawn floor and the playable field are the same shape, so there is no
  // larger ellipse for a prop to hide inside.
  function outsideArena(x, z, margin = 1.4){
    if (mode === 'pond' || mode === 'hell'){
      // match the ACTUAL visible patch (PATCH_R), not the older collision-only
      // ellipse: the gap between them let lily pads spawn where they landed
      // under the patch and never showed, which is why the background read as
      // sparse. Hell needs it for the opposite reason — its slab stands proud
      // of the lava, so a boulder at lava level inside the footprint punches
      // through it.
      return outsidePatch(x, z, margin);
    }
    return Math.hypot(x, z) > PATCH_R + margin;
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
    ground.material = pondGroundMat;
    // Same disc size as every other biome. At 1.35 the water reached ~94 units
    // out, past the top of the frame, so the pond was the one level with no
    // visible horizon — the sky showed only through the water's 0.85 opacity.
    ground.scale.setScalar(1);
    // same pattern as every biome: texture the shared `patch`, sized to ARENA.
    // Each biome having its own slightly different scale made the arena look a
    // different size from level to level.
    patch.scale.set(PATCH_R, PATCH_R, 1);
    patch.material.map = lilyPadTex; patch.material.color.setHex(0xffffff);
    patch.material.needsUpdate = true;
    border.visible=false;
    // mini lily pads across the open water, kept clear of the main pad. Spread
    // tightened toward the camera's visible range so they land on screen rather
    // than scattering into the far distance.
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
    ground.material = candyGroundMat;
    ground.scale.setScalar(1);
    patch.scale.set(PATCH_R, PATCH_R, 1); patch.material.color.setHex(0xffffff);
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
    patch.scale.set(PATCH_R, PATCH_R, 1); patch.material.color.setHex(0xffffff);
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
    ground.material = lavaGroundMat;
    ground.scale.setScalar(1);
    // arena surface: obsidian/basalt with lava fissures baked into the
    // texture, so they're physically part of the arena and can never
    // extend past its edge the way the old free-floating tube curves did
    patch.scale.set(PATCH_R, PATCH_R, 1);
    patch.material.map = obsidianTex; patch.material.color.setHex(0xffffff);
    // Matte, and NOT metallic: metalness on a MeshStandardMaterial with no
    // environment map kills the diffuse and leaves only a specular highlight, so
    // the slab went near-black away from the sun and picked up a sheen toward
    // it — and animate() orbits the sun, so the sheen slid across the arena.
    patch.material.roughness = 0.92; patch.material.metalness = 0;
    patch.material.emissiveMap = obsidianTex;
    patch.material.emissive.setHex(0xff5a1f);
    patch.material.emissiveIntensity = 0.55;
    patch.material.needsUpdate = true;
    border.visible=false;
    // obsidian boulders replace the meadow's trees in the background — planted
    // in the lava field, which now sits below the arena slab
    treeSpots.forEach(([x,z,s]) => makeObsidian(x, z, s*0.9, -HELL_LAVA_DROP));
    for(let i=0;i<8;i++){
      const [x,z] = randomOutside(16, 10, 1.2);
      makeObsidian(x, z, 0.7+Math.random()*1.0, -HELL_LAVA_DROP);
    }
    makeLavaBubbles();
    makeHellMoon();
  } else {
    ground.material=mat.grass; ground.scale.setScalar(1);
    patch.scale.set(PATCH_R, PATCH_R, 1);
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
        b.m.position.y = b.y0 + k*0.35;
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

