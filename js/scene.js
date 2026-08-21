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

/* Pitch, by how tall the screen is — and it barely leans any more.

   The tall end was 46 degrees, and it was a fix for the RECTANGLE. That arena
   was twice as wide as it was deep, so fitting its width set the camera
   distance and left a portrait phone a 371x92px strip: eight and a half units
   of depth inside 92 pixels, a catch radius of 14px measured up the screen,
   and no way to see whether you were on the dot. Pitching down to 46 spent the
   unused height above and below on depth and took it to 18px.

   A circle is as deep as it is wide, so that premise is gone, and 46 had
   turned into a tax paid twice. The steep angle stretches the field's depth
   across the screen, and the thumb band under it is a 1:1 copy of that depth
   (see raiseFrame), so every pixel of pitch cost two — until the phone ran out
   of room, the fit shrank the arena to get it back, and the field ended up
   NARROWER than the screen could hold. Measured on a 402x714 phone: at 46 the
   field is 313x240 with its top jammed at 18% of the screen; at 34 it is
   357x226 at 22%, which is 14% wider, lower down, and with more of the biome
   behind it. The catch radius goes the other way, 22.1px up the screen to
   20.6 — the axis being spent is the one the tilt is buying room on, which is
   the whole reason this is the right lever and shrinking the arena is not.

   34 rather than shallower because that is where the field's WIDTH maxes out
   on a phone; past it the tilt only foreshortens, and by 30 the catch radius
   is at the 18px line that fitCamera will not cross. It is barely a lean now —
   the desktop pose is 32.7 and has always drawn the ribbon, the falling food
   and a tall head-stack legibly at that angle, so a phone at 34 is not a new
   regime. The ramp stays only because the wide end IS the original pose to the
   last decimal, so every desktop framing is untouched. */
const CAM_PITCH_WIDE = Math.atan2(CAM_BASE.y - CAM_LOOK.y, CAM_BASE.z - CAM_LOOK.z);
const CAM_PITCH_TALL = THREE.MathUtils.degToRad(34);
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
let frameLift = 0;                       // px the whole frame is shifted up by
const LIFT_GAP = 34;                     // clear air between the play field and the thumb
const THUMB_SPAN = { x: 185, z: 120 };   // px the arena should fit inside, per axis
/* THE STRAIN FLOOR IS OFF. It bought one thing — an arena small enough on
   screen that a thumb never stretched for a corner — and it was the only reason
   the two axes ever scaled differently. It charged two, and the second is the
   one that took longest to name:

     ANGLE. At 1.96 across against 1.03 deep, a diagonal drag walked up to 18.1
     degrees off the line it was aimed at. Straight lines still looked right,
     which is why nothing ever appeared broken, and most shapes here are
     diagonal traversals.

     GAIN, which is what a player actually feels. Every pixel of finger travel
     moved the capybara nearly TWICE as far sideways as the ground under the
     finger, so a small correction was a big one and a twitch was a real move.
     Play-tested, the words were "small movements could easily over adjust" and
     "this one just goes where you point" — a 1:1 map has no such gap between
     where you point and where it goes, and none of the aim is spent undoing
     the amplification.

   The harness never could settle this: --touch models slide speed, placement
   noise and look latency, and has no notion of stretch, so it prices what the
   floor charged and nothing it bought. What decided it was a phone. Off, it
   reads more precise and clears more routes — and it costs reach, which is the
   honest trade: the thumb box grows from 185px wide to about 320px on a 390px
   screen, which an index finger on the free hand does not care about and a
   one-handed thumb might. `?strain=1` puts the floor back for that comparison. */
const STRAIN_FLOOR = /[?&]strain=1/.test(location.search);
const TOUCH_MIN_PX = 11;                 // smallest thumb movement worth aiming with
const REACH_CEIL = 2.2;                  // beyond here is guesswork, not evidence
/* The depth scale the LIFT is allowed to assume it can spend. It was 1.35, and
   on a circular field that was self-defeating: the lift took room on the
   promise of a 1.35 scale, which left `down` too small for the near rim, which
   forced the scale to actually BE 1.35. Setting it to 1 makes the lift take
   only what a true 1:1 map can pay for — and 1:1 is the thing input.js calls
   load-bearing, so the lift should not be the one spending it. Measured: reach
   falls from 1.35 to 1.0 on a phone, and the skew with it. */
const LIFT_REACH = 1.0;

/* The band of screen the whole platform has to land inside. The top is HUD,
   the bottom is the hint line and, on a phone, the DASH button. Fractions
   rather than pixels because both of those scale with the viewport.

   Touch keeps more of the top, and the reason is raiseFrame: 12% is where the
   HUD chips end, so it is the right place for a platform that is simply being
   FITTED and the wrong one for a platform being pushed up against it. On a
   short viewport — a phone's real one is ~714px, not the 844 the hardware
   claims, once the browser's own chrome is out — the raise wanted more room
   than the screen had, took all 12% of it, and pinned the field under the
   score chips with the whole lower half bare. Reported as "still high up
   there". At 18% the raise stops short of the HUD and the fit pays the
   difference by making the platform a little smaller, which is the trade
   worth making: the field being an inch lower is worth more than the last 7%
   of its width. */
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

/* FIT THE WHOLE PLATFORM, width AND depth, as large as both allow.

   This used to fit width alone and floor the zoom at 1. Both were right for a
   rectangle two units wide for every one deep on a camera whose framing was
   being held byte-identical: depth never ran out first, so it was never
   checked. A circle is as deep as it is wide, and on a 16:9 screen the depth
   is what runs out first — unchecked, the near rim landed below the bottom of
   the window and the opening beats of a route were simply off screen.

   Both constraints are now one predicate, and the answer is the SMALLEST zoom
   that satisfies it, since a smaller zoom is a larger arena. Bisected rather
   than stepped: stepping up by a fixed ratio until it fits overshoots by up to
   that ratio every pass, which measured out as a field a sixth smaller than it
   needed to be. Monotone in zoom — further away is always smaller — so twenty
   halvings land on it exactly, and it runs on resize only. */
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
    /* On touch the platform is not the only thing that has to fit. The thumb
       needs a band as tall as the arena's own image below it (see raiseFrame),
       and shifting the frame up only buys what the HUD band leaves — a 1024px
       tablet ran 291px short of it with the frame as high as it would go. So
       the platform gives way too, but only down to where a catch radius stops
       reading up the screen: an arena you cannot aim at is not a fix for a
       hand in the way. On a phone this costs nothing, since the shift alone
       pays for the band. */
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
   circular arena stopped paying for it: the field is as deep as it is wide
   now, so on a 390x844 phone the platform reached to within 108px of the DASH
   button, `most` came out 108 against an `ideal` of 299, and the hand covered
   the bottom 148px of a 265px arena — the near half of the field, which is
   where the next beats of a route are read from. Play-tested as the hand
   covering half the screen.

   The band a thumb needs is as tall as the arena's own image, because the map
   is 1:1 and nothing may buy that back with a gain (see the strain note
   above). So the platform has to move UP the screen, and there is room: on
   that phone it sat 238px below the HUD band with nothing but scenery in the
   gap.

   It moves as a LENS SHIFT rather than a camera move. An off-axis frustum
   shifts top and bottom together, which drops out of ndc y as a constant, so
   the projection translates RIGIDLY: every world point lands exactly
   `frameLift` px higher and the arena keeps the size, shape and perspective
   the fit just chose for it. Sliding the rig back does raise the image too,
   but it raises it by moving further away — measured, 5 units of slide bought
   115px of raise and spent 18% of the platform's depth doing it, which is the
   opposite of the trade being asked for. Nothing else has to know: raycasting
   unprojects through the same matrix, the probe mirrors it, and so
   groundX/groundY, the touch map and the HUD projections all read the shifted
   screen.

   What it costs is at the TOP of the frame. Food spawns at SPAWN_Y and now
   enters the window `frameLift` px later down its fall — over the far rim
   that is the last ~7 units of a 15-unit drop rather than all 15. The ribbon
   and the landing rings are the read on a phone anyway, and both are on the
   ground, where the shift puts them fully in the clear.

   The clamp is the HUD band: the platform never rides above FIT_TOP_TOUCH,
   which is set back from the chips for exactly this reason. Where
   that clamps the shift short — a 320x568, or a landscape phone with the DASH
   button eating the bottom third — the thumb keeps whatever band is left,
   which is still more than it had. */
/* `need` is exactly what refreshTouchMap's `most` is short of its `ideal`, in
   px of frame shift; `room` is what the HUD band leaves to shift into. One
   function so the two readers cannot drift: raiseFrame spends the one on the
   other, and fitCamera makes the platform smaller when they do not meet. */
/* HOW MUCH OF THE FIELD THE HAND MAY STILL COVER. At zero — a band as tall as
   the arena's whole image — the platform framed too high: it pinned the far
   rim under the HUD and left the bottom 45% of a phone as bare foreground,
   play-tested as "a bit too high". A quarter of the depth drops the platform
   66px on a 390x844 and hands back the nearest 24px of it, 9% of the field, at
   the rim furthest from where a route is being read. What is being bought off
   is a hand over a large part of the screen, not the last pixel of it. */
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
/* The lowest y a steering finger may be asked to reach: the bottom margin
   belongs to the home indicator, and the DASH button is a harder edge than any
   margin because it eats the touch outright. It sits bottom-right, the arena
   spans nearly the full width, so on a short screen the arena's near-right
   corner lands squarely on it and that corner simply cannot be steered to.
   Measured off the live button rather than assumed, so it keeps up with the
   CSS; hidden on desktop, where the rect is empty. Shared with raiseFrame,
   which is deciding how much room this leaves for the thumb. */
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

  /* As much lift as the room below allows, once the near edge is guaranteed
     reachable within the depth scale the lift is allowed to spend. `ideal` is
     the whole play field plus clear air, which is what puts the hand below it;
     raiseFrame has already shifted the frame up so that `most` can pay for it,
     as far as the HUD band allows. */
  const ideal = (hNear + hFar) + LIFT_GAP;
  const most  = bottom - touchCY - hNear / LIFT_REACH;
  /* No ceiling: it was 240px, and once the frame started riding high enough to
     pay for `ideal` that ceiling was the only thing still putting the hand on
     the field — 240 against an ideal of 299 left the top of the thumb 17px
     inside the near rim. `ideal` is the ceiling, and it is the amount that
     buys exactly the separation being asked for and no more. */
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

  /* ONE REACH, BOTH AXES, and this is the change a circular arena earns.

     These used to be fitted separately, and the reason given was that the arena
     was 2:1 and only its width strained. That premise is gone: the field is as
     deep as it is wide now, and fitted apart the two came out at 1 and 1.35 —
     a 0.74x skew, so a diagonal swipe walked up to 8.6 degrees off the line it
     was aimed at, every viewport, worse than anything the rectangle ever
     produced. Measured against the modelled thumb it also cost real catches:
     pointing fell behind the thumbstick at a fast look rate for the first time.

     Taking the larger of the two satisfies both constraints by construction and
     makes the skew exactly zero — swipe a direction, walk that direction. What
     it costs is thumb-box width, since the wider reach now applies to x as
     well; --touch asserts every point on the rim is still reachable and
     aimable, which is the floor under that trade. */
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

