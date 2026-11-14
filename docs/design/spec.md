# Clean+ blue — per-element spec

Written by Sonnet (T2, 14 Nov 2026) from the approved mockup `docs/design/clean-plus.html` / `clean-plus.png`. **Checked by Opus on 14 Nov 2026**: 47 possible faults raised by five reviewers, 25 confirmed by independent re-checks and fixed below; the open questions are decided in section 10. Every value below is read from the mockup's CSS or measured from the rendered page (`spec-measured.md` lists every element's box). The same values, typed, are in `src/constants/themes/clean-spec.ts`; `src/constants/__tests__/clean-spec.test.ts` checks them against the HTML and this file.

Do not change a value here to suit the code. If the mockup and the code disagree, the mockup wins; if the mockup is silent, see "Not drawn in the mockup" and ask Opus.

## 0. Units and frame

- 1 mockup px = 1 dp. The mockup phone is **390 × 844**. The app screen is that frame **minus** the Android system bars: content starts below the status bar, and the bottom bar sits above the gesture area (see 6.7).
- Side margin everywhere: **24**. Content width on a 390 phone: 342.
- Page background: **#FFFFFF**. Cards are white on white and are lifted only by their shadow.
- The look is always light.

### Board-only classes (not in the app)

`.strip` (title strip above the phones), `.row3` (row of three phones), `.phone` (the phone frame: 390 × 844, radius 36, shadow `0 8px 24px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.03)`), the page background `#F3F4F6`, and the `<h1>`/`<p>` in the strip. `.pad` is the 24 dp side padding. `.light` (weight 300) is defined but not used by any element.

## 1. Fonts

| Use | Family | Weight | Android family name (T3) |
|---|---|---|---|
| All text | Poppins | 300 (`.s52` numbers only) | `Poppins_300Light` |
| | Poppins | 400 (default) | `Poppins_400Regular` |
| | Poppins | 500 (`.med`, pills, buttons) | `Poppins_500Medium` |
| Telugu | Noto Sans Telugu | 400 (`.te` and as the fallback for any Telugu in other text) | `NotoSansTelugu_400Regular` |

Font stack in the mockup: `"Poppins", "Noto Sans Telugu", system-ui, sans-serif`. Anti-aliased, no bold (700) and no italic anywhere.

## 2. Colours

All colours in the mockup, nothing else is allowed.

| Name | Hex | Where |
|---|---|---|
| ink | #111827 | default text, headings, nutrient names |
| muted | #5F6673 | secondary text, inactive nav icons, chevron-right on tiles, chevron-down on the "1 bowl" chip, the weather sun icon (the back chevron is **ink**) |
| accent | #1F4FD8 | hero, FAB, primary button, active nav, water pips, nutrient bars, route, "Keep", fat dot, day fill |
| accentTint (`--accent-t`) | #E8EEFC | pill background, avatar circle, tinted icon circles, selected day box, pace-chart fill |
| accentMid (`--accent-m`) | #DCE4FA | empty week-day track, unfilled water pips |
| warm | #C8601F | food: icon, bar, protein dot, donut protein, food-result icons |
| warmTint | #FBEEE4 | food icon circles, food hero card |
| indigo | #5A5F86 | sleep: icon, bar |
| indigoTint | #EDEEF5 | sleep icon circle |
| hair | #EEF0F3 | hairlines, bar tracks (`.bar`) |
| soft | #F3F4F6 | grey fills: "1 bowl" chip, Edit button, segmented well, grey icon circle (car) |
| warn | #B42318 | sodium row text, its bar, warning pill text |
| warnTint | #FDECEA | warning pill background |
| onBlue (`--onblue`) | #D6E0FA | text on the blue hero (labels, "of 8,000", axis, "goal pace") |
| white | #FFFFFF | page, cards, text on accent, selected segment |
| heroPill | #3B66E0 | the "78%" pill on the hero (white text) |
| heroBarQuiet | #6A8BE6 | hero chart: bars for hours with no steps (past or future) |
| heroGoalLine | #A9BEF2 | hero chart: dashed goal-pace line |
| selectedTrack | #C3D1F6 | track of today's day in the week strip |
| carbs | #9AA1AC | carbs dot and donut segment |
| mapLand | #F1F3F6 | map ground |
| mapWater | #DCE5FA | map water |
| mapBlock | #E6E9EE | map park/building block |
| mapDot | #D9DDE4 | map trees inside the block |

Shadows (use RN `boxShadow`; if it renders differently on the emulator, report it — do not change the values):

| Name | Value | Where |
|---|---|---|
| card | `0 1px 2px rgba(17,24,39,.04), 0 8px 24px rgba(17,24,39,.06)` | `.card`, `.tile`, stat cards, map card |
| fab | `0 8px 20px rgba(17,24,39,.14)` | the + button |
| segment | `0 2px 8px rgba(17,24,39,.06)` | selected segment (Walk/Run/Cycle) |

No gradients, no glow, no other shadows.

## 3. Type scale

`line` is the line height. All text is left-aligned except where a row says right. `ls` = letter spacing.

| Class | Size | Line | Weight | ls | Role |
|---|---|---|---|---|---|
| `.s13` | 13 | 18 | 400 (`.med` 500) | 0 | captions, labels, units, day names, axis, pill text (500) |
| `.s15` | 15 | 22 | 400 (`.med` 500) | 0 | body: row titles, values in rows, "of 8,000", button labels (500), avatar letter (500) |
| `.s18` | 18 | 24 | 500 | 0 | tile and stat values |
| `.s22` | 22 | 30 | 500 | −0.01em in the board title only; **0 in the app** | screen titles ("Good morning, Ravi", dish name, "Morning walk") |
| `.s52` | 52 | 56 | 300 | −0.02em = **−1.04 dp** | big numbers: steps, kcal, distance |

Modifiers: `.muted` colour #5F6673; `.med` weight 500; `.te` Telugu line (Noto Sans Telugu 400, 15/24, muted). Exceptions: the "Car" row title is 15/**20**; `.btn` labels are 15/500 with the line height left to the font (22, centred).

Units after a number come in two kinds:
- **Inside an `.s18 med` value** ("of 1,900 kcal", "of 8 glasses", "min", "km" on the walk tile, "/km", "floors"): the unit is `.s13 muted` weight **400**, nested inline in the same text after **one space character set in the value's 18/500 font** (about 4.7 dp). No flex gap; number and unit share one baseline. In RN: `<Text style={value}>5 <Text style={unit}>of 8 glasses</Text></Text>`.
- **After an `.s52` number**: a separate `.s15` text in a baseline-aligned row with **gap 8**: muted for "kcal" and "km", onBlue for "of 8,000" on the hero.

## 4. Shapes and spacing

Spacing scale used: **4, 8, 12, 16, 24** (and 28/40/56/72/146 as fixed sizes). Radii: **2** (bars), **4** (week track, dots, 8×8 legend dots), **12** (week day box, pill), **16** (buttons, selected segment), **20** (avatar/chip/segmented well, circles 40), **24** (cards, hero, tiles, map), **28** (FAB). The pill radius is 12 (height 24). Circle = 40 × 40, radius 20.

Icons: **20 × 20**, 24-unit viewBox, no fill, stroke = current colour, **stroke width 1.5**, round caps and joins. Icon sits centred in its 40 circle (10 inset). The icon list with exact shapes is in section 8.

## 5. Components

### 5.1 Greeting row (Today)
Row height **48**, space-between, top padding of the screen **24** (below the status bar). Left: date `s13 muted` ("Sat, 14 Nov") over title `s22 med` ("Good morning, Ravi"); date box 18, title box 30 (together 48). Right: avatar circle 40 × 40, vertically centred in the 48 row (x 326, y 28 on 390; right edge 366), `accentTint` fill, the user's initial ("R" in the mockup) centred, `s15 med` in accent.

### 5.2 Week strip
Margin-top **16**. Seven columns, space-between, each **40 × 60**, radius 12, content centred, gap 8: day name `s13 muted` (Mon … Sun) over a **track 8 × 24**, radius 4, fill `accentMid`, with an inner fill from the bottom, radius 4, accent, height = share of that day's goal (the mockup: Mon 90 %, Tue 100 %, Wed 60 %, Thu 85 %, Fri 100 %, Sat 78 %, Sun none). Today (Sat): the column box fill `accentTint`, day name `s13 med` accent, track `selectedTrack`. Future/no-data day: empty track only.
Tapping a day opens that day in Journal (`docs/design.md`).

### 5.3 Steps hero
Margin-top 16. Box: accent fill, radius **24**, padding **24**, text white. Inside, top to bottom (y relative to the box top 164 on a 390 screen):
1. y 24: row height **20**, space-between, `s13`, colour onBlue: "Steps" left; "4.6 km · 52 min active" right (text box at y 25).
2. y 48 (margin-top 4): row space-between, baseline-aligned, 56 high: left "6,240" `s52` white (box 48–104) + 8 gap + "of 8,000" `s15` onBlue (box y 78); right pill "78%" (box y 78, its text baseline on the number's baseline; right edge at the box's inner right edge, x 342 on screen): height 24, padding 0 8, radius 12, `s13 med` white on `heroPill`.
3. y 116 (margin-top 12): the hour chart (5.4), 294 × 64, to y 180.
4. y 184 (margin-top 4): four axis labels in four equal columns, `s13`, onBlue, left-aligned: "12 am", "6", "12 pm", "6" (y 184–202).
Box total height **226** (padding 24 below the axis row).

### 5.4 Hour chart (inside the hero)
Drawn in SVG, source: `clean-plus.html` lines 111–130. Width = hero inner width (294 on a 390 phone), height **64**.
- 24 slots (hours 0–23). Bar width **6**, x = 3 + hour × pitch, pitch = **W / 24** (12.25 at W = 294): each bar sits 3 dp into its slot (hour 23: x 284.75, right edge 290.75).
- Draw order, back to front: quiet bars, goal line, "goal pace" label, white bars. White bars taller than the line cover the dashes. Bar corner radius 3 (1.5 for the 3 dp bars). Bars sit on the bottom edge (y = 64 − height).
- Hours with steps: white bar, height proportional, **tallest = 60**. Hours with no steps, past or future: height **3**, `heroBarQuiet`.
- Mockup heights for hours 6–15: 7, 60, 37, 21, 29, 22, 25, 18, 25, 13; hours 0–5 and 16–23 are the 3 dp quiet bars.
- Goal-pace line: horizontal at y = **43**, full width, stroke `heroGoalLine`, 1 wide, dashes 3 on / 4 off; label "goal pace" right-aligned at x = W, baseline y = 37, Poppins 13, onBlue.
- The rule that places the line (what 43 means) is not drawn in the mockup: see "Not drawn".

### 5.5 Tiles (2-column grid)
Grid 2 columns, gap **16** (row and column), margin-top 16. Tile: white, radius 24, card shadow, padding **16**, height **146** (width 163 on 390).
Inside: header row (height 40, space-between): left a 40 circle with the tile's icon; right either a chevron-right (20, muted), a **plus circle** (40, accent fill, white plus icon), or a **pill**. Then label `s13 muted` (margin-top 16), value `s18 med` with its unit nested inline after one space (section 3; unit x on 390: 88.45, 235.19, 100.33, 249.11), then margin-top 12 and the 4 dp bar (or pips); the walk tile instead has `s13 muted` "32 min · 3,120 steps" at margin-top 8.

| Tile | Circle | Header right | Label | Value | Bar |
|---|---|---|---|---|---|
| Food | warmTint, warm bowl | chevron | Food | 1,280 + "of 1,900 kcal" | track hair 4 high radius 2, fill warm 67 % |
| Water | accentTint, accent drop | plus circle | Water | 5 + "of 8 glasses" | 8 pips, each (width − 28)/8 wide (12.88 at 131), **4 high**, radius 2, gap 4; 5 accent, 3 accentMid |
| Sleep | indigoTint, indigo moon | chevron | Sleep | 6 h 50 + "min" | track hair, fill indigo 85 % |
| Morning walk | accentTint, accent walker | pill "7:10 am" | Morning walk | 2.3 + "km" | none (line of text instead) |

Order: Food, Water (row 1); Sleep, Morning walk (row 2). Whole tile is tappable (Food, Sleep, Walk open their detail; Water: the tile opens the water detail, the plus circle adds a glass).
Grid bottom (390 phone): 714.

### 5.6 Pill
`display:inline-flex`, height **24**, padding 0 8, radius 12, `s13 med`, accentTint fill, accent text. Text vertically centred, one line, never wraps; width = text width + 16, no minimum (41.91 for "78%", 65.06 for "7:10 am"). Variant on the hero: `heroPill` fill, white text. Variant "High" (warning): fill warnTint, text warn, padding 0 8 0 4, gap 4, with a 20 warning icon before the text.

### 5.6b Bar and pips
`.bar`: height 4, radius 2, fill hair, children fill left-to-right with radius 2. Pips: as in the Water tile.

### 5.7 Bottom bar (all main screens)
Absolute at the bottom, **height 72**, white, 1 dp top border `hair`, side padding 16, five slots with space-around, icon colour muted. Each slot is 48 wide: a 20 icon, gap 4, a 4 × 4 dot (radius 2, transparent unless selected). Selected slot: icon and dot accent. Slots, left to right: Today (clock-ring icon), Food (bowl), **Log food** (the FAB), Activity (pulse), You (person). **No text labels** (give each a TalkBack label). Journal has no slot.
FAB: **56 × 56**, radius 28, accent fill, white plus (20), fab shadow, **top edge 7.5 above the bar's top edge** (centre 15.5 above the bar's centre). It is the middle slot.
Tap areas: the visual slot is 48 × 28; the touch area must be at least 48 × 48 (extend it; the pictures do not change).

### 5.8 Buttons
Height **48**, radius 16, label `s15 med` centred. Primary: accent fill, white. Secondary: soft fill, ink. Food result: two side by side, bottom edge 24 above the screen bottom, gap 16, "Edit" width 112 (secondary), "Save to lunch" fills the rest (primary).

### 5.9 Top bar of a sub-screen (Food result, Walk)
Top padding **16**. Row height 40, space-between. Left: back chevron-left (20, **ink** #111827) with margin-left −4 (so the chevron's left edge is at x = 20) — on the Food result followed by "You typed" `s13 muted` at gap 8. Right (Food result): the "1 bowl ▾" chip: height 40, padding 0 12 0 16, radius 20, soft fill, `s15`, gap 4, chevron-down 20 muted. Right (Walk): the segmented control.
Segmented control: 216 × 40, soft fill, radius 20, padding 4, three equal segments, left to right "Walk", "Run", "Cycle", each (216 − 8) / 3 = 69.33 × 32 (on the Walk screen "Walk" is selected); selected segment: white, radius 16, segment shadow, label `s13 med` ink; others `s13` muted; all centred.

### 5.10 Food result
- Title: margin-top 8 below the top bar, `s22 med`, the text **as the user typed it, case kept** (mockup: "endu chepala with egg curry"); wraps if longer, never cut. Telugu line directly under it, margin 0: `.te` 15/24 muted (mockup: "ఎండు చేపల గుడ్డు కూర").
- Hero card: margin-top 16, warmTint fill, radius 24, padding 16 24, height **136**, space-between, items centred. Left: "412" `s52` ink + "kcal" `s15 muted` (baseline, gap 8); under it (margin-top 8) a 3-column grid (64, 64, 56): each column is a row `s15 med` ink with an 8 × 8 dot (radius 4, gap 8, centred on the 22 line) and the grams, with the label `s13 muted` directly below (no margin). Mockup: "38 g" Protein (dot warm), "14 g" Carbs (dot carbs), "22 g" Fat (dot accent). Right: donut 88 × 88 (see 5.12) with a bowl icon (warm, 20) centred.
- Section row "Ingredients": margin-top 24, space-between, baseline, `s15 med` left, `s13 muted` right ("Some ingredients still being added", shown only when something is pending).
- Ingredient row (`.ing`): height **48**, gap 12: a warmTint circle with a food icon (warm), then the text part: flex, height 48, space-between, bottom hairline (1 dp hair) on all but the last row, under the text part only (x 76 to 366, width 290; not under the circle); name `s15` ink with the method nested inside it as `s13 muted` after a space ("· fried", same baseline); amount `s15 muted` right ("40 g").
  Mockup rows in order: fish "Dried anchovy (methallu) · fried" 40 g; egg "Egg · boiled" 100 g; onion "Onion" 60 g; tomato "Tomato" 50 g; bottle "Oil" 10 g (last, no hairline).
- Section row "Nutrients": margin-top 16, a row with gap 8, baseline: "Nutrients" `s15 med` + "at least · bar shows % of daily need" `s13 muted`.
- Nutrient rows (`.nut`): margin-top 4 for the group; each row height **28**, gap 12: name 140 wide `s15` ink; bar flex (90 on 390) 4 high; value 88 wide `s15 muted`, right-aligned, written "≥ " + number + unit (micro sign µ). Name, bar and value vertically centred in the 28 row. Bars fill accent, fill radius 2.
  Warning row (Sodium): name text warn; the "High" pill (5.6 warning variant) follows the name at gap 8 inside the 140 name column; the bar track stays hair, only the fill is warn; value text warn.
  Mockup rows (name, fill, value): Sodium + High, 93 % warn, "≥ 1,850 mg"; Calcium, 21 %, "≥ 210 mg"; Iron, 17 %, "≥ 3.1 mg"; Vitamin B12, 100 %, "≥ 2.4 µg"; Vitamin A, 20 %, "≥ 180 µg".
- Buttons at the bottom (5.8).

### 5.11 Walk
- Top bar with segmented control (5.9); title `s22 med` margin-top 8; info row margin-top 4, height 24, space-between: left date `s13 muted` + pill ("7:10 am") with gap 8; right weather: a row `s13 muted`, gap 8, centred in the 24 row: sun icon 20 (muted) + "24°C clear".
- Map card: margin-top 16, white, radius 24, card shadow, overflow hidden, height **160**, full width. Contents: see 6 (map).
- Distance row: margin-top 16, space-between, bottom-aligned: left "2.3" `s52` + "km" `s15 muted`; right a 128-wide block: "Pace over time" `s13 muted`, then the 128 × 32 sparkline (margin-top 4).
- Stat cards: 2 × 2 grid, gap 16, margin-top 16. Each card: white, radius 24, card shadow, height **72**, padding 0 16, a row with gap 12: accentTint circle with accent icon, then value `s18 med` (unit nested inline, section 3) over label `s13 muted`; the 42-high value/label block is vertically centred in the card. Grid order: row 1 Time, Steps; row 2 Pace, Floors. Clock "32" + "min" / "Time"; feet "3,120" (no unit) / "Steps"; gauge "13:55" + "/km" / "Pace"; stairs "2" + "floors" / "Climbed".
- "Parts": margin-top 24, `s15 med`. Group margin-top 4. Part rows (`.ing` height **56**, gap 12): circle 40 (accentTint + accent walker for Walk; **soft + muted car** for the removed part), name `s15`, duration `s15 muted` right; hairline under all but the last. The removed part: name `s15 muted` (line 20) over "6 min · removed" `s13 muted`, and "Keep" `s15 med` accent at the right.

### 5.12 Donut
SVG 88 × 88, centre (44, 44), radius **36**, stroke width **10**, circumference 226.2, rotated −90° so it starts at the top. Three arcs in order protein (warm), carbs (carbs grey), fat (accent). Arcs run clockwise from 12 o'clock, stroke-linecap **butt** (round caps are for icons only), no track ring: the 3 dp gaps show the card's warmTint.
**Rule (Opus, 14 Nov):** macro kcal = protein g × 4, carbs g × 4, fat g × 9; arc length = macro kcal ÷ (sum of the three) × 217.2 (= 226.2 − 3 × 3); each arc is dasharray "len 226.2", offsets 0, −(P + 3), −(P + 3 + C + 3). The mockup's 80.7 / 28.7 / 107.8 (offsets 0, −83.7, −115.4; lines 216–220) are illustrative and do not follow from its own 38/14/22 g; the rule gives 81.3 / 30.0 / 105.9 (offsets 0, −84.3, −117.3). Tests use the rule. If all three are 0, draw no arcs (bowl icon only).

## 6. Drawings

### 6.1 Sparkline (Walk, pace)
128 × 32. Area: the polyline closed along the bottom, fill accentTint; line: accent, 2 wide, round caps and joins, no fill. Points (x, y): 0,20 · 16,14 · 32,18 · 48,10 · 64,16 · 80,12 · 96,22 · 112,15 · 128,18. Source lines 320–323.

### 6.2 Map (Walk)
342 × 160 drawing, source lines 300–312: ground mapLand; water mapWater in the bottom right; one block mapBlock (rx 16) with four mapDot circles; main roads white 8 wide with round caps, minor roads white 4 wide with butt caps; route accent **3 wide**, round caps and joins; start dot r 6, white fill, accent ring 2.5; end dot r 6.5, accent fill, white ring 2.5. In the app the tiles come from the map style (T8) in these colours; the route is drawn from the real points.

## 7. Screens

Every y below is for a 390 × 844 frame with no system bars, as in the mockup; in the app add the status-bar inset on top and the gesture inset at the bottom.

| Screen | Top padding | Order (gap to the next) | Bottom |
|---|---|---|---|
| Today | 24 | Greeting (48) → 16 → Week strip (60) → 16 → Hero (226) → 16 → Tiles grid (146 + 16 + 146) → ends at 714 | Bottom bar (72) from 772, Today selected |
| Food result | 16 | Top bar (40) → 8 → Title (30) → Telugu (24) → 16 → Hero card (136) → 24 → Ingredients heading (22) → rows 5 × 48 → 16 → Nutrients heading (22) → 4 → rows 5 × 28 → ends at 738 | Buttons 48 high, bottom edge 24 above the bottom (no bottom bar) |
| Walk | 16 | Top bar (40) → 8 → Title (30) → 4 → Info row (24) → 16 → Map (160) → 16 → Distance (56) → 16 → Stat cards (72 + 16 + 72) → 24 → Parts heading (22) → 4 → rows 2 × 56 → ends at 708 | Bottom bar (72) from 772, Activity selected |

Exact boxes for every element: `spec-measured.md`.

### Wider phones (the mockup is 390)
The extra width goes to the cards, never to the type: the 24 side margin stays; the tile grid and stat-card grid share the width equally with their 16 gap; the week strip spreads with space-between; the hero chart's width grows (pitch formula in 5.4); the nutrient bar grows (name 140 and value 88 stay). Heights, radii, icon and type sizes never change. Check at 390 and 411 (Pixel 6).

## 8. Icons

All are 24-unit viewBox shapes, drawn with `fill="none"`, stroke 1.5, round caps and joins, shown at 20 × 20. Exact source (`<svg class="i">` content in the mockup):

| Name | Shapes |
|---|---|
| bowl (Food) | `path M4 12h16a8 8 0 0 1-16 0z` · `path M9 8c0-1.2 1-1.5 1-2.7M13 8c0-1.2 1-1.5 1-2.7` |
| chevron-right | `path M9 6l6 6-6 6` |
| chevron-left (back) | `path M15 6l-6 6 6 6` |
| chevron-down | `path M7 10l5 5 5-5` |
| drop (Water) | `path M12 3.5c3 3.6 6 7 6 10.5a6 6 0 0 1-12 0c0-3.5 3-6.9 6-10.5z` |
| plus | `path M12 6v12M6 12h12` |
| moon (Sleep) | `path M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z` |
| walker | `circle cx13 cy4.5 r1.5` · `path M9.5 21l2.5-6.5 2.5 2.5V21` · `path M12 14.5l1.2-5.5 2.8 2.5 2.5.5` · `path M13.2 9l-3.2 1.5-1.5 3` |
| today (clock ring, nav) | `circle cx12 cy12 r8` · `path M12 4a8 8 0 0 1 8 8` · `path M12 8.5v3.5l2.5 1.5` |
| pulse (Activity) | `path M3 12h4l2.5-6 5 12 2.5-6h4` |
| person (You) | `circle cx12 cy8.5 r3.5` · `path M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5` |
| fish (dried anchovy) | `path M5 12c2.4-3.3 5.6-5 9-5 2.8 0 5 2 6 5-1 3-3.2 5-6 5-3.4 0-6.6-1.7-9-5z` · `path M5 12L2.5 9M5 12l-2.5 3` · `path M16.5 11v.1` |
| egg | `path M12 3.5c3.2 0 6 5 6 9.5a6 6 0 0 1-12 0c0-4.5 2.8-9.5 6-9.5z` |
| onion | `path M12 3.5c0 3-6.5 5-6.5 10a6.5 6.5 0 0 0 13 0c0-5-6.5-7-6.5-10z` · `path M12 10.5c-1.5 2-2 4-2 6M12 10.5c1.5 2 2 4 2 6` |
| tomato | `circle cx12 cy13.5 r6.5` · `path M9 6.5l3 1.5 3-1.5M12 8V4.5` |
| bottle (oil) | `path M10 3.5h4M10.5 3.5V7L8 10.5V19a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 19v-8.5L13.5 7V3.5` · `path M8 14h8` |
| warning | `path M12 4l8.5 15.5h-17z` · `path M12 10v4M12 16.8v.1` |
| sun (weather) | `circle cx12 cy12 r3.5` · `path M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4` |
| clock (Time) | `circle cx12 cy12 r8` · `path M12 8v4l2.5 1.5` |
| feet (Steps) | `path M8 4c1.4 0 2.2 1.6 2.2 3.6S9.4 10.5 8 10.5 6 9.5 6 7.6 6.6 4 8 4z` · `path M6.5 13h3v1.5a1.5 1.5 0 0 1-3 0z` · `path M16 8.5c1.4 0 2 1.6 2 3.6s-.6 2.9-2 2.9-2.2-1-2.2-2.9.8-3.6 2.2-3.6z` · `path M14.5 17.5h3v1a1.5 1.5 0 0 1-3 0z` |
| gauge (Pace) | `path M4.5 16.5a8 8 0 1 1 15 0` · `path M12 13.5l3.5-4` · `circle cx12 cy13.5 r1` |
| stairs (Floors) | `path M4 19h4v-4h4v-4h4V7h4` |
| car | `path M4 16.5v-4l2.2-5h11.6l2.2 5v4z` · `path M4 12.5h16` · `path M7 16.5v2M17 16.5v2` |

Icons used for ingredients other than the five drawn (rice, dal, milk …) are not in the mockup: see "Not drawn".

## 9. CSS class index (every class in the mockup, and where it is specified)

| Class | Meaning | Section |
|---|---|---|
| `.strip`, `.row3`, `.phone` | board only, not in the app | 0 |
| `.pad` | 24 dp side padding | 0 |
| `.s13`, `.s15`, `.s18`, `.s22`, `.s52` | type scale | 3 |
| `.muted` | colour muted | 3 |
| `.light` | weight 300, defined but unused | 0, 1 |
| `.med` | weight 500 | 3 |
| `.te` | Telugu line, Noto Sans Telugu 400 | 1, 3 |
| `.row` | flex row, items centred vertically | layout only |
| `.between` | flex row, space-between, items centred | layout only |
| `.hair` | 1 dp bottom border in hair colour | 5.10, 5.11 |
| `.i` | icon: 20 × 20, stroke 1.5 | 4, 8 |
| `.circ` | 40 circle, radius 20, content centred | 4 |
| `.c-acc` | circle fill accentTint, icon accent | 5.5 |
| `.c-warm` | circle fill warmTint, icon warm | 5.5, 5.10 |
| `.c-ind` | circle fill indigoTint, icon indigo | 5.5 |
| `.c-grey` | circle fill soft, icon muted | 5.11 |
| `.card` | white, radius 24, card shadow | 5.11 |
| `.tile` | card + padding 16, height 146 | 5.5 |
| `.pill` | 24 high, radius 12, tinted label | 5.6 |
| `.bar` | 4 high, radius 2, track hair | 5.6b |
| `.nav`, `.on` | bottom bar, selected slot | 5.7 |
| `.fab` | 56 circle, accent, lifted | 5.7 |
| `.btn`, `.primary`, `.secondary` | buttons | 5.8 |
| `.day` | week-strip day column | 5.2 |
| `.ing` | ingredient / part row | 5.10, 5.11 |
| `.nut`, `.n`, `.v` | nutrient row, its name and its value | 5.10 |

## 10. Not drawn in the mockup — decided by Opus (14 Nov 2026)

Built from the same tokens only; no new colours, sizes or fonts. Anything not covered here: stop and ask Opus.

### 10.1 Hour chart rules
- `goalPerHour = goal / 16` (waking hours 6 am–10 pm; 500 for 8,000).
- `scaleMax = max(largest hour's steps, goalPerHour × 1.5)`; bar height = steps / scaleMax × 60, but **at least 4** for any hour with ≥ 1 step (white). Hours with 0 steps: the 3 dp quiet bar.
- Goal line y = 64 − goalPerHour / scaleMax × 60 (never above y 24, so the label always fits). The mockup (y 43) matches a largest hour of about 1,430 steps.
- Future hours today: quiet bars. Past days (from Journal): the same chart, no "now" marker.

### 10.2 Empty and over-goal states
- **Zero steps:** hero shows "0" of 8,000, pill "0%", right line "0 km · 0 min active", all bars quiet, goal line shown.
- **Goal reached:** the pill shows the real share ("112%"); the week-strip fill and every bar stop at 100 % of their track. No colour change, no celebration graphics.
- **Food tile, nothing logged:** "0" + "of 1,900 kcal", empty track. **Over the food goal:** fill capped at 100 %, colours unchanged (no red).
- **Water 0:** all eight pips accentMid.
- **Sleep, no data:** value "—" `s18 med` muted, no unit, empty track, chevron stays (opens the sleep screen).
- **Walk tile, no walk today:** label "Walk", value "No walk yet" `s15` muted, no pill, chevron-right in the header; the line of text under it is left out.
- **Nutrient over 100 %:** bar full; value shows the real amount. Warning styling (warn colours + "High" pill) only where the app's existing nutrient code already flags a limit; never invent new limits in the UI.
- **Donut with all macros 0:** no arcs, bowl icon only (5.12).

### 10.3 Interaction and system states
- **Pressed:** Android ripple, bounded to the element's shape: `rgba(17,24,39,.08)` on white/tinted surfaces; `rgba(255,255,255,.24)` on accent (FAB, primary button, hero, plus circle).
- **Disabled button:** same colours at opacity 0.4; no other change.
- **Loading:** no skeletons or shimmer. Draw the layout at once with values "—" in muted; replace when data arrives (no animation).
- **Walk in progress:** a `.card` 72 high (stat-card layout) between the hero and the tiles grid, gap 16: c-acc circle with walker, "Walk in progress" `s15 med` over "12 min · 1.1 km" `s13 muted`, chevron-right (muted) on the right; whole card taps to the walk.
- **Snackbar:** ink #111827 fill, radius 16, height 48, side margins 24, 16 above the bottom bar (or 24 above the screen bottom where there is no bar); text `s15` white; optional action `s15 med` accentMid. Shown 4 s.
- **Premium-locked tile:** same tile size; c-grey circle with the **lock** icon; label as usual; value "Premium" `s15` muted; chevron-right. Lock icon (same style as section 8): `rect x5 y10.5 w14 h9.5 rx2` · `path M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5`.
- **One-time appearance note:** a `.card` with padding 16: text `s15` ink, "OK" `s15 med` accent at the right, gap 12.
- **Offline / errors:** use the snackbar; never a full-screen error.

### 10.4 Text
- User font scale: allow up to **1.3** (`maxFontSizeMultiplier={1.3}` on all text). Tiles, cards and rows use their heights as **minimums** and grow; nothing is clipped. Check at 1.0 and 1.3.
- Long names: dish title wraps (no limit); ingredient name wraps to at most 2 lines, then ends with "…", and the row grows from 48; nutrient names are a fixed list and fit.
- Telugu text anywhere uses Noto Sans Telugu at its line height (15/24, 13/20). Other Indian scripts: system font for now (not designed).

### 10.5 Longer lists
- Ingredients: show all; the page scrolls. The two Food-result buttons stay fixed at the bottom on a white strip (16 above the buttons, 1 dp hair top border shown only while content is scrolled under it).
- Nutrients: first five in the mockup's order of importance (warnings first), then a 48-high row "Show all nutrients" `s15 med` accent; tapping it lists the rest in the same `.nut` rows.
- Ingredient icons beyond the five drawn: fish → fish, meat, seafood; egg → eggs; onion → onion, garlic, shallot; tomato → vegetables and fruit; bottle → oils, ghee, butter, milk and other liquids; everything else → bowl (warm).

### 10.6 Screens not designed here
Journal, You, Activity, Settings, Goals: keep their current structure, restyled with these tokens (type scale, colours, 24 margins, cards, rows, buttons). Their own design is a later task.

### 10.7 System bars
Status bar and Android navigation bar: white background, dark icons, on every screen (the look is always light).
