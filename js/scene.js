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

/* The sky is a STRIP at the top of the frame, not a screen: the camera looks
   down far enough that the ground disc reaches almost to the horizon, and a
   gradient drawn over the full height puts 97% of itself behind the ground,
   leaving every biome one flat colour. `band` is the strip as a fraction of
   screen height, `aspect` the viewport's — the texture is stretched to fill, so
   a circle needs its x radius divided by the aspect. Ornaments go LOW: the HUD
   covers the top of the strip. */
const SKY_STOPS = [0.00, 0.35, 0.62, 0.82, 1.00];
function makeSkyTexture(colors, mode='gradient', band=0.16, aspect=1.6){
  const c = document.createElement('canvas');
  // 2x supersample: the strip is a few dozen rows and is stretched hard on the
  // way to the screen, so at 1x the stars came out as blocks
  const SS = 2;
  c.width = c.height = 256 * SS;
  const g = c.getContext('2d');
  g.scale(SS, SS);
  // the strip in canvas rows, with a little slack past the horizon so the
  // gradient never ends exactly on the ground edge
  const H = Math.max(6, Math.round(band * 256 * 1.15));
  const sunR = Math.max(1.5, H * 0.30);          // sun radius, in canvas rows
  const round = r => r / Math.max(0.2, aspect);  // rows -> columns, kept circular

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
  // all five stops inside the strip; below it the ground covers everything, so
  // the rest of the canvas is just the horizon colour
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
    // baked in rather than a Points field: a full-screen quad is always on
    // screen, and a sky object at this pitch never lands in the frustum
    for (let i = 0; i < 200; i++){
      const x = Math.random() * 256, y = Math.random() * H * 0.9;
      const r = Math.random() < 0.15 ? 1.5 : 0.7;
      g.globalAlpha = 0.4 + Math.random() * 0.6;
      g.fillStyle = '#ffffff';
      // ellipse, not arc: stretched vertically, round stars are rain streaks
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

/* Where fitCamera parks the camera: pulled back along its own axis until the
   whole platform fits. `follow` shrinks with it — a wide shot does not need
   the camera chasing you. */
const camFit = { x:CAM_BASE.x, y:CAM_BASE.y, z:CAM_BASE.z, follow:1 };

/* Pitch, by how tall the screen is — barely a lean now. The tall end was 46, a
   fix for the RECTANGLE, whose depth a portrait phone squeezed to 92px and a
   catch radius of 14px. On a circle a steep pitch costs twice: it stretches the
   field's depth, and the thumb band under it is a 1:1 copy of that depth (see
   raiseFrame), so the fit ran out of room and shrank the field NARROWER than the
   screen could hold. On a 402x714 phone 46 gives 313x240 jammed at 18% of the
   screen, 34 gives 357x226 at 22%, for 22.1px of catch radius against 20.6.
   Not shallower: 34 is where the field's width maxes out, and by 30 the catch
   radius is at the 18px line fitCamera will not cross. The ramp stays only
   because its wide end IS the base pose exactly, so desktop is untouched. */
const CAM_PITCH_WIDE = Math.atan2(CAM_BASE.y - CAM_LOOK.y, CAM_BASE.z - CAM_LOOK.z);
const CAM_PITCH_TALL = THREE.MathUtils.degToRad(34);
const PITCH_ASPECT = { wide: 1.3, tall: 0.55 };

/* The finger-to-ground mapping, every number derived from where the arena lands
   on screen.

   `touchLift` is how far above the fingertip the capybara stands: a lift of the
   arena's whole projected depth puts the thumb below the play field wherever it
   points, which is what makes pointing usable on a phone at all.

   `touchReachX/Z` are the one place the 1:1 gives, and they buy REACH — at 1:1
   the arena's ends land 14px from the bezel on a 390px phone, inside the OS
   edge-gesture strip, and running out of screen mid-drag can only be undone by
   lifting. TOUCH_MIN_PX is the ceiling on that: past the point where a catch
   radius is smaller than the smallest movement a thumb can place, more reach is
   a control you cannot aim. Reach still wins if they conflict.

   In landscape both cannot be paid for; the lift gives way first, down to what
   leaves the near edge reachable within LIFT_REACH. */
let touchLift = 90, touchReachX = 1, touchReachZ = 1, touchCX = 0, touchCY = 0;
let frameLift = 0;                       // px the whole frame is shifted up by
const LIFT_GAP = 34;                     // clear air between the play field and the thumb
const THUMB_SPAN = { x: 185, z: 120 };   // px the arena should fit inside, per axis
/* THE STRAIN FLOOR IS OFF, and `?strain=1` puts it back. It bought a thumb box
   small enough never to stretch for a corner, and it was the only thing that
   ever scaled the two axes differently — which charged twice: a diagonal drag
   walked up to 18.1 degrees off the line it was aimed at, and every pixel of
   finger travel moved the capybara nearly TWICE as far sideways as the ground
   under it, so a twitch was a real move. A phone settled it, not the harness,
   which models slide, noise and latency but has no notion of stretch. What it
   costs is reach: the thumb box grows from 185px wide to about 320px. */
const STRAIN_FLOOR = /[?&]strain=1/.test(location.search);
const TOUCH_MIN_PX = 11;                 // smallest thumb movement worth aiming with
const REACH_CEIL = 2.2;                  // beyond here is guesswork, not evidence
/* The depth scale the LIFT may assume it can spend. 1.35 was self-defeating:
   the lift took room on the promise of it, which left too little below the
   finger for the near rim, which forced the scale to actually BE 1.35. At 1 the
   lift can only spend what a true 1:1 map pays for. */
const LIFT_REACH = 1.0;

/* The band of screen the platform has to land inside: HUD above, the hint line
   and on a phone the DASH button below. Fractions, because both scale with the
   viewport.
   Touch keeps more of the top, because of raiseFrame: 12% is where the HUD chips
   end, which is right for a platform being FITTED and wrong for one being pushed
   up against it. On a short viewport — a phone's real one is ~714px, not the 844
   the hardware claims, once browser chrome is out — the raise took all 12% and
   pinned the field under the score chips. At 18% it stops short and the fit pays
   the difference in platform size, which is the better trade. */
const FIT_TOP = 0.12, FIT_TOP_TOUCH = 0.18, FIT_BOTTOM = 0.95, FIT_SIDE = 0.02;
const fitTop = () => window.innerHeight * (TOUCH ? FIT_TOP_TOUCH : FIT_TOP);

function poseAt(zoom, aspect){
  const base = Math.hypot(CAM_BASE.y - CAM_LOOK.y, CAM_BASE.z - CAM_LOOK.z);
  const dist = base * zoom;
  const t = THREE.MathUtils.clamp(
    (PITCH_ASPECT.wide - aspect) / (PITCH_ASPECT.wide - PITCH_ASPECT.tall), 0, 1);
  const pitch = CAM_PITCH_WIDE + (CAM_PITCH_TALL - CAM_PITCH_WIDE) * t;
  camFit.x = CAM_BASE.x;
  camFit.y = CAM_LOOK.y + Math.sin(pitch) * dist;
  camFit.z = CAM_LOOK.z + Math.cos(pitch) * dist;
  camFit.follow = 1 / zoom;
}

/* FIT THE WHOLE PLATFORM, width AND depth, as large as both allow. Fitting
   width alone was right for a rectangle two units wide per unit deep — depth
   never ran out first, so it was never checked — but a circle is as deep as it
   is wide, and on 16:9 the near rim landed below the bottom of the window with
   the opening beats of a route off screen.
   The answer is the SMALLEST zoom that satisfies the predicate, since a smaller
   zoom is a larger arena. Bisected, not stepped: stepping up by a fixed ratio
   overshoots by that ratio every pass, measured as a field a sixth smaller than
   it needed to be. Monotone in zoom, so twenty halvings land exactly. */
function fitCamera(){
  const aspect = window.innerWidth / window.innerHeight;
  const W = window.innerWidth, H = window.innerHeight;
  const top = fitTop(), bottom = H * FIT_BOTTOM, side = W * FIT_SIDE;
  frameLift = 0; applyFrameLift();       // the fit measures the unshifted frame

  const fits = zoom => {
    poseAt(zoom, aspect);
    if (groundY(0, PATCH_R) > bottom) return false;      // near rim below the band
    if (groundY(0, -PATCH_R) < top) return false;        // far rim above it
    if (Math.abs(groundX(PATCH_R, 0) - groundX(0, 0)) > W / 2 - side) return false;
    /* On touch the platform is not the only thing that has to fit: the thumb
       needs a band as tall as the arena's image below it (see raiseFrame), and
       the frame shift only buys what the HUD band leaves — a 1024px tablet ran
       291px short with the frame as high as it would go. So the platform gives
       way too, but only to where a catch radius stops reading up the screen. On
       a phone this costs nothing: the shift alone pays for the band. */
    if (!TOUCH) return true;
    const b = thumbBand();
    return b.need <= b.room || catchPx() <= CATCH_MIN_PX;
  };

  let lo = 0.45, hi = 4.0;
  if (!fits(hi)) hi = 6.0;                               // a viewport nothing fits
  if (fits(lo)) hi = lo;
  else for (let i = 0; i < 20; i++){
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid; else lo = mid;
  }
  poseAt(hi, aspect);
  raiseFrame();
  refreshTouchMap();
  refreshSky();
}

/* HOW HIGH THE PLATFORM RIDES — a screen shift, on touch only.

   The lift below promises the thumb sits entirely BELOW the play field, and a
   circular arena stopped paying for it: on a 390x844 phone `most` came out 108
   against an `ideal` of 299 and the hand covered the bottom 148px of a 265px
   arena — the near half of the field, where the next beats are read. The band a
   thumb needs is as tall as the arena's own image, because the map is 1:1 and
   nothing may buy that back with a gain, so the platform has to move UP.

   It moves as a LENS SHIFT, not a camera move. An off-axis frustum shifts top
   and bottom together, which drops out of ndc y as a constant, so the projection
   translates RIGIDLY — every world point lands `frameLift` px higher and the
   arena keeps the size and perspective the fit chose. Sliding the rig back also
   raises the image, but by moving further away: 5 units bought 115px of raise
   and spent 18% of the platform's depth. Nothing else has to know — raycasting
   unprojects through the same matrix and the probe mirrors it, so groundX/Y, the
   touch map and the HUD projections all read the shifted screen.

   What it costs is at the TOP: food spawns at SPAWN_Y and enters the window
   `frameLift` px later down its fall, the last ~7 units of 15 over the far rim.
   The ribbon and the landing rings are the read on a phone, and both are on the
   ground where the shift puts them in the clear.

   Clamped to FIT_TOP_TOUCH. Where that cuts the shift short — a 320x568, or
   landscape with DASH eating the bottom third — the thumb keeps what is left,
   which is still more than it had. */
/* `need` is exactly what refreshTouchMap's `most` is short of its `ideal`, in px
   of frame shift; `room` is what the HUD band leaves to shift into. One function
   so the two readers cannot drift.

   HAND_TOLERANCE is how much of the field the hand may still cover. At zero the
   platform framed too high — far rim under the HUD, bottom 45% of a phone bare,
   play-tested as "a bit too high". A quarter of the depth drops it 66px on a
   390x844 and hands back the nearest 24px, 9% of the field, at the rim furthest
   from where a route is read. What is bought off is a hand over a large part of
   the screen, not the last pixel. */
const HAND_TOLERANCE = 0.25;
function thumbBand(){
  const cy = groundY(0, 0);
  const hNear = groundY(0, ARENA.r) - cy, hFar = cy - groundY(0, -ARENA.r);
  const band = (hNear + hFar) * (1 - HAND_TOLERANCE) + LIFT_GAP;
  return { need: cy + hNear / LIFT_REACH + band - thumbFloor(),
           room: groundY(0, -PATCH_R) - fitTop() };
}
// the catch radius as it reads UP the screen, which is what a smaller platform
// spends. 14px was measured as "you cannot see whether you are on the dot".
const CATCH_MIN_PX = 18;
function catchPx(){
  return CATCH_R * Math.hypot(groundX(0, 1) - groundX(0, 0),
                              groundY(0, 1) - groundY(0, 0));
}
function applyFrameLift(){
  const W = window.innerWidth, H = window.innerHeight;
  if (frameLift > 0.5) camera.setViewOffset(W, H, 0, frameLift, W, H);
  else camera.clearViewOffset();
}
function raiseFrame(){
  frameLift = 0; applyFrameLift();       // measure the frame the fit chose
  if (!TOUCH) return;
  const b = thumbBand();
  frameLift = THREE.MathUtils.clamp(b.need, 0, Math.max(0, b.room));
  applyFrameLift();
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
  // the same lens shift the real camera carries, or every px this measures is
  // one the player is not looking at
  if (frameLift > 0.5)
    _skyProbe.setViewOffset(window.innerWidth, window.innerHeight, 0, frameLift,
                            window.innerWidth, window.innerHeight);
  else _skyProbe.clearViewOffset();
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
/* The lowest y a steering finger may be asked to reach. The bottom margin is
   the home indicator; the DASH button is a harder edge than any margin because
   it eats the touch outright, and the arena spans nearly the full width, so on
   a short screen a near corner lands squarely on it and cannot be steered to.
   Measured off the live button rather than assumed, so it follows the CSS and
   whichever side setDashSide put it on. Shared with raiseFrame. */
function thumbFloor(){
  const H = window.innerHeight;
  let bottom = H - THREE.MathUtils.clamp(H * 0.06, 30, 64);
  const dash = document.getElementById('btnDash')?.getBoundingClientRect();
  // the field's near corners are at 45 degrees on a circle, not at a corner,
  // and the button may be under either one — see setDashSide
  const diag = ARENA.r * Math.SQRT1_2;
  if (dash && dash.height > 0 &&
      groundX(diag, diag) > dash.left && groundX(-diag, diag) < dash.right)
    bottom = Math.min(bottom, dash.top - 10);
  return bottom;
}
function refreshTouchMap(){
  const W = window.innerWidth, H = window.innerHeight;
  // margins the finger should never have to cross: the sides belong to the
  // OS edge gestures, the bottom to the home indicator, the top to the HUD
  const EDGE = THREE.MathUtils.clamp(W * 0.09, 24, 48);
  const TOP  = THREE.MathUtils.clamp(H * 0.08, 44, 110);
  const bottom = thumbFloor();

  touchCX = groundX(0, 0);
  touchCY = groundY(0, 0);
  /* On a circle the extremes are on the axes: widest at z=0, nearest and
     furthest at x=0. (On the old rectangle the widest point was a near corner,
     which is why this used to read halfX,halfZ.) */
  const hx = Math.abs(groundX(ARENA.r, 0) - touchCX);
  const hNear = groundY(0, ARENA.r) - touchCY;
  const hFar  = touchCY - groundY(0, -ARENA.r);

  /* As much lift as the room below allows. `ideal` is the whole play field plus
     clear air, which is what puts the hand below it; raiseFrame has already
     shifted the frame so `most` can pay for it, as far as the HUD band allows.
     No ceiling: the old 240px was the only thing still putting the hand on the
     field once the frame rode high enough, 240 against an ideal of 299. */
  const ideal = (hNear + hFar) + LIFT_GAP;
  const most  = bottom - touchCY - hNear / LIFT_REACH;
  touchLift = Math.max(30, Math.min(ideal, most));

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
  // a strain of 0 drops out of the Math.min/Math.max above, leaving reach alone
  const strainX = STRAIN_FLOOR ? (hx * 2) / THUMB_SPAN.x : 0;
  const strainZ = STRAIN_FLOOR ? (hNear + hFar) / THUMB_SPAN.z : 0;
  const wantX = fit(hx / Math.max(1, W / 2 - EDGE), strainX, perX);
  const wantZ = fit(Math.max(hNear / down, hFar / up), strainZ, perZ);

  /* ONE REACH, BOTH AXES, which is what a circular arena earns. Fitted
     separately — the old rule, when the arena was 2:1 and only width strained —
     they came out 1 and 1.35, a 0.74x skew that walked a diagonal up to 8.6
     degrees off the line it was aimed at on every viewport, and cost real
     catches against the modelled thumb. The larger of the two satisfies both
     constraints by construction and makes the skew exactly zero. What it costs
     is thumb-box width; `--touch` asserts every rim point stays reachable. */
  touchReachX = touchReachZ = Math.max(wantX, wantZ);
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
// the camera does not need to be in the graph to render, but its children (the
// sky rig) do need it there to be transformed
scene.add(camera);

/* "Sky rig" — clouds, stars and the sun/moon disc, in coordinates relative to
   the camera (small Y, forward = -Z): the camera looks down steeper than its own
   half-FOV, so anything at a fixed WORLD height above it is outside the view
   cone and never renders. It is a child of the SCENE, not the camera — animate()
   copies only the camera's POSITION onto it. Parented to the camera, the sky
   inherited the small rotation of tracking you sideways and every cloud swam. */
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

// a soft warm light following the capybara, Night only, where the ambient and
// sun levels are deliberately low. Keep the offset small: at 2.4-3.5 units the
// bright falloff circle visibly separated from the animal it was lighting.
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

