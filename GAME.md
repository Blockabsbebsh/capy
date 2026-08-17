# Capybara Snack Rush — how the game works

A 3D arcade catch game in the browser. You steer a capybara around a shallow
rectangular arena and catch food falling from the sky, while avoiding hazards
and holes. One session, no saves, score attack.

## The loop

Food does not fall at random. A **spawn director** emits **formations**: a run
of 3–7 landing spots forming a shape — a sweep, an arc, a zig-zag, a funnel —
with the route between them drawn on the ground as a glowing ribbon the moment
the shape appears. You read the whole route, plan one movement, and run it.

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
| Desktop | WASD / arrows, or hold and drag the mouse — the capybara moves to the cursor |
| Touch | Floating thumbstick, bottom-left; a DASH button bottom-right |
| Dash | Space, or the button |

Movement is a **velocity-target** model: input says what velocity you want,
and the capybara eases toward it. It stops quickly and does not coast.

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

- **Magnet** — every good item flies to you and is caught; guaranteed 100%.
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
- **Watermelon feast** — a pure reward shower.
- **Sinkholes** — telegraphed by a pulsing red ring, then the ground opens for
  15s. Walk in and you lose a life; dash over them freely.

## Structure

Three lives. Every 5 levels the biome changes — Meadow, Lily Pad Ponds,
Bubblegum, Night, Hell — each with its own lighting, ground, sky and music, and
each theme change offers a draft of one of three perks (catch radius, combo
timer, power duration, movement speed, melon value, extra life, heart rate).
Hats unlock at score thresholds and are cosmetic.
