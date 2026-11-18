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

## Current: plain, sage and sand, mock d38 (owner approved 18 Nov 2026)

**Source:** the owner chose sage plus sand on 17 Nov ("Let us finalise on sage plus sand", "I need the app exactly as in the mock.. pixel to pixel"). On 18 Nov they asked for bolder figures, larger small words and a darker grey, and for the ad space between tiles mid-Today; then "Approve d38".
- **Mockup:** `docs/design/plain-sage-sand/plain.html?s=a|n|m&k=1&ic=1&icx=1&f=4&b=1&h=1&d=38` (Activity, Nutrition, Meet).
  - Add `&sm=1` for the small phone (360 × 800), `&lg=1` for large text, `&admark=1` to outline the ad space, `&check=1` to run the rule check (`rulecheck.js`), `&dump=1` to list the drawn values (`measure.js`).
- **Pictures:** `d38-activity.png`, `d38-nutrition.png`, `d38-meet.png` and `d38-small-*.png` in the same folder.
- **Code:** `src/components/plain/` (`plain-theme.ts` holds every value). **The code still has the 17 Nov values until d38 is built.**

Size rule for this look: the mockup phone is **411 px wide; 1 mockup px = 1 dp**, through `scaled()`. On small phones `scaled()` shrinks everything (down to 0.85), but **no text is drawn below 11 dp**: labels, switches, badges and the sync line take `max(11, scaled(size))`.

### Structure

- Three parts, switched by the top row: **NUTRITION · ACTIVITY · MEET**. Activity (Today) opens first. No bottom bar.
- Top row: calendar (left, opens Steps by day), the switch, the avatar (right, opens Profile).
- Nutrition = Food tab, Activity = Today, Meet = Walk buddies. News and Log food left Today (owner's OK, 17 Nov); News stays at `/news`.
- **Today, top to bottom:**
  1. the date line;
  2. the Steps tile;
  3. Distance and Active;
  4. **the ad space**;
  5. Food and Sleep;
  6. Water;
  7. the latest walk (sand tile).
- **Ad space:** empty, full tile width, **50 dp tall on every phone** (not scaled). It sits between the Distance/Active pair and the Food/Sleep pair. Nothing is drawn there until the ads design is approved.

### Colours

| Use | Value |
|---|---|
| Words, numbers | #2C2C2E |
| Labels (capitals) | #55555A |
| Notes, units, date line, times | #5E5E63 |
| Ground | 170° wash #F5F5F6 → #ECECEE → #F3F3F4, white glows top right and bottom right, #DADADE glow left middle |
| Plain tile | #F8F8F9, 1 px white edge |
| Sage (selected switch, primary buttons, Water +) | **#567565**, white text |
| Top tile on each screen (sage tint) | #DEE4E2, edge #D3DDD8 |
| Second tile (sand tint) | #F2EAE1, edge #EFE3D6 |
| Chips, avatars | #F2E9DE |
| Badge | **#876644**, white text |
| Secondary button (Later) | white 80 %, ink text |
| Search field | white, edge #E8E8EB |
| Today / Week switch, selected side | white pill, ink text, shadow 0 1 4 rgba(0,0,0,.08) (only one sage pill per screen) |

- Colour sits on surfaces only; words stay ink and grey.
- Every text colour passes contrast: 4.5:1 for small text, 3:1 for large.
- Each label icon has its own colour (`PLAIN_ICON_COLOR`), 17 dp, stroke 1.9.
- The calendar icon is ink #2C2C2E, 18 dp, stroke 1.6.

### Type

| Element | Face | Size / line |
|---|---|---|
| Label (STEPS TODAY) | Outfit 500, tracked 2, capitals | 11.5 |
| Big figure | Outfit **300**, tracking −2 | 96/100 Activity, 64/66 Nutrition |
| Tile figure | Outfit **300** | 38/46 Activity, 34/38 elsewhere |
| Unit after a figure | Figtree 400 grey | 15 |
| Middle figure | Outfit **400** | 22 / 26 |
| Note | Figtree 400 grey | 14 |
| Date line under the top row | Figtree 400, first words ink 600 | 15 |
| Button | Figtree 600 | 13, padding 8 × 16, radius 18 |
| Switch | Outfit 500, tracked 1.6 | 11.5 in 40 high; 11.5 in 32 high (Today / Week) |
| Badge | Figtree 600 | 11 |

- Fonts: Figtree 400/500/600 and Outfit 200/300/400/500 are bundled. Outfit ("Outfit thin", owner 18 Nov 2026) replaced the phone's condensed and mono faces; its files and licence are in `assets/fonts/`. **Outfit 400 (middle figures) is new for d38 and not bundled yet** (`assets/fonts/` has 200, 300 and 500). Same family and licence; download only with the owner's OK.
- Units never wrap on their own. With large text, a unit moves under its figure only as a whole ("of 250 g").

### Spacing

- **Screen and tiles:**
  - gutter 18;
  - **tiles 9 apart on every screen, Today included** (Today was 12; it gave the room to the ad space);
  - tile radius 24;
  - padding 14 × 18, or 18 × 20 on Today. On a small phone (360 × 800), Today's tiles take 14 × 18 too, so Today never scrolls and keeps at least 12 dp above the bottom edge.
- **Shadows and controls:** shadow 0 8 24 rgba(40,40,50,.06); round buttons 40; top row 6 under the status bar.
- **Side-by-side tiles:** the buttons sit at each tile's foot on one line, at least 12 under the words.
- **Measured exceptions in the mock (keep them):**
  - Calories tile padding 15 / 18 / 14;
  - Eaten today and Chats tiles bottom padding 8, because their list rows carry their own;
  - Coming next tile 12 × 18.

### Motion

- **Ground only:** three soft lights drift slowly behind the tiles, on 16, 19 and 22 second loops.
- **Nothing moves on tiles or text.**
- **"Remove animations":** when the phone has it on, the lights stop.

### Kept from before, not on the mockup (never removed)

- Food: Previous day / Next day under Eaten today; tap an entry to change or delete it, long-press to delete; the sand tile opens every nutrient (Macros, Vitamins, Minerals, Watch) below it; the week view; setup and gap notes.
- Meet: every chat, request, buddy and the walker ID share.

## Previous: grey, black and one red, every screen (owner, 17 Nov 2026)

**Source:** the owner's reference picture (a health app shot in grey, black and one red), then "can you deliver this theme?", "1" (the whole Today screen) and "every screen to this color combination". It replaces the Dawn/Noon/Dusk colours on Today and the parchment and green of the Calm theme everywhere else.

### Colours

| Use | Hex |
| --- | --- |
| Screen ground (`background`, `surface`, Today `bg`) | #F1F1F1 |
| Cards (`surfaceContainerLowest`, Today `card`), the bottom bar | #FBFBFB |
| Text, the main button, the data (steps, food), filled segments | #000000 |
| Water (glasses, plus button, Water screen) | #2B70AE, fill #A9D4F5 |
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
- **Cards:** no outline, radius 20, #FBFBFB on #F1F1F1, padding 9/16 (8 on short screens), 7 apart. Log food 42 high.
- **Steps card:** a clock icon and TODAY, the hours on your feet on the right. The count in Figtree Light 38 (34 on short screens) with STEPS beside it and "x TO GO" on the right; no percentage. A red line with a red dot and the time now, then the hour dots: 8 small dots (3 dp, 2 apart) per hour, the hour now red and blinking. The goal bar: 16 rounded pills (8 high, 3 apart), black up to the steps with the leading pill red, hatched for what is left, red past the goal. Under it a scale of the goal (0 · 2,500 · 5,000 · 7,500 · 10,000), or past the goal "GOAL x" and a red square with "+x PAST GOAL".
- **Distance and Active:** their own cards side by side: icon, name and a small ↗ arrow; the figure in Figtree Light; a rounded bar (8 high) with its scale (hidden on short screens and with large text). Distance grey, Active red (full at 30 min). Both open the steps detail.
- **FOOD & SLEEP:** a title in mono capitals (14, tracking 1.5) above the pair, hidden on short screens and with large text. Food's bar black with a small red dot at its end; Sleep's bar red. Both heads have the ↗ arrow.
- Water, the walk and Log food as before, without outlines.
- Motion as before: blocks rise once, bars grow once, the count counts up, the hour now keeps blinking, the news keeps moving. With "Remove animations" on, nothing moves.
- Today must not scroll at 360 x 800 with normal text.

### Second pass on the reference (owner, 17 Nov 2026: "Yes, make all 10")

- Hour dots: only the steps are drawn, as a small peak of three columns per hour (the middle tallest); an hour with none keeps one faint dot on the base line. Lit dots #5E5E5E; the hour now red and blinking.
- Goal bar and Sleep: pills of mixed length (`PILL_PATTERN`), 8 high, 3 apart. Goal: black with the leading pill red; past the goal black to the goal, red after. Sleep: black pills (2.5 times longer, it is a short bar) with a red dot at their end. Food keeps its black bar with a red tip; Active red; Distance grey.
- A faint line (#E4E4E4) under the steps count. "x TO GO" stays (it replaced the percentage).
- Distance, Active, Food and Sleep figures: one style, medium 22 (20 on short screens) with the unit small right after it ("4.6 km").
- FOOD & SLEEP title: bold mono 15.
- The switch is a compact pill in the middle (each half sized to its word); the selected half, the round top buttons and the cards sit on a soft shadow (elevation 2).

### Third pass on the reference, and water in pale blue (owner, 17 Nov 2026: "Yes, all in one")

This replaces what the two passes above say about the figures, the hour dots, the now line and the bars.

- **Figures:** the phone's condensed face (`sans-serif-condensed`): the step count light 38 (34 on short screens); the card figures regular 20 (18), the unit joined at the same size: "4.6km", "52m" or "2h 24m", "1,280 kcal", "6h 50m". Figtree Light is no longer loaded.
- **Hour dots:** an even grid of round dots, 3.5 dp with 3.5 dp gaps (3 and 2.6 on short screens), 7 rows, two columns an hour, each hour a small ramp: a steep rise, then a step down (`dotGrid`). The latest hour #3A3A3A, older hours #CFCFCF, quiet columns one faint base dot (#E4E4E4).
- **Now line:** across the grid on its second row: a red triangle (blinking, the one continuous movement), a red hairline (55%) and the time on the right.
- **Divider** under the count: the full card width.
- **Hours on your feet:** from the first hour with steps to the time now ("06:00 – 15:45").
- **Bars:** all 10 high. Filled part on a light base (#E8E8E8), the rest faint slanted strokes (#DCDCDC). Red dots 12 across, pieces 8 dp apart on the base (12 beside a dot). Goal: a red dot at the start, long black pills, a red dot at half the goal once passed; past the goal one red pill after it. Distance pale grey #C8C8C8, Active red, Food black with a red dot at its end, Sleep two black pills and a red dot.
- **Food and Sleep:** a tiny faint triangle (#B0B0B0) over the start of the bar; scales 0 · half · target (Food) and 0h · 4h · 8h (Sleep), hidden on short screens and with large text.
- **Scales:** mono 9 in #B0B0B0 (decorative; the cards say their figures to TalkBack).
- **FOOD & SLEEP** title: 6 dp more room above it.
- **Water in pale blue:** glasses outlined #2B70AE and filled #A9D4F5; the plus button #2B70AE on a 12% tint. Theme `water` #2B70AE (5.2:1 on white, 3.2:1 on the #CCCCCC lane), `waterContainer` #DCEEFB, map water #D4E7F5.

### Bottom bar (every screen)

A row of 52 dp round buttons, 6 apart (almost touching), centred, on the screen's own ground, no hairline; 60 dp plus the system inset. The selected one is a #FBFBFB circle on a soft shadow with a black icon, the others #E4E4E4 circles with black icons. Labels are not drawn; TalkBack still says each name (`nav-style.ts`, `navigation-bar.tsx`).

## History

- **Plain, sage and sand, 17 Nov 2026 values** (sage #5E7E6F, badge #C9A47C, grey #8E8E93, labels 10.5, notes 13, Outfit 200 figures, Today gap 12): replaced by mock d38 on 18 Nov 2026. The old table is in git history (this file, before commit "Design: approve mock d38").

- **Today "Time of day" (17 Nov 2026), replaced the same day:** Dawn/Noon/Dusk colours, a steps ring and hour bars (`docs/design/today-time-of-day.html`). Its full spec is in git history (commit b4274a0, this file).

- 14 Nov 2026: Clean+ blue chosen (`docs/design/clean-plus.html`), later replaced.
- 16–17 Nov 2026: Calm and large (theme `e`) was the one look; builds 70 to 74. Its Today is replaced by the Time-of-day Today above. The Calm theme stays for every other screen.
- Rejected 17 Nov 2026: the dark premium palettes, the light/colour-block sets, build 70's large sizes.
- Older looks A–F: Figma file "Steps app looks" (key of1WY3BRkYf0FmZHr1tVSu).
