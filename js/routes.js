/* =======================================================================
   ROUTE LIBRARY

   Every route the director can drop, as data. There is no runtime construction:
   a route is emitted exactly as drawn, rotated to a random angle and scaled to
   the field, so what the editor (`node tools/routes.js`) shows is what lands.

   The chainer this replaced assembled each route from two to five smaller
   shapes and measured badly: joins averaged a 105 degree turn against 65 inside
   a shape, and 46% of them passed the system's own near-reversal threshold
   against 2% inside a shape. The randomness a player saw was the seams — and it
   bought little, since 60% of late routes were a single shape anyway.

   COORDINATES ARE A UNIT DISC: x and z in -1..1 with x^2 + z^2 <= 1, scaled by
   the arena radius at emit. The disc is why the arena is a circle — a rotation
   on a circle is exact, so one authored route is 360 that all still fit.

   Routes are listed in the order items ARRIVE: everything falls at the same
   speed from the same height, so emission order is landing order.

   `min` is the unlock level and ALSO how length is paced — short routes early,
   longer ones layered on top, nothing ever removed, so a three-beat route is
   still in the deck at level 60 and there is no distribution to tune.
   `weight` is tickets in the pool of everything unlocked. `dash` on a beat
   prices that step against a dash-assisted run, and falls back to walking time
   for a player who traded the dash away.

   Nothing here is a difficulty knob: gaps come out of stepTime, so a new route
   is a new PATH, never a new demand. What it has to earn is a distinct IDEA —
   two routes that walk the same way are one route, and rotation already covers
   "the same but turned".
   ======================================================================= */
const ROUTES = [
  // the plainest thing in the deck: one straight run across the field
  { id:'line', min:1, weight:4, beats:[
    {x:-1,z:0}, {x:-0.33,z:0}, {x:0.33,z:0}, {x:1,z:0} ] },

  // half a crossing — the shortest route there is
  { id:'shortline', min:1, weight:3, beats:[
    {x:-0.62,z:0}, {x:0,z:0}, {x:0.62,z:0} ] },

  // a straight run, offset off centre so it is not always the middle
  { id:'lean', min:1, weight:3, beats:[
    {x:-0.86,z:0.42}, {x:-0.29,z:0.42}, {x:0.29,z:0.42}, {x:0.86,z:0.42} ] },

  // a quarter of the rim, walked as a gentle curve
  { id:'bend', min:1, weight:3, beats:[
    {x:0.76,z:0.15}, {x:0.63,z:0.46}, {x:0.38,z:0.68}, {x:0.06,z:0.78} ] },

  // in and out: two short legs meeting at a point
  { id:'wedge', min:2, weight:3, beats:[
    {x:-0.83,z:0.53}, {x:0,z:-0.53}, {x:0.42,z:0}, {x:0.83,z:0.53} ] },

  // one straight, one turn, one straight
  { id:'step', min:2, weight:3, beats:[
    {x:-0.8,z:-0.35}, {x:-0.25,z:-0.35}, {x:-0.25,z:0.35}, {x:0.35,z:0.35} ] },

  // a third of the rim
  { id:'curl', min:2, weight:3, beats:[
    {x:0.7,z:0}, {x:0.61,z:0.34}, {x:0.38,z:0.59}, {x:0.05,z:0.7},
    {x:-0.29,z:0.64} ] },

  // a lazy diagonal across the middle
  { id:'cross', min:3, weight:3, beats:[
    {x:-0.85,z:-0.4}, {x:-0.2,z:-0.1}, {x:0.2,z:0.15}, {x:0.85,z:0.45} ] },

  // down, up, and away
  { id:'tick', min:3, weight:3, beats:[
    {x:-0.7,z:0.3}, {x:-0.2,z:-0.15}, {x:0.15,z:0.55}, {x:0.75,z:0.15} ] },

  // three wide strides, each turning the other way
  { id:'hop', min:3, weight:2, beats:[
    {x:-0.9,z:0}, {x:-0.1,z:0.45}, {x:0.55,z:-0.3}, {x:0.95,z:0.2} ] },

  // one soft wave along a crossing
  { id:'shallow', min:4, weight:3, beats:[
    {x:-1,z:0}, {x:-0.5,z:0.3}, {x:0,z:0}, {x:0.5,z:-0.3}, {x:1,z:0} ] },

  // a wide sweep around one side of the field
  { id:'corner', min:4, weight:3, beats:[
    {x:-0.9,z:-0.3}, {x:-0.3,z:-0.75}, {x:0.35,z:-0.7}, {x:0.8,z:-0.25} ] },

  // one long S down the field and back
  { id:'esscurve', min:5, weight:3, beats:[
    {x:-1,z:0}, {x:-0.6,z:0.59}, {x:-0.2,z:0.36}, {x:0.2,z:-0.36},
    {x:0.6,z:-0.59}, {x:1,z:0} ] },

  // a tight weave across the middle
  { id:'zigshort', min:5, weight:3, beats:[
    {x:-0.81,z:-0.57}, {x:-0.41,z:0.57}, {x:0,z:-0.57}, {x:0.41,z:0.57},
    {x:0.81,z:-0.57} ] },

  // half the rim, edge to edge the long way round
  { id:'halfring', min:5, weight:3, beats:[
    {x:0.82,z:0}, {x:0.66,z:0.48}, {x:0.25,z:0.78}, {x:-0.25,z:0.78},
    {x:-0.66,z:0.48}, {x:-0.82,z:0} ] },

  // a proper V — out to one rim, back to the other
  { id:'vsharp', min:6, weight:3, beats:[
    {x:-0.78,z:0.61}, {x:-0.39,z:0}, {x:0,z:-0.61}, {x:0.26,z:-0.2},
    {x:0.52,z:0.2}, {x:0.78,z:0.61} ] },

  // a staircase, every tread the same length
  { id:'stairs', min:6, weight:3, beats:[
    {x:-0.81,z:-0.57}, {x:-0.43,z:-0.57}, {x:-0.43,z:-0.1}, {x:0.05,z:-0.1},
    {x:0.05,z:0.4}, {x:0.57,z:0.4} ] },

  // a straight run that hooks hard at the end
  { id:'hook', min:6, weight:2, beats:[
    {x:-0.9,z:0.15}, {x:-0.3,z:0.1}, {x:0.35,z:0.05}, {x:0.75,z:-0.45,dash:true},
    {x:0.3,z:-0.8} ] },

  // crosses its own middle twice
  { id:'bowtie', min:7, weight:3, beats:[
    {x:-0.88,z:-0.4}, {x:-0.24,z:-0.16}, {x:-0.6,z:0.62}, {x:0.24,z:0.16},
    {x:0.88,z:-0.4}, {x:0.6,z:0.62} ] },

  // most of the way round the rim
  { id:'threearc', min:7, weight:3, beats:[
    {x:0.72,z:0}, {x:0.59,z:0.41}, {x:0.26,z:0.67}, {x:-0.16,z:0.7},
    {x:-0.53,z:0.49}, {x:-0.71,z:0.1}, {x:-0.65,z:-0.32} ] },

  // down one side, back along the other
  { id:'pincer', min:7, weight:2, beats:[
    {x:-0.9,z:-0.35}, {x:-0.35,z:-0.6}, {x:0.25,z:-0.55}, {x:0.25,z:0.3},
    {x:-0.35,z:0.55}, {x:-0.9,z:0.3} ] },

  // three points and three returns toward the middle
  { id:'spike', min:8, weight:3, beats:[
    {x:0.92,z:0}, {x:0.23,z:0.4}, {x:-0.46,z:0.8}, {x:-0.46,z:0},
    {x:-0.46,z:-0.8}, {x:0.23,z:-0.4} ] },

  // a full wave across, deep enough to be a walk
  { id:'longwave', min:8, weight:3, beats:[
    {x:-1,z:0}, {x:-0.67,z:0.45}, {x:-0.33,z:0}, {x:0,z:-0.45}, {x:0.33,z:0},
    {x:0.67,z:0.45}, {x:1,z:0} ] },

  // the long way round one rim
  { id:'cornerrun', min:9, weight:3, beats:[
    {x:-0.85,z:-0.45}, {x:-0.25,z:-0.8}, {x:0.45,z:-0.7}, {x:0.85,z:-0.15},
    {x:0.5,z:0.45}, {x:-0.1,z:0.7} ] },

  // two straights joined by a hard turn
  { id:'dogleg', min:9, weight:2, beats:[
    {x:-0.9,z:0.3}, {x:-0.35,z:0.35}, {x:0.1,z:0}, {x:0.15,z:-0.6},
    {x:0.7,z:-0.65,dash:true}, {x:0.95,z:-0.2} ] },

  // out to the rim and back to the middle, three times
  { id:'petal3', min:10, weight:3, beats:[
    {x:0.38,z:-0.18}, {x:0.77,z:-0.36}, {x:0.38,z:0.18}, {x:0.13,z:0.22},
    {x:-0.04,z:0.42}, {x:-0.07,z:0.85}, {x:-0.35,z:0.24}, {x:-0.25,z:0},
    {x:-0.35,z:-0.24}, {x:-0.7,z:-0.48}, {x:-0.04,z:-0.42} ] },

  // a spiral inward from the rim to the middle
  { id:'spiralin', min:11, weight:3, beats:[
    {x:0.92,z:0}, {x:0.51,z:0.64}, {x:-0.16,z:0.69}, {x:-0.54,z:0.26},
    {x:-0.45,z:-0.22}, {x:-0.09,z:-0.38}, {x:0.18,z:-0.22}, {x:0.18,z:0} ] },

  // a full weave, corner to corner
  { id:'zigzag', min:11, weight:3, beats:[
    {x:-0.9,z:-0.42}, {x:-0.6,z:0.42}, {x:-0.3,z:-0.42}, {x:0,z:0.42},
    {x:0.3,z:-0.42}, {x:0.6,z:0.42}, {x:0.9,z:-0.42} ] },

  // two Us in a row, sharing a middle
  { id:'doubleu', min:12, weight:3, beats:[
    {x:-0.91,z:0.39}, {x:-0.65,z:-0.32}, {x:-0.26,z:-0.69}, {x:0.06,z:-0.26},
    {x:0.14,z:0.43}, {x:0.49,z:-0.1}, {x:0.81,z:-0.49}, {x:0.94,z:0.1} ] },

  // a full circuit of the rim, closing where it started
  { id:'ringrun', min:12, weight:3, beats:[
    {x:0.85,z:0}, {x:0.62,z:0.58}, {x:0.07,z:0.85}, {x:-0.53,z:0.67},
    {x:-0.84,z:0.13}, {x:-0.71,z:-0.47}, {x:-0.2,z:-0.83}, {x:0.42,z:-0.74},
    {x:0.81,z:-0.26} ] },

  // a star: four points, four returns
  { id:'star5', min:13, weight:3, beats:[
    {x:0.92,z:0}, {x:0.35,z:0.35}, {x:0,z:0.92}, {x:-0.35,z:0.35}, {x:-0.92,z:0},
    {x:-0.35,z:-0.35}, {x:0,z:-0.92}, {x:0.35,z:-0.35} ] },

  // most of the rim in one long arc
  { id:'sweeper', min:13, weight:2, beats:[
    {x:-0.95,z:0}, {x:-0.5,z:-0.5}, {x:0.1,z:-0.72}, {x:0.7,z:-0.5},
    {x:0.95,z:0}, {x:0.55,z:0.55}, {x:-0.05,z:0.75} ] },

  // a criss-cross that never quite repeats
  { id:'lattice', min:14, weight:3, beats:[
    {x:-0.83,z:-0.54}, {x:-0.29,z:0.1}, {x:-0.73,z:0.59}, {x:0,z:0.61},
    {x:0.15,z:-0.05}, {x:0.34,z:-0.64}, {x:0.83,z:-0.2}, {x:0.59,z:0.49} ] },

  // two full waves, deep, all the way across
  { id:'serpent', min:14, weight:3, beats:[
    {x:-0.91,z:0}, {x:-0.68,z:0.62}, {x:-0.46,z:0.38}, {x:-0.23,z:-0.38},
    {x:0,z:-0.62}, {x:0.23,z:0}, {x:0.46,z:0.62}, {x:0.68,z:0.38},
    {x:0.91,z:-0.38} ] },

  // four petals out of the middle
  { id:'petal4', min:15, weight:3, beats:[
    {x:0.4,z:-0.19}, {x:0.8,z:-0.37}, {x:0.4,z:0.19}, {x:0.19,z:0.19},
    {x:0.19,z:0.4}, {x:0.37,z:0.8}, {x:-0.19,z:0.4}, {x:-0.19,z:0.19},
    {x:-0.4,z:0.19}, {x:-0.8,z:0.37}, {x:-0.4,z:-0.19}, {x:-0.19,z:-0.19},
    {x:-0.19,z:-0.4}, {x:-0.37,z:-0.8}, {x:0.19,z:-0.4} ] },

  // a spiral outward from the middle to the rim
  { id:'spiralout', min:15, weight:3, beats:[
    {x:0.15,z:0}, {x:0.16,z:0.19}, {x:-0.05,z:0.35}, {x:-0.38,z:0.24},
    {x:-0.52,z:-0.17}, {x:-0.25,z:-0.6}, {x:0.34,z:-0.67}, {x:0.83,z:-0.2},
    {x:0.77,z:0.56} ] },

  // long strides around the rim
  { id:'sprint', min:16, weight:2, beats:[
    {x:-0.95,z:0.1}, {x:-0.35,z:-0.3}, {x:0.3,z:-0.35}, {x:0.9,z:0.05,dash:true},
    {x:0.5,z:0.6}, {x:-0.15,z:0.75}, {x:-0.8,z:0.55,dash:true}, {x:-0.95,z:-0.1} ] },

  // a loop that ties itself and comes back out
  { id:'knot', min:16, weight:3, beats:[
    {x:-0.8,z:-0.3}, {x:-0.1,z:-0.65}, {x:0.5,z:-0.2}, {x:0.15,z:0.35},
    {x:-0.5,z:0.5}, {x:-0.6,z:-0.1}, {x:0.2,z:0}, {x:0.85,z:0.35} ] },

  // out to the rim and part-way back, four times round
  { id:'combwalk', min:17, weight:3, beats:[
    {x:0.85,z:-0.3}, {x:0.37,z:0.13}, {x:0.3,z:0.85}, {x:-0.13,z:0.37},
    {x:-0.85,z:0.3}, {x:-0.37,z:-0.13}, {x:-0.3,z:-0.85}, {x:0.13,z:-0.37} ] },

  // rim, middle, rim, middle, working round the dial
  { id:'bounce', min:17, weight:3, beats:[
    {x:0.92,z:0}, {x:0.04,z:0.38}, {x:-0.9,z:0.19}, {x:-0.12,z:-0.37},
    {x:0.84,z:-0.37}, {x:0.19,z:0.33}, {x:-0.74,z:0.54}, {x:-0.26,z:-0.29},
    {x:0.62,z:-0.68} ] },

  // a tight zigzag that swings out at the end
  { id:'cascade', min:18, weight:3, beats:[
    {x:-0.89,z:0}, {x:-0.53,z:0.44}, {x:-0.18,z:0}, {x:0.18,z:-0.44},
    {x:0.53,z:0}, {x:0.89,z:0.44}, {x:0.35,z:0.69}, {x:-0.1,z:0.77},
    {x:-0.52,z:0.58} ] },

  // the whole rim, one lap
  { id:'grandtour', min:19, weight:3, beats:[
    {x:0.88,z:0}, {x:0.74,z:0.48}, {x:0.37,z:0.8}, {x:-0.13,z:0.87},
    {x:-0.58,z:0.67}, {x:-0.84,z:0.25}, {x:-0.84,z:-0.25}, {x:-0.58,z:-0.67},
    {x:-0.13,z:-0.87}, {x:0.37,z:-0.8}, {x:0.74,z:-0.48}, {x:0.88,z:0} ] },

  // two and a half waves, rim to rim
  { id:'doublehelix', min:20, weight:3, beats:[
    {x:-0.8,z:0}, {x:-0.64,z:0.57}, {x:-0.48,z:0.48}, {x:-0.32,z:-0.15},
    {x:-0.16,z:-0.61}, {x:0,z:-0.37}, {x:0.16,z:0.3}, {x:0.32,z:0.62},
    {x:0.48,z:0.23}, {x:0.64,z:-0.42}, {x:0.8,z:-0.59} ] },

  // a route that doubles back twice before it lets you out
  { id:'maze', min:21, weight:3, beats:[
    {x:-0.87,z:-0.48}, {x:-0.38,z:-0.53}, {x:-0.34,z:0}, {x:-0.82,z:0.14},
    {x:-0.77,z:0.58}, {x:-0.1,z:0.63}, {x:0.05,z:0.1}, {x:0.43,z:-0.34},
    {x:0.87,z:-0.14}, {x:0.67,z:0.43}, {x:0.14,z:0.77} ] },

  // five points and five returns
  { id:'bigstar', min:22, weight:3, beats:[
    {x:0.94,z:0}, {x:0.42,z:0.31}, {x:0.29,z:0.89}, {x:-0.16,z:0.49},
    {x:-0.76,z:0.55}, {x:-0.52,z:0}, {x:-0.76,z:-0.55}, {x:-0.16,z:-0.49},
    {x:0.29,z:-0.89}, {x:0.42,z:-0.31} ] },

  // in to the middle, then back out the other way round
  { id:'spiralboth', min:23, weight:3, beats:[
    {x:0.9,z:0}, {x:0.45,z:0.62}, {x:-0.19,z:0.6}, {x:-0.47,z:0.15},
    {x:-0.29,z:-0.21}, {x:0,z:-0.22}, {x:0.27,z:-0.37}, {x:-0.18,z:-0.54},
    {x:-0.65,z:-0.21}, {x:-0.65,z:0.47}, {x:0,z:0.92} ] },

  // a full lap of the rim and then a cut through the middle
  { id:'longhaul', min:24, weight:2, beats:[
    {x:-0.95,z:0}, {x:-0.45,z:-0.55}, {x:0.2,z:-0.7}, {x:0.8,z:-0.4},
    {x:0.95,z:0.2,dash:true}, {x:0.5,z:0.7}, {x:-0.15,z:0.85}, {x:-0.75,z:0.6},
    {x:-0.9,z:0,dash:true}, {x:-0.3,z:0.15}, {x:0.35,z:0.1} ] },

  // six full weaves across the field
  { id:'weaveall', min:26, weight:3, beats:[
    {x:-0.92,z:-0.32}, {x:-0.69,z:0.32}, {x:-0.46,z:-0.32}, {x:-0.23,z:0.32},
    {x:0,z:-0.32}, {x:0.23,z:0.32}, {x:0.46,z:-0.32}, {x:0.69,z:0.32},
    {x:0.92,z:-0.32} ] },

  // five petals — the longest thing out of the middle
  { id:'petal6', min:28, weight:3, beats:[
    {x:0.42,z:-0.2}, {x:0.83,z:-0.39}, {x:0.42,z:0.2}, {x:0.2,z:0.2},
    {x:0.2,z:0.42}, {x:0.39,z:0.83}, {x:-0.2,z:0.42}, {x:-0.2,z:0.2},
    {x:-0.42,z:0.2}, {x:-0.83,z:0.39}, {x:-0.42,z:-0.2}, {x:-0.2,z:-0.2},
    {x:-0.2,z:-0.42}, {x:-0.39,z:-0.83}, {x:0.2,z:-0.42} ] },

  // half the rim, then a spiral into the middle
  { id:'epic', min:30, weight:3, beats:[
    {x:0.9,z:0}, {x:0.78,z:0.45}, {x:0.45,z:0.78}, {x:0,z:0.9}, {x:-0.45,z:0.78},
    {x:-0.78,z:0.45}, {x:-0.9,z:0}, {x:0.54,z:-0.35}, {x:0.23,z:-0.51},
    {x:-0.08,z:-0.47}, {x:-0.27,z:-0.3}, {x:-0.31,z:-0.08}, {x:-0.23,z:0.07} ] },

  // a weave across and a long arc back
  { id:'marathon', min:32, weight:2, beats:[
    {x:-1,z:0}, {x:-0.71,z:0.49}, {x:-0.43,z:0.22}, {x:-0.14,z:-0.39},
    {x:0.14,z:-0.39}, {x:0.43,z:0.22,dash:true}, {x:0.71,z:0.49}, {x:1,z:0},
    {x:-0.78,z:-0.35}, {x:-0.57,z:-0.63}, {x:-0.26,z:-0.81,dash:true},
    {x:0.09,z:-0.85}, {x:0.43,z:-0.74}, {x:0.69,z:-0.5} ] },
];
