# Review 2 — CI screenshots against the spec (T12, Opus, 14 Nov 2026)

Source: CI run 43596886754, artifact `smoke-test` (downloaded to `smoke-ci2/`, not committed). Same layout as
review 1: mockup on the left, app on the right, the app shot with the system bars.

**Overall:** review 1's items 1–13 and 18 landed. Today now matches the mockup closely: Sat 14 Nov, "Ravi"
and "R", the Mon … Sun strip with the week's history and an empty Sunday, the mockup's hour bars and goal
line, and no mood card. The food result has "(methallu)" in ink with "· fried" / "· boiled" muted, the
Nutrients caption sits next to its heading, and there is no bottom bar. The walk's sparkline is wavy and the
route fills the map card. Dark phone mode is the same as light. Four items are left, all for Sonnet in one round.

## Items

| # | Screen | Difference | Fix (file → value) | Model |
|---|---|---|---|---|
| 19 | Detail | `clean-detail.png` shows the Expo splash (the "^" logo on white); `clean-detail-dark.png` shows the steps detail. The log has "design-preview ready: clean detail", so the capture ran before the splash finished fading: two splash frames in a row were the same, and the loop stopped. It is a timing race in CI, not an app fault. | `.github/scripts/launch-and-capture.sh`, `capture()` → after the "ready" line is found, `sleep 2` before the same-frame loop, and make the loop need **three** equal frames in a row (keep the 6 s limit, raise it to 8). Update the comment above `capture()`. | Sonnet |
| 20 | Food result | Under Vitamin A the app adds "Some ingredients not counted yet" (`PARTIAL_NOTE`), which runs under the button strip. The caption already says "at least", and the mockup and spec 5.10 end the section at the last nutrient row (or "Show all nutrients", 10.5). | `src/components/food/food-result.tsx`, the nutrients section (around line 482) → draw the trailing note only when `!atLeast` (no shown row has "≥"); keep it when there are no rows to show (the early return). Add or update a test if the section has one. | Sonnet |
| 21 | Walk | The route has a gap on the top road where the removed car part is. `routeLines()` (`src/walks/view.ts`) makes that stretch a `left-out` line, and `route-map.tsx` has a dashed layer for it, yet nothing is drawn there. | **Rule (Opus):** a removed part is drawn as a dashed line in muted (the scheme's `outline`, #5F6673 in Clean+) so the route reads as one line, as in the mockup; a kept part stays solid in its colour. Find why the dashed `left-out` line is missing in the Clean+ map (check the colour handed to it in `route-map.tsx` line 97, the `route-dashed` layer's filter and `line-dasharray`, and whether the preview's walk screen passes `parts`). Fix it; dash `[2, 2]`, width 3. Add a test that `routeLines(SAMPLE_WALK_POINTS, SAMPLE_WALK_PARTS)` gives route, left-out, route with the joints shared (no gap). | Sonnet |
| 22 | Walk | The sample route's shape differs from the mockup's (the app has an extra step and a diagonal end). The mockup: start bottom-left, a short rise to the north-east, north, a long run east, a short drop south, then south-west to the end. | `src/design-preview/sample.ts` → the mockup's route in metres (east, north), 6 m per mockup dp: `LEG_1 = [[0,0],[141,114],[141,534],[600,534]]`, `CAR = [[600,534],[900,534]]`, `LEG_2 = [[900,534],[1371,534],[1416,294],[1284,120]]`. Keep the times, the pace weights and `distanceM`. Re-run the sample tests (latitude span stays under 810 m, the sparkline keeps ≥ 4 turns); update any test that pins the old points. | Sonnet |

## Accepted (no change)

- **"Updated 2 min ago · Sample day" under the tiles (Today).** The mockup ends at the tiles, but the line tells
  how fresh the steps are and is `s13 muted`, so it stays. The owner can overrule this at the final OK.
- **"Good afternoon"** (the drawn chart needs an afternoon clock), real map tiles with the ⓘ, and **Delete walk**:
  as review 1.
- **Sparkline note (review 1 fixes):** windows 6–7 read 22 and 19 where the mockup has 12 and 22, because the
  car gap is bridged. The line is wavy with the mockup's rhythm; accepted.
- **Detail screen** (no mockup; checked against spec sections 3, 5 and 10.1 from `clean-detail-dark.png`):
  title `s22 med` with back chevron, date muted, the day pager pill with the forward chevron dimmed on today,
  "By hour" with the total, the white chart card with the 10.1 bars and goal line, and the hint line. The axis
  says "6 am" / "6 pm" where the hero says "6": fine on a full-width chart. Nothing to fix.

## Not checked by these shots

- Item 11 (the last nutrient row clears the buttons at the end of the scroll): the shot is at the top of
  the page. Sonnet checks it on the emulator or with a scrolled capture if one is easy to add.

## Next

1. **Sonnet:** "Fix items 19–22 in docs/design/review-2.md".
2. Commit, push and run the Android workflow (standing OK).
3. **Opus:** "Review the CI screenshots" → review 3. If it is clean, the owner looks at the screenshots and gives the final OK.
