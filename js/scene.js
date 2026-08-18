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

/* --- gradient sky as a background texture -------------------------------
   The camera looks down at ~33 degrees with a 26-degree half-FOV, so the
   background ground disc reaches nearly to the true horizon and the sky is
   only ever a STRIP at the top of the frame — measured at 3.2% of screen
   height on a desktop aspect and 16.5% on a phone. Everything below is drawn
   into that strip rather than across the full texture. Spread over the whole
   height, 97% of the gradient sat behind the ground and every biome's sky
   read as one flat colour, and the sun and clouds — real 3D objects in the
   sky rig — projected to NDC y 1.5-1.8 and were never in frustum on any
   aspect, phone or desktop.

   `band` is that strip as a fraction of screen height and `aspect` is the
   viewport's, both supplied by refreshSky() below; the background texture is
   stretched to fill the viewport, so a circle drawn here needs its x radius
   divided by the aspect to come out round on screen. */
const SKY_STOPS = [0.00, 0.35, 0.62, 0.82, 1.00];
function makeSkyTexture(colors, mode='gradient', band=0.16, aspect=1.6){
  const c = document.createElement('canvas');
  // Drawn in a 256 coordinate space but rendered at 2x. The strip is only a
  // few dozen rows tall and gets stretched several times over on the way to
  // the screen, so at 1x the stars came out as blocks.
  const SS = 2;
  c.width = c.height = 256 * SS;
  const g = c.getContext('2d');
  g.scale(SS, SS);
  // the strip in canvas rows, with a little slack past the horizon so the
  // gradient never ends exactly on the ground edge
  const H = Math.max(6, Math.round(band * 256 * 1.15));
  const sunR = Math.max(1.5, H * 0.30);          // sun radius, in canvas rows
  const round = r => r / Math.max(0.2, aspect);  // rows -> columns, kept circular

  // Ornaments sit LOW in the strip, just above the horizon: the HUD panels
  // occupy the top of it, and the band under them is the only sky a player
  // ever actually sees.
  const drawSun = (x, y, r, core, halo) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 3.2);
    gr.addColorStop(0, halo); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(x, y); g.scale(1 / Math.max(0.2, aspect), 1);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 3.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = core; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  const drawClouds = (tint, n) => {
    g.fillStyle = tint;
    for (let i = 0; i < n; i++){
      const cx = (i + 0.5) / n * 256 + (i % 2 ? 14 : -14);
      const cy = H * (0.42 + (i % 3) * 0.13);
      const rw = round(H * 0.5) * (1.6 + (i % 3) * 0.5), rh = H * 0.13;
      g.beginPath();
      g.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
      g.ellipse(cx + rw * 0.5, cy + rh * 0.3, rw * 0.6, rh * 0.8, 0, 0, Math.PI * 2);
      g.fill();
    }
  };
  // The full five-stop gradient, compressed into the strip. Below it the
  // ground covers everything, so the rest of the canvas just holds the
  // horizon colour rather than wasting the other four stops on rows no
  // camera in this game will ever show.
  const grd = g.createLinearGradient(0, 0, 0, H);
  colors.forEach((col, i) => grd.addColorStop(SKY_STOPS[i], col));
  g.fillStyle = grd; g.fillRect(0, 0, 256, H);
  g.fillStyle = colors[colors.length - 1];
  g.fillRect(0, H - 1, 256, 256 - H + 1);

  if (mode === 'candy'){
    // stripes drawn at partial opacity so the base gradient still shows
    // through — reads as "candy-striped sky," not "stripes over a sky"
    g.globalAlpha = 0.38;
    const gap = Math.max(4, H * 0.5);
    for (let y = -H; y < H * 2; y += gap){
      g.save();
      g.translate(128, y);
      g.rotate(-0.16);
      const st = g.createLinearGradient(-190, 0, 190, 0);
      st.addColorStop(0, colors[1]); st.addColorStop(0.5, colors[3]); st.addColorStop(1, colors[2]);
      g.fillStyle = st; g.fillRect(-190, -gap * 0.26, 380, gap * 0.52);
      g.restore();
    }
    g.globalAlpha = 1;
    drawClouds('rgba(255,244,251,0.7)', 4);
    drawSun(66, H * 0.76, sunR, '#fff2fb', 'rgba(255,190,228,0.5)');
  } else if (mode === 'night'){
    // Stars are baked in here rather than left to a 3D particle field for
    // exactly the reason above: a full-screen quad is always on screen, a
    // Points object has to land in the frustum, and this one never does.
    for (let i = 0; i < 200; i++){
      const x = Math.random() * 256, y = Math.random() * H * 0.9;
      const r = Math.random() < 0.15 ? 1.5 : 0.7;
      g.globalAlpha = 0.4 + Math.random() * 0.6;
      g.fillStyle = '#ffffff';
      // ellipse, not arc: the strip is stretched hard vertically on a phone,
      // and round stars came out as rain streaks
      g.beginPath(); g.ellipse(x, y, round(r), r, 0, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // a moon reads much larger than a sun at the same size against a dark sky
    drawSun(196, H * 0.7, sunR * 0.42, '#e9f1ff', 'rgba(150,180,255,0.22)');
  } else if (mode === 'hell'){
    drawSun(72, H * 0.72, sunR * 1.05, '#ff8a3a', 'rgba(255,92,20,0.45)');
  } else {
    drawClouds('rgba(255,255,255,0.75)', 4);
    drawSun(60, H * 0.74, sunR, '#fff4cf', 'rgba(255,212,138,0.55)');
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

/* Pitch, by how tall the screen is.

   The arena is twice as wide as it is deep, so fitting its WIDTH is what sets
   the camera distance, and on a portrait phone that distance leaves the play
   field a 371x92px strip: eight and a half units of depth inside 92 pixels,
   which puts the catch radius at 14px measured up the screen. You cannot see
   whether you are on the dot, and no input scheme fixes that.

   A tall screen has hundreds of pixels of unused height above and below that
   strip, and pitching the camera down spends them on depth without moving the
   camera any closer: at 46 degrees the same arena is 120px deep and the catch
   radius reads 18px. It is gated on aspect and the wide end is the original
   pose to the last decimal, so every desktop framing is untouched. */
const CAM_PITCH_WIDE = Math.atan2(CAM_BASE.y - CAM_LOOK.y, CAM_BASE.z - CAM_LOOK.z);
const CAM_PITCH_TALL = THREE.MathUtils.degToRad(46);
const PITCH_ASPECT = { wide: 1.3, tall: 0.55 };

/* The finger-to-ground mapping, all of it derived from where the arena
   actually lands on screen.

   `touchLift` is how far above the fingertip the capybara stands: a lift of
   the arena's own projected depth puts the thumb entirely below the play field
   wherever it is pointing, which is the whole reason pointing is usable on a
   phone.

   `touchReachX/Z` are why the mapping is not 1:1, and they answer two separate
   complaints with the same lever.

   REACH. At 1:1 the arena's ends land where they are drawn, and on a
   390px-wide phone that is 14px from the bezel — inside the OS edge-gesture
   strip. Running out of screen mid-drag is the worst thing that can happen to
   an absolute scheme, because the only way out is to lift and re-place, which
   moves the capybara somewhere nobody asked for.

   STRAIN. Cost is not distance travelled, it is how far the thumb has to
   stretch from where it rests, and at 1:1 the arena is a 321x109px box — twice
   what a thumb sweeps without moving the whole hand. Fitting the play field
   into THUMB_SPAN on each axis is what that floor is for.

   PER AXIS, because the arena is 2:1 and the two axes are in opposite
   trouble. Width is what strains (321px of a 390px screen); depth is already
   inside a comfortable sweep at 109px and is the axis whose precision is worse
   to begin with — 16px of thumb per catch radius against 22px across. One
   uniform scale big enough to fix the width would spend that depth precision
   for nothing. Scaling them apart leaves the mapping exactly absolute — every
   point still resolves to one place on the ground, corners included — it is
   only anisotropic, which is what a separate X/Y sensitivity has always been.

   TOUCH_MIN_PX is the ceiling and the reason there is one: past the point
   where a catch radius is smaller than the smallest movement a thumb can
   place, more sensitivity is not more reach, it is a control you cannot aim.
   Reach beats it if they ever conflict — an unreachable corner is worse than
   an imprecise one.

   The lift and the depth scale trade against each other in landscape, where
   the arena sits low and there is no room for both: the lift gives way first,
   down to whatever still leaves the near edge reachable within LIFT_REACH. */
let touchLift = 90, touchReachX = 1, touchReachZ = 1, touchCX = 0, touchCY = 0;
const THUMB_SPAN = { x: 185, z: 120 };   // px the arena should fit inside, per axis
const TOUCH_MIN_PX = 11;                 // smallest thumb movement worth aiming with
const REACH_CEIL = 2.2;                  // beyond here is guesswork, not evidence
const LIFT_REACH = 1.35;                 // depth scale the lift may assume it can spend

function fitCamera(){
  const aspect = window.innerWidth / window.innerHeight;
  const need = ARENA.halfX + FIT_MARGIN;
  // half-width visible at the arena's distance with the current framing
  const base = Math.hypot(CAM_BASE.y - CAM_LOOK.y, CAM_BASE.z - CAM_LOOK.z);
  const halfH = base * Math.tan(THREE.MathUtils.degToRad(BASE_FOV) / 2);
  const halfW = halfH * aspect;
  const zoom = THREE.MathUtils.clamp(need / halfW, 1, 2.6);
  const dist = base * zoom;
  const t = THREE.MathUtils.clamp(
    (PITCH_ASPECT.wide - aspect) / (PITCH_ASPECT.wide - PITCH_ASPECT.tall), 0, 1);
  const pitch = CAM_PITCH_WIDE + (CAM_PITCH_TALL - CAM_PITCH_WIDE) * t;
  camFit.x = CAM_BASE.x;
  camFit.y = CAM_LOOK.y + Math.sin(pitch) * dist;
  camFit.z = CAM_LOOK.z + Math.cos(pitch) * dist;
  camFit.follow = 1 / zoom;
  refreshTouchMap();
  refreshSky();
}

/* A scratch camera posed at camFit rather than the live one, because animate()
   only moves the real camera onto camFit on the next frame and fitCamera runs
   before that — so anything fitCamera needs to measure has to be measured
   against the pose it just chose. Both the sky band and the touch lift do. */
const _skyProbe = new THREE.PerspectiveCamera();
const _probePt = new THREE.Vector3();
function poseProbe(){
  _skyProbe.fov = camera.fov;
  _skyProbe.near = camera.near; _skyProbe.far = camera.far;
  _skyProbe.aspect = window.innerWidth / window.innerHeight;
  _skyProbe.position.set(camFit.x, camFit.y, camFit.z);
  _skyProbe.lookAt(CAM_LOOK);
  _skyProbe.updateMatrixWorld(true);
  _skyProbe.updateProjectionMatrix();
  return _skyProbe;
}
// where a point on the ground lands on screen, in px from the top left
function groundX(x, z){
  _probePt.set(x, 0, z).project(poseProbe());
  return (_probePt.x + 1) / 2 * window.innerWidth;
}
function groundY(x, z){
  _probePt.set(x, 0, z).project(poseProbe());
  return (1 - _probePt.y) / 2 * window.innerHeight;
}
/* How much of the screen is sky, as a fraction of its height — the boundary
   is the far edge of the background ground disc, not the true horizon, which
   sits off the top of the frame at this pitch. */
function skyBand(){
  const r = 60 * (typeof ground === 'undefined' ? 1 : ground.scale.x);
  const p = _probePt.set(0, 0, -r).project(poseProbe());
  return THREE.MathUtils.clamp((1 - p.y) / 2, 0.03, 0.6);
}
function refreshTouchMap(){
  const W = window.innerWidth, H = window.innerHeight;
  // margins the finger should never have to cross: the sides belong to the
  // OS edge gestures, the bottom to the home indicator, the top to the HUD
  const EDGE = THREE.MathUtils.clamp(W * 0.09, 24, 48);
  const TOP  = THREE.MathUtils.clamp(H * 0.08, 44, 110);
  let bottom = H - THREE.MathUtils.clamp(H * 0.06, 30, 64);
  /* The DASH button is the other thing the finger must not have to reach, and
     it is a harder edge than any margin: it eats the touch outright. It sits
     bottom-right, the arena spans nearly the full width, so on a short screen
     the arena's near-right corner lands squarely on it and that corner simply
     cannot be steered to. Measured off the live button rather than assumed, so
     it keeps up with the CSS; hidden on desktop, where the rect is empty. */
  const dash = document.getElementById('btnDash')?.getBoundingClientRect();
  const arenaRight = groundX(ARENA.halfX, ARENA.halfZ);
  if (dash && dash.height > 0 && arenaRight > dash.left) bottom = Math.min(bottom, dash.top - 10);

  touchCX = groundX(0, 0);
  touchCY = groundY(0, 0);
  // the widest the arena gets is at its near corners, not its middle
  const hx = Math.abs(groundX(ARENA.halfX, ARENA.halfZ) - touchCX);
  const hNear = groundY(0, ARENA.halfZ) - touchCY;
  const hFar  = touchCY - groundY(0, -ARENA.halfZ);

  // as much lift as the room below allows, once the near edge is guaranteed
  // reachable within the depth scale the lift is allowed to spend
  const ideal = (hNear + hFar) + 34;
  const most  = bottom - touchCY - hNear / LIFT_REACH;
  touchLift = THREE.MathUtils.clamp(Math.min(ideal, most), 30, 240);

  const down = Math.max(1, bottom - (touchCY + touchLift));
  const up   = Math.max(1, (touchCY + touchLift) - TOP);
  // px of screen per world unit, for the precision ceiling
  const perX = Math.abs(groundX(1, 0) - groundX(0, 0));
  const perZ = Math.hypot(groundX(0, 1) - groundX(0, 0), groundY(0, 1) - groundY(0, 0));

  /* Three constraints per axis, in priority order: the margins MUST be cleared,
     the strain floor is taken where precision allows, and 1:1 is the floor
     under all of it. */
  const fit = (need, strain, catchPx) => Math.min(REACH_CEIL,
    Math.max(1, need, Math.min(strain, (CATCH_R * catchPx) / TOUCH_MIN_PX)));
  touchReachX = fit(hx / Math.max(1, W / 2 - EDGE), (hx * 2) / THUMB_SPAN.x, perX);
  touchReachZ = fit(Math.max(hNear / down, hFar / up),
                    (hNear + hFar) / THUMB_SPAN.z, perZ);
}

/* Repaint the sky for the current theme, framing and viewport. Cheap enough
   to run on every resize — one 256x256 canvas — and it has to, because both
   the strip's height and the aspect correction change with the viewport. */
function refreshSky(){
  if (typeof curTheme === 'undefined') return;      // pre-boot, theme.js not up yet
  scene.background?.dispose();
  scene.background = makeSkyTexture(curTheme.sky, curTheme.skyMode,
                                    skyBand(), window.innerWidth / window.innerHeight);
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

