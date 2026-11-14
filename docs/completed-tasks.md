# Completed tasks

A short entry is added at the end after each finished task: date, what was done, where, checks, anything left open.

## Before 14 Nov 2026 (summary)

- Phone sign-in and passkeys replaced Supabase sign-in (StepsAuth API).
- Food: AI ingredient lists with our own calculation, recipes, where food came from, own foods with "Fill with AI", Premium locks, country sent with requests.
- Park-track redesign, five tabs, walks/rides/GPS, nutrition and water; 28 review findings fixed.
- Ingredient database from USDA (6,766 records) with Indian names and a background agent — deployed and loaded.

## 14 Nov 2026 — Build 21

- Themes (six looks A–F, switchable, default Colour blocks), barcode/QR scanning with label photos, partial nutrients, country detection. Commit 05be9d2, release android-21. Tests: 1,078 passing.
- Server: food-scan Lambda and steps-products table deployed with StepsApi.
- Open: the looks did not match their mockups (owner rejected); redesign under way.

## 14 Nov 2026 — Cooking model (built, not deployed)

- All 1,431 skipped USDA foods added with a kind tag (8,193 records); cooking model (yields, USDA retention factors, oil uptake) in `stepsinfra`. Python tests ~422 and npm 99 passing.
- Open: deploy needs the owner's OK (StepsData → import → StepsApi).

## 14 Nov 2026 — Clean+ mockups

- Richer Clean+ blue and green mockups made, rendered and checked by the designer, an independent reviewer, and Opus. Sent to the owner.
- Open: owner to pick one; then `docs/current-task.md` (build 22) starts.

## 14 Nov 2026 — Design chosen

- Owner chose Clean+ blue. Opus fixed its two faults (walk card icon, Food card label; Sleep "min"), re-rendered and checked it, and copied it to `docs/design/clean-plus.html|png`. `docs/design.md` and `docs/current-task.md` updated.
- Next: T1 (Sonnet).
- Owner: keep looks A–F visible; they reuse the Clean+ layout with their own colours and fonts (recorded in architecture.md, T1/T4 updated).

## 14 Nov 2026 — T1 (Sonnet): leftover work sorted

- Deleted the six per-look Today screens (backup in the scratchpad `leftover-backup/today/`); `index.tsx` now draws a placeholder `today-clean.tsx` for looks other than Park. Everything else kept; each file is listed in `docs/design/leftover-review.md`. tsc clean; jest 1,130 passing.
- Open: Opus to check the review file. Do not release a build before T6.
- Opus checked T1: claims verified (no stale imports; no code reads the Today-only layout flags; backup has all six files). Deviations accepted; follow-ups added to T4, T6, T7, T8. Decision: Park also moves to the one Clean+ layout. Next: T2 (Sonnet).

## 14 Nov 2026 — T2 (Sonnet): spec written from the mockup

- Wrote `docs/design/spec.md` (fonts, colours, type scale, shapes, every component, three screens, icons, CSS class index, and a list of what the mockup does not draw) plus `docs/design/spec-measured.md` (measured box of every element) and `src/constants/themes/clean-spec.ts` (same values, typed). `src/constants/__tests__/clean-spec.test.ts` checks the typed values and spec.md against the HTML (every class, every hex, :root vars, sizes, radii, shadows).
- tsc clean; eslint clean on the new files; jest 64 suites, 1,138 tests passing.
- Open: Opus to check spec.md against the mockup and decide the "Not drawn in the mockup" list. I did not check the values by eye against the picture, only against the HTML.
- Opus checked T2 (14 Nov 2026): five reviewers (tokens + clean-spec.ts, Today, Food result, Walk, icons) each followed by an independent verifier; 47 findings, 25 confirmed and fixed in spec.md. Main fixes: units inside 18-size values are nested text after one space (not an 8 gap); hour-chart pitch is W/24 plus the draw order; back chevron is ink; hero y positions; pill never wraps; donut arcs clockwise with butt caps and a stated rule (the mockup's arc numbers are illustrative); minor map roads have butt caps; full mockup copy for ingredients, nutrients, stat cards and segments. Added spec section 10 with decisions for undrawn states. Icons: all 23 matched. Tests 200/200 in src/constants, tsc clean. Next: T3 (Haiku).

## 14 Nov 2026 — T3 (Haiku): Clean+ fonts added

- Installed `@expo-google-fonts/poppins` and `@expo-google-fonts/noto-sans-telugu` (package.json, package-lock.json). Poppins 300/400/500 and Noto Sans Telugu 400 only.
- New `src/constants/themes/fonts.ts`: `fontFor(weight)` returns the per-weight Android family name (`Poppins_300Light`, `Poppins_400Regular`, `Poppins_500Medium`), `TELUGU_FONT`, and `CLEAN_FONT_FILES`, the font files keyed by family name.
- `src/app/_layout.tsx` loads these faces with the theme's fonts, so the splash waits for them.
- Test: `src/constants/__tests__/fonts.test.ts` (one check per weight; every family has a file). tsc clean; eslint clean on the touched files; jest 65 suites, 1,142 tests passing.
- Open: `npm install` reported existing audit warnings ("some issues need review"); not looked at in T3. Next: T4 (Sonnet).

## 14 Nov 2026 — T4 (Sonnet): the Clean+ theme, default and always light

- New `src/constants/themes/clean.ts` (id `clean`, name "Clean+"), built from `clean-spec.ts`. It is the default (`DEFAULT_THEME_ID = 'clean'`) and first in the picker (`THEME_IDS`, `THEMES`). An unknown or missing saved id loads Clean+; a saved park/a–f is kept.
- No look follows the phone any more: `ThemeDef.mode` is `'light' | 'dark'` (`'system'` removed). `use-color-scheme.ts` (+ `.web.ts`) return the theme's scheme; `groundOf(theme)` takes no phone argument; `apply.ts` and `theme-sheet.tsx` no longer read the phone's scheme.
- Park is now light only (its dark scheme was dropped, so Park in dark-mode phones is the light Park). Owner decision of 14 Nov: no look follows the phone.
- Removed the unused `ThemeLayout` fields (`logFood`, `gap`, `gutter.today`, `todayKicker`, `todayTitle`, `todayAction`, `todayPair`, `todayRows`, `heroPercent`, `heroStats`, `heroWeek`) and `TodayArea` from `types.ts`, `build.ts` (`PARK_LAYOUT`) and `a.ts`–`f.ts`. A grep showed nothing outside the theme files and tests read them.
- `appearance-note.tsx`: fixed the indent; text now says there are eight looks, Clean+ the one you start with.
- Colour roles: steps and water = accent, food = warm, sleep = indigo, over = warn. **No token-test exceptions were needed.** Two choices the spec does not make: `surfaceContainerLow` #FAFBFC and `surfaceContainer` #F8F9FB (a hair lighter than spec `soft` #F3F4F6) and `lane` #DADEE6, so the lane shows 1.25:1 on cards while the warm food colour keeps 3:1 on it; `onFood` is black (warm on white is 4.08:1). `soft` stays in CLEAN_SPEC for the components that draw the grey plates.
- Fonts: Poppins 400 = regular, 500 = medium, semibold, bold and numeralMedium; Poppins 300 = the big numerals. Only these three files load for Clean+. (T3's `fonts.ts` was fixed here to import per-weight files, not the package root, which would have bundled every weight.)
- Interim, removed in T8: `HAS_WALK_LOOK` is false for Clean+ (it uses the standard walk screen, as Park does) and `walk-icons.tsx` leaves `clean` out of its per-look tables. Clean's `style`/`layout` values are placeholders close to the spec; T5 rebuilds the shared pieces.
- Tests: `themes.test.ts` updated (registry order, default, saved choice, one-scheme rule, ground) and a new "Clean+ equals the spec" block (colours, type, radii, map, fonts). tsc clean; eslint clean; jest 65 suites, 1,169 tests passing.
- Open: Today is still the placeholder until T6; do not release a build before then. Next: T5 (Sonnet).

## 14 Nov 2026 — T4 checked by Opus

- Four reviewers (theme-id crash paths, phone dark mode, spec fidelity, tests and docs), each finding checked by an independent verifier: 7 confirmed, 7 rejected. No crash path for `clean` was found.
- Fixed:
  - Native dialogs (date/time pickers, alerts) still followed the phone: `app.json` `userInterfaceStyle` was "automatic". Now "light", and `_layout.tsx` calls `Appearance.setColorScheme(ThemeMode)` once per run, so Night's stay dark. Test in `app-config.test.ts`.
  - Card, tile and hero corners came out 16, not 24: radius roles were mapped wrong (components read `md` for cards). Now md 24, lg 28 (FAB), sm 12, xs 4, xl 28, all from `CLEAN_SPEC.radius`.
  - Type roles used sizes the spec does not have (screen titles were 24/32). Every role is now one of the five spec steps (13/18, 15/22, 18/24, 22/30, 52/56), built from `CLEAN_SPEC.type`; card numerals 18/24.
  - Colours outside the spec: now every role is a spec colour (near = warn, outline = muted, containers = soft/hair/mapBlock, lane = hair as the mockup's bars, food2/food3 = ink/accent) except `onFood` #000000, `onFoodContainer` #8F3F0A and `scrim` #000000, listed in `CLEAN_OFF_SPEC`. The earlier entry's "no token-test exceptions" no longer holds: `tokens.test.ts` checks Clean+'s hair lane at 1.1:1 on white only (bars are drawn on white cards), with the reason in the test.
  - Tests added: every Clean+ colour is a spec colour or an approved exception; every type role is a spec step in the right face.
- Follow-ups written into T5 (chip 20, snackbar 16, bar tracks vs pips, white cards with shadow), T7 (donut colours from CLEAN_SPEC) and T11 (capture `clean`, dark-phone check on `clean`, design-preview theme list).
- tsc clean; eslint clean; jest 65 suites, 1,172 tests passing. Nothing committed. Next: T5 (Sonnet).


## 14 Nov 2026 — T5 shared UI pieces to spec (Sonnet)

- Changed (all sizes from `CLEAN_SPEC`, all colours from theme roles; each piece has a pure `*-style.ts` / `*-geometry.ts` module with the numbers, tested):
  - `screen` (top padding = status-bar inset + 24, or +16 with a back control; spec chevron-left back button; overlay 16 above the bar in tabs, 24 elsewhere), `navigation-bar` (72 dp, icons only + dot, round 56 dp Log-food FAB lifted 7.5 dp, wrapper so the whole FAB is tappable), `section-header` (caption, 24/16 spacing), `list-row` (48/56 rows, hairline under the text part), `surface`/`Card` (white, radius 24, card shadow, shadow and clip on separate layers), `stat-tile` (146 dp, header row, nested unit, walk tile note fits), `chip` (radius 20, 40 dp), `button` (48/16, new `secondary` variant, disabled 0.4), `fab`, `progress-hero` (radius/padding from spec; blue plate in Clean+).
  - New in `src/components/ui/`: `icons.tsx` + `icon-paths.ts` (all spec icons + lock), `hero-colors.ts` (`heroColors`, `midTone`, `mixHex`), `pill`, `icon-circle`, `greeting`, `week-strip`, `hour-bars`, `ring`, `donut`, `nutrient-bar` (`NutrientRow`, `BarTrack`). All exported from `index.ts`.
- Reviewed by four reviewers with a verifier per finding: 15 confirmed and fixed (FAB position and tap area, heading spacing, overlay gap, row ripple, walk tile height, week-strip and donut colours colliding in looks A, C, F, pressed feedback, weak tests); 4 rejected.
- Decisions and deviations:
  - No react-test-renderer is installed and jest runs `.test.ts` in node, so tests cover the pure style modules (spec numbers, touch targets, a11y label builders), not rendered output. Nothing was seen on a device or emulator yet: T11 screenshots are the first real look.
  - Cards, hero, FAB and chips use the Clean+ sizes in every look (looks share one layout), not each look's own radius.
  - Hero colours (onBlue, pill, quiet bar, goal line), the selected-day track and carbs grey have no theme role: Clean+ uses the spec values, other looks mix them from primary (`hero-colors.ts`).
  - `Ring` is generic: the mockup draws no ring on Today.
  - `NavigationBar` is now 7.5 dp taller (transparent wrapper above the bar). `(tabs)/_layout.tsx` and `app-tabs.tsx` are not wired to the new bar yet (T6).
  - TalkBack: the Water tile is one focus target, so T6 must add an accessibility action for "add a glass".
- tsc clean; eslint clean; jest 84 suites, 1,290 tests passing. Nothing committed. Next: T6 (Sonnet).

## 14 Nov 2026 — T6 Today, T7 Food result, T8 Walk screen, T9 hourly detail (Sonnet agents, reviewed)

- **T6 Today:** `today-clean.tsx` is the one Today for every look (Park's `ParkToday` and the old hero/tiles are gone; `kit.tsx` deleted). Greeting, week strip, steps hero with hour bars, Food/Water/Sleep/Walk tiles, 72 dp "Walk in progress" card, free-app locked tiles (grey lock circle, "Premium") with the PremiumCard below, untimed-steps note. `(tabs)` bar is Today, Food, Log-food FAB, Activity, You (icons only); Journal is a hidden route opened from a row on You and the week strip. Water tile: plus circle is its own 48 dp target. StatTile now has one layout (Clean+) in every look.
- **Food kcal bug:** the two readers used the same arithmetic; Today re-read only on `dataVersion`, so it went stale (0 vs 185). Now `todayKcal()` (pure, `src/state/today-kcal.ts`) + `useTodayKcal(reload)`, used by Today and the Food tab, both re-read on focus. Test: 185 kcal gives 185.
- **T7 Food result:** one Clean+ layout (hero with donut and macros, ingredient rows with icon and cooking method, nutrient bars, fixed Edit/Save strip); hero wraps instead of overlapping at 1.3x text; 40-character name wraps to 2 lines. `food-result-look.ts` deleted.
- **T8 Walk:** one layout (`HAS_WALK_LOOK`, Park branch removed); map always the light style in both phone modes (test); each look keeps its own map colours; web map draws route/dots from map colours; load failure shows an error with back and retry.
- **T9 Detail:** `/detail/[kind]` (steps, active, food, water, sleep) with previous/next day (no future), 15-minute bars for the last 7 days (older days hourly with a note), DST-correct bucketing (`series.ts`), water reads past the newest 400 logs, missing minute data shows the stored total with a note. Today tiles open it (`DETAIL_ROUTES_LIVE = true`); the Walk tile still opens the walk screen.
- **Cleanup:** `ThemeLayout` and every per-look layout field removed from the themes.
- **Review:** reviewers with a verifier per finding: 13 (T6) + 6 (T7–T9) confirmed and fixed. Checks: tsc clean, eslint clean, jest 91 suites, 1,408 tests. Nothing committed; **nothing seen on a device yet** (T11 screenshots are the first look).
- **Open:** no `name` in Profile, so the greeting has no name and the avatar is empty; swipe between days in detail not built; week-strip day tap opens Journal without the day; stacked food hero (donut under text) and the detail layout are the agents' choice where the spec is silent: check in T11/T12; medium nutrient flags show as plain rows; locked-tile tap scrolls to the PremiumCard (no paywall route exists).

## 14 Nov 2026 — T10 Log food button covering the chart (Haiku)

- Food tab's scroll content now ends with a clearance spacer of `BAR_FAB_CLEARANCE` = 56 (round FAB) + 7.5 (lift) + 16 = 79.5 dp, so the last chart clears the bottom bar's Log-food FAB. The constant lives in `src/components/ui/fab-style.ts`, is re-exported from `fab.tsx` and the `ui` barrel.
- Test: `src/components/ui/__tests__/fab-style.test.ts` checks 79.5.
- tsc clean; eslint clean on touched files; jest 91 suites, 1,409 tests passing.
- **Not verified:** the emulator screenshot ("By hour" fully visible at the end of the scroll) has not been taken. It belongs to T11.
- Files: `src/app/(tabs)/food.tsx`, `src/components/ui/fab.tsx`, `src/components/ui/fab-style.ts`, `src/components/ui/index.ts`, `src/components/ui/__tests__/fab-style.test.ts`.

## 14 Nov 2026 — T11 screenshot check setup (Sonnet)

- `launch-and-capture.sh` now photographs only the `clean` look: today, food, walk and detail in light phone mode, plus today and detail with the phone in dark mode (must look the same). The park/a–f loop is gone. Install, crash and alive checks are unchanged; screenshots never fail the job.
- `.github/scripts/side-by-side.py` (Pillow) writes `smoke/compare-today.png`, `compare-food.png`, `compare-walk.png` and `compare-today-dark.png`: mockup crop left, app right, both scaled to 780 px. Crop boxes (three 390x844 phones in the 1360x1060 mockup PNG) are constants at the top, measured with Pillow. Tested locally with fake screenshots. The mockup has no detail screen, so there is no `compare-detail.png`; the detail shots are evidence only.
- `android.yml`: a compare step (`if: always()`, `continue-on-error`) after the emulator step; the whole `smoke/` folder (compare images included) is uploaded as an artifact.
- Design preview: `screen=detail` (optional `kind=steps|active|food|water|sleep`, default steps) renders the real detail screen over the mockups' sample day, with sample minute data (`sampleStepBuckets`, 52 active minutes as on Today). Param tests added. tsc clean; eslint clean; jest 91 suites, 1,417 tests.
- **Not done / for the owner:** a CI run has not happened. It needs the branch pushed (owner's OK) and the Android workflow run; the compare images are then in the `smoke-test` artifact for Opus (T12). The Pixel 6 screenshot includes system bars, so the compare images differ slightly in height: align from the top.

### T11 follow-up — first CI run (run 43591624287, 14 Nov 2026)

- The run succeeded (build, emulator check, compare step, artifact, release). Artifact downloaded to `smoke-ci/` (untracked; do not commit): `clean-today/food/walk/detail` (+ dark), `compare-today/food/walk/today-dark`.
- **Found:** `clean-detail.png` and its dark twin are blank white. Cause: the design preview has no `[kind]` route segment, so `router.setParams({ kind })` never reached the detail screen and `DetailPreview` rendered nothing. **Fixed in the working tree (not yet committed or re-run):** `detail/[kind].tsx` exports `Detail`, and the preview renders `<Detail kind firstDay />` directly. tsc, eslint, jest (91 suites, 1,417 tests) pass.
- **For Opus (T12), seen on a first look at compare-today:** it is close to the mockup. Differences to judge: week strip shows the 7 days ending today (Sat..Fri) where the mockup shows Mon–Sun; greeting has no name and an empty avatar (no name in Profile); the screenshot has system bars and the "How are you feeling?" card below the tiles; date/greeting follow the real clock (Fri afternoon), not the mockup's Sat morning.

## 14 Nov 2026 — T12 review 1 (Opus)

- Compared `compare-today/food/walk/today-dark` from run 43591624287 with `docs/design/spec.md`. Type, colour, radius, tiles, hero, bottom bar and FAB match; dark phone mode looks the same as light.
- Findings in `docs/design/review-1.md`: 13 fix items for Sonnet. Most are sample-data and preview-clock items: Saturday clock, the mockup's hour bars with the goal line at y 43, the week's history, ingredient methods, a wavy pace sparkline. The rest are layout rules: the week strip runs Mon–Sun; no mood card on Today; "(methallu)" in ink; the Nutrients caption inline; no bottom bar under the food result, and its last rows clear the buttons; route padding 24 and no gaps.
- Accepted: real map tiles and the OSM ⓘ (spec 6.2). Owner decisions: A, a name in the greeting; B, where "Delete walk" lives.
- Detail screenshot still blank in this run; the fix is in the working tree, waiting for a re-run.

## 14 Nov 2026 — Review 1 fixes, items 1–13 and 18 (Sonnet)

- **Preview data (1, 2, 4, 7, 13):** the clock and sample day are Sat 14 Nov 2026, 3:45 pm (`SAMPLE_NOW`; `clock.ts` comment). `SAMPLE_HOURLY` is the mockup's chart (largest hour 1,455, so every bar is within half a dp of 7, 60, 37, 21, 29, 22, 25, 18, 25, 13 and the goal line is at y 43.4; spec's 1,430 would have broken the 6,240 total). Active minutes re-spread to stay 52. New `SAMPLE_WEEK` (Mon–Fri at 90, 100, 60, 85, 100 %). Ingredients are `Dried anchovy (methallu, fried)` and `Egg, boiled`. The sample profile is born 1991 so Ravi is still 35 and the target stays 1,900 kcal in 2026. The car stretch of the sample walk now lies along the route and the pace follows `PACE_WEIGHTS`, giving a wavy sparkline.
- **Today (3, 6):** `weekOf` runs Monday to Sunday of this week; later days are `future` (empty track, not a button, spoken "not yet"). The "How are you feeling?" block is gone from Today (the mood check-in and its reminder stay in Journal).
- **Food result (8, 9, 10, 11):** the note in brackets is ink (`ingredientTitle`), only " · method" and counts are muted (`ingredientSuffix`). "Nutrients" and its caption sit in one row, gap 8. The preview shows the food result with no bottom bar; on the phone a result now hides the tab bar while it is up (`food-result-cover.ts`, used by `app-tabs.tsx` and the result's bottom inset). Item 11 needed no change: the Edit/Save strip is not over the list (the list scrolls above it); the earlier crop was the bar taking space.
- **Walk (12):** map camera padding 24 (was 40), and the car loop no longer stretches the bounds.
- **Name (18):** `Profile.name` (null by default, trimmed, 40 characters, `cleanName`), a "Name (optional)" field at the top of the Profile card in Settings, used for the greeting and the avatar letter; with no name there is no avatar circle. Stored in the phone's profile only; nothing uploads the profile. Preview name: Ravi.
- Checks: tsc clean, eslint clean, jest 93 suites, 1,428 tests. Nothing committed; nothing seen on a device.
- Item 15 ("Delete walk") kept as is; item 16 (real map tiles) accepted.
- **Independent review of these fixes:** one finding confirmed, left as is. The sample pace sparkline matches the mockup's shape for points 1–5 and 8–9 but not 6–7 (app: 22, 19; mockup: 12, 22). Cause: the 6-minute car stretch is left out of the pace maths and bridged by a straight line, so the two windows over it always read slow. Matching the mockup there would need a long car leg and a redrawn sample route. For Opus (review 2): accept, or ask for the route to be redrawn.

## 14 Nov 2026 — T12 review 2 (Opus)

- CI run 43596886754 (all four jobs green). Review 1's items 1–13 and 18 are confirmed on the screenshots; Today matches the mockup closely, dark mode is the same as light.
- Four items left for Sonnet (`docs/design/review-2.md`): 19, the light detail shot caught the splash (a CI timing race; the dark detail shot is fine); 20, the food result's extra "Some ingredients not counted yet" note under the nutrients; 21, the removed car part leaves a gap in the walk route (new spec rule in 6.2: draw it dashed in muted); 22, the sample route redrawn to the mockup's shape.
- Accepted: the "Updated … · Sample day" line under the Today tiles (the owner can overrule at the final OK), and the sparkline note from the review 1 fixes.

## 14 Nov 2026 — Review 2 fixes, items 19–22 (Sonnet)

- **19 (CI capture):** `launch-and-capture.sh` waits 2 s after the "ready" line, then needs three identical photos in a row (at most 8 s), so the light detail shot cannot catch the fading splash.
- **20 (food note):** "Some ingredients not counted yet" shows only when no shown nutrient row is a "≥" row (the caption already says "at least"); it still shows when there are no rows.
- **21 (walk gap):** the cause was not found by reading (the data, `routeLines` and the dashed layer are all right; a test already gave route, left-out, route), so the map no longer relies on MapLibre's `line-dasharray`. `dashRuns` (`walks/view.ts`, pure, tested) cuts a weak or left-out stretch into dashes of 1/140 of the route (at least 4 m), drawn as plain butt-capped lines in muted (`outline`), 3 wide, joined to the route. New test: the sample walk gives route, left-out, route with shared joints. Not seen on a device: CI run decides.
- **22 (sample route):** the mockup's route at 6 m a mockup dp (`LEG_1`, `CAR`, `LEG_2` in `sample.ts`), 2.29 km in all, 2.65 : 1 box. New test pins its shape and length. Note for Opus: on foot (without the 300 m car leg) it is 1.99 km while `SAMPLE_WALK.distanceM` says 2,300 and the part says 1,100 m; the screen shows the stored figures, so nothing visible changes.
- Checks: tsc, eslint clean; jest 93 suites, 1,432 tests.

## 14 Nov 2026 — T12 review 3 (Opus)

- CI run 43599840988 (b2b473d, all jobs green). Every shot is covered by the emulator's "Pixel Launcher isn't responding" box. Under it, review 2's fixes show: the walk route has the mockup's shape with the car part dotted and no gap, the food list ends at Vitamin A, the light detail shot is the real screen.
- Item 23 (Haiku): the capture script hides and closes system dialogs. One more clean run is needed (review 4).
- Planned the same day: T15 (correct a dish's ingredients and amounts) and T16 (walk buddies; owner chose area-only nearby, chat after accept, totals for buddies only, 18+).

## 14 Nov 2026 — T12 review 4 (Opus)

- CI run 43612325716 (1219365, all jobs green). Item 23 worked: no system dialog in any shot, no warning in the log.
- Today (light and dark), the food result and the detail screen match the mockup and spec. The walk route and the dotted car part match.
- Item 24 (Haiku): the sample walk's legs had very different speeds (0.88 and 1.95 m/s), so the pace sparkline climbs at the end. Fix the car times (7:25–7:31) and scale the route so the on-foot length is 2,300 m; this also fixes the distance mismatch noted in the review 2 fixes.
