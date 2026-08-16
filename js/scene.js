/* =======================================================================
   RENDERER / SCENE
   ======================================================================= */
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// --- gradient sky as a background texture -------------------------------
const SKY_STOPS = [0.00, 0.35, 0.62, 0.82, 1.00];
function makeSkyTexture(colors, mode='gradient'){
  const c = document.createElement('canvas');
  c.width = (mode === 'candy' || mode === 'night') ? 256 : 8; c.height = 256;
  const g = c.getContext('2d');
  if (mode === 'candy'){
    // base: the SAME smooth vertical gradient every other theme uses, so
    // the stripes have something coherent to sit on top of instead of a
    // flat fill — that flat-vs-gradient mismatch was the "clash" at the
    // horizon (a hard-edged diagonal band cutting across a solid color)
    const base = g.createLinearGradient(0, 0, 0, 256);
    colors.forEach((col, i) => base.addColorStop(SKY_STOPS[i], col));
    g.fillStyle = base; g.fillRect(0, 0, c.width, c.height);
    // stripes drawn at partial opacity so the base gradient still shows
    // through — reads as "candy-striped sky," not "stripes over a sky"
    g.globalAlpha = 0.42;
    for (let y = -100; y < 356; y += 58){
      g.save();
      g.translate(128, y);
      g.rotate(-0.16);
      const grd = g.createLinearGradient(-190, 0, 190, 0);
      grd.addColorStop(0, colors[1]); grd.addColorStop(0.5, colors[3]); grd.addColorStop(1, colors[2]);
      g.fillStyle = grd; g.fillRect(-190, -16, 380, 32);
      g.restore();
    }
    g.globalAlpha = 1;
  } else if (mode === 'night'){
    // stars baked directly into the sky texture instead of relying on a
    // 3D particle field. scene.background is a full-screen quad that's
    // always fully visible regardless of camera position/rotation — a
    // real 3D Points object, by contrast, has to actually fall inside the
    // camera's view frustum, and this camera's pitch changes a lot with
    // phone aspect ratio (steeper on narrow screens), so a 3D star field
    // was unreliable and often just didn't appear. Baking them into the
    // texture sidesteps that: they're guaranteed on screen every time.
    const grd = g.createLinearGradient(0, 0, 0, 256);
    colors.forEach((col, i) => grd.addColorStop(SKY_STOPS[i], col));
    g.fillStyle = grd; g.fillRect(0, 0, c.width, 256);
    // concentrate stars in the upper 70% — keeps the lower sky (near the
    // horizon/treeline) clean and readable
    for (let i = 0; i < 260; i++){
      const x = Math.random() * c.width, y = Math.random() * 180;
      const r = Math.random() < 0.15 ? 1.6 : 0.7;
      g.globalAlpha = 0.45 + Math.random() * 0.55;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  } else {
    const grd = g.createLinearGradient(0, 0, 0, 256);
    colors.forEach((col, i) => grd.addColorStop(SKY_STOPS[i], col));
    g.fillStyle = grd; g.fillRect(0, 0, c.width, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
scene.background = makeSkyTexture(THEMES[0].sky, THEMES[0].skyMode);
scene.fog = new THREE.Fog(THEMES[0].fog, 26, 74);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth/window.innerHeight, 0.1, 220);
const CAM_BASE = new THREE.Vector3(0, 10.6, 13.4);
const CAM_LOOK = new THREE.Vector3(0, 1.6, -0.6);

/* On a phone (especially portrait) the default framing cuts off the ends of
   the arena, so we pull the camera straight back along its own axis until the
   full play field fits horizontally, with a little margin for landing rings.
   `follow` shrinks too — a wide shot doesn't need the camera chasing you. */
const camFit = { x:CAM_BASE.x, y:CAM_BASE.y, z:CAM_BASE.z, follow:1 };
const FIT_MARGIN = 1.6;

function fitCamera(){
  const aspect = window.innerWidth / window.innerHeight;
  const need = ARENA.halfX + FIT_MARGIN;
  // half-width visible at the arena's distance with the current framing
  const dist = Math.hypot(CAM_BASE.y - CAM_LOOK.y, CAM_BASE.z - CAM_LOOK.z);
  const halfH = dist * Math.tan(THREE.MathUtils.degToRad(BASE_FOV) / 2);
  const halfW = halfH * aspect;
  const zoom = THREE.MathUtils.clamp(need / halfW, 1, 2.6);
  camFit.x = CAM_BASE.x;
  camFit.y = CAM_LOOK.y + (CAM_BASE.y - CAM_LOOK.y) * zoom;
  camFit.z = CAM_LOOK.z + (CAM_BASE.z - CAM_LOOK.z) * zoom;
  camFit.follow = 1 / zoom;
}

camera.position.copy(CAM_BASE);
camera.lookAt(CAM_LOOK);
// the camera never gets added to `scene` by default (renderer.render(scene,
// camera) doesn't need it to be), but we DO need it in the graph so that
// camera-local children (the sky rig below) get transformed and rendered
scene.add(camera);

/* "Sky rig" — clouds, stars, and the sun/moon disc all live here, using
   coordinates chosen relative to the camera (small Y, "forward" = -Z)
   instead of fixed world height. The camera looks down at roughly 33°,
   steeper than its own half-FOV (26°), so anything placed at a fixed
   WORLD height above the camera (like the old y:15-44 values) was
   mathematically outside the view cone and never rendered.
   Crucially, this rig is a child of the SCENE, not the camera — every
   frame we copy just the camera's *position* onto it (see animate()).
   Parenting it to the camera directly was tried first, but the camera's
   rotation shifts slightly as it tracks you sideways, and the whole sky
   inherited that rotation — every cloud visibly swam/orbited with your
   small movements. Position-only following avoids that: the rig
   translates along with the camera so things stay framed, but doesn't
   rotate, so it holds still the way a real sky should. */
const skyRig = new THREE.Group();
scene.add(skyRig);

/* ---------------------------- lighting -------------------------------- */
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6b7a3a, 0.62);
scene.add(hemi);

const ambient = new THREE.AmbientLight(0xffe8cc, 0.34);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffd9a8, 2.15);
sun.position.set(-11, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 95;
// wide enough that food still casts shadows high up in its fall
sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
sun.shadow.camera.top = 26;   sun.shadow.camera.bottom = -24;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(sun.target);
sun.target.position.set(0, 0, 0);

// cool rim light from the back for shape separation
const rim = new THREE.DirectionalLight(0x88bbff, 0.5);
rim.position.set(7, 6, -12);
scene.add(rim);

// a soft warm light that follows the capybara — only used for the Night
// biome, where the ambient/hemi/sun levels are intentionally low for mood
// and something needs to keep the arena readable up close.
// A small offset (not directly overhead) rakes across the model for some
// shading definition, but keep it small — the first version used a 2.4-3.5
// unit offset, which pushed the light's bright falloff circle far enough
// off the capybara's actual position that the two visibly separated on
// screen ("offset from player model"). This stays close enough that the
// falloff circle still centers on the character.
const nightLight = new THREE.PointLight(0xd8e4ff, 0, 15, 1.5);
nightLight.position.set(0, 3.4, 0.6);
scene.add(nightLight);
// a second, dimmer fill from the front-low so the underside isn't pitch black
const nightFill = new THREE.PointLight(0x9fb8e8, 0, 10, 1.7);
nightFill.position.set(0, 0.7, 1.0);
scene.add(nightFill);

// visible sun disc — local camera space, see skyRig note above
const sunDisc = new THREE.Mesh(
  new THREE.SphereGeometry(2.1, 24, 16),
  new THREE.MeshBasicMaterial({ color:0xfff0c0, fog:false })
);
sunDisc.position.set(-9, 6, -40);
skyRig.add(sunDisc);
const sunHalo = new THREE.Mesh(
  new THREE.SphereGeometry(3.4, 24, 16),
  new THREE.MeshBasicMaterial({ color:0xffd070, transparent:true, opacity:0.22, fog:false })
);
sunHalo.position.copy(sunDisc.position);
skyRig.add(sunHalo);

