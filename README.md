# Steps (working name)

A walking-habit app for iOS and Android by Neutcrafts OPC Private Limited. It counts steps
automatically, turns them into a few honest metrics, and keeps people walking with a daily goal,
streaks, badges, reminders and a home-screen widget. It also records walks on a map and notes the
context around walking (time of day, weather, mood, food) so it can show people their own
patterns. While testing, people sign in per phone, with an email to get the account back;
passkeys (their fingerprint, no email or password) are built and come back later. They can lock
the app with their fingerprint; everything else stays on the phone and in Apple Health / Health
Connect.

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
| Steps Premium: today's steps (count and goal ring) are free, everything else is premium. From `GET /v1/me` (`premium`, `premiumReason`), kept for offline; a food route's 402 goes free; testers get "Preview as a free user" in Settings | `src/premium/premium.ts`, `src/state/use-premium.tsx`, `src/components/premium-gate.tsx` |

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

### Sleep, heart rate and blood pressure

- **Typed in or read from a watch.** Journal → Sleep takes bed and wake times (guessed from when
  the phone stopped and started moving) and how rested the person feels; Journal → Body → BP takes
  home readings. After the person taps "Connect", `src/sync/vitals-sync.ts` reads sleep sessions,
  daily heart rate and BP from Health Connect / Apple Health (`src/health/vitals.*.ts`) on each
  foreground sync, at most every 30 minutes: 60 days the first time, then the last 3 days.
- **No double counting.** Sleep stages often arrive from a phone and a watch for the same night;
  `sleepSessions` in `src/lib/sleep.ts` keeps the app that saw the most sleep. BP readings typed
  here are also written to the health store and skipped when read back.
- **Not a diagnosis.** BP categories follow the AHA's adult ranges and are labelled as such.
  Readings of 180/120 or higher show what to do next (re-measure, call a doctor, 108/112 with
  symptoms). Insights compare the person's own numbers ("on days you reached your goal…"), never
  causes.

### Sign-in and the app lock

- **For now: per phone, with an email** (`SIGN_IN_MODE = 'phone'` in `src/constants/app.ts`;
  design and API in `docs/phone-signin.md`). First open asks "I'm 18 or older" and an email,
  checks the phone's fingerprint or PIN, makes the account and sends a 6-digit code to confirm
  the email. Google Block Store (`modules/blockstore`, a local Kotlin module) keeps this phone's
  restore key, so a reinstall, or a new phone restored from the Google backup, signs straight
  back in. Anything else: "I already have an account", the email, and a code. There is no
  sign-out in this mode. The key may be the only way back in, so the app never writes over one it
  hasn't read: a session that ends during the run tries the key again, and Continue on a phone
  that still has a working key signs in to that account instead of making a new one. The passkey
  screens below stay in the code, switched off.
- **Passkeys, through our own sign-in API** (`src/auth/`, `modules/passkeys`; design and API in
  `docs/passkeys.md`). One button, "Continue with fingerprint", signs in with the passkey on the
  phone; if there is none, the same screen asks "I'm 18 or older" and makes one. Google Password
  Manager keeps the passkey, so a new phone signed in to the same Google account signs in too. The
  server sees only the public key and a random account id.
- **`modules/passkeys`** is a local Kotlin module over Android's Credential Manager
  (`androidx.credentials`). iOS and the web preview report "not supported" until there is an Apple
  developer account.
- **Tokens** (`src/auth/session.ts`): the access token (an hour) stays in memory; the refresh token
  and account id sit in the Android Keystore / iOS Keychain (`src/auth/session-storage.ts`). Other
  callers of our API use `getAccessToken()` or `authFetch()`, which refresh one at a time when
  under a minute is left. The server ends the whole session if a refresh token is used twice,
  except for a retry within 60 s of a lost reply, which the app makes by itself (the grace
  window in `docs/passkeys.md`).
- **The domain file.** Android lets the app use passkeys for the sign-in domain only when
  `https://<rpId>/.well-known/assetlinks.json` lists `com.neutcrafts.steps` and the signing
  certificate's SHA-256. The Android build prints that fingerprint, and the
  `android:apk-key-hash:` origin the server must accept, in its run summary. Only our private
  keys may be listed, never React Native's shared debug key (see "Test signing key").
- **Fingerprint lock** (`src/state/app-lock.tsx`): offered once after the first sign-in on each
  phone, then asked on every open and after a minute in the background. Face and the phone's
  screen-lock PIN work too. The app stays mounted under the lock, so a walk keeps recording.
- **One account per phone's data.** Data from before sign-in goes to the first account; if a
  different account signs in, the previous person's data on the phone is wiped first. "New here?"
  warns when making an account would do that. Once only, when a phone moves from the Supabase
  build: if someone was still signed in there, their data goes to the first passkey account
  (`src/auth/handover.ts`), since every account id changes.
- **Settings → Account** shows a short account code, signs out (passkeys) or shows the email and
  "Confirm your email" (phone sign-in), and deletes the account (`DELETE /v1/me`: the server's
  data, email, passkey records, restore keys and refresh tokens), then deletes the Block Store
  entry and clears the app's data on the phone the same way "Delete all app data" does. The passkey itself is
  in the person's Google account; the app tells them they can remove it in Google Password Manager.

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

#### Test signing key

Gradle signs these APKs with React Native's debug key. That key and its password ship in every
React Native project, so anyone can sign an app as `com.neutcrafts.steps` with it. **Passkeys must
never trust it**: never put its fingerprint (`FA:C6:17:45:…:3B:9C`) in `assetlinks.json` or the
sign-in server's origins. Anyone could then use our passkeys from their own app.

So CI signs the APK again with a private test key when these repository secrets are set (Settings →
Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `ANDROID_TEST_KEYSTORE_BASE64` | the keystore file, base64 (`base64 -w0 steps-test.jks`) |
| `ANDROID_TEST_KEYSTORE_PASSWORD` | its password |
| `ANDROID_TEST_KEY_ALIAS` | the key's alias, e.g. `steps-test` |
| `ANDROID_TEST_KEY_PASSWORD` | optional; leave unset for a PKCS12 keystore (it has one password) |

Make the key once, on a trusted computer, and keep the file somewhere safe outside the repo:
`keytool -genkeypair -storetype PKCS12 -keystore steps-test.jks -alias steps-test -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Steps test"`.
Each build's summary then shows the two forms of its fingerprint for the server. Without the
secrets the build still works, but passkey sign-in can't.

Android won't install an APK signed with a new key over one signed with the old key. When the key
changes, testers uninstall the old build once, and that deletes the data on their phone.

Play Store builds are signed by Google (Play app signing); list that key too, from Play Console.

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
      mood and food, all kept on the phone, and food look-ups, which send what's typed and the
      phone's country to our server and an AI service.
- [ ] Premium purchases (Google Play Billing, StoreKit). They only change what `GET /v1/me` says;
      the buy button goes on the Premium screen (`src/components/premium-gate.tsx`).
- [ ] Run a 2-week beta (TestFlight + Play closed testing).

## Renaming

`APP_NAME` (in-app text), `expo.name` (home-screen name), `expo.slug`, `expo.scheme`,
`ios.bundleIdentifier`, `android.package`, and the App Group (`group.com.neutcrafts.steps`) in
`app.json`, `src/constants/app.ts` and `targets/widget/StepsWidget.swift`.
