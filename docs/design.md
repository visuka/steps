# Design

**Managed by Opus (or a stronger model) only.** Sonnet and Haiku read this file and follow it; they never edit it. If something here is missing or wrong, stop and report it.

## Owner's rules

1. The app must look **exactly** like the approved mockup: font, weight, size, line height, colour, spacing, corners, shadows, icons. "Same output."
2. Simple and elegant, light and gentle colours, white space, few elements per screen. No shine, glow or emojis. (17 Nov 2026: the owner approved the Time-of-day look below, which uses soft gradients on the screen top, the steps card and the ring. Gradients are allowed only there.)
3. Rich, not empty: a strong hero, soft cards, small visuals that carry the numbers.
4. The owner decides only after seeing a picture. Nothing reaches the owner unchecked.
5. Light looks stay light when the phone is in dark mode.
6. **Functionality never changes with a redesign** (owner, 17 Nov 2026). Every tap, number and screen stays. Never remove or move a feature without the owner's OK.
7. Not too large (owner, 17 Nov 2026: build 70 "Large is too large"). Use the sizes below, no bigger.

## How a design becomes the app

1. Mockup approved by the owner → copied into `docs/design/`.
2. Opus writes the per-element values here (or in `docs/design/spec.md`). Every value in code comes from them.
3. Tests check that the theme values equal the spec.
4. CI photographs the real screens (design-preview deep link); Opus compares them with the mockup element by element; differences become fix items.
5. The owner sees the screenshots before a build is sent.

Size rule: the mockup phone screen is **360 px wide; 1 mockup px = 1 dp**. Text keeps `scaled()` (ui-scale.ts) and `MaxTextScale`. On wider phones the extra width goes to the cards, not to bigger text.

## Current: grey, black and one red, every screen (owner, 17 Nov 2026)

**Source:** the owner's reference picture (a health app shot in grey, black and one red), then "can you deliver this theme?", "1" (the whole Today screen) and "every screen to this color combination". It replaces the Dawn/Noon/Dusk colours on Today and the parchment and green of the Calm theme everywhere else.

### Colours

| Use | Hex |
| --- | --- |
| Screen ground (`background`, `surface`, Today `bg`) | #F1F1F1 |
| Cards (`surfaceContainerLowest`, Today `card`), the bottom bar | #FBFBFB |
| Text, the main button, the data (steps, food, water), filled segments | #000000 |
| Soft black (secondary, sleep, food3) | #3C3C3C |
| Second text (`onSurfaceVariant`, Today `muted`) | #5E5E5E (#8C8C8C fails 4.5:1 on the ground, so it is used only for the hour dots) |
| Hour dots with steps (Today `ringA`) | #8C8C8C |
| Lines, empty segments, hatching, dots with no steps (`outlineVariant`, Today `edge`/`track`) | #DCDCDC / #E4E4E4 |
| Lanes (track behind a bar) | #CCCCCC |
| The one red on Today (`accent`): the hour now, steps past the goal | #FD393A |
| Red for warning text (`error`, `over`; 4.5:1 on the ground) | #C8201F |

Dawn, Noon and Dusk still exist in code (`day-part.ts`, the preview's `&part=`) but share these colours. The old Clean+ spec (`clean-spec.ts`) is unchanged; its blue mixes apply only when `primary` is its blue, so with black every screen mixes its greys from black.

### Steps tile (Today)

- Card: radius 16, padding 12/16 (10 on short screens), #FBFBFB, 1 dp #E4E4E4 edge. Opens the steps detail, as before.
- Top line: "TODAY" small label (monospace capitals, 11, tracking 1, muted); right: the hours on your feet ("06:00 – 14:00", or "06:00 – NOW" while this hour has steps) and a 14 chevron.
- Count: 34/40 semibold, tracking -0.8, counts up; "STEPS" small label beside it; the percentage as a small black label on the right.
- Hour dots: one column of 5 dots (5 dp, 3 apart) per hour; lit dots by steps against the busiest hour so far (at least one for any hour with steps), grey #8C8C8C; unlit #E4E4E4. **The hour now is red and blinks gently, 1 to 0.3 and back over 1.6 s, for as long as Today is open** (the owner: simple, continuous movement). Axis 00 06 12 18 in small labels.
- Goal bar: 28 segments, 10 high, 2 apart. Black up to the steps; hatched grey (three fine upright strokes) for what is left; past the goal the bar stands for all the steps, black up to the goal and red after it. Under it: "GOAL 7,000" left; right "4,236 TO GO" (muted) or a red square and "+4,236 PAST GOAL" (black).
- Two small tiles (gap 8, #F1F1F1, radius 12, padding 8/10): DISTANCE ("8.1 km", bar = share of the steps goal) and ACTIVE ("7 min", bar full at 30 min). Each has a 12-segment bar, 4 high.
- No ring, no gradient, no hour bars any more on this tile.

### The rest of Today

- Food, Sleep, Water heads: a 14 icon and the name as a small label, both muted. Food and Sleep bars are the 12-segment bar. Glasses, the + button, the walk circle and Log food are black and grey. Every tap, figure and slot is as before.
- Motion: blocks rise once as before; bars are revealed left to right once; the steps count counts up; the hour now keeps blinking; the news keeps moving. With "Remove animations" on, nothing moves.
- Today must not scroll at 360 x 800 with normal text.

## History

- **Today "Time of day" (17 Nov 2026), replaced the same day:** Dawn/Noon/Dusk colours, a steps ring and hour bars (`docs/design/today-time-of-day.html`). Its full spec is in git history (commit b4274a0, this file).

- 14 Nov 2026: Clean+ blue chosen (`docs/design/clean-plus.html`), later replaced.
- 16–17 Nov 2026: Calm and large (theme `e`) was the one look; builds 70 to 74. Its Today is replaced by the Time-of-day Today above. The Calm theme stays for every other screen.
- Rejected 17 Nov 2026: the dark premium palettes, the light/colour-block sets, build 70's large sizes.
- Older looks A–F: Figma file "Steps app looks" (key of1WY3BRkYf0FmZHr1tVSu).
