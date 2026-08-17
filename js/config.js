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

/* Ceiling on the hop. Catches, hits, respawns and shield bounces all pop the
   capybara up, and those pops used to STACK: assigning hopV while already
   airborne relaunches from that height, so a few hits in quick succession put
   the capybara in the stratosphere and out of the fight on the way back down.
   See popUp() in player.js. */
const HOP_MAX = 2.4;

/* Grace period after taking a hit. There was none, so three chillis landing in
   quick succession took all three lives with nothing the player could do — the
   run ended before the first hit had finished reading. */
const HIT_INVULN = 1.2;

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

/* Quick Paws' landing shockwave: a ring thrown out where the burst ends that
   hoovers up food inside it. The multiplier is on the catch radius, so the
   first pick already reaches three times as far as you can, and it widens from
   there. At 1.5x it was barely wider than an ordinary catch and the perk read
   as nothing happening. */
const SHOCK_R = [0, 3.0, 4.0, 5.0];
const SHOCK_LIFE = 0.5;      // seconds the visual ring takes to expand and fade

/* Phantombara's afterimage: how long a dash's ghost lingers. It catches on the
   same radius the capybara does, so a ghost parked on a landing ring is as good
   as standing there yourself — 5s is long enough to place one and go back for
   something else, which is the whole point of the perk. */
const GHOST_LIFE = 5.0;

/* Auto-Shield: a bubble that throws itself up when a hazard gets close, holds
   for BLINK seconds, and then needs a full minute. The radius is generous
   because it has to fire BEFORE the thing hits you, not as it lands. */
const AS_RADIUS = 2.6;       // how close a falling hazard has to get
const AS_BLINK  = 2.0;       // seconds up, blinking, absorbing anything hostile
const AS_COOL   = 60;        // seconds before it can fire again

/* Each heart past the starting three raises the hazard rate by this much. More
   lives is more room for error, so it buys more to go wrong. */
const HAZARD_PER_HEART = 0.20;
const STEP_RATE = 1.03;      // leg-cycle speed per unit of ground speed. Purely
                             // cosmetic — the cycle is not matched to distance
                             // travelled, so this is a look dial, not physics.
const HEART_FALL = 3.1;      // hearts ignore fallSpeed and drift down at this rate

/* Fall speed keeps its old ramp — the early levels are unchanged — but stops
   climbing far sooner. Past this the difficulty is carried by the spawn
   director's shapes getting longer and tighter (see formations.js), not by
   giving the player less time to read anything. At the old 15.5 ceiling an
   item fell from spawn to catch height in 0.82s, of which roughly 0.3s had a
   legible landing ring; at 11 that fall is 1.08s. */
const FALL_CAP = 11.0;

/* Minimum seconds between level-ups, however much score arrives. The curve is
   1 + score/220 + elapsed/34, and a watermelon at a x6 multiplier is worth
   240 — so a feast, or a magnet over a feast, used to bank a dozen levels in
   a couple of seconds and drop a fresh run straight into Hell. */
const LEVEL_MIN_GAP = 4.5;

/* `weight` used to live here and hasn't been read since pickType started
   working off level-scaled chances — removed rather than left to imply a spawn
   weighting that does not exist. */
const TYPES = {
  burger:     { good:true,  points:10,  radius:0.46 },
  watermelon: { good:true,  points:40,  radius:0.52 },
  chili:      { good:false, points:0,   radius:0.34 },
  // soap no longer drains points — it makes you slippery, which you can feel
  soap:       { good:false, points:0,   radius:0.40, slip:true },
  // power-ups: catching them is good, missing them costs nothing
  magnet:     { good:true, neutral:true, power:'magnet', points:0, radius:0.46 },
  shield:     { good:true, neutral:true, power:'shield', points:0, radius:0.46 },
  slowmo:     { good:true, neutral:true, power:'slowmo', points:0, radius:0.46 },
  heart:      { good:true, neutral:true, heal:true,      points:0, radius:0.42 },
};

/* Magnet pursuit speed. Has to beat the capybara's own top speed outright —
   (12.2 + level*0.16) * up.speed peaks around 22 — or a running player simply
   tows the food along behind them and the power-up reads as decoration. */
const MAGNET_SPEED = 24;

/* Magnet is half of what it was. At 7.5s it did not read as a power-up so much
   as an intermission: nothing could be dropped, nothing could hit you, and a
   feast landing under one banked levels on its own. */
const POWERS = {
  magnet: { name:'MAGNET',   dur:3.75, color:'#ff8494', icon:'magnet' },
  shield: { name:'SHIELD',   dur:12,   color:'#8fe9ff', icon:'shield' },
  slowmo: { name:'SLOW-MO',  dur:7,    color:'#bff4ff', icon:'slowmo' },
};

/* Upgrades are drafted every 10 levels. Each one bumps a field on game.up,
   which the relevant system reads live — nothing here needs a re-apply pass.

   `icon` names an entry in ICON_BODY (icons.js) — drawn, not an emoji, so the
   same card looks the same on every platform.

   `tier` drives the card treatment and the icon on the owned-perk rail:
   undefined for the ordinary stacking perks, 'silver' for the two one-offs, and
   'gold' for the run perks below. `dead(game)` marks a perk that this run has
   made pointless — it is kept out of the draft and struck through if it is ever
   shown, because offering a dash upgrade to a player with no dash is worse than
   offering nothing.

   Descriptions are sentences: capital letter, no full stop. */
const UPGRADES = [
  { id:'reach',  icon:'reach', name:'Long Snout',
    desc:'+0.22 catch radius, shown as an aura', max:4,
    apply:u => u.reach += 0.22 },
  { id:'dash',   icon:'dash', name:'Quick Paws',
    desc:'Dash cools 25% faster, and lands a food-catching shockwave', max:3,
    apply:u => { u.dashCD *= 0.75; u.shock++; },
    dead:g => g.run.sticky },                    // no dash, nothing to cool
  { id:'melon',  icon:'melon', name:'Melon Lover',
    desc:'Watermelons pay +60%', max:3,
    apply:u => u.melon += 0.6 },
  { id:'life',   icon:'life', name:'Second Wind',
    desc:'+1 max life, and one heart back', max:3,
    apply:u => u.life += 1 },
  { id:'hearts', icon:'hearts', name:'Lucky Heart',
    desc:'A heart right now, and hearts drop twice as often', max:2,
    apply:u => u.heartRate += 1 },
  /* The two silver one-offs: bigger than a stacking perk, smaller than a gold
     trade, and neither of them costs you anything. */
  { id:'autoShield', icon:'autoShield', name:'Auto-Shield', tier:'silver', max:1,
    desc:'A bubble that throws itself up when a hazard closes in, then rests a minute',
    apply:u => u.autoShield = true },
  { id:'chain',  icon:'chain', name:'Chain Sweeper', tier:'silver', max:1,
    desc:'Clear a route and the next one turns golden: ×2 on everything, then ×3, ×4…',
    apply:u => u.chain = true },
];

/* ONE-PER-RUN PERKS. Each is a trade with a real cost, not a straight buff, so
   taking one is a decision about how the rest of the run plays rather than a
   number going up. Half the drafts offer one alongside the ordinary perks, and
   the gold slot closes for the whole run once any of them is taken. */
const RUN_PERKS = [
  { id:'phantom', icon:'phantom', name:'Phantombara', tier:'gold', max:1,
    desc:'−1 max life. Every dash leaves a ghost for 5s that catches food — a hazard pops it',
    apply:r => r.phantom = true,
    dead:g => g.run.sticky },
  { id:'sticky',  icon:'sticky', name:'Sticky Feet', tier:'gold', max:1,
    // measured: a five-beat route takes 1.77s normally and 3.55s under this,
    // because formations are timed against game.up.speed. Items fall at exactly
    // the same rate — it is the route that unfolds at half pace.
    desc:'Immune to sinkholes and soap. Half speed and no dash, and routes arrive at half pace to match',
    apply:r => r.sticky = true },
  { id:'puzzler', icon:'puzzler', name:'Puzzler', tier:'gold', max:1,
    desc:'Routes fall half as fast. Clear one for a life, drop one and it costs a life',
    apply:r => r.puzzler = true },
];

/* Hearts are drawn one glyph each up to five, then as "5+n" — Puzzler can run
   the count well past anything the HUD row could hold. */
const LIVES_SHOWN = 5;
const LIVES_MAX = 20;

/* =======================================================================
   VISUAL THEMES — the meadow shifts every THEME_EVERY levels, and the music
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
/* A biome every TEN levels, not five. The level curve got a lot quicker, and at
   one theme per five levels a run was in Hell before it had finished learning
   the meadow — and drafted seven perks on the way. */
const THEME_EVERY = 10;
const themeFor = level =>
  THEMES[Math.min(THEMES.length - 1, Math.floor((level - 1) / THEME_EVERY))];

/* honour the OS "reduce motion" setting: no shake, no flashes, no FOV punches */
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let REDUCED = reduceMotionQuery.matches;
reduceMotionQuery.addEventListener?.('change', e => { REDUCED = e.matches; });

/* thumbstick + DASH button on touch devices, keyboard hint on everything else */
const TOUCH = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (TOUCH) document.body.classList.add('touch');
