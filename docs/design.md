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

### Today, after the owner's reference picture (17 Nov 2026)

The owner sent the reference next to build 80 and asked for every difference to be made ("complete this each and every thing").

- **Top row:** the avatar (opens You) on the left; in the middle a NUTRITION / ACTIVITY switch (grey track #E4E4E4, the selected half a #FBFBFB pill; Nutrition opens Food, Activity is this screen); on the right a round calendar button (opens the steps by day). 40 high, 36 on short screens. Under it one line: the date (15 bold), the weather and the quote.
- **Cards:** no outline, radius 20, #FBFBFB on #F1F1F1, padding 12/16 (9 on short screens), 10 apart (8 on short screens).
- **Steps card:** a clock icon and TODAY, the hours on your feet on the right. The count in Figtree Light 42 (34 on short screens) with STEPS beside it and "x TO GO" on the right; no percentage. A red line with a red dot and the time now, then the hour dots: 8 small dots (3 dp, 2 apart) per hour, the hour now red and blinking. The goal bar: 16 rounded pills (8 high, 3 apart), black up to the steps with the leading pill red, hatched for what is left, red past the goal. Under it a scale of the goal (0 · 2,500 · 5,000 · 7,500 · 10,000), or past the goal "GOAL x" and a red square with "+x PAST GOAL".
- **Distance and Active:** their own cards side by side: icon, name and a small ↗ arrow; the figure in Figtree Light; a rounded bar (8 high) with its scale (hidden on short screens and with large text). Distance grey, Active red (full at 30 min). Both open the steps detail.
- **FOOD & SLEEP:** a title in mono capitals (14, tracking 1.5) above the pair, hidden on short screens and with large text. Food's bar black with a small red dot at its end; Sleep's bar red. Both heads have the ↗ arrow.
- Water, the walk and Log food as before, without outlines.
- Motion as before: blocks rise once, bars grow once, the count counts up, the hour now keeps blinking, the news keeps moving. With "Remove animations" on, nothing moves.
- Today must not scroll at 360 x 800 with normal text.

### Bottom bar (every screen)

A row of 48 dp round buttons, 16 apart, centred, on the screen's own ground, no hairline; 60 dp plus the system inset. The selected one is a #FBFBFB circle with a black icon, the others #E4E4E4 circles with grey icons. Labels are not drawn; TalkBack still says each name (`nav-style.ts`, `navigation-bar.tsx`).

## History

- **Today "Time of day" (17 Nov 2026), replaced the same day:** Dawn/Noon/Dusk colours, a steps ring and hour bars (`docs/design/today-time-of-day.html`). Its full spec is in git history (commit b4274a0, this file).

- 14 Nov 2026: Clean+ blue chosen (`docs/design/clean-plus.html`), later replaced.
- 16–17 Nov 2026: Calm and large (theme `e`) was the one look; builds 70 to 74. Its Today is replaced by the Time-of-day Today above. The Calm theme stays for every other screen.
- Rejected 17 Nov 2026: the dark premium palettes, the light/colour-block sets, build 70's large sizes.
- Older looks A–F: Figma file "Steps app looks" (key of1WY3BRkYf0FmZHr1tVSu).
