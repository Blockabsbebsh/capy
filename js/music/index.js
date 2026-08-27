/* =======================================================================
   MUSIC BRIDGE — the five tracks, in biome order, behind one object.

   The tracks are ES modules; the rest of the game is classic scripts sharing
   one global scope (see CLAUDE.md — the script order is load-bearing and
   converting the game to modules would break it). So exactly one module is
   loaded from index.html and it publishes `window.Music`; `js/audio.js`
   delegates to that and keeps its own Web Audio context for the SFX.

   Module scripts are deferred, so this runs after every classic script has
   parsed but before any user gesture. `startMusic()` is only ever called from
   a click, so `window.Music` is always there by then — `pending` covers the
   pathological case rather than the normal one.
   ======================================================================= */
import * as meadow    from './meadow.js';
import * as ponds     from './ponds.js';
import * as bubblegum from './bubblegum.js';
import * as night     from './night.js';
import * as hell      from './hell.js';

// biome order, and it must stay in step with THEMES in config.js
const TRACKS = [meadow, ponds, bubblegum, night, hell];

let cur = 0, playing = false, level = 1, vol = 0.75;

const clamp = i => Math.min(TRACKS.length - 1, Math.max(0, i | 0));

export const Music = {
  tracks: TRACKS,
  specs: TRACKS.map(t => t.spec),
  get current(){ return cur; },
  get playing(){ return playing; },

  play(){
    if (playing) return;
    playing = true;
    TRACKS[cur].setVolume(vol);
    TRACKS[cur].start({ level });
  },
  stop(){
    if (!playing) return;
    playing = false;
    TRACKS[cur].stop();
  },
  /* A theme change is a piece change: the old one stops dead and the new one
     starts from its own bar one. Crossfading two written pieces in different
     keys and tempos is worse than a cut. */
  setTheme(i){
    const next = clamp(i);
    if (next === cur) return;
    // build the incoming voices BEFORE silencing the outgoing ones, so the gap
    // between the two pieces is a beat rather than however long a build takes
    TRACKS[next].warm();
    // keepTransport: the clock is handed over, not stopped and restarted
    if (playing) TRACKS[cur].stop({ keepTransport: true });
    cur = next;
    if (playing){ TRACKS[cur].setVolume(vol); TRACKS[cur].start({ level }); }
  },
  /** Build a track's voices ahead of time. See warm() in any track file. */
  warm(i){ TRACKS[clamp(i)].warm(); },
  setLevel(l){ level = l; TRACKS[cur].setLevel(l); },
  // duck() from the game lands here: one volume, applied live
  setVolume(v){ vol = Math.max(0, Math.min(1, v)); TRACKS[cur].setVolume(vol); },
};

globalThis.Music = Music;

/* Warm the first biome once the page has gone quiet. Its voices take a few
   hundred ms to build, and paying that here — while the menu is up and nothing
   is waiting on the main thread — is the difference between the music starting
   with the level and starting a beat after it. */
const idle = globalThis.requestIdleCallback || (fn => setTimeout(fn, 1200));
idle(() => { try { Music.warm(0); } catch (e) { /* no Tone yet: start() rebuilds */ } });
// audio.js records anything asked for before this module ran, and this replays it
if (typeof globalThis.__musicPending === 'function') globalThis.__musicPending(Music);
