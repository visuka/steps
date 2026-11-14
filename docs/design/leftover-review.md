# T1 — Review of the leftover work (14 Nov 2026, by Sonnet)

The stopped "screens match mockups" run left 28 changed files and new folders on top of build 21 (commit 05be9d2). Each one is sorted here. Baseline before and after T1: `npx tsc --noEmit` clean; `npx jest` 63 suites, 1,130 tests passing; eslint clean on the files I touched.

**Dropped (deleted):** the six per-look Today screens. Copies are kept outside the repo in the session scratchpad `leftover-backup/today/` in case Opus wants to look at one.

**Do not release a build between T1 and T6.** Today now shows a plain-text placeholder in every look except Park (see `today-clean.tsx` below).

## Dropped

| File | Why |
| --- | --- |
| `src/components/today/today-a.tsx` … `today-f.tsx` (6 files, about 1,480 lines) | One layout for all looks now (`docs/architecture.md`, "Looks"). Replaced by `today-clean.tsx` in T6. |

## Changed by T1

| File | What changed | Why |
| --- | --- | --- |
| `src/app/(tabs)/index.tsx` | Removed the six imports and the `LAYOUTS` table; `ThemedToday` now draws `TodayClean` with `{ background: theme.surface, gutter: Spacing.three }`; comments updated. | It no longer compiles without the six files. |
| `src/components/today/today-clean.tsx` (new) | Placeholder: date, steps, food, water as plain text, plus the walking and locked slots. | Keeps the app running until T6 builds the real Today. |

## Kept (reviewed, no change)

| File | Why it stays |
| --- | --- |
| `src/app/design-preview.tsx`, `src/design-preview/*` (clock, launch, params, providers, sample + 3 tests) | The fixed sample day that CI photographs (T11). Never runs in a normal launch (`previewLaunch()`). |
| `src/auth/auth-state.tsx` (`PreviewAuthProvider`), `src/state/app-state.tsx` (`PreviewAppProvider`, exported `AppContextValue`), `src/state/use-premium.tsx` (`PreviewPremiumProvider`), `src/data/db.web.ts` (`memoryRepository`, exported `Snapshot`) | Providers the design preview needs: no account, no phone data read or written. |
| `src/app/_layout.tsx` | `PREVIEW` branch and `PreviewGate`, only when the deep link starts it. |
| `src/constants/themes/choice.ts`, `themes/index.ts` | A preview run takes the link's theme and never saves it. |
| `.github/scripts/launch-and-capture.sh`, `.github/workflows/android.yml` | The photo loop and the Pixel 6 (1080 × 2400, 420 dpi) profile. T11 cuts the theme list down to `clean` and adds the detail screen. |
| `src/components/ui/screen.tsx` | Status-bar strip in the page colour: fixes the header under the clock. |
| `src/state/use-calories.ts` (`reload` argument) and `index.tsx` (`visits` counter, passed to `useCaloriesToday` / `TodayTiles`) | Fix for Today showing 0 kcal while Food showed 185: food is read again each time Today comes into view. T6 adds the test. |
| `src/app/(tabs)/index.tsx` (`TileDetail` extracted, `ThemedToday` data wiring, `ParkToday`) | The wiring builds the `TodayView` (figures, taps, slots) that T6's layout takes. Park keeps its own Today. |
| `src/components/today/model.ts`, `view.ts`, `use-today-extras.ts`, `__tests__/model.test.ts` | Pure figures and the `TodayView` contract for T6. |
| `src/components/today/kit.tsx` | Drawing pieces (stroke icons, bars, ring, glass pips) at 1 mockup px = 1 dp. T5 reuses and re-specs them. Not used by anything yet. |
| `src/app/(tabs)/food.tsx` + `src/components/food/food-result-host.tsx` | A food result opens as a screen of its own over the Food tab. |
| `src/components/journal/food-log.tsx`, `src/components/food/food-result.tsx`, `food-result-look.ts`, `food-result-format.ts` + tests | Food result screen. **Change in T7:** it is per-look (reads `layout.foodHero/macros/ingredients/nutrients`); T7 makes it the one Clean+ layout. |
| `src/app/walk/[id].tsx`, `src/components/walk/*` + test | Walk screen, `WalkDetail` exported for the preview. **Change in T8:** `walk-detail-look.tsx` (1,142 lines) is per-look (`layout.walkStats`, `block`, `map`); T8 makes it the one Clean+ layout. |
| `src/components/map-style.ts` + `__tests__/map-style.test.ts`, `route-map.tsx`, `route-map.web.tsx` | Map recoloured from the theme's `map` colours instead of the phone's dark mode. T8 sets the Clean+ light map. |
| `src/components/appearance-note.tsx` | New `style` prop. Has one badly indented block (`<View style={style}>` is not indented). T4 rewrites the note's text ("seven to choose from") and fixes the indent. |
| `app.json` | Splash on a dark phone is now white, as a light look needs. |
| `src/constants/themes/a.ts` … `f.ts`, `types.ts`, `build.ts`, `__tests__/themes.test.ts` | Looks A–F are now light/dark-as-mocked palettes with extra layout flags. They stay selectable (owner, 14 Nov). **Change in T4:** the `layout` flags that only served the six Today screens (`todayKicker`, `todayTitle`, `todayAction`, `todayPair`, `todayRows`, `heroPercent`, `heroStats`, `heroWeek`, `logFood`, `gap`, `gutter.today`) have no reader now; T4 removes them with their tests. The flags the food result and walk screens read stay until T7 and T8. I did not trim them in T1 to avoid breaking `themes.test.ts` (114 changed lines). |

## Differences from the plan, for Opus to check

1. The plan said to drop "per-look branches in `a.ts`–`f.ts` that only served" the Today screens. I left them (last row above) and moved that to T4, because the theme tests assert them and removing them first is a large edit with no visible result.
2. The plan did not say how `index.tsx` should compile without the six files; I added the placeholder `today-clean.tsx` (T6 replaces it).
3. `food-result*`, `walk-detail-look.tsx` and `kit.tsx` are not in the plan's keep or drop list; I kept them because T5, T7 and T8 list them as files to modify.

## Checks run

- `npx tsc --noEmit`: no errors.
- `npx eslint "src/app/(tabs)/index.tsx" src/components/today`: no warnings.
- `npx jest`: 63 suites, 1,130 tests passed (same as before T1).
- Not checked: the app on a phone or emulator (T1 changes no screen except Today in non-Park looks, which is now a placeholder).
