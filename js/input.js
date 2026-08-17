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

/* ---- virtual thumbstick (touch only) ----------------------------------
   Drag-to-follow puts your thumb on top of the thing you're trying to see,
   so on touch devices we hand movement to a floating stick instead: touch
   down anywhere in the bottom-left zone and the ring appears right under
   your thumb, so you never have to hunt for a small fixed target. */
const stickZone = $('stickZone'), stickEl = $('stick'), knobEl = $('stickKnob');
if (TOUCH && stickZone && stickEl){
  const R = 58;                        // knob travel in px
  const DEAD = 14;                     // dead zone in px, generous for thumbs
  let stickId = null, originX = 0, originY = 0;

  const setStick = (dx, dz) => {
    const d = Math.hypot(dx, dz);
    const clamped = Math.min(d, R);
    const nx = d > 0 ? dx / d : 0, nz = d > 0 ? dz / d : 0;
    knobEl.style.transform = `translate(${nx * clamped}px, ${nz * clamped}px)`;
    // dead zone first, then analog magnitude ramps to full by ~60% travel
    // so you don't need to drag all the way to the edge to hit top speed
    const mag = d < DEAD ? 0 : Math.min(1, (d - DEAD) / (R * 0.6 - DEAD));
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
    if (game.state !== 'playing') return;
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

const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', e => {
  if (game.state !== 'playing' || TOUCH) return;   // touch steers with the stick
  canvas.setPointerCapture?.(e.pointerId);
  capyState.dragging = true;
  const h = pointerToGround(e.clientX, e.clientY);
  if (h){ capyState.dragX = h.x; capyState.dragZ = h.z; }
});
canvas.addEventListener('pointermove', e => {
  if (!capyState.dragging || game.state !== 'playing') return;
  const h = pointerToGround(e.clientX, e.clientY);
  if (h){ capyState.dragX = h.x; capyState.dragZ = h.z; }
});
const endDrag = () => { capyState.dragging = false; capyState.dragX = null; capyState.dragZ = null; };
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
  if (game.state === 'playing') pauseGame();
});

