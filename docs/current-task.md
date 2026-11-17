# Current task: T18 — Today in "Time of day" colours, and the labelled bottom bar

Approved by the owner on 17 Nov 2026 ("Yup let us go for time of day"). The owner also confirmed ("Yes go ahead", 17 Nov 2026): the hours Dawn 05:00 / Noon 11:00 / Dusk 16:30; the day colours on Today and the bar only; the hour bars under the ring come back. The design, every value and the palettes are in `docs/design.md`, section "Current: Today Time of day". The mockup is `docs/design/today-time-of-day.html` (the "Time of day" chip).

## Who does what next

| Task | Who | The line to give it |
| --- | --- | --- |
| **T18a** | Sonnet | "Do T18a in docs/current-task.md" |
| T18b | Sonnet | "Do T18b in docs/current-task.md" |
| T18c | Sonnet | "Do T18c in docs/current-task.md" |
| T18d | Sonnet | "Do T18d in docs/current-task.md" |
| T18 check | Opus | "Review the T18 CI screenshots" |
| T18e (fixes from the check) | Sonnet or Haiku, as the check says | written by Opus after the check |

T18a, T18b and T18c touch different files and can be done in any order; T18d comes last.

Still open from before (details in `docs/tasks-archive/build-22-and-open-tasks.md`): T13 and T14 (only with the owner's OK), T15c (cooking method in Edit recipe), T16 (walk buddies), T17 (fast design loop).

## Goal

1. Today looks exactly like the mockup, in Dawn, Noon or Dusk colours by the phone's local time.
2. The bottom bar has three labelled buttons: Today (house), Chats, Profile. No lifted round button.
3. **Nothing Today does changes** (owner's rule 6): every tap, number, slot and screen stays.
4. Today fits a 360 x 800 dp phone without scrolling; with large text nothing is cut off or overlaps.

## Rules for every task

- App repo: this repo, branch `combined`. `npx tsc --noEmit` and `npx jest` must pass after each task.
- Keep each file's line endings as they are. Don't run prettier on whole files.
- Read `docs/design.md` and `docs/architecture.md` first. Never edit `docs/design.md` (Opus only). If a value is missing or unclear there, stop and report it; never guess.
- 1 mockup px = 1 dp. Text sizes go through `scaled()` and `maxFontSizeMultiplier={MaxTextScale}` as `today-calm.tsx` does now.
- New colours and sizes go in a constants file (T18a's `day-part.ts`, or the bar's style file), never inline in a component.
- No new native packages. Gradients use `react-native-svg` (already installed: `Svg`, `Defs`, `LinearGradient`, `Rect`, `Circle`). Motion uses `react-native-reanimated` (installed), always with `ReduceMotion.System`.
- Never remove or move a feature that is not listed in this task. If something does not fit, stop and report.
- Commit and push after each task (standing OK); run the Android workflow only in T18d.
- After each task, append a short entry to `docs/completed-tasks.md` (date, task id, what changed, test counts, anything left open).

## T18a. Day parts and palettes (Sonnet)

Files: new `src/constants/day-part.ts`, new `src/hooks/use-day-part.ts`, new `src/constants/__tests__/day-part.test.ts`.

1. `day-part.ts`:
   - `export type DayPart = 'dawn' | 'noon' | 'dusk'`.
   - `export function dayPartOf(d: Date): DayPart`: minutes of the local day; 300–659 dawn, 660–989 noon, everything else dusk (design.md "Day parts").
   - `export interface DayPalette` with the roles in design.md "Palettes": `bg, wash, edge, newsBg, plate, muted, main, onMain, card, text, heroTop, heroBottom, heroEdge, ringA, ringB, track, food, foodLane, sleep, sleepLane, water, waterLane`.
   - `export const DAY_PALETTES: Record<DayPart, DayPalette>` with exactly the hex values in the table (card `#FFFFFF`, text `#1F1B16`, onMain `#FFFFFF` for all three).
2. `use-day-part.ts`: `useDayPart(): { part: DayPart; palette: DayPalette }`. Works out the part on mount, on `AppState` change to `active`, and on a 60 s interval (cleared on unmount). Accept an optional `forced?: DayPart` argument that wins (the design preview uses it in T18d).
3. Tests:
   - Boundaries: 04:59 dusk, 05:00 dawn, 10:59 dawn, 11:00 noon, 16:29 noon, 16:30 dusk, 23:59 dusk, 00:00 dusk.
   - Every palette has every role as `#RRGGBB`.
   - Contrast (write a small `contrast(a, b)` helper in the test): text and muted on bg, card and heroBottom ≥ 4.5:1; onMain on main ≥ 4.5:1; main on plate and on newsBg ≥ 4.5:1; ringB on heroBottom ≥ 3:1 (19 bold is large text); food, sleep and water on card ≥ 3:1. If one fails, stop and report it to Opus; don't change a colour.

Acceptance: tsc and jest pass; nothing else in the app changes yet.

## T18b. The bottom bar: labels, house icon, no lifted button (Sonnet)

Files: `src/components/ui/navigation-bar.tsx`, `src/components/ui/nav-style.ts`, `src/components/ui/icon-paths.ts`, `src/components/tab-routes.ts`, `src/components/app-tabs.tsx` (only if it passes colours), `src/components/__tests__/tab-routes.test.ts`, and any nav-style test that checks the old sizes.

1. Add a `home` icon to `icon-paths.ts`: a simple 1.6-stroke outline house on the same 24 grid as the others (roof as an inverted V from (3,11) to (12,3.5) to (21,11), body (5.5,9.5) down to (5.5,20.5) across to (18.5,20.5) up to (18.5,9.5), door (10,20.5)–(10,14.5)–(14,14.5)–(14,20.5)). Draw your own; don't copy one from an icon set.
2. `BAR_TABS` becomes:
   `{ key: 'index', label: 'Today', specIcon: 'home', spoken: 'Today' }`, `{ key: 'plus', label: 'Chats', specIcon: 'chats', spoken: 'Chats and groups' }`, `{ key: 'you', label: 'Profile', specIcon: 'person', spoken: 'Your profile' }`. Add the optional `spoken?: string` to `NavigationItem` (TalkBack uses `spoken ?? label`). No `fab`. Keys and `OFF_BAR_SCREENS` stay exactly as they are; never give a screen `href: null` (see the comment at the top of `tab-routes.ts`).
3. `NavigationBar` draws each item as icon 22 over a label 11/14 (gap 3), slot width 80, items spread evenly (`justifyContent: 'space-around'`), bar height 60 plus `bottomInset`, fill and 1 dp top hairline as design.md "Bottom bar". Active: label semibold. No dot. Touch area stays at least 48 x 48. Keep `onReselect` and everything else the bar does now. The `fab` code path may stay in the file for now but no item uses it.
4. Colours: the bar takes an optional `colors?: { fill: string; hairline: string; active: string; idle: string }` prop. Without it, it uses the Calm theme roles in design.md. `app-tabs.tsx` passes the day palette's `card / edge / main / muted` **only when the focused tab is `index`** (use `useDayPart()` from T18a; if T18a is not merged yet, leave this one line as a TODO and tell Opus).
5. Labels: `maxFontSizeMultiplier={MaxTextScale}`, one line, never cut ("Profile" and "Chats" must show in full at 360 dp and font scale 1.3).
6. Tests: update `tab-routes.test.ts` for the new labels and icons, the three keys unchanged, no item with `fab`, every off-bar screen still declared. Update any nav-style size test to the new numbers.

Acceptance: tsc and jest pass; on every tab screen the bar shows Today / Chats / Profile with labels; Chats still opens chats and groups; Profile still opens the You screen.

## T18c. The Today screen (Sonnet)

Files: `src/components/today/today-calm.tsx` (rewrite the `TodayCalm` body; keep the export name and props), new `src/components/today/time-of-day-parts.tsx` (the ring, hour bars, glasses, meter and the two gradients), `src/components/today/calm-motion.tsx` (keep only `useCountUp`; delete the moving pictures if nothing else uses them; `grep -rn calm-motion src` first), `src/app/(tabs)/index.tsx` (only the sync line's colour and the screen background, see 7).

1. Colours: `const { palette: p } = useDayPart(forcedPart)` where `forcedPart` comes from a new optional `TodayView` field `dayPart?: DayPart` (add it to `view.ts` with a one-line comment: "only the design preview sets it"). Every colour on Today comes from `p`; nothing on Today uses `useTheme()` any more except what the slots draw themselves.
2. Layout, sizes and texts: exactly design.md "Layout", top to bottom. Measure against the mockup at 360 dp.
   - Header: date row as now but the weather moves into the 13/18 sub line before the quote, joined by " · " (the owner approved this move in the mockup). The avatar keeps `v.on.profile`.
   - `NewsTicker`: pass the new colours only (`background: p.newsBg, label: p.card, labelInk: p.main, ink: p.text, quiet: p.muted`). If its height or text size is not 32 / 11 / 12, add size props with today's values as defaults so other screens don't change.
   - Steps card: the whole card stays one `Pressable` with `v.stepsSpoken` and `v.on.steps`. Ring: `Svg` 92, track `Circle` r 40 stroke 7 in `p.track`, arc `Circle` with `pathLength`-style dash using `strokeDasharray` = 2πr and an animated `strokeDashoffset`, stroke `url(#ring)` from a `LinearGradient` ringA→ringB (x1 0 y1 0 x2 1 y2 1), rotated -90°. Percentage = `v.pct` (count-up), 19 bold `p.ringB`. Hour bars from `v.hourly` and `v.nowHour` as design.md. Facts line uses `distanceText(v)` and `v.activeMin` as now.
   - Card gradient: an absolutely placed `Svg` behind the card's contents, `Rect` filling it with a 150° `LinearGradient` heroTop→heroBottom (x1 0 y1 0 x2 1 y2 1 is close enough), `borderRadius: 20` and `overflow: 'hidden'` on the card.
   - `v.slots.walking` stays between the steps card and the pair.
   - Food / Sleep / Water / Walk keep `tapFor(v, kind)`, the spoken labels from the tile models, the locked state (lock icon, no meter, no glasses, no + button; taps go to `v.on.premium`) and every text the current code shows (`m.food.value`, `of {v.food.target} kcal`, sleep value and unit, "Last night", water "x of y glasses" / "x glasses", the walk title, `walkSub`, the walk distance).
   - Meters use `m.food.share` and `m.sleep.share`.
   - Glasses: one per glass of `v.water.of` (8 without a target), at most 10; filled = `v.water.glasses` (capped). The + button keeps `v.on.addGlass` and "Add a glass of water"; visual 34 round, touch area 48 (`hitSlop`).
   - `Tail` (`slots.below` / `slots.locked`) stays above Log food. Log food keeps `v.on.logFood`, 48 high pill, `marginTop: 'auto'`.
3. Screen wash: an absolutely placed `Svg` at the top of the Today column, full width, 260 high, vertical gradient wash→bg, behind everything; the column's background is `p.bg`.
4. Motion: design.md "Motion". Use `FadeInDown`-style entering with the listed delays and 700 ms (translate 10), the ring/meter/bars with `withTiming` and the listed durations, all `ReduceMotion.System`. Colour change between parts: a 500 ms fade is nice to have; if it costs more than ~30 lines, skip it and say so in completed-tasks.
5. Keep the short-screen rule: at a window height under 860 dp, use gap 8 instead of 10 and block padding 10 instead of 12, so Today fits at 360 x 800 with the sync line above the bar.
6. Remove the walker, bowl, glass and moon pictures from Today (they are not in the design). Keep `useCountUp`.
7. `src/app/(tabs)/index.tsx`: the sync line below Today (line ~206) uses `p.muted`, 11 size, centred; the area behind Today uses `p.bg` so no Calm colour shows at the edges. Change nothing else there.
8. Tests: a jest render test (or extend the existing Today test) that checks, with a sample view, that every tap target is still there with its label: steps card, avatar, news, food, sleep, water, add a glass, walk, Log food; and in the locked state that food, sleep, water and walk call `on.premium`.

Acceptance: tsc and jest pass; the screen matches the mockup values; nothing Today could do before is missing.

## T18d. Preview, CI screenshots, commit (Sonnet)

Files: `src/design-preview/params.ts` (+ its test), `src/app/design-preview.tsx`, `.github/scripts/launch-and-capture.sh`.

1. The preview link takes `&part=dawn|noon|dusk` (unknown or missing = the real time). It sets `TodayView.dayPart` for Today and passes the same part to the bar.
2. `launch-and-capture.sh`: add `capture e today smoke/calm-today-dawn.png '&part=dawn'`, the same for `noon` and `dusk`; make the existing large-font (1.3) and 360 dp Today shots use `&part=noon`. Keep every other shot.
3. Commit, push, run the Android workflow (standing OK). When it finishes, download the `smoke-test` artifact and tell the owner and Opus where the PNGs are. Don't commit `smoke-ci*` or the PNGs.

Acceptance: CI green; `calm-today-dawn.png`, `-noon.png`, `-dusk.png`, `calm-today-360dp.png` and `calm-today-large-font.png` exist.

## T18 check (Opus)

Compare the five Today shots and one other tab's shot (bar in Calm colours) with the mockup element by element: sizes, colours, spacing, the bar, no scrolling at 360 dp, nothing cut at font 1.3. Send the shots to the owner with SendUserFile. Differences become T18e.

## Risks

- **Bar on other screens:** the bar now has labels and no lifted button on every tab screen. That is approved (the mockup's bar), but check Chats and Profile shots too.
- **Height at 360 dp:** the hour bars add about 54 dp to the steps card. The design fits at 800 dp because every other size is smaller than build 74; if the CI shot scrolls, cut gaps first (10 → 8), never a feature.
- **Large text:** labels and values must not be cut; `fit` (shrink to 70 %) is allowed on values, as now.
- **Gradients in SVG** need explicit sizes: measure the card with `onLayout` before drawing the `Rect`, or use `width="100%" height="100%"` on the `Svg` with `preserveAspectRatio="none"`.
- **The interval in `useDayPart`** must be cleared on unmount, or jest warns about open handles.
