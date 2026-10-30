# Steps (working name)

A walking-habit app for iOS and Android by Neutcrafts OPC Private Limited. It counts steps
automatically, turns them into a few honest metrics, and keeps people walking with a daily goal,
streaks, badges, reminders and a home-screen widget. No account, no backend: data stays on the
phone and in Apple Health / Health Connect.

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
| Weight and water logs, written to the health platform | `src/app/logs.tsx` |
| Onboarding, profile, CSV export, delete all data | `src/components/onboarding.tsx`, `src/app/settings.tsx` |

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
- [ ] Google Play: Health Connect permission declaration, Data safety form, health apps
      declaration, and the foreground service (type `health`) declaration with a short video.
- [ ] Run a 2-week beta (TestFlight + Play closed testing).

## Renaming

`APP_NAME` (in-app text), `expo.name` (home-screen name), `expo.slug`, `expo.scheme`,
`ios.bundleIdentifier`, `android.package`, and the App Group (`group.com.neutcrafts.steps`) in
`app.json`, `src/constants/app.ts` and `targets/widget/StepsWidget.swift`.
