# Capybara Snack Rush — how the game works

A 3D arcade catch game in the browser. You steer a capybara around a shallow
rectangular arena and catch food falling from the sky, while avoiding hazards
and holes. One session, no saves, score attack.

## The loop

Food does not fall at random. A **spawn director** emits **formations**: a run
of landing spots forming a shape — nineteen of them unlocking as the level
rises, from sweeps and arcs to weaves, spirals, pincers, out-and-back
boomerangs and dash-gated leaps. The route between them is drawn on the ground
as a glowing ribbon the moment the shape appears. You read the whole route,
plan one movement, and run it.

**Routes get longer as the game goes on.** Early ones are a single shape, about
five items. Late ones chain several shapes end to end into one continuous walk
of fifteen to twenty — which is where late difficulty actually comes from, since
every step inside them is still timed to be walkable. The connecting lines are
only drawn a few steps ahead; past that you read the dots, which is what they
were always for.

The ribbon is drawn to be read in order: a **dot on every landing spot**,
largest and brightest at the next beat and tapering over the few after it, with
hazard beats marked red so you can see what to walk around before it is in the
air.
Segments you have used **leave the ground** as their beats land, so what is
drawn is always the part still ahead of you.

Only one route is live at a time. After its last item lands there is a pause —
long at low levels, almost none at high ones — before the next, with a thinner
drip of unscripted **stray** items between routes so the sky isn't a metronome.

Clearing a whole route without dropping a good item or eating a hazard is a
**route clear**: a score bonus, a combo step, and a full refill of the combo
timer. That is the main skill expression.

## Controls

| | |
|---|---|
| PC | WASD or the arrow keys; or hold and drag, and the capybara walks to the cursor |
| Mobile | Drag anywhere — the capybara walks to a point just above your finger. A DASH button, bottom-right |
| Dash | Space, or the button |

**Both pointers steer the same way: you name a place, not a speed.** The
capybara moves faster the further it has to go and slows as it arrives, so
parking on a landing ring is not a matter of letting go at the right instant.
On a phone it stands a little *above* your fingertip, keeping your finger off
the ground you are reading, and the mapping is close to 1:1 — move a centimetre
and the capybara moves a centimetre, so it goes where you point rather than
somewhere amplified. That means using most of the screen, which suits an index
finger better than a one-handed thumb. The keys are the one input that says a
direction instead.

Movement is a **velocity-target** model: input says what velocity you want and
the capybara eases toward it. It stops quickly and does not coast.

On a tall screen the camera tips further down, so the arena is seen from a
steeper angle — fitting the field's width is what sets the camera distance, and
on a phone that alone would leave a letterbox strip you cannot read depth in.

**Dash** is a committed burst of about 5 units in 0.22s on a ~0.8s cooldown. It
carries you over an open sinkhole, doubles the score of anything caught during
it, and slightly extends your catch radius. It can't be used while soap-slipped,
and it ends early if you hit a wall.

## Items

| Item | Effect |
|---|---|
| Burger | 10 points |
| Watermelon | 40 points, wobbles as it falls |
| Chilli | Costs a life if caught |
| Soap | No damage — makes you skid with almost no grip for 2s, and blocks the dash |
| Heart | Restores a life, or 250 points at full health. Drifts slowly, only appears when hurt |
| Magnet / Shield / Slow-mo | Power-ups, drift down slowly. The active one shows as an icon and a draining bar |

Hazards **home in on you** while falling, capped so they stay dodgeable by
moving. Inside a formation they are decoys placed off the walking line — missing
one costs nothing, catching one spoils the route clear. Where they sit is
decided fresh every time, so a shape is never a hand you learn, and a route
never carries more than **one hazard per six food items**: a route you mostly
dodge would be a shorter route with walking in between, and the catching is the
point. Longer routes therefore carry more of them.

Every falling item has a **landing ring** on the ground, visible from the moment
it spawns and shrinking onto its exact footprint as the item arrives. The ring
reaching full size is the catch moment. Hazard rings pulse.

## Powers

- **Magnet** — every good item flies to you and is caught; guaranteed 100%, but
  only for a short burst (3.75s).
- **Shield** — a bubble that absorbs one hazard or one sinkhole.
- **Slow-mo** — items fall at 45% speed and routes arrive much faster.

## Combo and score

Each good catch bumps a combo counter which decays on a timer, and the timer
shortens as levels rise. The multiplier steps up every 4 catches to ×6, then
every 8, uncapped. A dropped item takes a bite out of the timer rather than
breaking the combo; catching a hazard or falling in a hole breaks it outright.

## Difficulty

Level rises with score and elapsed time, capped to one level every few seconds
so a score spike can't skip levels. What gets harder: routes arrive closer
together and get longer with tighter spacing, more hazards appear (including
inside formations), and the combo timer shortens.

**More hearts means more hazards.** Every heart past the starting three raises
the hazard rate by 20%, so banking lives with Second Wind or Puzzler buys risk
along with the safety net.

**It never stops getting harder,** but **fall speed deliberately stops rising
early.** Every curve bottoms out by about level 24 — fall speed long before that
— and past there one scalar keeps climbing, spent purely on density: more
hazards, set-pieces closer together and larger, hazards that steer a little
harder. Late difficulty is density and route complexity, never less time to
read. Every formation stays provably clearable: the gap between landing spots is
computed from the distance and the capybara's top speed, so no shape can ask for
more than it has.

## Set-pieces

Every ~20s a set-piece interrupts the normal flow:

- **Chilli missiles** — a volley of fast homing hazards to dodge.
- **Watermelon feast** — a reward, but a routed one: one long continuous path is
  chosen from five (an S, a circuit, a figure of eight, a triangular weave, a
  spiral), drawn on the ground, and every melon lands on it. Follow the trail and
  you get all twenty. The steps are far slacker than a formation's — it is a
  reward beat, not a test.
- **Sinkholes** — telegraphed by a pulsing red ring, then the ground opens for
  5s. Walk in and you lose a life; dash over them freely.

## Structure

Three lives. Every **10** levels the biome changes — Meadow, Lily Pad Ponds,
Bubblegum, Night, Hell — each with its own lighting, ground, sky and **its own
piece of music** (a marimba stroll, a kalimba drift over water drips, a chiptune
sugar rush, a music-box waltz in 3/4, and a harmonic-minor circus). Each change
pauses the run for a draft of three perks.

Ordinary perks stack:

| Perk | Effect | Max |
|---|---|---|
| Long Snout | +0.22 reach for **food**, drawn as an aura around you. It never widens the circle that catches hazards | 4 |
| Quick Paws | dash cooldown −25%, and the dash ends in a shockwave that catches food out to 3× your reach (then 4×, 5×) | 3 |
| Melon Lover | watermelons pay +60% | 3 |
| Second Wind | +1 max life, and one heart back | 3 |
| Lucky Heart | a heart falls right away, and hearts drop twice as often | 2 |

**Silver** perks are one-per-run each, permanent, and cost nothing:

| Perk | Effect |
|---|---|
| Auto-Shield | A bubble throws itself up when a hazard closes in, holds two seconds absorbing anything hostile, then rests a minute (the countdown sits on the perk rail) |
| Chain Sweeper | Clear a route and the next one turns **golden**: every item in it glows and pays ×2, then ×3, ×4… for as long as the streak holds |

**One-per-run perks** are gold and appear on about half of all drafts. You get
**one for the entire run** — taking any of the three closes the gold slot for
good, so it is a choice between them, not a collection. Each is a trade:

- **Phantombara** — −1 max life. Every dash leaves a see-through copy of the
  capybara standing where it started for 5s; the ghost catches anything good on
  your radius, and a hazard pops it.
- **Sticky Feet** — immune to sinkholes and soap, at half movement speed and
  with no dash. Routes re-time themselves to the slower walk, dash-gated beats
  included, so nothing becomes unclearable. Items fall at exactly the same
  speed; it is the *route* that unfolds at half pace, which is why the whole
  biome feels calmer.
- **Puzzler** — routes fall half as fast. Clear one and you gain a life; drop one
  and it costs a life — unless a sinkhole opened on top of it, in which case
  dropping it is free. The life row shows five hearts and then a tally
  (`♥♥♥♥♥ +3`), because a good Puzzler run banks more than the HUD can draw.

Every perk you hold shows as a small tinted icon down the left edge — plain,
silver or gold — with `n/max` on anything that stacks and the Auto-Shield's
countdown on its own.

Hats unlock at score thresholds and are cosmetic.

## High scores

A shared board, reachable from **HIGH SCORES** on the title card and on the game
over screen. It lists every submitted run, highest first.

You are asked for a **tag** only when a run beats your own best on that device —
a bad run never interrupts. The tag is a name everyone knows you by, not an
account: nothing proves it is yours, and you keep using it across devices
precisely because you want the board to say it was you. That does mean the same
tag appears more than once, as a ladder of its own improving runs; **Best per
tag** collapses it to one row each.

No connection is needed to play. With the board unreachable the game is
unchanged, the last board you saw is shown with the time it was fetched, and a
score earned offline goes up the next time you play.
