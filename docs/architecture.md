# Architecture decisions

Important decisions for the Steps app and its server. Add new ones at the end of the right section with the date. Do not delete old ones; if one is replaced, mark it **Replaced (date): see …**.

## App

- **Stack:** Expo SDK 58, React Native, expo-router (file routes in `src/app/`). Android first; iOS code paths exist but are not shipped.
- **Builds:** GitHub Actions `.github/workflows/android.yml` with jobs check (tsc + jest) → build-apk → smoke-test (API 35 emulator, `.github/scripts/launch-and-capture.sh`) → publish. Releases are named `android-<N>`.
- **Local data:** SQLite on the phone (`src/data/`: entries, food rows, walk rows, migrations). What a person ate and where stays on the phone; only day totals go to the server.
- **Step and health data:** chosen per platform in `src/health/select-source*.ts`: Health Connect, the phone's step sensor, and Google's step recorder for accuracy. No new permissions without the owner's OK.
- **Themes:** one token set per look in `src/constants/themes/`; the chosen look is read synchronously at start from `expo-sqlite/kv-store` (key `appearance.theme`); changing it restarts the app with `reloadAppAsync()`. A look designed as light stays light when the phone is in dark mode.
- **Design check:** `src/app/design-preview.tsx` opens a fixed sample day by deep link (`neutcraftssteps://design-preview?theme=…&screen=…`) so CI can photograph real screens for comparison with the mockup.

## Sign-in and security

- Phone-number sign-in and passkeys via our own StepsAuth API. Supabase sign-in was removed; no third-party Supabase proxies.
- Never trust the React Native debug certificate.
- Secrets live in AWS SSM, never in the repo or in chat. The premium email list never goes in the public repo.

## Food and nutrition

- **The AI never states nutrients.** It only gives what a dish is made of (ingredients, grams, and how each was cooked, raw or cooked weight). Our code calculates every number from our ingredient database. Details: `docs/food-service.md`.
- **Ingredient database:** USDA SR Legacy + Foundation, 8,193 records, each tagged with a kind (generic, branded, fast-food, restaurant, baby, lab-dry). Plain names match generic foods first; lab-dry is never used for matching. Indian names are added by a background ingredient agent.
- **Cooking model** (`stepsinfra/docs/cooking-model.md`): use a real USDA cooked record when one exists; otherwise raw record → yield (water change) → USDA retention factors (Release 6) → fat drip loss → frying oil uptake. All factors live in versioned data files under `stepsinfra/data/cooking/` with their source.
- **Packaged food:** barcode/QR → Open Food Facts (ODbL: stored separately and credited), else a label photo. A label-photo product is trusted only when two different people's reads agree.
- **Cost rules:** asking the same thing again is free when no model call is needed; a separate daily cap of 20 refreshes per person.
- Everything is stored per 100 g; portions are plain arithmetic on the phone.

## Server (stepsinfra)

- AWS CDK in Python, account 469465348449, region ap-south-1. Stacks: StepsData (tables), StepsApi (food, scan, ingredient store and agent), StepsAuth.
- Deploy order when data changes: StepsData → `scripts/import-ingredients.py --write` → StepsApi.
- Nothing is deployed without the owner's OK.

## Way of working (14 Nov 2026)

- Opus designs and writes `docs/current-task.md` (replaced for each new task); Sonnet and Haiku implement it; Opus reviews.
- `docs/design.md` is managed only by Opus or a stronger model.
- `docs/completed-tasks.md` gets a short entry after each finished task.

## Looks (14 Nov 2026)

- One screen layout for all looks: Clean+ (the default, `docs/design/clean-plus.png`). Looks A–F stay selectable but only change colours and fonts on that layout; there are no per-look screens. Each look keeps its own light/dark; none follows the phone's dark mode.
- (14 Nov 2026, Opus) Park is included: every look, Park too, uses the one Clean+ Today, Food result and Walk screen (T6–T8 remove ParkToday, HAS_WALK_LOOK and the per-look layout flags). Looks differ only in colours, fonts and map colours.
