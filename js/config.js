/* =======================================================================
   CONSTANTS / TUNING
   ======================================================================= */
const ARENA = { halfX: 8.6, halfZ: 4.2 };      // capybara movement bounds
const SPAWN_Y = 15;
const CATCH_Y = 1.35;                           // mouth height
const CATCH_R = 1.25;                           // horizontal catch radius
const START_LIVES = 3;
const GRAV = -19;

const SLIP_TIME = 2.0;       // seconds of soap-slick controls

/* --- movement feel -------------------------------------------------------
   Every input path — keys, pointer drag, thumbstick — resolves to a DESIRED
   velocity, and updateCapybara eases the real velocity toward it. These are
   the times, in seconds, to close 90% of that gap; smaller is snappier.

   Having three of them is the whole point. The previous model accelerated at
   a fixed 92 u/s² and then let friction do the stopping, which measured out
   at 0.18s to reach full speed but 0.77s and 3.2 units of glide to stop —
   more than twice the catch radius, so you could never park on a landing
   ring, only drift over it. */
const MOVE_T_ACCEL = 0.10;   // opening up, or holding a line
const MOVE_T_BRAKE = 0.07;   // input released: stop, don't coast
const MOVE_T_TURN  = 0.07;   // reversing into the opposite direction
const MOVE_T_SLIP  = 0.55;   // soap turns all of the above to mush
const DRAG_GAIN    = 11;     // pointer drag: desired speed per unit of offset
const DRAG_DEAD    = 0.05;   // pointer offset below which we simply stop

/* --- dash ----------------------------------------------------------------
   The player's action button, in place of the old hop. It is a repositioning
   tool first: a burst well above top speed that carries you over a sinkhole,
   and pays double on anything you catch during it. The hop itself is still
   here — catches, respawns and shield bounces all pop the capybara up — it
   just isn't something you can ask for any more. */
const DASH_SPEED = 34;       // u/s at the start of the burst
const DASH_TIME  = 0.22;     // seconds of burst
const DASH_CD    = 0.55;     // cooldown, counted from the end of the burst
const DASH_BONUS = 2.0;      // score multiplier for catching mid-dash
const DASH_REACH = 0.2;      // extra catch radius while dashing
const STEP_RATE = 1.03;      // leg-cycle speed per unit of ground speed. Purely
                             // cosmetic — the cycle is not matched to distance
                             // travelled, so this is a look dial, not physics.
const HEART_FALL = 3.1;      // hearts ignore fallSpeed and drift down at this rate

const TYPES = {
  burger:     { good:true,  points:10,  radius:0.46, weight:1.0 },
  watermelon: { good:true,  points:40,  radius:0.52, weight:0.30 },
  chili:      { good:false, points:0,   radius:0.34, weight:0.42 },
  // soap no longer drains points — it makes you slippery, which you can feel
  soap:       { good:false, points:0,   radius:0.40, weight:0.34, slip:true },
  // power-ups: catching them is good, missing them costs nothing
  magnet:     { good:true, neutral:true, power:'magnet', points:0, radius:0.46 },
  shield:     { good:true, neutral:true, power:'shield', points:0, radius:0.46 },
  slowmo:     { good:true, neutral:true, power:'slowmo', points:0, radius:0.46 },
  heart:      { good:true, neutral:true, heal:true,      points:0, radius:0.42 },
};

const POWERS = {
  magnet: { name:'MAGNET',   dur:7.5, color:'#ff8494', blurb:'food comes to you' },
  shield: { name:'SHIELD',   dur:12,  color:'#8fe9ff', blurb:'blocks one hit' },
  slowmo: { name:'SLOW-MO',  dur:7,   color:'#bff4ff', blurb:'time crawls, food pours' },
};

/* Upgrades are drafted every 5 levels. Each one bumps a field on game.up,
   which the relevant system reads live — nothing here needs a re-apply pass. */
const UPGRADES = [
  { id:'reach',  icon:'🫴', name:'Long Reach',   desc:'+0.22 catch radius',        max:4,
    apply:u => u.reach += 0.22,   level:u => u.reach / 0.22 },
  { id:'decay',  icon:'⏳', name:'Slow Chewer',  desc:'+0.8s on the combo timer',  max:4,
    apply:u => u.decay += 0.8,    level:u => u.decay / 0.8 },
  { id:'power',  icon:'✨', name:'Power Hoarder',desc:'power-ups last 30% longer',  max:3,
    apply:u => u.powerMul += 0.3, level:u => Math.round((u.powerMul - 1) / 0.3) },
  { id:'speed',  icon:'💨', name:'Quick Paws',   desc:'+12% movement speed',       max:3,
    apply:u => u.speed += 0.12,   level:u => Math.round((u.speed - 1) / 0.12) },
  { id:'melon',  icon:'🍉', name:'Melon Lover',  desc:'watermelons pay +60%',      max:3,
    apply:u => u.melon += 0.6,    level:u => Math.round((u.melon - 1) / 0.6) },
  { id:'life',   icon:'❤️', name:'Second Wind',  desc:'+1 max life, refilled now', max:3,
    apply:u => u.life += 1,       level:u => u.life },
  { id:'hearts', icon:'💖', name:'Lucky Heart',  desc:'hearts drop twice as often',max:2,
    apply:u => u.heartRate += 1,  level:u => u.heartRate },
];

/* =======================================================================
   VISUAL THEMES — the meadow shifts every 5 levels, and the music
   changes key/instrumentation with it (see Audio.setMusicTheme).
   ======================================================================= */
const THEMES = [
  { name:'Meadow', arena:'meadow', skyMode:'gradient',
    sky:['#3f7bd6','#69aee6','#b6dcf0','#ffd9a0','#ffb779'],
    fog:0xbfd9e8, hemiSky:0xbfe3ff, hemiGround:0x6b7a3a, hemi:0.62,
    amb:0xffe8cc, ambI:0.34, sun:0xffd9a8, sunI:2.15, rim:0x88bbff, rimI:0.5,
    grass:0x8ec54f, grassDark:0x7ab244, water:0x4fb3d9, cloud:0xffffff, disc:0xfff0c0 },

  { name:'Lily Pad Ponds', arena:'pond', skyMode:'gradient',
    sky:['#3f8bab','#5fa9c2','#8ec9c8','#bcdccb','#d8e8d2'],
    fog:0xb9dcd6, hemiSky:0x9fd3d0, hemiGround:0x315b52, hemi:0.78,
    amb:0xd8f0e8, ambI:0.55, sun:0xcdeee0, sunI:2.0, rim:0x6bb6c0, rimI:0.62,
    grass:0x79ad78, grassDark:0x4f8f72, water:0x3fa8bc, cloud:0xf3fbf8, disc:0xcdeee2 },

  { name:'Bubblegum', arena:'candy', skyMode:'candy',
    sky:['#8b4fc1','#c26bcf','#f08bbd','#f7b5cf','#ffe0ef'],
    fog:0xf2b7d0, hemiSky:0xffc8e1, hemiGround:0x8e6680, hemi:0.66,
    amb:0xffd9ec, ambI:0.42, sun:0xffc7e0, sunI:1.9, rim:0xff8fd0, rimI:0.58,
    grass:0xf2c4d9, grassDark:0xe7a7ca, water:0x8fc8dd, cloud:0xfff4fb, disc:0xfff0f7 },

  { name:'Night', arena:'night', skyMode:'night',
    sky:['#030713','#07132b','#0c1d3e','#142a50','#20375d'],
    fog:0x162846, hemiSky:0x5e78ae, hemiGround:0x11182b, hemi:0.5,
    amb:0x8fa4d6, ambI:0.4, sun:0x9fbaff, sunI:0.9, rim:0x718fff, rimI:0.8,
    grass:0x263c31, grassDark:0x1b2d26, water:0x1f4c68, cloud:0x52698c, disc:0xdde9ff },

  { name:'Hell', arena:'hell', skyMode:'hell',
    sky:['#4a1006','#7a1e0a','#c23a10','#ff7a2a','#ffb347'],
    fog:0x8a2818, hemiSky:0xff8a3c, hemiGround:0x3a1208, hemi:0.85,
    amb:0xffa060, ambI:0.75, sun:0xff6a2a, sunI:2.6, rim:0xffa040, rimI:0.9,
    grass:0x211313, grassDark:0x120b0b, water:0x5b130b, cloud:0x3a1715, disc:0xffcf6a },
];
const themeFor = level => THEMES[Math.min(THEMES.length - 1, Math.floor((level - 1) / 5))];

/* honour the OS "reduce motion" setting: no shake, no flashes, no FOV punches */
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let REDUCED = reduceMotionQuery.matches;
reduceMotionQuery.addEventListener?.('change', e => { REDUCED = e.matches; });

/* thumbstick + HOP button on touch devices, keyboard hint on everything else */
const TOUCH = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (TOUCH) document.body.classList.add('touch');

