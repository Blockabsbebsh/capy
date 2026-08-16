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

// level -> biome, matching THEMES order in config.js (a new theme every 5 levels)
const BIOMES = { meadow: 1, pond: 6, candy: 11, night: 16, hell: 21 };

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
      // every name the animation code reaches into (see CLAUDE.md)
      rig: ['root','bob','squash','tilt','body','head','legs','muzzle','mouth',
            'skull','hatAnchor','stackAnchor'].filter(k => !capy[k]),
      rigNums: typeof capy.legRestY === 'number' && typeof capy.stackBaseY === 'number',
      legs: capy.legs.length,
    }));
    ok('boots and clears the loading screen', boot.loadingGone && boot.canvas);
    ok('HUD populated', boot.lives === 3 && boot.hats === 6, `lives=${boot.lives} hats=${boot.hats}`);
    ok('capybara rig complete', boot.rig.length === 0 && boot.rigNums && boot.legs === 4,
       boot.rig.length ? 'missing: ' + boot.rig.join(',') : '');

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

    // Set-pieces must never repeat back to back.
    const seq = await page.evaluate(() => {
      game.level = 8; evt.last = null;
      const out = [];
      for (let i = 0; i < 300; i++) { triggerEvent(); out.push(evt.last); evt.active = null; evt.queue.length = 0; }
      return out;
    });
    const repeats = seq.filter((k, i) => i && k === seq[i - 1]).length;
    ok('no back-to-back set-pieces', repeats === 0, `${repeats} in ${seq.length}`);

    ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  }

  await browser.close();

  if (fail.length) {
    console.error(`\n${fail.length} check(s) failed.`);
    process.exit(1);
  }
})().catch(e => { console.error('harness failed:', e.message); process.exit(2); });
