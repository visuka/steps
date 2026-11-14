# Review 1 — CI screenshots against the spec (T12, Opus, 14 Nov 2026)

Source: CI run 43591624287, artifact `smoke-test` (downloaded to `smoke-ci/`, not committed):
`compare-today.png`, `compare-food.png`, `compare-walk.png`, `compare-today-dark.png`, `clean-detail*.png`.
Each compare image has the mockup crop on the left and the app on the right. The app shot includes the
system bars, so line the two up from the top.

**Overall:** type, colour, radius, card sizes, tiles, the hero layout, the bottom bar and the FAB match
the spec. Dark phone mode gives the same picture as light, which is correct. The differences below come
mostly from the **sample data and the preview clock**, plus a few layout rules. Each item names the file,
the value to set and the model to use. Sonnet does items 1–13 and 18 in one round; none needs Opus.

## Today (`compare-today.png`)

| # | Difference | Fix (file → value) | Model |
|---|---|---|---|
| 1 | The date reads "Fri, 14 Nov" and the clock is 1:30 pm on a Friday. The mockup is Saturday. | `src/design-preview/clock.ts` and `SAMPLE_NOW` / `SAMPLE_DAY` in `src/design-preview/sample.ts` → **Sat 14 Nov 2026, 3:45 pm local**. Update the comment in `clock.ts` (it says 2025). Every sample date built from `SAMPLE_DAY` moves with it. | Sonnet |
| 2 | Hour bars: the app has 8 active hours (6–13) that are mostly short. The mockup has hours 6–15 with heights 7, 60, 37, 21, 29, 22, 25, 18, 25, 13. | `SAMPLE_HOURLY` in `sample.ts` → hours 6–15 = **170, 1430, 880, 500, 690, 525, 600, 430, 600, 415**, all other hours 0. The total stays 6,240. With goal 8,000 this gives scaleMax 1,430 and a goal line at y = 64 − 500 / 1430 × 60 = **43.0**, as in the mockup (spec 10.1). Re-split `SAMPLE_ACTIVE` / `sampleStepBuckets` from the new hours so active minutes stay **52**. Add a test: `hourChart(SAMPLE_HOURLY, 8000)` gives a goal y of 43 ± 0.1 and a tallest bar of 60. | Sonnet |
| 3 | The week strip shows the seven days ending today (Sat … Fri). Spec 5.2 and the mockup show **Mon … Sun** of the current week, with today's column highlighted and later days drawn as an empty track. | The week-strip model in `src/components/today/today-layout.ts` (or `model.ts`, wherever the days are built) → the days run from the Monday of today's week to Sunday. Later days: no fill, label `s13 muted`, not tappable. Add a test for Sat 14 Nov 2026 giving Mon 9 … Sun 15 with index 5 highlighted, and one for a Monday. | Sonnet |
| 4 | Past days in the strip are empty because the sample has no history for the week. | `sample.ts` → add days Mon 9 … Fri 13 Nov 2026 with steps of **90, 100, 60, 85, 100 %** of 8,000 (7,200, 8,000, 4,800, 6,800, 8,000). Today stays 6,240 (78 %). Put them in the snapshot's `days`. | Sonnet |
| 5 | The greeting has no name and the avatar circle is empty. The mockup has "Good morning, Ravi" and "R". | Owner chose **A(1)**: see item 18. With the 3:45 pm clock the word is "Good afternoon": the drawn chart needs an afternoon clock, so that word stays. | Sonnet (item 18) |
| 6 | The "How are you feeling?" card shows under the tiles. Spec 7 ends Today at the tiles (714). | `src/app/(tabs)/index.tsx` → in the Clean+ Today, drop the mood section (`SectionHeader "How are you feeling?"` and its card). Mood stays in Journal (`mood-log.tsx`). Check that nothing else on Today depended on it. | Sonnet |

## Food result (`compare-food.png`)

| # | Difference | Fix (file → value) | Model |
|---|---|---|---|
| 7 | Anchovy has no "· fried", and Egg shows "· 2" where it should be "· boiled". The cause is the sample names. | `SAMPLE_FOOD.ingredients` in `sample.ts` → `'Dried anchovy (methallu, fried)'` and `'Egg, boiled'`. Check that `ingredientLine()` (`food-result-layout.ts`) gives main "Dried anchovy", aside "(methallu)", method "fried", and main "Egg", method "boiled". Add both as test cases. | Sonnet |
| 8 | "(methallu)" is drawn in muted `s13`. Spec 5.10: the aside is part of the name, `s15` **ink**; only " · fried" is `s13 muted`. | `src/components/food/food-result.tsx` around line 395 → outer text = `line.main` + (aside ? ` ${aside}` : ''); the nested muted text holds only ` · ${method}` (or the count). Keep `ingredientRowLayout` measuring the same full string. | Sonnet |
| 9 | The Nutrients caption is pushed to the right. Spec 5.10: a row with gap 8, baseline: "Nutrients" then the caption right after it. | `food-result.tsx` → give the Nutrients row its own style, `{ flexDirection: 'row', alignItems: 'baseline', gap: CLEAN_SPEC.space.s8, flexWrap: 'wrap' }`, without `justifyContent: 'space-between'`. Keep `sectionRow` (space-between) for Ingredients. | Sonnet |
| 10 | The bottom navigation bar shows under the food result. Spec 7: the food result has no bottom bar; its buttons sit 24 above the bottom. | `src/app/design-preview.tsx` → render `screen=food` without `WithNavigationBar`, as the detail preview is. Then check that on the phone the food result opened from the Food tab (`FoodResultHostView`, `food.tsx`) also covers the tab bar. If it does not, hide the bar while a result is open. | Sonnet |
| 11 | The last nutrient rows run behind the Edit / Save strip. | `food-result.tsx` → the scroll content's bottom padding = button height 48 + 24 + 16 = **88**, plus the bottom inset, so the last row (Vitamin A) clears the buttons when scrolled to the end. After item 10 the frame is the mockup's 390 × 844 minus the bars; it may still need to scroll. That is fine as long as nothing is hidden at the end. | Sonnet |

## Walk (`compare-walk.png`)

| # | Difference | Fix (file → value) | Model |
|---|---|---|---|
| 12 | The route is small inside the map and shows gaps. | `src/components/route-map.tsx` line 145 → camera padding **24** on all sides (was 40), so the route fills the 342 × 160 card as in the mockup. Gaps: check `SAMPLE_WALK_POINTS` in `sample.ts`. If the line breaks where the part changes (walk → removed car), the car part should not be drawn, but the walk line must be one unbroken polyline. If the gap is between points that are far apart, add points so the L and the diagonal are continuous. | Sonnet |
| 13 | The pace sparkline is flat with one dip. Spec 6.1 has a wavy line (y 20, 14, 18, 10, 16, 12, 22, 15, 18). | `SAMPLE_WALK_POINTS` in `sample.ts` → space the timestamps so the pace over the nine samples follows the mockup's shape: faster where y is small (10, 12) and slower where it is large (22). Add a test: `sparkline(speedSeries(SAMPLE_WALK_POINTS))` has at least four direction changes. | Sonnet |
| 14 | The info row reads "Fri". | Fixed by item 1. | — |
| 15 | There is a "Delete walk" button under the parts. The mockup has none. | **Kept** (owner, 14 Nov 2026: keep it where it is). No change. | — |
| 16 | The map shows real street tiles and an ⓘ attribution button. The mockup draws a simple sketch. | **Accepted.** Spec 6.2 says the app draws real tiles in the mockup's colours, and they are mapLand / mapWater / white roads here. The OpenStreetMap attribution is required by the map licence, so the ⓘ stays. | — |

## Name field (owner decision A, 14 Nov 2026)

| # | Change | Fix (file → value) | Model |
|---|---|---|---|
| 18 | An optional name, used for the greeting ("Good afternoon, Ravi") and the avatar initial ("R"). | **Type:** `src/data/types.ts` → `Profile.name: string \| null`; `src/data/profile.ts` → `DEFAULT_PROFILE.name = null`. A saved profile without the field reads as null (check the profile load and `mergeProfile`; add a test that an old saved profile still loads). **Input:** `src/app/settings.tsx`, Profile card → a text field "Name (optional)" as the first row above Units, placeholder "—", saved on blur. Trim it; an empty value saves null; at most 40 characters; `autoComplete="name"`, `textContentType="givenName"`, `autoCapitalize="words"`. Use the text input from `src/components/controls.tsx` (add a small `TextField` there in the same style as `NumberField` if none fits). Add "Name sets the greeting on Today." at the start of the section's `why` text. **Today:** `src/components/today/use-today-extras.ts` line 44 → `const name = profile.name?.trim() \|\| null;` and remove the old comment. `greetingFor` and `avatarInitial` already handle a name. With no name, the avatar circle is not drawn. Check `today-clean.tsx`: no empty accentTint circle. **Preview:** `SAMPLE_PROFILE.name = 'Ravi'` in `src/design-preview/sample.ts`. **Privacy:** the name stays on the phone. Check that `src/sync/*` and any upload (backup, AWS) do not send it; if the profile is uploaded anywhere, leave `name` out and say so in completed-tasks. The "What we keep" text in settings should mention the name only if it is kept. **Tests:** the default is null; an empty or whitespace name gives null; the greeting and initial come from the profile name. | Sonnet |

## Detail

| # | Difference | Fix | Model |
|---|---|---|---|
| 17 | `clean-detail.png` is blank. | Already fixed in the working tree (the preview renders `Detail` directly). Needs the commit and a CI re-run; it is reviewed in review 2. | — |

## Dark phone mode

`compare-today-dark.png` is the same as light. Nothing to fix.

## Owner decisions (14 Nov 2026)

- **A. Name in the greeting:** add an optional name field (item 18).
- **B. "Delete walk":** keep the button on the walk screen as it is (item 15).

## Next

1. **Sonnet:** "Fix items 1–13 and 18 in docs/design/review-1.md".
2. **Owner OK:** commit, push, and run the Android workflow. A run publishes a pre-release.
3. **Opus:** "Review the CI screenshots" → review 2.
