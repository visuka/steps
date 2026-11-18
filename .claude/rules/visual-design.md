# Visual design rules — Steps

These rules apply to every mockup, screen and component change. They cover the look only: layout, colour, typography, spacing, icons and motion.

**Where things live:**
- This file holds the rules.
- [docs/design.md](../../docs/design.md) holds the approved per-element values.
- [src/components/plain/plain-theme.ts](../../src/components/plain/plain-theme.ts) holds those values in code.
- If they disagree, stop and ask the owner. Don't pick one yourself.

## Source of the look

- **The approved look is "plain, sage and sand"** (owner, 17 Nov 2026).
  - The owner's choices outrank any general design brief, including their own master prompt of 18 Nov 2026.
  - [docs/design-rules-audit.md](../../docs/design-rules-audit.md) lists which points of that prompt were set aside, and why.
- **A new wish is met inside these rules.** "More cheerful" or "more premium" does not override them. If a wish would break a rule, ask the owner before breaking it.
- **Mock first.** The owner decides from a picture. The app must then match the approved mock exactly: font, weight, size, line height, colour, spacing, corner radius, shadow and icon.

## Layout and spacing

1. **Tiles stay.** Use frosted white tiles on a soft grey ground. The open look with dividers instead of tiles was rejected on 18 Nov 2026.
2. **Top row:** the NUTRITION · ACTIVITY · MEET switch, calendar on the left, avatar on the right. There is no bottom bar.
3. **One focal point per screen:** the top (hero) tile.
4. **Precise alignment:** one gutter, one tile gap and one tile padding per screen. Take them from `docs/design.md`; never use one-off values.
5. **Comfortable density.**
   - Never fill space just to avoid emptiness.
   - Keep room in the middle of Today for a future ad space, and leave it empty.
6. **Today (Activity) never scrolls** at 360 × 800 dp with normal text size.
7. **No tile inside a tile.**
   - Use the spec's corner radius; don't round anything further.
   - Use soft shadows only.
8. **Fits every phone and every text size.**
   - Nothing is cut off and no word breaks mid-word.
   - A unit never leaves a lone letter on its own line. A unit moves down only as a whole ("of 250 g").
   - No tile is squashed.
   - Text growth stays capped by `MaxTextScale`.

## Colour

1. **Two colours only, sage and sand,** plus neutrals.
2. **Colour goes on surfaces only.**
   - Sage: the selected switch pill (one per screen), main buttons and the hero tint.
   - Sand: the second tile, chips, avatars and badges.
3. **Words and numbers never take colour.** Use charcoal ink and grey only.
4. **No harsh or flashy fills.**
   - No black solids.
   - No saturated or deep solid fills.
   - No shine, glow or glitter.
   - No gradients except the soft ground wash.
5. **Contrast.** White text on sage and on badges counts too.
   - Text under 18 dp (under 14 dp if bold): at least 4.5:1.
   - Larger text: at least 3:1.
6. **Smallest text is 11 dp.**
7. **Light only.** A light look stays light when the phone is in dark mode, unless the owner approves a dark version.

## Typography

1. **Two typefaces only.** No other faces and no decorative fonts.
   - Outfit (200 and 300 for figures, 500 for labels and the switch) for figures, labels and the switch.
   - Figtree for words.
2. **One type scale:** the table in `docs/design.md`. Don't invent sizes.
3. **The big figure is big but balanced** inside its tile, never filling the screen. The owner said "Not too large".
4. **Changing numbers must not shift the layout** as they update (step count, kcal). Use tabular figures where the font supports them.
5. **Labels** are small capitals, tracked. **Notes** are sentence case, in grey.
6. **Units** are smaller and grey, right after the figure ("4.6 km").

## Showing data

- **Numbers and words only.** No progress bars, rings, dots, gauges or charts on the plain look.
- **Use a short insight line** ("1,760 to go", "goal reached at 12 pm") rather than decoration.

## Icons

1. **Every tile label has its icon,** all in one line style with the same stroke and size.
2. **Each icon has its own soft colour by kind of data** (`PLAIN_ICON_COLOR`): steps and walk green, distance coral, active amber, food orange, sleep indigo, water blue. Icons are the only coloured marks outside surfaces.
3. **No emoji, illustrations, stock images or 3D characters.**

## Motion

1. **Gentle continuous movement in the ground only:** slow drifting light behind the tiles. Nothing moves on tiles or text, and there is no sheen (see Colour: no shine).
2. **Calm transitions.** No bounce and no exaggerated springs.
3. **Respect the phone's "Remove animations" setting.** When it is on, everything stops.

## Before showing a design to the owner

1. **Render it and look at every screen yourself.** Never say a design is checked without rendering it.
2. **Check three cases:** a normal phone, 360 × 800 dp, and the largest text size.
3. **Go through this file rule by rule.** Fix every break before the owner sees it; the owner should never have to find one.
4. **Never suggest copying another app's look.**
