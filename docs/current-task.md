# Current task: Build 22 — the chosen Clean+ look, hourly detail, bug fixes

Status: **Approved design: Clean+ blue (14 Nov 2026).** T0 to T11 done; CI run 43591624287 gave the first screenshots. T12 review 1 done and its fixes (items 1–13 and 18) are done by Sonnet, not yet committed. Next: the owner's OK to commit, push and re-run the Android workflow (it publishes a pre-release), then **Opus review 2**.

## Who does what next

| Step | Model | Say to it |
| --- | --- | --- |
| ~~T1~~ | done | |
| ~~T1 check~~ | done | |
| ~~T2~~ | done | |
| ~~T2 check~~ | done | |
| ~~T3~~ | done | |
| ~~T4~~ | done | |
| ~~T4 check~~ | done | |
| ~~T5~~ | done | |
| ~~T6, T7, T8, T9~~ | done | |
| ~~T10~~ | done | |
| ~~T11~~ | done (CI run 43591624287) | |
| ~~T12 review 1~~ | done | `docs/design/review-1.md` |
| ~~Review 1 fixes~~ | done (Sonnet) | |
| **T11 re-run (next)** | owner's OK | commit, push, run the Android workflow (publishes a pre-release) |
| T12 review 2 | Opus | "Review the CI screenshots" |
| T13 | Haiku | only after the owner's OK |
| T14 | Sonnet | only after the owner's OK |

Switch to the model shown, give it the line, and come back to Opus at each "check" row.
Written by Opus, 14 Nov 2026. Implement with Sonnet / Haiku as marked.

## Goal

1. The app looks exactly like the Clean+ mockup the owner picks (font, colours, sizes, spacing, shapes).
2. Tapping any Today tile opens an hourly (or finer) time series for that day, with previous days.
3. Fix the build 21 bugs: header under the status bar, Log food button covering the chart, Today Food 0 kcal vs Food tab 185 kcal, dark walk map.
4. Screenshots of the real app are checked against the mockup before build 22 is sent.
5. (Separate, needs its own OK) Deploy the cooking-model server.

## Rules for every task

- App repo: this repo, branch `combined`. Checks: `npx tsc --noEmit` and `npx jest` must pass after each task.
- Keep each file's line endings as they are.
- Do not commit or push unless the owner says so. Never deploy without the owner's OK.
- Sizes: the mockup phone is 390 px wide. Use **1 mockup px = 1 dp**. On wider phones (Pixel 6 = 411 dp) the extra width goes to the cards, not to bigger text.
- Every value (font, size, weight, line height, colour, radius, padding, gap, shadow) comes from `docs/design/spec.md`. Never guess a value. If the spec is missing one, stop and add it to the spec from the mockup HTML first.
- The look is always light. The phone's dark mode must not change it.
- Read `docs/design.md` and `docs/architecture.md` first. Never edit `docs/design.md` (Opus only).
- After finishing a task, append a short entry to `docs/completed-tasks.md` (date, task id, what changed, test counts, anything left open).

## Order

T0 → T1 → T2 → T3 → T4 → T5 → (T6, T7, T8, T9, T10 can run in any order) → T11 → T12 → T13. T14 is separate.

---

## T0. Owner picks the design (gate)

- **DONE 14 Nov 2026: Clean+ blue** (Poppins, #1F4FD8). Faults fixed by Opus. Mockup: `docs/design/clean-plus.html` / `.png`.
- Bottom bar: Today, Food, (+ Log food), Activity, You — icons only. The Journal tab goes; Journal opens from the You tab and from tapping a day in Today's week strip (see `docs/design.md`). This changes `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/you.tsx` and `navigation-bar.tsx` in T5/T6.
- **Files:** none.
- **Risk:** Starting before the pick wastes all later work.
- **Done when:** the owner has named one.
- **Model:** none (owner).

## T1. Sort out the unfinished work in the working tree

**DONE 14 Nov 2026 (Sonnet), checked by Opus.** Result: `docs/design/leftover-review.md`. Its three deviations are accepted; their follow-ups are now in T4, T6, T7 and T8.

The stopped "screens match mockups" run left 28 changed files and new folders (about 1,700 lines). They are not reviewed.

- **What:** Keep what helps the single chosen look; drop the rest.
  - Keep (review, then keep): `src/app/design-preview.tsx`, `src/design-preview/*` (fixed sample day for screenshots), the capture loop in `.github/scripts/launch-and-capture.sh` and `.github/workflows/android.yml`, `src/components/map-style.ts` (+ test), the fixes in `src/state/use-calories.ts`, `src/components/ui/screen.tsx`, `src/app/(tabs)/food.tsx`.
  - Drop: the six per-look Today screens `src/components/today/today-a.tsx` … `today-f.tsx` and any per-look branches in `src/constants/themes/a.ts`–`f.ts` that only served them.
  - Write the result to `docs/design/leftover-review.md`: each file, keep / drop / change, one line why.
- **Files:** everything listed in `git status`; `docs/design/leftover-review.md` (new).
- **Risk:** Throwing away the real bug fixes along with the per-look screens. Use `git diff <file>` per file; do not `git checkout .`.
- **Done when:** `git status` matches the review file; tsc and jest pass.
- **Model:** **Sonnet** (reading and sorting). Opus checks the review file (5 minutes).

## T2. Write the per-element design spec

- **What:**
  1. Copy the chosen mockup into the repo: `docs/design/clean-plus.html` and `docs/design/clean-plus.png` (already done by Opus).
  2. Write `docs/design/spec.md`: one table per screen (Today, Food result, Walk, nav bar), one row per element. Columns: element, font family, weight, size, line height, colour (hex), background, radius, padding, gap/margin, border, shadow, icon size. Plus a colour table (all CSS variables) and a type scale.
  3. Write `src/constants/themes/clean-spec.ts`: the same values as a typed object (the tests in T4 read it).
- **Files:** `docs/design/clean-plus.html`, `docs/design/clean-plus.png`, `docs/design/spec.md`, `src/constants/themes/clean-spec.ts` (all new).
- **Risk:** Missing elements (the build 21 failure). Go through the HTML rule by rule and element by element; every class used in the markup must appear in the spec. Telugu text uses Noto Sans Telugu — include it.
- **Done when:** a script or manual check shows every CSS class in the HTML is in spec.md; every value in `clean-spec.ts` equals spec.md.
- **Model:** **Sonnet.** Opus reviews spec.md against the PNG before T3.

## T3. Add the fonts

- **What:** Install `@expo-google-fonts/poppins` (weights 300, 400, 500 only) and `@expo-google-fonts/noto-sans-telugu`. Load them at start in `src/app/_layout.tsx` (keep the splash screen up until loaded). On Android each weight is its own family name (e.g. `Poppins_500Medium`); add a helper `fontFor(weight)` in `src/constants/themes/fonts.ts`.
- **Files:** `package.json`, `package-lock.json`, `app.json` (expo-font plugin if needed), `src/app/_layout.tsx`, `src/constants/themes/fonts.ts` (new).
- **Risk:** Using `fontWeight` with a custom font on Android falls back to the system font — always use the family name per weight. App size grows; load only the weights in the spec.
- **Done when:** `fontFor` has a test for each weight in the spec; tsc and jest pass.
- **Model:** **Haiku.**

## T4. The "Clean" theme tokens

**DONE 14 Nov 2026 (Sonnet).** See `docs/completed-tasks.md`.

- **What:** Add theme id `clean` built from `clean-spec.ts`; make it the default; always light. The other six looks (A–F) **stay visible and selectable** in Settings (owner, 14 Nov 2026). They use the same Clean+ layout and shared pieces, with their own colours and fonts only; no per-look screen layouts. Each look keeps its own light/dark as designed (B Night is dark); none follows the phone's dark mode.
- **Files:** `src/constants/themes/clean.ts` (new), `types.ts` (add id, `DEFAULT_THEME_ID = 'clean'`), `index.ts`, `build.ts`, `choice.ts` (unknown saved id → `clean`; a saved A–F choice is kept), `apply.ts` and `src/app/_layout.tsx` (ignore the phone's colour scheme), `src/components/appearance-note.tsx`, `src/app/settings.tsx` (look picker lists Clean+ first, then A–F), `src/constants/__tests__/themes.test.ts`.
- **Tests:** every token in the `clean` theme equals the value in `clean-spec.ts`; the theme is the same with the phone in dark mode; an unknown saved id loads `clean`; a saved `d` still loads `d`; all seven looks build without missing tokens.
- **Risk:** A–F only change colours and fonts on the new layout, so they will not look like their old mockups; that is accepted. Every look must still pass text contrast ≥ 4.5:1 (existing theme tests). People who never chose a look get Clean+.
- **Also (from T1):** remove the `ThemeLayout` fields that no code reads any more — `logFood`, `gap`, `gutter.today`, `todayKicker`, `todayTitle`, `todayAction`, `todayPair`, `todayRows`, `heroPercent`, `heroStats`, `heroWeek` (and the `TodayArea` type) — from `types.ts`, `build.ts` (`PARK_LAYOUT`), `a.ts`–`f.ts` and their tests. Check first with `grep -rn` that nothing outside the theme files and tests reads them.
- **Also:** `src/components/appearance-note.tsx`: fix the unindented `<View style={style}>` block, and change the text to say there are eight looks with Clean+ the default.
- **Done when:** tests pass.
- **Model:** **Sonnet.**

## T5. Shared UI pieces to spec

**DONE 14 Nov 2026 (Sonnet).** See `docs/completed-tasks.md`. T6 notes: use `NavigationBar` with a `fab` item and `specIcon`s and wire `(tabs)/_layout.tsx`; the Water tile needs a TalkBack action for "add a glass"; pips and the empty week track use `midTone(theme)` from `hero-colors.ts`.

- **From the T4 check (Opus):** Clean+ radius roles follow tokens.ts (md 24 = cards/tiles/hero, lg 28 = FAB, sm 12); set the spec's chip 20 and snackbar 16 per component from `CLEAN_SPEC.radius`. Bar tracks paint `lane` (= hair); water pips and the empty week track paint accentMid (`secondaryContainer`). Cards are white with `CLEAN_SPEC.shadow.card`, not the grey `surfaceContainer` plate.

- **What:** Make the shared pieces match the spec exactly, and add the new ones the mockup uses.
  - Change: `src/components/ui/screen.tsx` (top padding = status bar inset + spec gap; fixes header under status bar), `navigation-bar.tsx`, `section-header.tsx`, `surface.tsx`, `stat-tile.tsx`, `chip.tsx`, `button.tsx`, `fab.tsx`, `list-row.tsx`, `progress-hero.tsx`.
  - New in `src/components/ui/`: `greeting.tsx` (avatar + name + date), `week-strip.tsx` (7 days, today marked), `hour-bars.tsx` (bar chart, 24 bars, used by hero and detail), `ring.tsx`, `donut.tsx` (macros), `nutrient-bar.tsx`, `icon-circle.tsx` (tinted 40 dp circle), `pill.tsx`. Export from `index.ts`.
- **Tests:** in `src/components/ui/__tests__/`: each component's style values equal the spec (render with react-test-renderer and read the style); tap targets ≥ 48 dp; charts have an accessibility label summing the data.
- **Risk:** Other screens use these pieces; check Journal, Activity, You, Settings still render (tsc + existing tests). SVG charts: use `react-native-svg` (already installed? check `package.json`; if not, ask before adding).
- **Done when:** tests pass; no hard-coded colour or size outside the theme in these files (`grep -n "#[0-9A-Fa-f]\{6\}"` finds none).
- **Model:** **Sonnet.**

## T6. Today screen

- **What:** Build Today exactly as the mockup: greeting, week strip, steps hero with hour bars, 2-column cards (Food, Water, Sleep, …) with icon circles and rings, walk card with a tinted walk icon circle and time pill. Every card is tappable and opens T9's detail (`router.push('/detail/<kind>')`).
- **Food kcal bug:** Today and the Food tab must read the same number. Use one hook (`src/state/use-calories.ts` → `useTodayKcal(date)`) in both places. Add a test: given food entries totalling 185 kcal, both readers return 185.
- **Files:** `src/app/(tabs)/index.tsx`, `src/components/today/today-clean.tsx` (new), `src/components/today/model.ts`, `use-today-extras.ts`, `view.ts`, `src/state/use-calories.ts`, `src/app/(tabs)/food.tsx` (use the same hook), tests in `src/components/today/__tests__/`.
- **Risk:** Empty day (no data yet) must still look like the mockup's layout with zeros, not collapse.
- **Also (from T1):** replace the T1 placeholder in `src/components/today/today-clean.tsx`. **Every look, Park included, uses this one Today:** delete `ParkToday` and its now-unused helpers from `src/app/(tabs)/index.tsx` and make `TodayScreen` always render the Clean+ Today. The frame (`look.background`, `look.gutter`) comes from the theme tokens, not hard-coded values. Fix the stale comment at the top of `src/components/today/view.ts` (it still names today-a … today-f). Reuse `src/components/today/kit.tsx` pieces only where they match the spec; otherwise use the T5 components.
- **Done when:** tests pass; the T11 screenshot matches the mockup.
- **Model:** **Sonnet.**

## T7. Food result screen

- **From the T4 check (Opus):** the donut and macro dots use `CLEAN_SPEC.colors` warm (protein), carbs (carbs), accent (fat) as spec 5.12, not `food`/`food2`/`food3` (those only feed the old split bar, which goes).

- **What:** Result hero with macro donut, ingredient rows with icons and cooking method ("Dried anchovy · fried · 40 g"), nutrient bars.
- **Files:** `src/components/food/food-result.tsx`, `food-result-look.ts`, `food-result-format.ts`, `food-result-host.tsx`, `src/components/journal/food-log.tsx`, tests in `src/components/food/__tests__/`.
- **Risk:** Long Indian dish names and Telugu names: wrap to 2 lines, never clip. Test with a 40-character name.
- **Also (from T1):** one layout for every look: remove the per-look branches (`FoodResultThemed`, reads of `layout.foodHero`, `layout.macros`, `layout.ingredients`, `layout.nutrients`, `layout.rows`, `gutter.food`, `block`) from `food-result.tsx`, `food-result-look.ts` and `food-log.tsx`, then remove those fields from `ThemeLayout`/`ThemeDef` and `a.ts`–`f.ts` if nothing else reads them.
- **Done when:** tests pass; screenshot matches.
- **Model:** **Sonnet.**

## T8. Walk screen and map

- **What:** Light map style matching the mockup, stat cards, route line in the accent colour.
- **Files:** `src/app/walk/[id].tsx`, `src/components/walk/walk-detail-look.tsx`, `src/components/map-style.ts`, `src/components/route-map.tsx`, `route-map.web.tsx`, `src/components/__tests__/map-style.test.ts`.
- **Risk:** Map style must not follow phone dark mode (that was the dark map bug).
- **Also (from T1):** one layout for every look: remove `HAS_WALK_LOOK` and the Park branch in `src/app/walk/[id].tsx`, and the per-look branches (`layout.walkStats`, `gutter.walk`, `block`) in `walk-detail-look.tsx`; then remove `ThemeLayout` entirely if nothing reads it. Keep per-look `map` colours (each look's map still uses its own colours).
- **Done when:** test asserts the style is the light one in both phone modes; screenshot matches.
- **Model:** **Sonnet.**

## T9. Tap a tile → hourly detail

- **What:** New screen `/detail/[kind]`, kind = `steps | active | food | water | sleep`. Shows the day's series:
  - steps: per hour; tap an hour → 15-minute bars (from the minute data the step counter already stores);
  - active minutes: per hour;
  - food and water: each entry at its time, plus per-hour totals;
  - sleep: stages/hours where Health Connect gives them; otherwise "No sleep data for this day".
  - Swipe left/right or arrows for previous/next day; no future days.
- **Files:**
  - `src/app/detail/[kind].tsx` (new) — the screen.
  - `src/state/series.ts` (new) — pure bucketing: `bucketByHour(points, dayStart, tz)`, `bucketBy15Min(...)`. No React here.
  - `src/state/use-series.ts` (new) — reads data: steps/active from `src/health/select-source*.ts` / `health-connect-source.ts` and the minute rows in `src/data/`; food from `src/data/food-rows.ts`/`entries.ts`; water from `src/state/use-water.ts`; sleep from `src/health/vitals*.ts`.
  - `src/components/detail/series-chart.tsx` (new) — uses `hour-bars.tsx` from T5.
  - `src/state/__tests__/series.test.ts` (new).
- **Tests:** hour buckets sum to the day total; an entry at 23:59 lands in hour 23, at 00:00 next day not in this day; India (+5:30) and a whole-hour zone; empty day gives 24 zeros; 15-minute buckets sum to their hour.
- **Risk:** Health Connect may not have minute data for older days — show hourly only and say so. No new permissions.
- **Done when:** tests pass; each Today tile opens its detail on the emulator.
- **Model:** **Sonnet** (screen and data). The bucketing tests alone could be **Haiku** once `series.ts` exists.

## T10. Log food button covering the chart

- **What:** The Food tab list gets bottom padding = FAB height + FAB margin + 16 dp, so the last chart is never under the button.
- **Files:** `src/app/(tabs)/food.tsx`, `src/components/ui/fab.tsx` (export its height constant).
- **Done when:** on the emulator screenshot, the "By hour" chart is fully visible when scrolled to the end.
- **Model:** **Haiku.**

## T11. Screenshot check before the build

- **From the T4 check (Opus):** `.github/scripts/launch-and-capture.sh` loops over `park a b c d e f` only: add `clean` (first) and take the dark-phone check on `clean`, not D. Add `clean` to the theme list in `src/design-preview/params.ts` and the notice in `src/app/design-preview.tsx`.

- **What:** The CI emulator photographs Today, Food result, Walk, and one detail screen in the `clean` look, light and dark phone mode, using the design-preview deep link. A script puts each next to the mockup at the same width (`smoke/compare-<screen>.png`) for review.
- **Files:** `.github/scripts/launch-and-capture.sh` (themes = `clean` only; add `detail`), `src/app/design-preview.tsx` and `src/design-preview/*` (add `detail` screen), `.github/scripts/side-by-side.py` (new; Pillow; mockup crop on the left, app on the right), `.github/workflows/android.yml` (upload `smoke/` as an artifact).
- **Risk:** Screenshots are evidence only — they do not fail the job. A person (Opus) must look.
- **Done when:** a CI run produces the compare images.
- **Model:** **Sonnet.**

## T12. Review against the mockup (gate)

- **What:** Opus compares each compare image element by element against `docs/design/spec.md`: font, weight, size, colour, spacing, radius, alignment, clipping, Telugu. Every difference becomes a fix item (file + value) for Sonnet/Haiku; repeat T11–T12 until none. Then the owner gets the screenshots.
- **Files:** `docs/design/review-<n>.md` (findings).
- **Done when:** no differences left and the owner has seen the screenshots and said OK.
- **Model:** **Opus.**

## T13. Commit and build 22

- **What:** Only after the owner's OK: commit on `combined`, push, CI builds `android-22`.
- **Files:** none new.
- **Done when:** release android-22 exists and smoke test passes.
- **Model:** **Haiku.**

## T14. Cooking-model server deploy (separate; needs the owner's OK)

- **What:** In `stepsinfra`: run both test suites; `cdk deploy StepsData`; run `scripts/import-ingredients.py --write` (8,193 records); then `cdk deploy StepsApi`. Check one dish request ("1 cup rice + dal + aloo fry") returns cooked values.
- **Risk:** Deploy order matters (data before API). Live AWS change.
- **Done when:** both stacks deployed, ingredient count 8,193, the test dish works.
- **Model:** **Sonnet.** Not before the owner says yes.

---

## Open questions for the owner

1. ~~Which design~~ — Clean+ blue (done).
2. ~~Hide the other looks?~~ — No, keep them visible (done).
3. OK to deploy the cooking server (T14) now or later?
