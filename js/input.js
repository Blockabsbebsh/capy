const input = { left:false, right:false, up:false, down:false };
const raycaster = new THREE.Raycaster();
/* Two planes, because the two devices point at different things. A mouse sits
   ON the capybara, so it reads against a plane at its middle and the body ends
   up under the cursor. A finger points at a spot on the GROUND — a ribbon dot,
   a landing ring — from a fixed distance below it, so it reads against y=0 or
   the lift is quietly 0.6 units short of what it says. */
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
   Both the mouse and a thumb answer the same question — WHERE do you want to
   be — and hand `capyState.dragX/dragZ` to the proportional controller in
   updateCapybara. That controller is why the game feels good with a mouse: it
   scales speed by how far away the target is, so arriving is automatic and
   overshoot is impossible. Nothing about arrival is left to the player's
   timing.

   Touch used to get a velocity thumbstick instead, and that is what made
   routes unplayable on a phone. A rate device asks the player for two
   quantities they cannot see anywhere on screen — a heading and a throttle —
   and holds whatever they last said until they say something else, so every
   moment of inattention is an integration error. Measured against the
   thumbstick with a modelled thumb (see `--touch` in tools/shoot.js) it clears
   47% of routes to the stick's 39% at a 150ms look-rate, and 31% to 16% at
   250ms — an ordinary rate for someone reading a route rather than drilling
   one. The gap widens as the player slows down because a destination stays
   correct while nobody is looking at it and a velocity does not.

   Two things make pointing work on a phone at all, and both are load-bearing:

   1:1, never a gain. A relative "trackpad" mapping was measured at gains 1.4
   through 3.6 and every one of them was WORSE than the thumbstick, because a
   gain multiplies the thumb's own imprecision: 6px of thumb wobble at gain 2.4
   is half a catch radius on a screen where the whole arena is 350px wide. At
   1:1 the arena is small enough on screen to cover without ever clutching, so
   there is no reason to pay for reach.

   The capybara stands ABOVE the fingertip, by `touchLift` px. This is the
   reason drag-to-follow was rejected for touch before, and it is the whole
   fix rather than a detail: the lift is computed from the arena's own
   projected depth, so on a phone your thumb sits entirely BELOW the play
   field and never covers the thing you are steering onto. */
const canvas = renderer.domElement;
const touchZone = $('touchZone');
let steerId = null;

function steerTo(clientX, clientY){
  const h = TOUCH ? pointerToGround(clientX, clientY - touchLift)
                  : pointerToGround(clientX, clientY, bodyPlane);
  if (!h) return;                       // pointing at the sky: keep the last target
  // Clamping matters on touch and not on a mouse: the finger has to be able to
  // ask for the arena's near and far edges without landing exactly on them.
  capyState.dragX = TOUCH ? THREE.MathUtils.clamp(h.x, -ARENA.halfX, ARENA.halfX) : h.x;
  capyState.dragZ = TOUCH ? THREE.MathUtils.clamp(h.z, -ARENA.halfZ, ARENA.halfZ) : h.z;
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
['pointerup','pointercancel','pointerleave'].forEach(ev =>
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
