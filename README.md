# Steps (working name)

A walking-habit app for iOS and Android by Neutcrafts OPC Private Limited. It counts steps
automatically, turns them into a few honest metrics, and keeps people walking with a daily goal,
streaks, badges, reminders and a home-screen widget. It also records walks on a map and notes the
context around walking (time of day, weather, mood, food) so it can show people their own
patterns. No account, no backend: data stays on the phone and in Apple Health / Health Connect.

Built with Expo SDK 58 (React Native 0.88, TypeScript).

## What's in the MVP

| Feature | Where |
| --- | --- |
| Automatic step tracking (HealthKit on iOS; Health Connect or the phone's own sensor on Android) | `src/health/` |
| Distance, active calories (estimated), active minutes, floors | `src/lib/metrics.ts`, `src/sync/engine.ts` |
| Daily goal with a suggestion after 14 days | `src/lib/goals.ts`, Goals tab |
| Streaks and badges (7/30/100 days, 100k/1M lifetime steps) | `src/lib/streaks.ts`, `src/lib/achievements.ts` |
| History: day (hourly), week, month, year | `src/app/history.tsx` |
| Home-screen widgets | Android: `src/widget/`; iOS: `targets/widget/` |
| Move reminders and goal-reached notifications | `src/sync/run.ts`, `src/lib/reminders.ts` |
| Background sync about every 15 min (OS decides) | `src/sync/background.ts` |
| Record a walk: route on a map, distance, pace, steps, calories from speed, weather | `src/app/walk/`, `src/walks/`, `modules/step-counter` (Android `WalkService`) |
| Patterns: time of day, weekends, mood, heat and rain vs steps | `src/lib/insights.ts`, `src/components/patterns.tsx` |
| Daily weather for the phone's area (MET Norway) | `src/weather/` |
| Mood check-in (Today card, optional evening notification) | `src/components/journal/mood-log.tsx`, `src/state/use-mood.ts` |
| Food log: search 143 foods (local names too), portions, own foods; calories, protein, vitamins and minerals vs daily values; eaten vs burned | `src/nutrition/`, `src/components/journal/food-log.tsx`, `src/components/food/` |
| Weight and water logs, written to the health platform | `src/components/journal/body-log.tsx` |
| Onboarding, profile, CSV export, delete all data | `src/components/onboarding.tsx`, `src/app/settings.tsx` |

Tabs: Today (with the big Record button), Walks, Journal, Insights, Goals. Settings opens from the
gear on Today.

## How steps flow

```
HealthKit / Health Connect / Android step sensor (modules/step-counter)
        │  per-minute step buckets, de-duplicated by the platform
        ▼
src/sync/engine.ts  → day_summary + hour_steps rows in SQLite (src/data/db.ts)
        ▼
screens · widget · reminders (they only read rows)
```

On Android the app picks Health Connect when another app (Samsung Health, Fitbit, Google…) already
records steps there. Otherwise it runs its own foreground service on `TYPE_STEP_COUNTER`, shows a
silent "N steps today" notification, and copies finished hours into Health Connect.

### Food and nutrients

- The built-in list (`src/nutrition/foods.generated.ts`) has fruit, vegetables, grains, breads,
  dals, meat, fish, eggs, dairy and 34 Indian dishes. Raw foods come from USDA FoodData Central
  (public domain); dishes are rough estimates from typical home recipes. See
  `scripts/nutrition/` to change or regenerate it.
- Entries store the food, unit and quantity, not the nutrients. When someone says "my bowl of
  rice is 200 g", past and future entries recalculate. Health Connect keeps the values from when
  the entry was logged.
- People can add their own foods (calories required, everything else optional).
- Daily values are the US FDA's adult figures, shown as general targets.
- The planned AI estimate service and its contract are in `docs/food-service.md`.

### Location, maps and weather

- **Location is only used while the app is in use.** `ACCESS_BACKGROUND_LOCATION` is blocked in
  `app.json`. Walks record through a `location` foreground service started from the app
  (`WalkService.kt`), which Android allows with "while using the app" permission; fixes go to
  SQLite so a walk survives the app being swiped away. On iOS (and the web preview) recording
  uses `watchPositionAsync`, so the app must stay open; background recording on iOS needs its
  own native work.
- **Maps:** MapLibre with OpenFreeMap tiles (OpenStreetMap data): no API key, commercial use
  allowed, no SLA. Attribution shows on the map.
- **Weather:** MET Norway Locationforecast, fetched only from the foreground sync, at most every
  2 hours (and never before the response's `Expires`), with coordinates rounded to ~1 km and an
  identifying User-Agent. Credit "Weather data from MET Norway" appears where weather is used.
  MET asks high-traffic apps to put a caching proxy in front of it; do that before a big launch.

## Run it

```bash
npm install
npm test            # unit tests: metrics, streaks, goals, reminders, sync engine
npm run typecheck
npm run web         # browser preview on demo data (no sensors on the web)
```

Health data needs a real phone and a native build; Expo Go cannot load these native modules.

## Build for phones

### Android test builds (GitHub Actions, free)

Every push to `master` runs `.github/workflows/android.yml`: type check, unit tests, a release
APK built on GitHub's runners, then a launch test on an Android 15 emulator. Only an APK that is
still running 30 seconds after launch is published, as a GitHub Release named "Android build N":
open it on the phone and tap the `.apk`. Run it by hand from the Actions tab with "Run workflow".

To read a crash on launch without a phone on a cable, run "Android smoke test" from the Actions
tab with a release tag; it keeps logcat and a screenshot.

The emulator test only checks that the app opens. Step counting, walk recording (GPS) and
Health Connect need a real phone.

Release builds have R8 shrinking turned off (`expo-build-properties` in `app.json`): with it on,
R8 stripped WorkManager's generated database class and the app crashed on launch. Re-enable it
for store builds only together with keep rules, and check with the smoke test.

These APKs are signed with React Native's shared debug key: fine for testing, not for the Play
Store.

### EAS (Expo's cloud)

The project is linked to the Expo account `neutcrafts` as `@neutcrafts/steps`, and EAS already
holds the Android upload key for store builds. EAS builds count against the account's monthly
plan.

```bash
eas build --platform android --profile preview   # installable APK
eas build --platform android --profile production  # Play Store bundle
```

iOS needs an Apple Developer account (enrol Neutcrafts as an organisation once the D-U-N-S number
arrives), then:

1. Add `"appleTeamId": "<your team id>"` under `ios` in `app.json`.
2. `eas build --platform ios --profile preview` and install through TestFlight or ad hoc.

Test step counts on at least two Android phones (one with Samsung Health, one without) and one
iPhone, and compare daily totals with the phone's own health app for a week (target: within ±5%).

## Before store release

- [ ] Pick the final name; update `APP_NAME` in `src/constants/app.ts`, `name` in `app.json`, and if
      wanted the bundle IDs (`com.neutcrafts.steps`) before the first upload. They can't change after.
- [ ] Replace the placeholder Expo icons and splash in `assets/`.
- [ ] Privacy policy URL (both stores require one for health data).
- [ ] App Store: App Privacy details; HealthKit data is never used for ads.
- [ ] Google Play: Health Connect permission declaration (including nutrition), Data safety form
      (location, health, food), health apps declaration, and foreground service declarations for
      types `health` (step counting) and `location` (walk recording), each with a short video.
- [ ] Privacy policy covers location (approximate area for weather, routes of recorded walks),
      mood and food, all kept on the phone.
- [ ] Run a 2-week beta (TestFlight + Play closed testing).

## Renaming

`APP_NAME` (in-app text), `expo.name` (home-screen name), `expo.slug`, `expo.scheme`,
`ios.bundleIdentifier`, `android.package`, and the App Group (`group.com.neutcrafts.steps`) in
`app.json`, `src/constants/app.ts` and `targets/widget/StepsWidget.swift`.
