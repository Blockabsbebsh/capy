# Capybara Snack Rush — how the game works

A 3D arcade catch game in the browser. You steer a capybara around a shallow
rectangular arena and catch food falling from the sky, while avoiding hazards
and holes. One session, no saves, score attack.

## The loop

Food does not fall at random. A **spawn director** emits **formations**: a run
of 3–7 landing spots forming a shape — nineteen of them, unlocking as the level
rises: sweeps, arcs, weaves, spirals, pincers, chevrons, out-and-back
boomerangs, dash-gated leaps — with the route between them drawn on the ground
as a glowing ribbon the moment the shape appears. You read the whole route, plan one movement, and run it.

The ribbon is drawn to be read in order: a **dot on every landing spot**, largest
and brightest at the first beat and tapering to the last, with hazard beats
marked red so you can see what to walk around before it is in the air. Segments
you have already used **leave the ground** as their beats land, so what is drawn
is always the part still ahead of you.

Only one route is live at a time. When its last item has landed there is a
pause — long at low levels, almost none at high ones — before the next. A
thinner drip of unscripted **stray** items falls between routes so the sky
isn't a metronome.

Clearing an entire route without dropping a good item or eating a hazard is a
**route clear**: a score bonus, a combo step, and a full refill of the combo
timer. That is the main skill expression.

## Controls

| | |
|---|---|
| PC | WASD or the arrow keys; or hold and drag, and the capybara walks to the cursor |
| Mobile | Floating thumbstick, bottom-left; a DASH button bottom-right |
| Dash | Space, or the button |

The title card shows these as two boxes, Mobile and PC, since the two setups
share nothing but the dash.

Movement is a **velocity-target** model: input says what velocity you want, and
the capybara eases toward it. It stops quickly and does not coast.

**Dash** is a committed burst of about 5 units in 0.22s on a ~0.8s cooldown.
It carries you over an open sinkhole, doubles the score of anything caught
during it, and slightly extends your catch radius. It can't be used while
soap-slipped, and it ends early if you hit a wall.

## Items

| Item | Effect |
|---|---|
| Burger | 10 points |
| Watermelon | 40 points, wobbles as it falls |
| Chilli | Costs a life if caught |
| Soap | No damage — makes you skid with almost no grip for 2s, and blocks the dash |
| Heart | Restores a life, or 250 points at full health. Drifts slowly, only appears when hurt |
| Magnet / Shield / Slow-mo | Power-ups, drift down slowly |

Hazards **home in on you** while falling, capped so they stay dodgeable by
moving. Inside a formation, hazards are decoys placed off the walking line —
missing one costs nothing, catching one spoils the route clear.

Every falling item has a **landing ring** on the ground. It is visible from the
moment the item spawns and shrinks onto its exact footprint as the item
arrives — the ring reaching full size is the catch moment. Hazard rings pulse.

## Powers

- **Magnet** — every good item flies to you and is caught; guaranteed 100%, but
  only for a short burst (3.75s).
- **Shield** — a bubble that absorbs one hazard or one sinkhole.
- **Slow-mo** — items fall at 45% speed and routes arrive much faster.

## Combo and score

Each good catch bumps a combo counter which decays on a timer; the timer
shortens as levels rise. The multiplier steps up every 4 catches to ×6, then
every 8, uncapped. A dropped item takes a bite out of the timer rather than
breaking the combo; catching a hazard or falling in a hole breaks it outright.

## Difficulty

Level rises with score and elapsed time, capped to one level every few seconds
so a big score spike can't skip levels. What actually gets harder:

- routes arrive closer together and get longer, with tighter spacing
- more hazards, and hazards inside formations
- the combo timer shortens

**Fall speed deliberately stops rising early.** Late difficulty is density and
route complexity, not less time to read. Every formation is provably clearable:
the gap between consecutive landing spots is computed from the distance and the
capybara's top speed, so no shape can ask for more than it has.

## Set-pieces

Every ~20s a set-piece interrupts the normal flow:

- **Chilli missiles** — a volley of fast homing hazards to dodge.
- **Watermelon feast** — a reward, but a routed one: one long continuous path is
  chosen from five (an S, a circuit, a figure of eight, a triangular weave, a
  spiral), drawn on the ground, and every melon in the feast lands on it. Follow
  the trail and you get all twenty. The steps are far slacker than a formation's
  — it is still a reward beat, not a test.
- **Sinkholes** — telegraphed by a pulsing red ring, then the ground opens for
  7s. Walk in and you lose a life; dash over them freely.

## Structure

Three lives. Every **10** levels the biome changes — Meadow, Lily Pad Ponds,
Bubblegum, Night, Hell — each with its own lighting, ground, sky and music, and
each theme change pauses the run for a draft of three perks.

Ordinary perks stack:

| Perk | Effect | Max |
|---|---|---|
| Long Snout | +0.22 catch radius, drawn as an aura around you | 4 |
| Quick Paws | dash cooldown −25%, and the dash ends in a shockwave that catches food in a widening radius | 3 |
| Melon Lover | watermelons pay +60% | 3 |
| Second Wind | +1 max life, and one heart back | 3 |
| Lucky Heart | hearts drop twice as often | 2 |
| Overcharged | grabbing a power-up wipes every hazard on the field | 1 |
| Clean Sweep | a route clear drags the remaining food to you | 1 |

**One-per-run perks** are gold and appear on about half of all drafts alongside
the ordinary ones. You get **one for the entire run**: taking any of the three
closes the gold slot for good, so it is a choice between them, not a collection.
Each is a trade, not a buff:

- **Phantombara** — −1 max life. Every dash leaves a see-through copy of the
  capybara standing where it started for 3s; the ghost catches anything good on
  your radius — food, hearts, power-ups — and a hazard pops it.
- **Sticky Feet** — immune to sinkholes and soap, at half movement speed and
  with no dash. Routes re-time themselves to the slower walk, dash-gated beats
  included, so nothing becomes unclearable.
- **Puzzler** — routes fall half as fast. Clear one and you gain a life; drop one
  and it costs a life. The life row shows five hearts and then a tally (`♥♥♥♥♥
  +3`), because a good Puzzler run banks more than the HUD can draw.

Hats unlock at score thresholds and are cosmetic.
