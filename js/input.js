const input = { left:false, right:false, up:false, down:false };
const raycaster = new THREE.Raycaster();
/* Two planes, because the two devices point at different things. A mouse sits
   ON the capybara, so it reads against a plane at its middle. A finger points
   at a spot on the GROUND from a fixed distance below it, so it reads against
   y=0 or the lift is quietly 0.6 units short of what it says. */
const bodyPlane  = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.7);
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();

function pointerToGround(clientX, clientY, plane = groundPlane){
  _ndc.x = (clientX / window.innerWidth) * 2 - 1;
  _ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(_ndc, camera);
  if (raycaster.ray.intersectPlane(plane, _hit)) return _hit;
  return null;
}

/* ---- steering: one scheme, two devices --------------------------------
   Mouse and thumb answer the same question — WHERE do you want to be — and
   hand `capyState.dragX/dragZ` to the proportional controller in
   updateCapybara, which scales speed by distance so arriving is automatic and
   overshoot impossible. Nothing about arrival is left to the player's timing.

   Touch used to get a velocity thumbstick, and that is what made routes
   unplayable on a phone: a rate device asks for a heading and a throttle that
   are nowhere on screen and holds the last answer until you give another, so
   every moment of inattention is an integration error. Against a modelled thumb
   (`--touch`) pointing clears 47% of routes to the stick's 39% at a 150ms look
   rate, and 31% to 16% at 250ms — the gap widens as the player slows down,
   because a destination stays correct while nobody is looking at it.

   Two things make pointing work on a phone, and both are load-bearing:

   1:1, NEVER A GAIN. A relative trackpad mapping measured worse than the
   thumbstick at every gain from 1.4 to 3.6, because a gain multiplies the
   thumb's own imprecision: 6px of wobble at 2.4 is half a catch radius.

   THE CAPYBARA STANDS ABOVE THE FINGERTIP by `touchLift` px, computed from the
   arena's own projected depth, so the thumb sits below the play field and never
   covers the thing it is steering onto. `touchReachX/Z` are the one place the
   1:1 gives, and only to keep the field clear of the bezel — see
   refreshTouchMap. */
const canvas = renderer.domElement;
const touchZone = $('touchZone');
let steerId = null;

function steerTo(clientX, clientY){
  // On touch the finger reads against the ground through the inset mapping:
  // lifted, then scaled about the arena's own centre on screen.
  const h = TOUCH
    ? pointerToGround(touchCX + (clientX - touchCX) * touchReachX,
                      touchCY + (clientY - touchLift - touchCY) * touchReachZ)
    : pointerToGround(clientX, clientY, bodyPlane);
  if (!h) return;                       // pointing at the sky: keep the last target
  /* Both devices clamp, and on a round field that is what keeps the rim
     pleasant rather than a nicety: the controller drives toward the place you
     named, so a place outside the field means driving into the wall and holding
     there. Clamping to the NEAREST point inside means pointing past the edge
     asks for the edge — the capybara arrives and stops. */
  const t = arenaClamp(h.x, h.z);
  capyState.dragX = t.x;
  capyState.dragZ = t.z;
}
function endSteer(){
  steerId = null;
  capyState.dragging = false;
  capyState.dragX = null; capyState.dragZ = null;
}

/* On touch the surface is a full-screen zone that sits under the buttons, so
   either thumb can steer and the DASH button still swallows its own taps. On
   desktop it is the canvas, which is all there is to press. */
const surface = TOUCH && touchZone ? touchZone : canvas;
surface.addEventListener('pointerdown', e => {
  if (game.state !== 'playing') return;
  if (steerId !== null) return;         // a second thumb does not fight the first
  e.preventDefault();
  steerId = e.pointerId;
  surface.setPointerCapture?.(e.pointerId);
  capyState.dragging = true;
  steerTo(e.clientX, e.clientY);
});
surface.addEventListener('pointermove', e => {
  if (e.pointerId !== steerId || game.state !== 'playing') return;
  e.preventDefault();
  steerTo(e.clientX, e.clientY);
});
/* `pointerleave` is desktop-only: with the pointer captured it should never
   fire mid-drag, but if capture is refused it would end steering the moment a
   thumb grazed the screen edge — the exact place the reach margin exists to
   keep you away from. A touch the OS steals arrives as pointercancel. */
const enders = TOUCH ? ['pointerup','pointercancel']
                     : ['pointerup','pointercancel','pointerleave'];
enders.forEach(ev =>
  surface.addEventListener(ev, e => { if (e.pointerId === steerId) endSteer(); }));

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowleft','arrowright','arrowup','arrowdown',' '].includes(k)) e.preventDefault();
  if (k === 'a' || k === 'arrowleft')  input.left = true;
  if (k === 'd' || k === 'arrowright') input.right = true;
  if (k === 'w' || k === 'arrowup')    input.up = true;
  if (k === 's' || k === 'arrowdown')  input.down = true;
  if (k === ' ' && !e.repeat) tryDash();
  if (k === 'escape' || k === 'p'){
    if (game.state === 'playing') pauseGame();
    else if (game.state === 'paused') resumeGame();
  }
  if (k === 'm') toggleMute();
  if (game.state === 'upgrade' && (k === '1' || k === '2' || k === '3')){
    const cards = document.querySelectorAll('#upgradeCards .upcard');
    cards[+k - 1]?.click();
  }
  if (k === 'enter'){
    if (game.state === 'menu') startGame();
    else if (game.state === 'over') startGame();
  }
});
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'a' || k === 'arrowleft')  input.left = false;
  if (k === 'd' || k === 'arrowright') input.right = false;
  if (k === 'w' || k === 'arrowup')    input.up = false;
  if (k === 's' || k === 'arrowdown')  input.down = false;
});
window.addEventListener('blur', () => {
  input.left = input.right = input.up = input.down = false;
  endSteer();
  if (game.state === 'playing') pauseGame();
});
