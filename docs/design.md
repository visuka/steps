# Design

**Managed by Opus (or a stronger model) only.** Sonnet and Haiku read this file and follow it; they never edit it. If something here is missing or wrong, stop and report it.

## Owner's rules

1. The app must look **exactly** like the approved mockup: font, weight, size, line height, colour, spacing, corners, shadows, icons. "Same output."
2. Simple and elegant: one accent colour, one warm colour for food, white space, few elements per screen, light geometric type. No shine, glow, gradients or emojis.
3. Rich, not empty: a strong hero, soft cards, small visuals that carry the numbers.
4. The owner decides only after seeing a picture. Nothing reaches the owner unchecked.
5. Light looks stay light when the phone is in dark mode.

## How a design becomes the app

1. Mockup approved by the owner → copied into `docs/design/`.
2. Opus writes the per-element spec `docs/design/spec.md` (+ `src/constants/themes/clean-spec.ts`). Every value in code comes from the spec.
3. Tests check that the theme values equal the spec.
4. CI photographs the real screens (design-preview deep link); Opus compares them with the mockup element by element; differences become fix items.
5. The owner sees the screenshots before a build is sent.

Size rule: the mockup phone is 390 px wide; 1 mockup px = 1 dp. On wider phones the extra width goes to the cards, not to bigger text.

## Current state (14 Nov 2026)

- Build 21 shipped six looks (A–F) that did not match their mockups; rejected by the owner.
- "Clean" (plain) blue and green: rejected as too plain/empty.
- Clean+ blue and Clean+ green made and checked.
- **14 Nov 2026: the owner chose Clean+ blue.** Approved mockup: `docs/design/clean-plus.html` and `docs/design/clean-plus.png`. This is the only source of truth for the look.
  - Opus fixed its two faults before approval: the walk card now uses a tinted walk icon circle (like the other cards) instead of a route picture; the Food card reads "Food" / "1,280 of 1,900 kcal"; Sleep reads "6 h 50 min".
  - Bottom bar: Today, Food, (+ Log food), Activity, You — icons only, active tab marked by accent colour and a dot. Each icon still gets a TalkBack label.
  - Journal has no tab: it opens from the You tab (first row, "Journal") and from Today's week strip (tap a day).
  - 14 Nov 2026: per-element spec `docs/design/spec.md` written (T2) and checked by Opus; its section 10 holds Opus's decisions for states the mockup does not draw (empty days, goal reached, pressed, loading, walk in progress, snackbar, premium lock, large text, long lists, system bars).
- The green column below is kept for reference only.

| | Clean+ blue | Clean+ green |
| --- | --- | --- |
| Font | Poppins 300/400/500 | Outfit 300/400/500 |
| Accent | #1F4FD8 (tints #E8EEFC, #DCE4FA) | #0F7A55 (text #0B6B4A, tint #E6F2EC) |
| Food (warm) | #C8601F, tint #FBEEE4 | #B4541A, tint #FBEEE4, mid #E9B58F |
| Sleep | #5A5F86, tint #EDEEF5 | #4A5280, tint #ECEEF5 |
| Text | #111827, grey #5F6673 | #111827, grey #5F6672 |
| Bottom bar | Today, Food, (+), Activity, You — icons only | Today, Food, Log food (+), Activity, Journal — with labels; You = avatar on Today |
| Known faults | walk card route picture; "Food · of 1,900" label | none seen |

Both: Telugu in Noto Sans Telugu; 24 px side margins; 8 px spacing scale; 1.5 px line icons in 40 px tinted circles; soft shadows only; text contrast ≥ 4.5:1.

Older looks A–F: Figma file "Steps app looks" (key of1WY3BRkYf0FmZHr1tVSu).
