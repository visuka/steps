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

## Current: Today "Time of day" (approved 17 Nov 2026)

**Source of truth:** `docs/design/today-time-of-day.html` (open it in a browser; the "Time of day" chip is the chosen one; the other chips, Monsoon, Block print, Chai and Ink, were not chosen). The owner's words: "Yup let us go for time of day".

Scope: the **Today screen and the bottom bar**. Every other screen keeps the Calm theme (`e`) as it is.

### Day parts

| Part | Hours (phone's local time) | Feel |
| --- | --- | --- |
| Dawn | 05:00 to 10:59 | peach light on cream, coral-to-rose ring, aubergine buttons |
| Noon | 11:00 to 16:29 | clear sky blue, bright blue ring, navy buttons |
| Dusk | 16:30 to 04:59 | soft lilac, lavender-to-violet ring, plum buttons |

The part is checked when Today opens, when the app comes back to the front, and once a minute. A change cross-fades the colours over 500 ms (a cut with "Remove animations" on).

### Palettes

Shared: card `#FFFFFF`, main text `#1F1B16`, text on the main button `#FFFFFF`.

| Role | Dawn | Noon | Dusk |
| --- | --- | --- | --- |
| bg (screen) | #F8F4EF | #F3F6F9 | #F5F3F9 |
| wash (top of screen, fades to bg by 260 dp) | #FBE6DA | #DDEBF6 | #E6DFF3 |
| edge (card border, bar hairline) | #F0E6DD | #E2E9F0 | #E8E3F1 |
| newsBg | #F6E8DF | #E3ECF4 | #EAE5F4 |
| plate (avatar, walk circle) | #F7E3DA | #DCE9F4 | #E6E0F5 |
| muted (second text) | #6E6260 | #5B6875 | #655F78 |
| main (Log food, active tab, avatar letter, news label text) | #3A2D45 | #1D3A5F | #3B2F66 |
| heroTop → heroBottom (steps card, 150° diagonal) | #FFF6F0 → #FBE4D8 | #F7FBFE → #DDEBF7 | #F8F6FD → #E4DDF3 |
| heroEdge | #F5DDD0 | #D6E5F2 | #DDD5EF |
| ringA → ringB (ring, top-left to bottom-right) | #F09A6B → #C2577A | #5BB0E6 → #1F5FA8 | #A895E8 → #5340A6 |
| track (ring track, low hour bars) | #F6DCD3 | #D5E5F2 | #E2DCF2 |
| food / foodLane | #C4652F / #FAE6DA | #D06A3E / #FAE7DE | #CF7550 / #FAE8DF |
| sleep / sleepLane | #6A5BA8 / #ECE8F6 | #5B57A6 / #E9E8F6 | #2F7A85 / #DDEFF1 |
| water / waterLane | #3A7FBF / #E3EEF8 | #238C9A / #DCF0F2 | #3A78C0 / #E1ECF8 |

The ring percentage text uses ringB. Hour bars of hours that have steps use a ringA (top) → ringB (bottom) gradient.

### Layout (360 x 800 dp screen, top to bottom)

- Screen: side padding 18, gap between blocks 10, top padding 8, bottom padding 10. Background: the wash gradient (wash at 0 → bg at 260 dp, then bg).
- **Header row:** date 22/28 bold, letter spacing -0.3. Under it one line 13/18 muted: weather (the existing `WeatherBesideDate`, or `slots.dateExtra`) · the daily quote, ellipsised. Right: avatar 40 round, plate fill, initial 15 bold in main; it opens Profile (as now).
- **Good news ticker:** height 32, radius 16, newsBg; label pill "Good news" 11 semibold, card fill, main text; items 12 (existing `NewsTicker`, new colours only).
- **Steps card** (opens the steps detail, as now): radius 20, padding 12/16, heroTop→heroBottom gradient, heroEdge border 1.
  - Left: head "Steps" 14 semibold with an 18 walker icon; number 40/44 bold, letter spacing -1.2, count-up; "of 8,000 goal" 13 muted; facts 13: "**4.6 km** · **52 min** active" (values in main text, the dots and "active" muted).
  - Right: ring 92 x 92, radius 40, stroke 7, round caps, track colour behind; percentage 19 bold ringB in the middle.
  - Hour bars: 24 bars, 5 wide, radius 3, row height 40, 10 below the top part; bar height = steps that hour / the day's highest hour (min 5). Hours with steps use the gradient, others track. Hours after `nowHour` are drawn at 5 in track. Axis 11 muted: 12 am, 6 am, 12 pm, 6 pm (right padding 30).
- `slots.walking` (walk in progress) stays here, as now.
- **Food and Sleep pair:** two cards, gap 10, radius 20, padding 12/16, card fill, edge border.
  - Head 14 semibold with an 18 icon (bowl in food colour / moon in sleep colour; lock when locked).
  - Value 21/26 bold, letter spacing -0.3, unit in 13 semibold ("1,280 kcal", "6 h 50 min").
  - Sub 12 muted ("of 1,900 kcal", "Last night").
  - Meter 5 high, round, 10 below: lane colour behind, part colour fill (the fills are the tile models' `share`, already 0..1 in `today-layout.ts`).
- **Water card:** one row, gap 10. Head "Water" (drop icon) and value 17/22 semibold "5 of 8 glasses" (or "5 glasses" with no target). Right: glasses (one per glass of the target, 8 without one, at most 10 shown), each 12 x 18, outline 1.5 water, open top, bottom radius 4, filled ones 80 % water at 0.8 opacity, gap 4. Then the add button: 34 round, border 1.5 water, waterLane fill, "+" in water. Touch area at least 48 x 48. Tap the card → Water; tap + → add a glass (as now).
- **Walk card:** row, gap 12. Circle 38 plate with the walker in main; title 14 semibold ("Morning walk" / "Walk"); sub 12 muted ("7:10 am · 32 min", or "No walk yet today"); right: distance 16 semibold and a 14 chevron muted. Opens Activity (as now).
- `slots.below` / `slots.locked` (the premium card for the free app) stay here, as now.
- **Log food:** height 48, pill (radius 24), main fill, "+" 20 regular and "Log food" 15 semibold in white, gap 8. It sits at the bottom of the column (`marginTop: 'auto'`).
- The existing sync line ("Updated 2 min ago · Health Connect", drawn in `app/(tabs)/index.tsx`) stays below Log food, 11 muted, centred.
- **Today does not scroll** at 360 x 800 with normal text. With large text it may scroll; nothing may be cut off or overlap.

### Bottom bar (all tab screens)

- Three buttons, each with an icon 22 and a label 11 under it (gap 3), slot width 80, bar height 60 plus the system inset, card fill, top hairline 1 in edge.
- Order: **Today** (house icon), **Chats** (chats icon; the screen key stays `plus`), **Profile** (person icon; the screen key stays `you`).
- Active: main colour and label semibold. Others: muted. No dot, no lifted round button.
- On Today the colours come from the day part. On other screens the bar uses the Calm theme: active `primary`, others `onSurfaceVariant`, fill `surfaceContainerLowest`, hairline `outlineVariant`.
- TalkBack labels: "Today", "Chats and groups", "Your profile".

### Motion (gentle, once, when Today opens)

- Blocks rise 10 dp and fade in, 700 ms, 50 ms apart (header 0, news 50, steps 100, pair 180, water 240, walk 300, Log food 360).
- Steps number counts up; the ring fills over 1.5 s from 200 ms; meters fill over 1.3 s from 350 ms; hour bars grow over 0.9 s.
- The news ticker keeps moving as now. Nothing else moves. With "Remove animations" on, everything is drawn at its final state at once.
- The build 71 to 74 moving pictures (calm-motion: walker on the steps bar, filling bowl, water glass, rocking moon) are **not** in this design.

## History

- 14 Nov 2026: Clean+ blue chosen (`docs/design/clean-plus.html`), later replaced.
- 16–17 Nov 2026: Calm and large (theme `e`) was the one look; builds 70 to 74. Its Today is replaced by the Time-of-day Today above. The Calm theme stays for every other screen.
- Rejected 17 Nov 2026: the dark premium palettes, the light/colour-block sets, build 70's large sizes.
- Older looks A–F: Figma file "Steps app looks" (key of1WY3BRkYf0FmZHr1tVSu).
