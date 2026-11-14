# Review 4 — CI screenshots against the spec (T12, Opus, 14 Nov 2026)

Source: CI run 43612325716 (1219365, all four jobs green), artifact `smoke-test` in `smoke-ci4/` (not committed).

**Overall:** item 23 worked. No shot has a system dialog, and the log has no "a system dialog was on screen"
warning. This is the first unobstructed run, so colours could be checked:

- **Today (light and dark):** matches the mockup. The date, "Ravi" and "R", the week strip with an empty
  Sunday, the blue hero with 6,240 of 8,000, 78 %, the hour bars and goal pace line, and the four tiles with
  their bars all match. Clean+ is a light look, so the dark-mode shot is the same as the light one, as decided
  (docs/architecture.md, Looks).
- **Food result:** matches the mockup row for row. The kcal card with the donut, the five ingredients with
  " · fried" / " · boiled" muted, Nutrients "at least · bar shows % of daily need" with the Sodium High pill,
  and the list ends at Vitamin A. Edit / Save to lunch are in the white strip.
- **Detail (light and dark):** the real steps detail screen in both: title, date, the Today pill, By hour with
  6,240 steps, the bar card and the hint.
- **Walk:** the route has the mockup's shape, and the removed car part is a dotted muted line joining the two
  walk parts (spec 6.2 rule). The header, the weather, the four stat cards and Parts with "Keep" all match. One
  thing differs: the pace sparkline (item 24).

## Items

| # | Screen | Difference | Fix (file → value) | Model |
|---|---|---|---|---|
| 24 | Walk | The pace sparkline is flat, then climbs at the end. The mockup's line goes up and down across the whole width. The cause is the sample, not the app: leg 1 is 1,060 m in 20 min (0.88 m/s) and leg 2 is 934 m in 8 min (1.95 m/s), so the last windows are twice as fast whatever `PACE_WEIGHTS` say. The same sample is also 1.99 km on foot while `SAMPLE_WALK.distanceM` says 2,300, and the car part says 1,100 m for a 300 m leg. | `src/design-preview/sample.ts`: (1) **Times:** `CAR_START = sampleTime(7, 25)`, `CAR_END = sampleTime(7, 31)`; keep `WALK_START` 7:10 and `WALK_END` 7:44. Each leg's share of walking time then matches its share of length (about 1.19 and 1.21 m/s). (2) **Length:** keep the three paths as written, but multiply every coordinate by `FOOT_SCALE = 2300 / (pathLength(LEG_1) + pathLength(LEG_2))`, computed in code from the unscaled legs (about 1.153). Apply it to `CAR` too, so the shape is unchanged. (3) **Car part:** `distanceM: Math.round(pathLength(CAR) * FOOT_SCALE)` (about 346). (4) Update the comments: the header says on foot to 7:25, the car 7:25–7:31, on foot 7:31–7:44; the leg comment says about 6.9 m a mockup dp. Keep `PACE_WEIGHTS`, `distanceM` 2,300, `movingS` and the steps. **Tests** (`src/design-preview/__tests__/sample.test.ts`): the on-foot route length is within 1 % of `SAMPLE_WALK.distanceM`; the two legs' average speeds are within 10 % of each other; the car part's `distanceM` is within 1 % of its leg length. Update any test that pins the old 1.99 km or 2.29 km total. The existing checks (latitude span under 810 m, shape, ≥ 4 sparkline turns) must still pass. | Haiku |

## Accepted (no change)

As review 2: "Good afternoon", real map tiles with the ⓘ, **Delete walk**, and the "Updated 2 min ago · Sample
day" line under the Today tiles. The owner can overrule any of these at the final OK.

## Next

1. **Haiku:** "Fix item 24 in docs/design/review-4.md", then commit, push and run CI (standing OK).
2. **Opus:** "Review the CI screenshots" → review 5. Only the walk sparkline needs checking. If it waves like
   the mockup, you look at the screenshots and give the final design OK.
