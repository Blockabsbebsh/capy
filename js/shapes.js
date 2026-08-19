/* =======================================================================
   ROUTE SHAPE LIBRARY

   The deck of shapes the spawn director chains routes out of. Split out of
   formations.js because it is DATA, and data is the one part of the director
   that is edited by hand — or, more usefully, by `node tools/routes.js`,
   the route editor. That tool reads this array, draws every shape, and
   writes the file back out: everything between `const FMT_SHAPES = [` and
   the closing bracket is regenerated, everything outside it is preserved
   verbatim, and a `//` comment block directly above a shape is that shape's
   note in the editor. Keep both of those true and the round trip is lossless.

   Shapes are normalised: x and z run -1..1 inside the formation's own
   footprint, which is sized and anchored in the arena at emit time. They are
   listed in the order the items ARRIVE — every item falls at the same speed
   from the same height, so emission order is landing order.

   Every beat here is FOOD. Hazards used to be written in as `bad` beats, which
   made them a property of the shape: the same two decoys in the same two
   places every time gauntlet came up, learnable in a handful of sightings, and
   the same two whether the route was five beats or twenty. They are placed at
   emit time now — see placeHazards.

   `dash` times that beat's gap against a dash-assisted run instead of a
   walking one, so the step is only comfortable if you use the dash — and is
   still always reachable.  `min` is the level the shape unlocks at.

   Nothing here is a difficulty knob. The gaps come out of stepTime, so a new
   shape is a new PATH and never a new demand — which is why the deck could
   grow from nine to nineteen for free. Nine was small enough that a long run
   started recognising hands rather than reading routes; what a new shape has
   to earn is a distinct IDEA, since two shapes that walk the same way are one
   shape as far as the player is concerned.
   ======================================================================= */
const FMT_SHAPES = [
  // the plainest thing in the deck: one straight run along a single lane
  { id:'sweep', min:1, span:0.92, weight:3, beats:[
    {x:-1,z:0}, {x:-0.5,z:0}, {x:0,z:0}, {x:0.5,z:0}, {x:1,z:0} ] },

  // three beats scattered inside a tiny footprint — barely any walking, so it
  // reads as a pause between the shapes that do ask for some
  { id:'cluster', min:1, span:0.16, weight:2, beats:[
    {x:-1,z:0.5}, {x:1,z:-0.3}, {x:0,z:0.9} ] },

  // the metronome: full depth, every other beat, all the way across
  { id:'wave', min:2, span:0.9, weight:3, beats:[
    {x:-1,z:0.2}, {x:-0.5,z:-0.9}, {x:0,z:0.2}, {x:0.5,z:-0.9}, {x:1,z:0.2} ] },

  // one diagonal, walked in five even steps
  { id:'stairs', min:3, span:0.85, weight:2, beats:[
    {x:-1,z:-0.9}, {x:-0.6,z:-0.45}, {x:-0.2,z:0}, {x:0.2,z:0.45}, {x:0.6,z:0.9} ] },

  // ends first, then closing in — the walk narrows as it goes
  { id:'funnel', min:4, span:1.0, weight:2, beats:[
    {x:-1,z:0}, {x:1,z:0.35}, {x:-0.55,z:-0.35}, {x:0.55,z:0.2}, {x:0,z:0} ] },

  // the dash shape: long hops timed against a dash rather than a walk
  { id:'leap', min:5, span:1.0, weight:2, beats:[
    {x:-1,z:0.3}, {x:0.2,z:-0.4,dash:true}, {x:1,z:0.35,dash:true} ] },

  // a run along the near edge with two reaches back into the far half
  { id:'gauntlet', min:6, span:0.95, weight:3, beats:[
    {x:-1,z:0.35}, {x:-0.45,z:-0.75}, {x:-0.1,z:0.35}, {x:0.45,z:-0.75},
    {x:1,z:0.35} ] },

  // Every traversal gets its own z LANE, front to back. The swings used to sit
  // at z 0, 0.4, -0.4, 0.35, 0 — four end-to-end lines stacked into the same
  // shallow band, which drew as three overlapping streaks with no way to tell
  // which one came first. The arena is twice as wide as it is deep, so anything
  // that crosses it repeatedly has to step in z as it goes or it is unreadable
  // however it is drawn. The walk is the same; the picture is legible.
  { id:'pendulum', min:7, span:0.95, weight:2, beats:[
    {x:-1,z:-0.9}, {x:0.9,z:-0.4}, {x:-0.7,z:0.15}, {x:0.7,z:0.6}, {x:0,z:0.95} ] },

  // min 11, not 9: the steps here are about the length of one dash, so at 9 a
  // player who dashes into them overshoots and the cooldown blocks the
  // correction — measured as losing the fifth beat 12 times out of 12, while
  // walking it cleared every run. By 11 it is robust either way.
  { id:'comb', min:11, span:0.9, weight:2, beats:[
    {x:-1,z:-0.8}, {x:-0.7,z:0.7}, {x:-0.35,z:-0.8}, {x:0,z:0.7},
    {x:0.35,z:-0.8}, {x:0.7,z:0.7}, {x:1,z:-0.8} ] },

  // a plain V: in and out on the diagonal, the simplest depth-change there is
  { id:'chevron', min:2, span:0.85, weight:2, beats:[
    {x:-1,z:-0.85}, {x:-0.5,z:0.1}, {x:0,z:0.9}, {x:0.5,z:0.1}, {x:1,z:-0.85} ] },

  // a smooth bow — the wave's curve without the reversals, so it walks as one
  // continuous arc instead of five decisions
  { id:'arc', min:3, span:0.9, weight:2, beats:[
    {x:-1,z:0.55}, {x:-0.55,z:-0.35}, {x:0,z:-0.85}, {x:0.55,z:-0.35},
    {x:1,z:0.55} ] },

  // four beats, full depth each time: fewer, longer strides than the wave
  { id:'ladder', min:4, span:0.8, weight:2, beats:[
    {x:-0.95,z:0.85}, {x:-0.3,z:-0.85}, {x:0.3,z:0.85}, {x:0.95,z:-0.85} ] },

  // runs out one way and returns, so the second half is walked backwards
  // through ground you have already covered
  { id:'boomerang', min:5, span:0.95, weight:2, beats:[
    {x:-1,z:0.5}, {x:-0.2,z:-0.55}, {x:0.7,z:0.35}, {x:0,z:0.85},
    {x:-0.75,z:-0.2} ] },

  // both far corners first, then closing in on the middle — laned in z like the
  // pendulum above, and unlike it the amplitude shrinks every step, so the
  // picture is a funnel of crossings converging rather than parallel streaks
  { id:'pincer', min:6, span:1.0, weight:2, beats:[
    {x:-1,z:0.9}, {x:1,z:0.45}, {x:-0.55,z:0}, {x:0.5,z:-0.45}, {x:0,z:-0.9} ] },

  // a near-edge run broken by two lifts into the far half
  { id:'slalom', min:7, span:0.9, weight:3, beats:[
    {x:-1,z:-0.55}, {x:-0.6,z:0.6}, {x:-0.3,z:-0.6}, {x:0.1,z:0.6},
    {x:0.4,z:-0.6}, {x:0.85,z:-0.5} ] },

  // a spiral inward — every step turns the same way, which reads very
  // differently from anything that zig-zags
  { id:'coil', min:8, span:0.95, weight:2, beats:[
    {x:1,z:0.1}, {x:0.35,z:0.8}, {x:-0.55,z:0.5}, {x:-0.9,z:-0.4},
    {x:0.05,z:-0.85}, {x:0.5,z:-0.25} ] },

  // the second dash shape: one long committed hop across, then a short
  // recovery back — the leap without the second dash in a row
  { id:'hook', min:9, span:1.0, weight:2, beats:[
    {x:-1,z:-0.6}, {x:-0.4,z:0.5}, {x:0.85,z:0.6,dash:true}, {x:0.5,z:-0.7} ] },

  // peaks of uneven height off a shared baseline, so the rhythm is irregular
  // where the wave's is metronomic
  { id:'crown', min:10, span:0.92, weight:2, beats:[
    {x:-1,z:-0.2}, {x:-0.6,z:0.85}, {x:-0.2,z:-0.2}, {x:0.15,z:0.55},
    {x:0.5,z:-0.2}, {x:1,z:-0.2} ] },

  // the long one: seven beats weaving the full width. A weave rarely takes a
  // decoy — placeHazards needs a line to sit off of and this crosses its own
  { id:'serpent', min:12, span:1.0, weight:2, beats:[
    {x:-1,z:0.2}, {x:-0.62,z:-0.7}, {x:-0.25,z:0.55}, {x:0.1,z:-0.75},
    {x:0.42,z:0.6}, {x:0.72,z:-0.5}, {x:1,z:0.35} ] },
];
