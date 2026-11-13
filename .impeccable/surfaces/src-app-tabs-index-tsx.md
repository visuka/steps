---
version: 1
slug: "src-app-tabs-index-tsx"
primary_target: "src/app/(tabs)/index.tsx"
related_targets: []
---

## Scope

Today screen (src/app/(tabs)/index.tsx) as the first surface of a full-app replacement world. Mode: Operate. Android, Material 3 structure. The same world then applies to Food, Activity, Journal and You.

## Audience and task

Adults 25–55, parents 55+, fitness people, and people managing weight, sugar or blood pressure, mostly in India. They glance several times a day: how far they've walked, what they've eaten, and whether they've had water. One tap logs water or food. Indian scripts must render, text must scale with the phone's text-size setting, and it must work outdoors in sunlight on budget phones.

## Direction contract

THESIS: The day is a morning-walk track in a colony park. Progress reads as distance along a painted loop, not as a dashboard of cards. It refuses the category default: neon rings on near-black, pastel wellness gradients, and paragraph-heavy cards.

OWN-WORLD:
- Lime-washed ground: a cool off-white by day, a deep night-park green-black by night. Ink is deep green-black.
- The colour lives only inside the data:
  - lawn green for steps and progress;
  - red-oxide path brick for food and calories;
  - morning-sky blue for water;
  - dusk indigo for sleep;
  - marigold for "near the limit";
  - Material error red for "too much".
- Everything is flat: no gradients, glass, glow or shimmer.
- Painted white tick marks are the shared measure on tracks, bars and progress.
- Chrome stays neutral. Raised from the lexicon: "colour quarantined inside the plates".
- One workhorse UI family with a strict type scale, plus condensed numerals for the big numbers, like markers painted on a track. Raised from the bitmap specimen: one family at many sizes.
- An 8 dp module, with numerals sized to it. Raised from the Crouwel grid.

STORY: At a glance the person knows how far along today's loop they are, what they've eaten, and their water. One thumb logs water or food. Detail opens in place; it never takes a hunt.

FIRST VIEWPORT:
- At the top: the date as a small title, and a sync line.
- The hero, about 45% of the height: an oval running track (two straights and two bends) drawn around today's steps. The steps are big condensed numerals in the infield, with the goal and laps small beneath. The covered distance is lawn-green, with painted ticks every 10%.
- Below it, one row of three equal tiles:
  - Food: kcal, with a red-oxide bar;
  - Water: glasses, with a +1 button;
  - Active minutes.
- One extended FAB, "Log food", above the 5-tab Material navigation bar: Today, Food, Activity, Journal, You.
- Tapping a tile expands its detail in place while the rest dims back. Raised from the streaming wall.

FORM: Colony park walking track, position 6 on my grounded list. Seed key fcecdb7b.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Signature interaction and motion

When steps sync, a runner dot travels along the track to the new position in one smooth Material-standard move, about 600 ms. Reduce motion makes it a cut. Tabs use shared-axis transitions. There is no bounce, overshoot or shimmer anywhere.

## Raises (named)

- Lexicon page: colour is quarantined inside the data plates (tracks, bars, rings); chrome stays neutral ink on lime-wash.
- Crouwel grid specimen: one strict 8 dp module; big numerals are sized to whole multiples of it.
- Zoo guide map: flat, unmodulated colour fields only; no gradients or grain.
- Bitmap specimen: one type family repeated at a strict scale; no ad-hoc sizes.
- Streaming wall: focus expands in place and the rest recedes, for progressive disclosure instead of paragraphs.

## Unresolved

- The exact UI face and numeral face must cover Latin, with the system fallback (Noto) covering the Indian scripts. To be confirmed by rendering Hindi and Telugu samples.
- The app name may change, so nothing depends on the word "Steps".
