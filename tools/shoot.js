#!/usr/bin/env node
/* Headless screenshot + assertion harness for the game.
 *
 * There is no test suite here and the work is mostly visual, so this exists to
 * make "look at it in a real browser" a one-liner instead of a bespoke script
 * every time.
 *
 *   npm i playwright-core                  # not committed; chromium is preinstalled
 *   python3 -m http.server 8765 &
 *   node tools/shoot.js --check            # assertions; exits non-zero on failure
 *   node tools/shoot.js --biome hell,night # screenshot named biomes
 *   node tools/shoot.js --capy             # capybara turnaround
 *   node tools/shoot.js --play             # menu + gameplay + hat fit
 *   node tools/shoot.js --touch            # touch steering vs a modelled thumb
 *   node tools/shoot.js --icons            # every icon at the size it is drawn at
 *
 * Options: --url <u>  --out <dir>  --browser <path>  --size <WxH>
 * Output goes to .shots/ (gitignored).
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? dflt : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true);
};

const URL      = flag('url', 'http://localhost:8765/index.html');
const OUT      = flag('out', path.join(__dirname, '..', '.shots'));
const BROWSER  = flag('browser', process.env.CHROMIUM_PATH
                  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const [W, H]   = String(flag('size', '760x520')).split('x').map(Number);

// level -> biome, matching THEMES order in config.js (a new theme every 10 levels)
const BIOMES = { meadow: 1, pond: 11, candy: 21, night: 31, hell: 41 };

let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch {
  console.error('playwright-core is not installed. Run: npm i playwright-core');
  process.exit(2);
}

const fail = [];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: BROWSER,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H } });

  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const shot = async name => {
    const file = path.join(OUT, name + '.png');
    await page.screenshot({ path: file });
    console.log('  wrote', path.relative(process.cwd(), file));
  };
  const jump = async level => {
    // dev.js exposes jumpToLevel; it also starts the game if still on the menu
    await page.evaluate(l => jumpToLevel(l), level);
    await page.waitForTimeout(1100);
  };

  if (flag('play')) {
    console.log('play:');
    await shot('menu');
    await page.click('#btnStart');
    await page.waitForTimeout(2500);
    await shot('meadow');
    await page.evaluate(() => setHat('straw'));
    await page.waitForTimeout(600);
    await shot('hat');                       // hat anchors still line up?
    await page.evaluate(() => setHat('none'));
  }

  if (flag('biome')) {
    const names = flag('biome') === true ? Object.keys(BIOMES) : String(flag('biome')).split(',');
    console.log('biomes:');
    await page.click('#btnStart').catch(() => {});
    await page.waitForTimeout(400);
    for (const n of names) {
      const lvl = BIOMES[n.trim()];
      if (!lvl) { console.error('  unknown biome:', n); continue; }
      await jump(lvl);
      await shot('biome-' + n.trim());
    }
  }

  if (flag('capy')) {
    console.log('capybara turnaround:');
    await page.click('#btnStart').catch(() => {});
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      game.state = 'paused';                 // freeze the idle wander
      capyState.x = 0; capyState.z = 1.0; capyState.hopY = 0;
      capy.tilt.rotation.set(0, 0, 0);
      capy.squash.scale.set(1, 1, 1);
    });
    // animate() rewrites camera.position from camFit/CAM_LOOK every frame, so
    // drive those rather than the camera itself
    const views = { front: [0, 2.6, 6.4], threeq: [4.4, 2.9, 4.8],
                    side: [6.6, 2.0, 1.0], top: [0, 6.4, 3.2] };
    for (const [name, p] of Object.entries(views)) {
      await page.evaluate(v => {
        camFit.x = v[0]; camFit.y = v[1]; camFit.z = v[2]; camFit.follow = 0;
        CAM_LOOK.set(0, 0.85, 1.0);
      }, p);
      await page.waitForTimeout(250);
      await shot('capy-' + name);
    }
  }

  /* Every icon in the two places it is actually drawn: the perk rail at 15-18px
     and a draft card at 28px. The art is a downscaled 128px PNG, and the only
     thing that tells you whether one survives the downscale is looking at it —
     so this holds every perk at once and opens a draft that shows all of them,
     rather than whatever three the pool happened to pick. */
  if (flag('icons')) {
    console.log('icons:');
    await page.click('#btnStart').catch(() => {});
    // park the pointer off every control: clicking start leaves it wherever the
    // button was, and a card that opens under it screenshots in its :hover
    // state, which reads as a tinted card rather than a plain one
    await page.mouse.move(1, 1);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      // one of everything, at full stacks, so the rail is as crowded as it gets
      for (const u of UPGRADES) game.taken[u.id] = u.max;
      for (const u of RUN_PERKS) game.taken[u.id] = 1;
      game.as.cd = 42;                        // the countdown badge, not a blank
      refreshHUD();
    });
    await page.waitForTimeout(300);
    await shot('icons-rail');

    // a card per icon, in the real card markup, at the real 28px. The panel
    // caps its height and scrolls, so the viewport grows for this one shot —
    // ten cards is more than a draft ever shows and the point is to see them
    // all side by side.
    await page.setViewportSize({ width: W, height: Math.max(H, 1100) });
    await page.evaluate(() => {
      game.state = 'paused';
      const box = document.getElementById('upgradeCards');
      box.innerHTML = '';
      for (const u of UPGRADES.concat(RUN_PERKS)) {
        const b = document.createElement('button');
        b.className = 'upcard' + (u.tier ? ' ' + u.tier : '');
        b.innerHTML = `<i>${icon(u.icon, 26)}</i><span style="flex:1"><b>${u.name}</b>` +
                      `<span>${u.desc}</span></span>`;
        box.appendChild(b);
      }
      showPanel(document.getElementById('upgradePanel'));
    });
    await page.waitForTimeout(300);
    await shot('icons-cards');
    await page.setViewportSize({ width: W, height: H });

    /* The cut, on a field nothing in the art comes near. Every other view here
       is a dark chip or a brown card, which is exactly where a tan drop shadow
       or a pastel backdrop left behind by the converter hides — `reach` shipped
       one and none of the shots above showed it. */
    await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend',
        `<div id="cutplate" style="position:fixed; inset:0; z-index:99;
          background:#f0f; display:flex; flex-wrap:wrap; align-content:center;
          justify-content:center; gap:6px; padding:20px">` +
        // no .ico class: the drop shadow it carries would read as a leftover one
        Object.keys(ICON_SRC).map(id => icon(id, 96).replace('class="ico" ', ''))
          .join('') + `</div>`);
    });
    await page.waitForTimeout(300);
    await shot('icons-cut');
    await page.evaluate(() => document.getElementById('cutplate').remove());

    // and the power chip, which draws them smallest of all at 15px
    await page.evaluate(() => {
      game.state = 'playing';
      showPanel(null);
      game.power = { type: 'magnet', t: 3, dur: 3.75 };
      refreshHUD();
    });
    await page.waitForTimeout(300);
    await shot('icons-power');
  }

  /* Autopilot sweep over every formation shape and every feast route.
   *
   * CLAUDE.md: a new shape is only "provably clearable" once something has
   * actually walked it. Headless frame timing is meaningless (~5fps under
   * swiftshader), so this drives updateFormations/updateCapybara/updateItems
   * directly at a fixed 1/60 instead of waiting on real time, and the
   * autopilot dashes ONLY when walking cannot cover the step — otherwise a
   * failure would say more about a bad player than about the shape.
   */
  if (flag('fmt')) {
    console.log('formations (autopilot):');
    await page.click('#btnStart').catch(() => {});
    await page.waitForTimeout(600);

    const runs = await page.evaluate(() => {
      const out = [];

      /* The autopilot plays the way the game is meant to be read: off the
         RIBBON. A live route publishes its landing spots (rec.pts) the moment
         it appears, so the target is the next unresolved good beat, hazard
         beats skipped — not "whichever item happens to have spawned". Waiting
         for spawns caps your lead time at one fall (~1.1s) and fails shapes
         whose steps are legitimately given more than that. When nothing is
         routed (a feast), it falls back to chasing landing rings. */
      const autopilot = () => {
        // timing half of the read: when does the next thing actually arrive
        let soonest = 1e9, ring = null;
        for (const it of items) {
          if (it.dead || !it.def.good) continue;
          const t = (it.mesh.position.y - CATCH_Y) / Math.max(0.5, -it.vy);
          if (t < soonest) { soonest = t; ring = it.ring.position; }
        }

        let target = null, wantsDash = false;
        const rec = fmt.live.values().next().value;
        if (rec && rec.pts) {
          const done = rec.total - rec.pending;         // beats land in order
          for (let i = Math.max(0, done); i < rec.pts.length; i++) {
            if (!rec.pts[i].bad) { target = rec.pts[i]; wantsDash = !!rec.pts[i].dash; break; }
          }
        }
        if (!target) target = ring;
        if (!target) { capyState.dragX = capyState.dragZ = null; return; }

        // Steer the way both real devices do: name a destination and let the
        // controller in updateCapybara pick the speed. There is no other
        // channel any more — the thumbstick is gone.
        capyState.dragging = true;
        capyState.dragX = target.x; capyState.dragZ = target.z;
        const d = Math.hypot(target.x - capyState.x, target.z - capyState.z);

        /* Dash ONLY when walking cannot cover the step: either the beat is
           dash-timed by construction, or the thing already in the air will land
           before a flat-out walk arrives. The distance and time floors matter —
           without them this fires on a beat that is already underfoot with a
           hundredth of a second to run, flinging the autopilot five units away
           and leaving it on cooldown, which measures a bad player rather than a
           hard shape. */
        const sp = (12.2 + game.level * 0.16) * game.up.speed;
        const cantWalk = soonest > 0.12 && d > sp * soonest * 0.92;
        if (d > 2.5 && (cantWalk || (wantsDash && d > sp * DASH_TIME * 2))) tryDash();
      };

      const setup = (level, sticky) => {
        game.state = 'playing'; game.devLock = true; game.level = level;
        resetUpgrades();
        game.run.sticky = !!sticky;
        game.up.speed = sticky ? 0.5 : 1;            // see takeUpgrade
        applyDifficulty();
        clearItems(); clearHoles(); resetFormations(); resetEvents(); resetCapy();
        game.maxLives = game.lives = 99; game.combo = 0; game.shield = false;
        game.power = null; game.timeScale = 1;
        fmt.strayTimer = 1e9;                        // strays would distract it
      };

      const realPick = pickShape, realComplete = completeFormation;
      const realCatch = onCatch, realMiss = onMiss;

      /* Each shape at its unlock level, again at 24 where fmtReach has hit its
         0.78 ceiling (the tightest any step ever gets), and once more at 24
         under Sticky Feet — half speed and no dash, the one perk that can make
         a shape unwalkable rather than merely slower. */
      const passes = [{ sticky: false }, { level: 24 }, { level: 24, sticky: true }];
      for (const shape of FMT_SHAPES) {
        for (const pass of passes) {
          const level = pass.level || Math.max(shape.min, 1);
          let rec = null;
          pickShape = () => shape;
          completeFormation = r => { rec = { caught: r.caught, goods: r.goods, spoiled: r.spoiled }; realComplete(r); };
          setup(level, pass.sticky);
          emitFormation();
          for (let i = 0; i < 60 * 40 && !rec; i++) {
            autopilot();
            updateFormations(1 / 60);
            updateCapybara(1 / 60);
            updateItems(1 / 60);
          }
          pickShape = realPick; completeFormation = realComplete;
          out.push({ kind: pass.sticky ? 'shape/sticky' : 'shape', id: shape.id, level,
                     ...(rec || { caught: -1, goods: -1 }) });
        }
      }

      // feast routes: no formation record, so count the melons directly
      for (const route of FEAST_ROUTES) {
        let caught = 0, goods = 0;
        onCatch = it => { if (it.type === 'watermelon') caught++; realCatch(it); };
        onMiss  = it => { if (it.type === 'watermelon') goods++; realMiss(it); };
        setup(12);
        const queue = [];
        const total = startFeastRoute(queue, route.id);
        let clock = 0;
        for (let i = 0; i < 60 * 60 && (queue.length || items.length); i++) {
          clock += 1 / 60;
          while (queue.length && clock >= queue[0].at) queue.shift().fn();
          autopilot();
          updateCapybara(1 / 60);
          updateItems(1 / 60);
        }
        onCatch = realCatch; onMiss = realMiss;
        out.push({ kind: 'feast', id: route.id, level: 12, caught, goods: caught + goods,
                   secs: Math.round(total * 10) / 10 });
      }
      disposeFeastPath();
      return out;
    });

    for (const r of runs) {
      const all = r.caught === r.goods && r.goods > 0 && !r.spoiled;
      console.log(`  ${all ? 'ok  ' : 'FAIL'} ${r.kind} ${r.id} (L${r.level}) ` +
                  `${r.caught}/${r.goods}${r.spoiled ? ' SPOILED' : ''}${r.secs ? ' ' + r.secs + 's' : ''}`);
      if (!all) fail.push(`${r.kind} ${r.id}: ${r.caught}/${r.goods}`);
    }
  }

  /* Touch steering, against a modelled thumb.
   *
   * CLAUDE.md: a steering scheme needs evidence it beats the one it replaces,
   * and the only honest way to get that headless is to put a thumb's real
   * limits in front of the game's own physics — a player who re-looks every
   * LAT seconds, whose finger takes time to slide, and who is a few pixels
   * imprecise. Everything else (the arena, the shapes, updateCapybara) is the
   * shipped code.
   *
   * Both schemes drive capyState.dragX/dragZ, which can reproduce a rate stick
   * EXACTLY and so keeps the comparison runnable after the stick itself was
   * deleted: the drag controller's desired speed is min(d * DRAG_GAIN, SPEED),
   * so parking the target mag*SPEED/DRAG_GAIN units ahead of the capybara,
   * every frame, commands exactly `mag` of top speed along that heading. Same
   * physics, same easing — the only differences are the ones being measured.
   *
   * The result that decided the scheme: the two are level at a 150ms look-rate
   * and pointing pulls away as the player gets slower, because a destination
   * stays correct while nobody is looking at it and a velocity does not.
   */
  if (flag('touch')) {
    console.log('touch steering (modelled thumb, 390x844):');
    const tp = await browser.newPage({ viewport: { width: 390, height: 844 },
                                       hasTouch: true, isMobile: true });
    tp.on('pageerror', e => errors.push('touch: ' + e.message));
    await tp.goto(URL, { waitUntil: 'load' });
    await tp.waitForTimeout(1200);
    await tp.click('#btnStart').catch(() => {});
    await tp.waitForTimeout(900);

    const rows = await tp.evaluate(({ lats, levels, reps }) => {
      let seed = 20260817;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const gauss = () => (rnd()+rnd()+rnd()+rnd()+rnd()+rnd() - 3) / 1.5;
      /* The game rolls for item type, mirroring and hazard placement, so two
         schemes only get the same routes if the whole thing is seeded. Without
         this the run-to-run spread was wider than the difference being
         measured. Restored at the end — the page stays playable. */
      const realRandom = Math.random;
      Math.random = rnd;
      const reseed = () => { seed = 20260817; };

      const THUMB = 1100;              // px/s a thumb actually slides
      const NOISE = 5;                 // px, one sigma of placement error
      const HOME  = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.78 };
      const V = new THREE.Vector3();
      const proj = (x, z) => { V.set(x, 0, z).project(camera);
        return { x:(V.x + 1)/2*window.innerWidth, y:(1 - V.y)/2*window.innerHeight }; };
      const slide = (from, to, dt) => {
        const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy), m = THUMB*dt;
        if (d > m){ from.x += dx/d*m; from.y += dy/d*m; } else { from.x = to.x; from.y = to.y; }
      };
      const speed = () => (12.2 + game.level * 0.16) * game.up.speed;

      /* The shipped scheme, driven through the REAL mapping: the noise is put
         on the FINGER in screen px and then goes through steerTo's transform,
         so the reach scales multiply it exactly as they would on a phone
         rather than being assumed away. */
      const toFinger = (x, z) => { const g = proj(x, z);
        return { x: touchCX + (g.x - touchCX)/touchReachX,
                 y: touchCY + (g.y - touchCY)/touchReachZ + touchLift }; };
      const point = () => {
        const finger = toFinger(0, 0), want = toFinger(0, 0);
        return {
          decide(t){ const f = toFinger(t.x, t.z);
                     want.x = f.x + gauss()*NOISE; want.y = f.y + gauss()*NOISE; },
          step(dt){
            slide(finger, want, dt);
            const h = pointerToGround(touchCX + (finger.x - touchCX)*touchReachX,
                                      touchCY + (finger.y - touchLift - touchCY)*touchReachZ);
            if (!h) return;
            capyState.dragging = true;
            capyState.dragX = THREE.MathUtils.clamp(h.x, -ARENA.halfX, ARENA.halfX);
            capyState.dragZ = THREE.MathUtils.clamp(h.z, -ARENA.halfZ, ARENA.halfZ);
          },
        };
      };
      // the removed thumbstick: R/DEAD/CURVE as it shipped, aimed the way a
      // player aims — along the direction they SEE, which the stick then read
      // as a world-space heading
      const stick = () => {
        const R = 58, DEAD = 11, CURVE = 1.8;
        const thumb = { ...HOME }, want = { ...HOME };
        return {
          decide(t){
            const dx = t.x - capyState.x, dz = t.z - capyState.z;
            const d = Math.hypot(dx, dz) || 1e-6;
            const c = proj(capyState.x, capyState.z);
            const fz = Math.hypot(proj(capyState.x, capyState.z + 1).x - c.x,
                                  proj(capyState.x, capyState.z + 1).y - c.y) /
                       Math.hypot(proj(capyState.x + 1, capyState.z).x - c.x,
                                  proj(capyState.x + 1, capyState.z).y - c.y);
            let ax = dx, az = dz * fz;
            const an = Math.hypot(ax, az) || 1; ax /= an; az /= an;
            const mag = Math.min(1, d * DRAG_GAIN / speed());
            const px = DEAD + Math.pow(mag, 1/CURVE) * (R - DEAD) + gauss()*NOISE;
            want.x = HOME.x + ax*px; want.y = HOME.y + az*px;
          },
          step(dt){
            slide(thumb, want, dt);
            const ox = thumb.x - HOME.x, oy = thumb.y - HOME.y, od = Math.hypot(ox, oy);
            const t = od < DEAD ? 0 : Math.min(1, (od - DEAD) / (R - DEAD));
            const mag = Math.pow(t, CURVE);
            if (mag <= 0){ capyState.dragX = capyState.dragZ = null; return; }
            capyState.dragging = true;
            const ahead = mag * speed() / DRAG_GAIN;     // exact velocity emulation
            capyState.dragX = capyState.x + ox/od*ahead;
            capyState.dragZ = capyState.z + oy/od*ahead;
          },
        };
      };

      const setup = level => {
        game.state = 'playing'; game.devLock = true; game.level = level;
        resetUpgrades(); game.run.sticky = false; game.up.speed = 1;
        applyDifficulty();
        clearItems(); clearHoles(); resetFormations(); resetEvents(); resetCapy();
        game.maxLives = game.lives = 99; game.combo = 0; game.shield = false;
        game.power = null; game.timeScale = 1; fmt.strayTimer = 1e9;
      };
      const realPick = pickShape, realComplete = completeFormation;
      const out = [];

      for (const [name, make] of [['pointing', point], ['thumbstick', stick]]){
        for (const lat of lats){
          reseed();                       // every scheme walks the same routes
          let cleared = 0, routes = 0, caught = 0, goods = 0;
          for (const shape of FMT_SHAPES){
            for (const level of levels){
              if (level < shape.min) continue;
              for (let r = 0; r < reps; r++){
                let rec = null;
                pickShape = () => shape;
                completeFormation = x => {
                  rec = { caught:x.caught, goods:x.goods, spoiled:x.spoiled }; realComplete(x); };
                setup(level);
                const dev = make();
                emitFormation();
                let clock = 0, next = 0;
                for (let i = 0; i < 60*40 && !rec; i++){
                  if (clock >= next){
                    // the ribbon read, same as the --fmt autopilot
                    let soonest = 1e9, ring = null;
                    for (const it of items){
                      if (it.dead || !it.def.good) continue;
                      const tt = (it.mesh.position.y - CATCH_Y) / Math.max(0.5, -it.vy);
                      if (tt < soonest){ soonest = tt; ring = it.ring.position; }
                    }
                    let target = null, wantsDash = false;
                    const live = fmt.live.values().next().value;
                    if (live && live.pts){
                      const done = live.total - live.pending;
                      for (let k = Math.max(0, done); k < live.pts.length; k++){
                        if (!live.pts[k].bad){ target = live.pts[k]; wantsDash = !!live.pts[k].dash; break; }
                      }
                    }
                    if (!target) target = ring;
                    if (target){
                      dev.decide(target);
                      const d = Math.hypot(target.x - capyState.x, target.z - capyState.z);
                      const sp = speed();
                      if (d > 2.5 && ((soonest > 0.12 && d > sp*soonest*0.92) ||
                                      (wantsDash && d > sp*DASH_TIME*2))) tryDash();
                    }
                    next = clock + lat;
                  }
                  dev.step(1/60);
                  updateFormations(1/60); updateCapybara(1/60); updateItems(1/60);
                  clock += 1/60;
                }
                pickShape = realPick; completeFormation = realComplete;
                routes++;
                if (rec){ caught += rec.caught; goods += rec.goods;
                  if (rec.caught === rec.goods && rec.goods > 0 && !rec.spoiled) cleared++; }
              }
            }
          }
          out.push({ name, lat, routes, cleared, caught, goods });
        }
      }
      Math.random = realRandom;
      return out;
    }, { lats: [0.15, 0.25], levels: [10, 18, 24], reps: 2 });

    const pct = r => r.cleared / r.routes * 100;
    for (const r of rows) {
      console.log(`  ${r.name.padEnd(11)} ${String(r.lat*1000).padStart(4)}ms look   ` +
        `${String(r.cleared).padStart(3)}/${r.routes} routes cleared = ${pct(r).toFixed(0).padStart(3)}%   ` +
        `${r.caught}/${r.goods} items = ${(r.caught/r.goods*100).toFixed(1)}%`);
    }
    const at = (n, l) => rows.find(r => r.name === n && r.lat === l);
    const okT = (label, cond, detail = '') => {
      console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`);
      if (!cond) fail.push(label);
    };

    /* Reach. An absolute scheme lives or dies on whether every part of the
       arena can be pointed at without the finger going somewhere it cannot or
       must not go, because the only way out mid-drag is to lift — and lifting
       moves the capybara somewhere nobody asked for. Two separate things have
       already broken this: the arena's ends landing 14px from the bezel, and
       the DASH button eating the near-right corner on a short screen. Both are
       invisible until you check the corners at a real phone size. */
    const REACH_MIN = 20;                       // px of screen a corner must spare
    const AIM_MIN = 10;                         // px of thumb per catch radius
    for (const [w, h] of [[390, 844], [360, 640], [320, 568], [844, 390], [768, 1024]]) {
      await tp.setViewportSize({ width: w, height: h });
      await tp.waitForTimeout(350);
      const r = await tp.evaluate(() => {
        const V = new THREE.Vector3();
        const proj = (x, z) => { V.set(x, 0, z).project(camera);
          return { x: (V.x + 1)/2*window.innerWidth, y: (1 - V.y)/2*window.innerHeight }; };
        const finger = (x, z) => { const g = proj(x, z);
          return { x: touchCX + (g.x - touchCX)/touchReachX,
                   y: touchCY + (g.y - touchCY)/touchReachZ + touchLift }; };
        const dash = document.getElementById('btnDash').getBoundingClientRect();
        let edge = 1e9, onDash = 0;
        const fx = [], fy = [];
        for (const [x, z] of [[-ARENA.halfX, ARENA.halfZ], [ARENA.halfX, ARENA.halfZ],
                              [-ARENA.halfX, -ARENA.halfZ], [ARENA.halfX, -ARENA.halfZ]]){
          const f = finger(x, z);
          fx.push(f.x); fy.push(f.y);
          edge = Math.min(edge, f.x, f.y, window.innerWidth - f.x, window.innerHeight - f.y);
          if (dash.height > 0 && f.x > dash.left && f.x < dash.right &&
              f.y > dash.top && f.y < dash.bottom) onDash++;
          // and the mapping has to actually resolve there
          const h = pointerToGround(touchCX + (f.x - touchCX)*touchReachX,
                                    touchCY + (f.y - touchLift - touchCY)*touchReachZ);
          if (!h) onDash += 100;
        }
        const c = proj(0, 0);
        const perX = Math.abs(proj(1, 0).x - c.x);
        const perZ = Math.hypot(proj(0, 1).x - c.x, proj(0, 1).y - c.y);
        return { edge: Math.round(edge), onDash,
                 rx: +touchReachX.toFixed(2), rz: +touchReachZ.toFixed(2),
                 lift: Math.round(touchLift),
                 boxW: Math.round(Math.max(...fx) - Math.min(...fx)),
                 boxH: Math.round(Math.max(...fy) - Math.min(...fy)),
                 aimX: +(CATCH_R * perX / touchReachX).toFixed(1),
                 aimZ: +(CATCH_R * perZ / touchReachZ).toFixed(1) };
      });
      okT(`${w}x${h}: every corner reachable`, r.edge >= REACH_MIN && r.onDash === 0,
          `nearest corner ${r.edge}px from an edge, ${r.onDash} under the DASH button`);
      /* The scales buy reach and cut strain, and the thing they spend to do it
         is aim: past the point where a catch radius is smaller than the
         smallest movement a thumb can place, sensitivity stops being reach and
         becomes a control you cannot aim. The thumb box is reported rather than
         asserted — it is a tuning outcome, not a contract. */
      okT(`${w}x${h}: still aimable by thumb`, r.aimX >= AIM_MIN && r.aimZ >= AIM_MIN,
          `reach ${r.rx}/${r.rz}, lift ${r.lift}, thumb box ${r.boxW}x${r.boxH}px, ` +
          `catch radius ${r.aimX}x${r.aimZ}px of thumb`);
    }
    await tp.setViewportSize({ width: 390, height: 844 });
    okT('a thumb can still clear routes at all',
        pct(at('pointing', 0.15)) > 30, `${pct(at('pointing', 0.15)).toFixed(0)}%`);
    /* The reason the thumbstick was replaced, kept as an assertion: pointing is
       what survives a player who is slow to look up. If this ever inverts, the
       scheme is no longer earning its place. */
    okT('pointing beats the thumbstick for a slow look',
        pct(at('pointing', 0.25)) > pct(at('thumbstick', 0.25)),
        `${pct(at('pointing', 0.25)).toFixed(0)}% vs ${pct(at('thumbstick', 0.25)).toFixed(0)}%`);
    await tp.close();
  }

  if (flag('check')) {
    console.log('checks:');
    const ok = (label, cond, detail = '') => {
      console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`);
      if (!cond) fail.push(label);
    };

    const boot = await page.evaluate(() => ({
      loadingGone: !document.getElementById('loading'),
      canvas: !!document.querySelector('#app canvas'),
      lives: document.getElementById('lives').children.length,
      hats: document.getElementById('hatPicker').children.length,
      three: THREE.REVISION,
      // every name the animation code reaches into (the contract is in MODEL.md)
      rig: ['root','bob','squash','tilt','body','head','legs','muzzle','mouth',
            'skull','hatAnchor','stackAnchor'].filter(k => !capy[k]),
      rigNums: typeof capy.legRestY === 'number' && typeof capy.stackBaseY === 'number',
      legs: capy.legs.length,
      // the external model, not a silent fall back to the procedural capybara
      skinned: !!(capy.torso && capy.torso.isSkinnedMesh),
      bones: capy.torso && capy.torso.skeleton ? capy.torso.skeleton.bones.length : 0,
    }));
    ok('boots and clears the loading screen', boot.loadingGone && boot.canvas);
    ok('HUD populated', boot.lives === 3 && boot.hats === 6, `lives=${boot.lives} hats=${boot.hats}`);
    ok('capybara rig complete', boot.rig.length === 0 && boot.rigNums && boot.legs === 4,
       boot.rig.length ? 'missing: ' + boot.rig.join(',') : '');
    ok('external model in use (not the fallback)', boot.skinned && boot.bones > 0,
       `skinned=${boot.skinned} bones=${boot.bones}`);

    await page.click('#btnStart');
    await page.waitForTimeout(2000);

    // Visit every biome twice: the arena patch must stay white wherever a map
    // is applied (else the theme lerp stains it), and the ground material must
    // be the same object both times (else it is being reallocated per visit).
    const seen = {};
    for (const pass of [1, 2]) {
      for (const [name, lvl] of Object.entries(BIOMES)) {
        await jump(lvl);
        const s = await page.evaluate(() => ({
          tint: '#' + patch.material.color.getHexString(),
          mapped: !!patch.material.map,
          ground: ground.material.uuid,
        }));
        (seen[name] = seen[name] || []).push(s);
      }
    }
    for (const [name, [a, b]] of Object.entries(seen)) {
      ok(`${name}: patch not stained`, a.mapped ? a.tint === '#ffffff' : true, a.tint);
      ok(`${name}: ground material reused`, a.ground === b.ground);
    }

    /* Nothing may stand in the pond. Meadow is the only biome that draws the
       pond and the default scenery together, so this had exactly one place to
       show and two hand-placed trees plus a share of the random scatter were
       growing out of the water there. The scatter is random per load, so this
       is worth asserting rather than eyeballing once. */
    const scenery = await page.evaluate(() => {
      const bad = [];
      for (const g of sceneryGroup.children){
        if (!outsidePond(g.position.x, g.position.z)){
          bad.push(`${g.position.x.toFixed(1)},${g.position.z.toFixed(1)}`);
        }
      }
      return { bad, total: sceneryGroup.children.length };
    });
    ok('no scenery standing in the pond', scenery.bad.length === 0,
       `${scenery.total} pieces${scenery.bad.length ? ', in the water: ' + scenery.bad.join(' ') : ''}`);

    // Set-pieces must never repeat back to back.
    const seq = await page.evaluate(() => {
      game.level = 8; evt.last = null;
      const out = [];
      for (let i = 0; i < 300; i++) { triggerEvent(); out.push(evt.last); evt.active = null; evt.queue.length = 0; }
      return out;
    });
    const repeats = seq.filter((k, i) => i && k === seq[i - 1]).length;
    ok('no back-to-back set-pieces', repeats === 0, `${repeats} in ${seq.length}`);

    // --- balance and perk wiring ----------------------------------------
    const bal = await page.evaluate(() => {
      const themes = [1, 10, 11, 20, 21, 40, 41].map(l => themeFor(l).name);
      // a draft is 3 cards, and a gold one-per-run perk turns up on some but
      // not all of them; taking one must retire it for the rest of the run
      let withGold = 0;
      for (let i = 0; i < 400; i++) {
        game.run = { phantom: false, sticky: false, puzzler: false };
        game.taken = {};
        offerUpgrades(11);
        const cards = document.querySelectorAll('#upgradeCards .upcard');
        if (cards.length !== 3) return { cardCount: cards.length };
        if (document.querySelectorAll('#upgradeCards .upcard.gold').length) withGold++;
      }
      /* ONE run perk for the whole run: taking any of the three has to close the
         gold slot, not just remove that one perk from it. Filtering per-perk let
         a single run stack all three. */
      let goldAfterTaken = 0;
      game.run = { phantom: false, sticky: false, puzzler: false };
      game.run.sticky = true;                       // just one taken
      for (let i = 0; i < 200; i++) {
        game.taken = {};
        offerUpgrades(11);
        goldAfterTaken += document.querySelectorAll('#upgradeCards .upcard.gold').length;
      }

      game.state = 'playing';
      resetUpgrades();
      game.maxLives = 7; game.lives = 7; renderLives();
      const row = document.getElementById('lives');
      const life7 = row.querySelectorAll('.heart').length + '+' +
                    (row.querySelector('.lifeplus') || {}).textContent;
      game.maxLives = 3; game.lives = 3; renderLives();
      const life3 = row.querySelectorAll('.heart').length + '/' +
                    (row.querySelector('.lifeplus') ? 'plus' : 'noplus');
      showPanel(null);                              // leave the page playable
      return { themes, withGold, goldAfterTaken, life7, life3,
               hole: HOLE_LIFE, magnet: POWERS.magnet.dur, shapes: FMT_SHAPES.length,
               feasts: FEAST_ROUTES.length, cardCount: 3 };
    });
    ok('sinkholes close after 5s', bal.hole === 5, String(bal.hole));
    ok('magnet halved to 3.75s', Math.abs(bal.magnet - 3.75) < 1e-6, String(bal.magnet));
    ok('a biome every 10 levels',
       String(bal.themes) === 'Meadow,Meadow,Lily Pad Ponds,Lily Pad Ponds,Bubblegum,Night,Hell',
       String(bal.themes));
    ok('19 formation shapes and 5 feast routes', bal.shapes === 19 && bal.feasts === 5,
       `${bal.shapes} shapes, ${bal.feasts} routes`);
    ok('draft is always 3 cards', bal.cardCount === 3, String(bal.cardCount));
    ok('gold perks appear on roughly half of drafts',
       bal.withGold > 150 && bal.withGold < 250, `${bal.withGold}/400`);
    ok('one run perk per run: the gold slot closes after any pick',
       bal.goldAfterTaken === 0, `${bal.goldAfterTaken} gold cards in 200 later drafts`);
    ok('life row tallies past five', bal.life7 === '5++2' && bal.life3 === '3/noplus',
       `${bal.life7} / ${bal.life3}`);

    /* Power-ups must actually run out. activatePower multiplied P.dur by a
       game.up field that no longer existed, which made every duration NaN — and
       NaN <= 0 is false, so slow-mo, shield and magnet each ran until the run
       ended. Durations are asserted as finite AND as expiring on the clock. */
    const pow = await page.evaluate(() => {
      const out = {};
      game.state = 'playing';
      resetUpgrades();
      for (const type of ['magnet', 'shield', 'slowmo']) {
        game.power = null; game.shield = false; shieldBubble.visible = false;
        activatePower(type, new THREE.Vector3(0, 1, 0));
        const dur = game.power.dur;
        let t = 0;
        for (let i = 0; i < 60 * 40 && game.power; i++) { updatePower(1 / 60); t += 1 / 60; }
        out[type] = { dur, ok: Number.isFinite(dur) && !game.power && Math.abs(t - dur) < 0.2,
                      secs: Math.round(t * 10) / 10, shield: game.shield };
      }
      return out;
    });
    for (const [type, r] of Object.entries(pow)) {
      ok(`${type} expires on its own clock`, r.ok && !r.shield,
         `dur=${r.dur} ended at ${r.secs}s`);
    }

    /* A Phantombara ghost has to take hearts and power-ups as well as food. It
       used to test only plain food, so a heart falling on a ghost was silently
       dropped — the worst possible item to lose to a bug. */
    const gh = await page.evaluate(() => {
      const out = {};
      const setup = () => {
        game.state = 'playing'; game.devLock = true; game.level = 5;
        resetUpgrades(); applyDifficulty();
        clearItems(); clearHoles(); clearPerkFX(); resetFormations(); resetEvents();
        game.run.phantom = true;
        game.maxLives = 3; game.lives = 1; game.power = null; game.shield = false;
        resetCapy();
        capyState.x = 0; capyState.z = 0;
        spawnGhost(0, 0);
        capyState.x = -7.5; capyState.z = -3.5;      // stand well clear
      };
      const drop = type => {
        spawnItem(type, { targeted: false, x: 0, z: 0 });
        for (let i = 0; i < 60 * 12 && items.length; i++) updateItems(1 / 60);
      };
      setup(); drop('heart');
      out.heart = `lives=${game.lives} ghosts=${ghosts.length} left=${items.length}`;
      setup(); drop('shield');
      out.power = `power=${game.power && game.power.type} ghosts=${ghosts.length} left=${items.length}`;
      clearPerkFX(); clearItems(); game.power = null; game.shield = false;
      shieldBubble.visible = false;
      return out;
    });
    ok('a ghost picks up hearts', gh.heart === 'lives=2 ghosts=1 left=0', gh.heart);
    ok('a ghost picks up power-ups', gh.power === 'power=shield ghosts=1 left=0', gh.power);

    /* --- this batch of perk changes, each asserted where it can regress ---- */
    const perks = await page.evaluate(() => {
      const o = {};
      const fresh = (lvl = 14) => {
        game.state = 'playing'; game.devLock = true; game.level = lvl;
        resetUpgrades(); applyDifficulty();
        clearItems(); clearHoles(); clearPerkFX(); resetFormations(); resetEvents();
        game.lives = game.maxLives = 3; game.power = null; game.shield = false;
        shieldBubble.visible = false; resetCapy();
      };
      const step = n => { for (let i=0;i<n;i++){ updateCapybara(1/60); updateItems(1/60);
                                                updatePerks(1/60); updatePower(1/60); } };
      o.ghostLife = GHOST_LIFE;
      o.holeLife = HOLE_LIFE;
      fresh(); game.up.shock = 1; o.shockR = +shockRadius().toFixed(2);
      o.shockSteps = SHOCK_R.join(',');

      // Auto-Shield fires on proximity, holds, absorbs, and then rests a minute
      fresh(); game.up.autoShield = true;
      capyState.x = 0; capyState.z = 0;
      spawnItem('chili', { targeted:false, x:0.6, z:0 });
      items[0].mesh.position.y = CATCH_Y + 1.4;
      step(3);
      o.asFired = game.as.t > 1.5 && shieldBubble.visible;
      items[0].mesh.position.y = CATCH_Y - 0.05;
      step(3);
      o.asAbsorbed = game.lives === 3 && items.length === 0;
      step(Math.ceil(60 * (AS_BLINK + 0.3)));
      o.asRest = Math.round(game.as.cd);
      o.asDown = !shieldBubble.visible;

      // Chain Sweeper escalates on consecutive clears and resets on a drop
      fresh(); game.up.chain = true;
      const rec = perfect => ({ fid:++fmt.nextId, total:3, pending:0, goods:3,
                                caught: perfect?3:2, spoiled:!perfect, blocked:false,
                                gold:chainMul(), path:null });
      o.chain = [];
      for (let i=0;i<3;i++){ o.chain.push(chainMul()); completeFormation(rec(true)); }
      o.chain.push(chainMul());
      completeFormation(rec(false));
      o.chainReset = chainMul();

      // a route stranded in a sinkhole costs Puzzler nothing, but still pays
      fresh(); game.run.puzzler = true; game.lives = 3;
      completeFormation({ fid:1, total:3, pending:0, goods:3, caught:2,
                          spoiled:true, blocked:true, gold:1, path:null });
      o.blockedFree = game.lives;
      completeFormation({ fid:2, total:3, pending:0, goods:3, caught:3,
                          spoiled:false, blocked:true, gold:1, path:null });
      o.blockedClearPays = game.lives;

      // hazard rate: +20% per heart over the starting three
      fresh();
      const rate = () => { let bad = 0;
        for (let i=0;i<6000;i++){ const t = pickType(); if (t==='chili'||t==='soap') bad++; }
        return bad/6000; };
      game.lives = 3; const h3 = rate();
      game.lives = 5; const h5 = rate();
      o.heartHazard = +(h5/h3).toFixed(2);          // expect ~1.4

      // difficulty keeps moving past the point where every curve caps out
      game.level = 24; const q24 = overtime();
      game.level = 44; const q44 = overtime();
      o.overtime = [q24, +q44.toFixed(1)];

      // a perk this run made pointless is never offered
      fresh(); game.run.sticky = true;
      let offered = 0;
      for (let i=0;i<200;i++){ game.taken = {}; offerUpgrades(11);
        if ([...document.querySelectorAll('#upgradeCards .upcard b')]
              .some(b => b.textContent === 'Quick Paws')) offered++; }
      showPanel(null); game.pendingLevel = null; game.state = 'playing';
      o.deadOffered = offered;

      // every description is a sentence, and the rail shows what is held
      o.lowercase = UPGRADES.concat(RUN_PERKS).filter(u => /^[a-z]/.test(u.desc)).map(u => u.id);
      o.tiers = UPGRADES.concat(RUN_PERKS).map(u => u.tier || 'plain')
                        .filter((v,i,a) => a.indexOf(v) === i).sort().join(',');
      fresh();
      game.taken = { reach:2, autoShield:1, puzzler:1 };
      game.up.autoShield = true; game.run.puzzler = true; game.as.cd = 42;
      refreshHUD();
      const rail = document.getElementById('perkRail');
      o.rail = rail.children.length;
      o.railTiers = [...rail.children].map(c => c.className.replace('perk','').trim() || 'plain').join(',');
      o.railBadge = (rail.querySelector('b') || {}).textContent;
      o.railTimer = (rail.querySelector('s') || {}).textContent;
      fresh();
      return o;
    });
    ok('ghost lasts 5s', perks.ghostLife === 5, String(perks.ghostLife));
    ok('sinkholes close after 5s', perks.holeLife === 5, String(perks.holeLife));
    ok('shockwave is 3x the catch radius at one pick', perks.shockR === 3.75,
       `${perks.shockR} from ${perks.shockSteps}`);
    ok('Auto-Shield fires on a near hazard and absorbs it',
       perks.asFired && perks.asAbsorbed, `fired=${perks.asFired} absorbed=${perks.asAbsorbed}`);
    ok('Auto-Shield then rests a minute', perks.asRest === 60 && perks.asDown,
       `cd=${perks.asRest}s down=${perks.asDown}`);
    ok('Chain Sweeper escalates 1,2,3,4 and resets on a drop',
       String(perks.chain) === '1,2,3,4' && perks.chainReset === 1,
       `${perks.chain} then ${perks.chainReset}`);
    ok('a sinkholed route costs Puzzler nothing but still pays out',
       perks.blockedFree === 3 && perks.blockedClearPays === 4,
       `dropped ${perks.blockedFree}, cleared ${perks.blockedClearPays}`);
    ok('each heart over three adds 20% hazards',
       Math.abs(perks.heartHazard - 1.4) < 0.09, `5 hearts = ${perks.heartHazard}x of 3`);
    ok('difficulty still climbing past the caps',
       perks.overtime[0] === 0 && perks.overtime[1] === 2, String(perks.overtime));
    ok('a dead perk is never offered', perks.deadOffered === 0,
       `${perks.deadOffered}/200 drafts`);
    ok('descriptions all start with a capital', perks.lowercase.length === 0,
       perks.lowercase.join(','));
    ok('three card tiers exist', perks.tiers === 'gold,plain,silver', perks.tiers);
    ok('perk rail shows one tinted icon each, with badge and timer',
       perks.rail === 3 && perks.railTiers === 'plain,silver,gold' &&
       perks.railBadge === '2/4' && perks.railTimer === '42',
       `${perks.rail} icons [${perks.railTiers}] badge=${perks.railBadge} timer=${perks.railTimer}`);

    // the ghost is the real model, not the procedural fallback
    const ghostModel = await page.evaluate(() => ({
      one: ghostTemplate.children.length === 1,
      shared: ghostTemplate.children[0].geometry === capy.torso.geometry,
      scale: GHOST_SCALE,
    }));
    ok('ghost uses the .glb geometry',
       ghostModel.one && ghostModel.shared && ghostModel.scale === 1,
       JSON.stringify(ghostModel));

    // ---- high score board -------------------------------------------------
    // No network here on purpose: --check must pass offline and in CI, so this
    // covers the parts that do not need Supabase — normalisation, the
    // best-per-tag collapse, the panel wiring, and the rule that a run is only
    // offered to the board when it beat this device's own best.
    const board = await page.evaluate(() => {
      const o = {};
      o.tags = ['cap!!ybarry', '  spaced  ', 'waytoolongatagname', 'ok'].map(cleanTag);
      o.valid = [validTag('AB'), validTag('A'), validTag('CAPY KING'), validTag('BAD<TAG>')];
      o.escaped = esc('<img onerror=1>');
      o.best = bestPerTag([
        { tag:'A', score:9 }, { tag:'B', score:8 }, { tag:'A', score:7 }, { tag:'B', score:1 },
      ]).map(r => r.tag + ':' + r.score);
      // showPanel must know about the board, or opening it leaves two panels up
      showPanel(ui.scorePanel);
      o.exclusive = !ui.scorePanel.classList.contains('hidden') &&
                    ui.startPanel.classList.contains('hidden') &&
                    ui.overPanel.classList.contains('hidden');
      // a losing run must not ask for a tag; a personal best must
      game.best = 9999; game.score = 10; game.elapsed = 30; endGame('spicy');
      o.quietOnLoss = getComputedStyle(ui.tagRow).display === 'none';
      game.best = 0; game.score = 4310; game.elapsed = 60; endGame('spicy');
      o.promptOnBest = getComputedStyle(ui.tagRow).display !== 'none';
      showPanel(ui.startPanel);
      return o;
    });
    ok('tags normalise to what the server will store',
       String(board.tags) === 'CAPYBARRY,SPACED,WAYTOOLONGAT,OK', String(board.tags));
    ok('tag validation matches the SQL regex',
       String(board.valid) === 'true,false,true,false', String(board.valid));
    ok('board text is escaped before it reaches innerHTML',
       !/[<>]/.test(board.escaped), board.escaped);
    ok('best-per-tag keeps one row per tag, the highest',
       String(board.best) === 'A:9,B:8', String(board.best));
    ok('showPanel knows about the board panel', board.exclusive);
    ok('only a personal best is offered to the board',
       board.quietOnLoss && board.promptOnBest, JSON.stringify(board));

    /* The icons are files now, so two things can go wrong that could not before:
       a perk can name an icon nobody drew, and a file can fail to arrive. An
       uppercase letter in a filename is the same failure with a delay on it —
       it works on a case-insensitive checkout and 404s on Pages. */
    const icons = await page.evaluate(async () => {
      const ids = Object.values(POWERS).map(p => p.icon)
                    .concat(UPGRADES.concat(RUN_PERKS).map(u => u.icon));
      const load = ([id, file]) => new Promise(res => {
        const im = new Image();
        im.onload  = () => res(`${id}:${im.naturalWidth}x${im.naturalHeight}`);
        im.onerror = () => res(`${id}:FAILED`);
        im.src = ICON_DIR + file;
      });
      const got = await Promise.all(Object.entries(ICON_SRC).map(load));
      return {
        unnamed: ids.filter(id => !ICON_SRC[id]),
        broken: got.filter(g => g.endsWith('FAILED')),
        // one square source at one size for all of them: the perk rail is a
        // column, and an icon a few pixels bigger than its neighbours shows
        sizes: [...new Set(got.map(g => g.split(':')[1]))],
        uppercase: Object.values(ICON_SRC).filter(f => f !== f.toLowerCase()),
        count: Object.keys(ICON_SRC).length,
      };
    });
    ok('every perk and power-up names an icon that exists',
       icons.unnamed.length === 0, icons.unnamed.join(','));
    ok('every icon file loads', icons.broken.length === 0,
       icons.broken.join(' | ') || `${icons.count} icons`);
    ok('every icon is the same square source size',
       icons.sizes.length === 1 && /^(\d+)x\1$/.test(icons.sizes[0]) &&
       Number(icons.sizes[0].split('x')[0]) >= 128, icons.sizes.join(' | '));
    ok('icon filenames are all lowercase', icons.uppercase.length === 0,
       icons.uppercase.join(','));

    ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  }

  await browser.close();

  if (fail.length) {
    console.error(`\n${fail.length} check(s) failed.`);
    process.exit(1);
  }
})().catch(e => { console.error('harness failed:', e.message); process.exit(2); });
