/* =======================================================================
   THEME APPLICATION
   Lights, fog and ground tints ease toward the new theme over ~1.6s; the
   sky gradient is a canvas texture so it can't be lerped and swaps on the
   beat of the level-up banner, where the change reads as intentional.
   ======================================================================= */
let curTheme = THEMES[0];
const themeLerp = { t: 1 };                 // 0 = just switched, 1 = settled
const themeFrom = {}, themeTo = {};

function snapshotTheme(dst, th){
  dst.fog = new THREE.Color(th.fog);
  dst.hemiSky = new THREE.Color(th.hemiSky);
  dst.hemiGround = new THREE.Color(th.hemiGround);
  dst.amb = new THREE.Color(th.amb);
  dst.sun = new THREE.Color(th.sun);
  dst.rim = new THREE.Color(th.rim);
  dst.grass = new THREE.Color(th.grass);
  dst.grassDark = new THREE.Color(th.grassDark);
  dst.water = new THREE.Color(th.water);
  dst.cloud = new THREE.Color(th.cloud);
  dst.disc = new THREE.Color(th.disc);
  dst.hemi = th.hemi; dst.ambI = th.ambI; dst.sunI = th.sunI; dst.rimI = th.rimI;
  return dst;
}

function applyTheme(th, instant){
  const skyChanged = curTheme.sky !== th.sky;
  curTheme = th;
  if (instant){
    snapshotTheme(themeFrom, th);
  } else {
    // start from wherever we currently are, not from the previous theme's ideal
    themeFrom.fog = scene.fog.color.clone();
    themeFrom.hemiSky = hemi.color.clone();
    themeFrom.hemiGround = hemi.groundColor.clone();
    themeFrom.amb = ambient.color.clone();
    themeFrom.sun = sun.color.clone();
    themeFrom.rim = rim.color.clone();
    themeFrom.grass = mat.grass.color.clone();
    themeFrom.grassDark = mat.grassDark.color.clone();
    themeFrom.water = mat.water.color.clone();
    themeFrom.cloud = mat.cloud.color.clone();
    themeFrom.disc = sunDisc.material.color.clone();
    themeFrom.hemi = hemi.intensity; themeFrom.ambI = ambient.intensity;
    themeFrom.sunI = sun.intensity;  themeFrom.rimI = rim.intensity;
  }
  snapshotTheme(themeTo, th);
  themeLerp.t = instant ? 1 : 0;
  if (instant || skyChanged){
    scene.background.dispose();
    scene.background = makeSkyTexture(th.sky, th.skyMode);
  }
  if (typeof refreshThemeEnvironment === 'function') refreshThemeEnvironment(th);
  if (instant) updateThemeMix(1);
}

function updateThemeMix(k){
  scene.fog.color.copy(themeFrom.fog).lerp(themeTo.fog, k);
  hemi.color.copy(themeFrom.hemiSky).lerp(themeTo.hemiSky, k);
  hemi.groundColor.copy(themeFrom.hemiGround).lerp(themeTo.hemiGround, k);
  ambient.color.copy(themeFrom.amb).lerp(themeTo.amb, k);
  sun.color.copy(themeFrom.sun).lerp(themeTo.sun, k);
  rim.color.copy(themeFrom.rim).lerp(themeTo.rim, k);
  mat.grass.color.copy(themeFrom.grass).lerp(themeTo.grass, k);
  mat.grassDark.color.copy(themeFrom.grassDark).lerp(themeTo.grassDark, k);
  mat.water.color.copy(themeFrom.water).lerp(themeTo.water, k);
  mat.cloud.color.copy(themeFrom.cloud).lerp(themeTo.cloud, k);
  sunDisc.material.color.copy(themeFrom.disc).lerp(themeTo.disc, k);
  sunHalo.material.color.copy(themeFrom.disc).lerp(themeTo.disc, k);
  hemi.intensity    = THREE.MathUtils.lerp(themeFrom.hemi, themeTo.hemi, k);
  ambient.intensity = THREE.MathUtils.lerp(themeFrom.ambI, themeTo.ambI, k);
  sun.intensity     = THREE.MathUtils.lerp(themeFrom.sunI, themeTo.sunI, k);
  rim.intensity     = THREE.MathUtils.lerp(themeFrom.rimI, themeTo.rimI, k);
}

function updateTheme(dt){
  if (themeLerp.t >= 1) return;
  themeLerp.t = Math.min(1, themeLerp.t + dt / 1.6);
  const k = themeLerp.t;
  updateThemeMix(k * k * (3 - 2 * k));       // smoothstep
}

snapshotTheme(themeFrom, THEMES[0]);
snapshotTheme(themeTo, THEMES[0]);

