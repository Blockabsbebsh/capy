const input = { left:false, right:false, up:false, down:false };
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.7);
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();

function pointerToGround(clientX, clientY){
  _ndc.x = (clientX / window.innerWidth) * 2 - 1;
  _ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(_ndc, camera);
  if (raycaster.ray.intersectPlane(groundPlane, _hit)) return _hit;
  return null;
}

/* ---- virtual thumbstick (touch, 'follow' scheme only) -----------------
   Drag-to-follow puts your thumb on top of the thing you're trying to see,
   so on touch devices we hand movement to a floating stick instead: touch
   down anywhere in the bottom-left zone and the ring appears right under
   your thumb, so you never have to hunt for a small fixed target.

   The 'offset' scheme replaces this entirely — see below. */
const stickZone = $('stickZone'), stickEl = $('stick'), knobEl = $('stickKnob');
if (TOUCH && stickZone && stickEl){
  const R = 58;                        // knob travel in px
  const DEAD = 11;                     // dead zone in px, generous for thumbs
  /* Response curve. Since the stick's magnitude IS the target speed, how much
     thumb travel the slow end gets is exactly how precisely you can park under
     falling food — and it used to get almost none. Saturating at 60% of the
     radius left 21px between the dead zone and full speed to express every
     speed the capybara has, of which the parking crawl (~2 u/s) occupied about
     three. Ramping across the full radius doubles that band to 47px, and the
     exponent spends most of it on the slow end: the same crawl is now roughly
     16px of travel, and full speed still sits exactly at the rim where your
     thumb can feel it. */
  const CURVE = 1.8;
  let stickId = null, originX = 0, originY = 0;

  const setStick = (dx, dz) => {
    const d = Math.hypot(dx, dz);
    const clamped = Math.min(d, R);
    const nx = d > 0 ? dx / d : 0, nz = d > 0 ? dz / d : 0;
    knobEl.style.transform = `translate(${nx * clamped}px, ${nz * clamped}px)`;
    const t = d < DEAD ? 0 : Math.min(1, (d - DEAD) / (R - DEAD));
    const mag = Math.pow(t, CURVE);
    capyState.stickX = nx * mag;
    capyState.stickZ = nz * mag;
  };
  const release = () => {
    stickId = null;
    capyState.stickX = capyState.stickZ = 0;
    knobEl.style.transform = 'translate(0,0)';
    stickEl.classList.remove('on');
  };
  stickZone.addEventListener('pointerdown', e => {
    if (game.state !== 'playing' || CTRL !== 'follow') return;
    e.preventDefault();
    stickId = e.pointerId;
    stickZone.setPointerCapture?.(e.pointerId);
    // the ring is centered exactly on the touch point — clamping this to
    // avoid screen-edge clipping used to offset the ring from your thumb,
    // so the very first pointermove would register a big, sudden input
    // even though your thumb hadn't actually moved yet. Anchoring on the
    // real touch point keeps input glued to your thumb from frame one.
    originX = e.clientX;
    originY = e.clientY;
    stickEl.style.left = originX + 'px';
    stickEl.style.top = originY + 'px';
    stickEl.classList.add('on');
    setStick(0, 0);
  });
  stickZone.addEventListener('pointermove', e => {
    if (e.pointerId !== stickId) return;
    e.preventDefault();
    setStick(e.clientX - originX, e.clientY - originY);
  });
  ['pointerup','pointercancel','pointerleave'].forEach(ev =>
    stickZone.addEventListener(ev, e => { if (e.pointerId === stickId) release(); }));
}

/* ---- input-offset drag ('offset' scheme, both touch and desktop) -------
   Press anywhere and the OFFSET from that press point is the stick. There is
   no fixed knob to find and nothing anchored to a corner of the screen: the
   control appears where your hand already is, which is the whole reason this
   exists as an alternative to drag-to-follow — in that scheme your hand sits
   on top of the arena you are trying to read.

   It feeds capyState.stickX/stickZ, the same channel as the thumbstick, so
   updateCapybara and tryDash need to know nothing about any of this: it is
   one more answer to "what velocity does the player want".

   Screen down is +z, matching both the thumbstick and the camera. */
const padEl = $('dragPad'), padKnobEl = $('dragKnob');
let offId = null, offX = 0, offY = 0, offR = 100;

function setOffset(dx, dy){
  const d = Math.hypot(dx, dy);
  const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : 0;
  padKnobEl.style.transform = `translate(${nx * Math.min(d, offR)}px, ${ny * Math.min(d, offR)}px)`;
  const t = d < OFF_DEAD ? 0 : Math.min(1, (d - OFF_DEAD) / (offR - OFF_DEAD));
  const mag = Math.pow(t, OFF_CURVE);
  capyState.stickX = nx * mag;
  capyState.stickZ = ny * mag;
}

function endOffsetDrag(){
  offId = null;
  capyState.stickX = capyState.stickZ = 0;
  padKnobEl.style.transform = 'translate(0,0)';
  padEl.classList.remove('on');
}

const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', e => {
  if (game.state !== 'playing') return;
  if (CTRL === 'offset'){
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    offId = e.pointerId;
    // Re-measured per press, not cached: the gesture is sized off the viewport
    // and a phone can be rotated between one press and the next.
    offR = offsetRadius();
    offX = e.clientX; offY = e.clientY;
    padEl.style.left = offX + 'px';
    padEl.style.top  = offY + 'px';
    padEl.style.width = padEl.style.height = (offR * 2) + 'px';
    padEl.classList.add('on');
    setOffset(0, 0);
    return;
  }
  if (TOUCH) return;                               // touch steers with the stick
  canvas.setPointerCapture?.(e.pointerId);
  capyState.dragging = true;
  const h = pointerToGround(e.clientX, e.clientY);
  if (h){ capyState.dragX = h.x; capyState.dragZ = h.z; }
});
canvas.addEventListener('pointermove', e => {
  if (game.state !== 'playing') return;
  if (offId !== null){
    if (e.pointerId !== offId) return;
    e.preventDefault();
    setOffset(e.clientX - offX, e.clientY - offY);
    return;
  }
  if (!capyState.dragging) return;
  const h = pointerToGround(e.clientX, e.clientY);
  if (h){ capyState.dragX = h.x; capyState.dragZ = h.z; }
});
const endDrag = e => {
  if (offId !== null && (!e || e.pointerId === offId)) endOffsetDrag();
  capyState.dragging = false; capyState.dragX = null; capyState.dragZ = null;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', endDrag);

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
  endOffsetDrag();          // a held pointer that leaves the window is released
  if (game.state === 'playing') pauseGame();
});

