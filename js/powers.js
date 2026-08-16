/* =======================================================================
   POWER-UPS
   ======================================================================= */
const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1.32, 22, 16), mat.bubbleSkin);
shieldBubble.visible = false;
scene.add(shieldBubble);

function activatePower(type, at){
  const P = POWERS[type];
  if (type === 'shield'){
    game.shield = true;
    shieldBubble.visible = true;
  }
  const dur = P.dur * game.up.powerMul;
  game.power = { type, t: dur, dur };
  if (type === 'slowmo') Audio.slowmo();
  else Audio.powerUp();
  popup(at, P.name + '!', P.color);
  flash(P.color, 0.28);
  game.shake = Math.max(game.shake, 0.1);
}

function updatePower(dt){
  game.timeScale = 1;
  if (game.power){
    game.power.t -= dt;
    if (game.power.type === 'slowmo') game.timeScale = 0.45;
    if (game.power.t <= 0){
      if (game.power.type === 'shield' && game.shield){
        // shield simply times out if it was never spent
        game.shield = false;
        shieldBubble.visible = false;
      }
      if (game.power.type === 'slowmo') Audio.unslow();
      game.power = null;
    }
  }
  // the bubble sits on the capybara and breathes
  if (shieldBubble.visible){
    const t = performance.now() * 0.001;
    shieldBubble.position.set(capyState.x, 0.85 + capyState.hopY + Math.sin(t*2)*0.03, capyState.z);
    shieldBubble.scale.setScalar(1 + Math.sin(t * 3.4) * 0.035);
    shieldBubble.rotation.y += dt * 0.7;
  }
}

function popShield(at){
  game.shield = false;
  shieldBubble.visible = false;
  if (game.power && game.power.type === 'shield') game.power = null;
  Audio.shieldBreak();
  burst(at, 22, PAL.soap, { spread:6.4, up:4.4, size:0.12, life:0.7 });
  popup(at, 'BLOCKED!', '#8fe9ff');
  game.shake = Math.max(game.shake, 0.18);
  flash('#8fe9ff', 0.3);
}

