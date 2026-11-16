# Backup and restore (data sync)

Status: **plan only, 15 Nov 2026.** No code changed yet. Opus planned this; Sonnet builds it phase by phase (section 7).

## 1. The short answer (owner's question, 15 Nov 2026)

- **Where is my past data?** It was only on the old install. The app has never sent your steps, food, walks, sleep, mood, blood pressure, weight, water, saved foods or settings to our server. Uninstalling deleted the phone copy, so there is nothing on the server to pull.
- **When will it be pulled?** Only data saved after this plan ships can come back. Data from before this reinstall cannot be got back from our server.
- **What can still come back today:** steps that are in Health Connect. On Android 14 or newer, set the step source to Health Connect (Settings) and allow "past data". The app then reads up to 365 days of daily totals (hourly bars only for the last 7 days). Sleep, heart rate and blood pressure come back for the last 60 days after you connect vitals again. Food, walks, mood, water, weight, notes, saved foods and your profile do not come back.
- **The server is ready only in part.** It has a "save days" route (`POST /v1/days`) and a one-day read (`GET /v1/days/{date}`), but they keep only part of each record kind, and there is no bulk restore. Section 5 lists the changes.

## 2. Rules we already decided (31 Oct 2026)

- History and analytics live on our platform, keyed by the user id (`sub`) from the verified sign-in token. No route ever takes a user id from the app.
- The phone keeps recent data. A day on the phone is deleted only after the server confirms it has it.
- Data comes back after a reinstall only when the person signs in to the **same account** again (passkey, restore key or email recovery). A new account starts empty.

## 3. What gets backed up

Each thing below becomes a **record**: `kind`, `id`, `updatedAt` (ms), `deleted` (true/false), `v` (field-list version of the app that wrote it, see 5.3), `data`.

| Kind | From (local) | Id | Notes |
| --- | --- | --- | --- |
| `day` | `day_summary` + `hour_steps` | date | Steps, distance, kcal, goal, source, 24 hourly counts. The server also writes the existing `DAY#` item, so trends and the lake keep working |
| `food` | `food_log` | `id` | Every field we store, incl. macros if present |
| `water` | `water_log` | `id` | Each entry, not just the day total |
| `weight` | `weight_log` | `id` | Each entry |
| `mood` | `mood_log` | date | Score, note, `logged_at` |
| `sleep` | `sleep_log` | `id` | Manual nights and Health Connect nights (Health Connect gives back only 60 days) |
| `bp` | `bp_log` | `id` | Manual and Health Connect |
| `heart` | `heart_day` | date | Daily min, avg, max, resting |
| `walk` | `walk` + `walk_part` | `id` | Weather, stretches, parts and choices. The route is separate (section 5.4) |
| `place` | `place` | `id` | Pinned places (has location, see section 6) |
| `ownFood` | `own_food` | `id` | |
| `savedFood` | `saved_food` | `id` | |
| `dish` | kv `myDishes` | dish id | One record per dish (fixes the `mine:<n>` clash, section 4.1) |
| `setting` | kv keys | key name | `profile`, `portionOverrides`, `cookingTables`, `foodsNotForMe`, `pendingFoods`, `scan.own`, `walkStride`, `waterReminders` |

**Not backed up** (can be rebuilt or belongs to one phone): achievements (recomputed), weather cache, `scan.recent`, `scan.queue`, `appLock`, and machine state (`sourceId`, `backfilledAt`, `lastSyncAt`, `vitalsConnected`, `vitalsSyncedAt`, `stepsPublishedThrough`, `bpCopiesLeft`, widget and notification markers, `premium`, `accountId`, and the new `deviceId` and sync state).

**The `setting` list is an allowlist.** Only the kv keys named in the table are sent. A new kv key is not backed up until it is added to the list on both sides (5.3). This keeps machine state, tokens and anything else per phone off the server.

**Never sent, whatever the kind:** photos or images (for example from food scan), raw Health Connect samples, heart-rate samples, barometer rows, auth tokens, and the `appLock` PIN. Only `floors` per day is kept from the barometer.

**Health Connect ids** (`health_sample_id`, `health_id`) are sent with the record. They are opaque, and restore needs them to avoid duplicates (4.4).

**Child rows belong to the parent record.** `hour_steps` is part of `day`; `walk_part` (and later `walk_point`, through the route file) is part of `walk`. A change to a child row must bump the parent's `updated_at` and enqueue the parent, or the edit (for example a walk part `choice`) is never sent.

**Day totals.** The app fills `waterMl`, `weightKg`, `mood`, `moodNote`, sleep, heart and `nutrients` on the `day` record from the entries, as `POST /v1/days` expects, so `DAY#`, trends and the lake stay the same. A change to a food, water, weight, mood, sleep, bp or heart record for a date also enqueues that date's `day` (the outbox keeps one row per record, so this costs one write).

**Location switch.** When "Back up walk maps and places" is off (section 6), `place` records are not sent, and the `walk` record is sent without route, start or end coordinates, place ids or place names. Weather on a walk is sent without its coordinates.

## 4. The app side

### 4.1 Database changes (migration 9)

- Add `updated_at` (ms) to `food_log`, `weight_log`, `water_log`, `mood_log` and fill it from `logged_at` (or now). (`achievement` is not backed up, so it needs none.)
- Add table `kv_meta` (`key`, `updated_at`), written by the kv setter for the allowlisted keys, so each `setting` record has its own `updatedAt`.
- Add table `outbox`: `kind`, `id`, `updated_at`, `deleted`, `tries`, `next_try_at`, `last_error`; key (`kind`, `id`). One row per changed record. A later change to the same record replaces the row, so ten edits send once.
- Add table `sync_state` (or kv keys): `deviceId` (a `newId()` made once per install, never backed up, so a reinstall is a new device), `clockOffsetMs`, `restoredAt`, `restoreCursor`, `restoreDaysDone`, `lastUploadAt`, `firstBackupDone`.
- **Every `updated_at` written from now on** is `max(now + clockOffsetMs, old updated_at + 1)`, so a record's own edits always move forward even if the phone clock goes back (4.3).
- New dish ids use `newId()` (`mine:<newId>`) instead of the per-phone counter. Old `mine:1`, `mine:2` are renamed to `mine:<newId>` **in migration 9 itself**, not at first backup (the person may tap "Not now", and a restore can arrive first). In the same transaction, update every place that holds the id: `food_id` on food entries, `saved_food.id`, and the keys inside kv `myDishes`, `portionOverrides`, `pendingFoods` and `foodsNotForMe`.

### 4.2 Upload as things change

- **One hook, not many.** Wrap the repository (`src/data/db.ts`) so every write method also puts a row in `outbox` in the same SQLite transaction. The UI keeps calling the repository as it does now. Health Connect range swaps (`replaceHealthSleep`, `replaceHealthBloodPressure`) enqueue only what changed.
- **Health Connect swaps never delete restored rows.** On a new phone, Health Connect may not have the old nights and readings. A swap that removed every `health:*` row in its range would delete them and send tombstones, wiping the server copy. So a swap deletes (and tombstones) only rows that this `deviceId` itself read from Health Connect; rows that came from the server are left alone.
- **Today's `day` is held back.** The step engine rewrites today every 15 minutes, and each `day` write also costs a `DAY#` transaction, a stream record and a lake S3 PUT (5.6). Today's `day` is sent at most once an hour, when the app goes to the background, and once after midnight for the day that ended. Past days and all other kinds use the normal timing below.
- **No upload until the first restore has finished** (`restoredAt` set). Otherwise a new install's low step count or empty settings, stamped with a newer time, would overwrite the good server copy before it is pulled.
- **Deletes.** The local delete stays a hard delete. The outbox row says `deleted = 1`; that is the tombstone. It is sent like any other change.
- **The payload is read at send time** from the live row, so the outbox stays small. For a tombstone only `kind`, `id`, `updatedAt` are sent.
- **When to send:** 30 seconds after the last change while the app is open, when the app goes to the background, in the 15-minute background task if the outbox is not empty, and when the network comes back. Never more than one upload at a time.
- **Batch:** up to 200 records or 256 KB, whichever comes first.
- **Retries:** network error or 5xx: wait 30 s, then 2, 10, 30 minutes, then every 6 hours, with a little random delay. 401: refresh the token, try once more. 413: split the batch in half. A record the server rejects (400 for that record) stays in the outbox with `last_error`, and Settings shows "N items could not be backed up".
- **Offline:** nothing is lost; the outbox lives in SQLite and waits.
- **First backup** (existing installs after the update): put every row of every kind in the outbox once. Settings shows "Backing up: 1,240 of 5,000".
- **Settings → Backup row:** last backup time, items waiting, "Back up now".

### 4.3 Conflict rule

- **Last write wins by `updatedAt`.** The server keeps a record only if its `updatedAt` is newer than the stored one (same idea as `POST /v1/days` today). If equal, the higher `deviceId` wins, so two phones always agree.
- A tombstone is a record like any other: a newer delete beats an older edit, and a newer edit beats an older delete.
- The server answers per record: `saved` (stored, or the server already has the same `updatedAt`), `stale` (the server has a newer copy; the answer carries that copy) or `rejected` with the reason. The phone removes an outbox row on `saved` and on `stale`; on `stale` it also writes the server copy locally, so the phone never keeps showing an edit the server threw away.
- **Clock skew.**
  - Every answer has `serverTime`. The phone keeps `clockOffsetMs = serverTime - phone time` (smoothed, updated only from answers that took under 5 seconds) and adds it to every new `updated_at` (4.1). Two phones with wrong clocks then still order their edits by server time.
  - If a record's `updatedAt` is more than 1 day ahead of the server, the server stores the server time instead and returns the stored `updatedAt`; the phone writes that back to its row. A wrong clock then cannot block all later edits.
  - A `day` (or any dated record) with a date the server refuses (before 2020-01-01, or after tomorrow India time) is `rejected` with `bad_date`. The phone drops it from the outbox after 7 days instead of retrying forever, and keeps the local row.

### 4.4 Restore after sign-in

- **When:** after sign-in on a new install, or when a recovered account signs in, and `restoredAt` is not set for this `accountId`. It runs **after** `claimLocalData` (`src/auth/owner.ts`), which may wipe local data for a different account.
- **Also on an existing install** the first time the update runs, before the first backup: it pulls from "since 0" (normally empty, so cheap). This covers a person who already backed up from another phone.
- **How:** step 1 pulls `setting`, `dish`, `ownFood` and `savedFood` records (so name, goal, units and the foods that food entries point at are right at once). Step 2 pulls `day` records, then sets `restoreDaysDone`. Step 3 pulls everything else. Each step is paged, with a cursor saved after each page. If the app is closed, the next start continues from the cursor.
- **Pages overlap.** The cursor is server time, and two uploads running at once (two phones, or two Lambdas) can commit with times slightly out of order, and the index is read eventually consistent. Each pull after the first therefore starts 5 minutes before the saved cursor. Repeats are harmless because the merge below is by `updatedAt`.
- **A record the app cannot read** (unknown kind, or `v` newer than this app) is skipped and counted, not stored half. Settings says "Update Steps to bring back N more items". The server keeps it as it is (5.3).
- **Merge, per record:**
  - not on the phone → insert;
  - phone copy older → replace (or delete, for a tombstone);
  - phone copy newer, or a newer change waiting in the outbox → keep the phone copy (it will upload).
- Restored rows are **not** put in the outbox (they came from the server).
- **The app is usable during restore.** A small bar on Today says "Bringing back your data… 40%". Screens fill in as pages arrive. Walk routes are fetched only when a walk is opened, or later in the background.
- **Guard against the step counter overwriting good days.** After a fresh install the phone counter starts again from zero (`recorderSince` is reset), and a Health Connect backfill has no hourly detail for old days. So:
  - the step engine does not rewrite a day that came from the server and is older than the install day;
  - for the install day and the days the engine re-reads, steps = the larger of the restored value and the new count;
  - backfill (`src/sync/engine.ts`) skips days that already exist from the restore. Backfill and the engine's writes for days before the install day wait until `restoreDaysDone` is set; the first sync after sign-in runs only the install day.
- **No duplicates from Health Connect.** After vitals are connected again, the 60-day read brings back nights and readings that are already restored. Blood pressure typed in the app comes back from Health Connect as `source: 'health'` with a new `health:<id>`. Before inserting a Health Connect row, skip it if a restored row has the same `health_sample_id` / `health_id`, or (for bp) the same time and values.
- After the last page, set `restoredAt` and run achievements again. Uploads start only now (4.2).

### 4.5 Keeping only recent data on the phone (later)

Not needed for backup. Later: keep the last 400 days on the phone; delete an older day only when nothing for it is waiting in the outbox and the server has said `saved`. Older history screens then read from `/v1/trends` and `/v1/days`. Pruning must not depend on premium: a free user's old days are still kept on the server and shown after an upgrade (section 6). This is phase 7.

## 5. Server changes (stepsinfra)

### 5.1 Table

Same table `steps-user-data`, same partition `PK USER#<sub>`.

- New item per record: `SK REC#<kind>#<id>`, with `updatedAt`, `deviceId`, `deleted`, `v`, `data` (map), `serverAt` (ms, set by the server), `size`.
- New index (GSI1) for "what changed since": `GSI1PK = USER#<sub>`, `GSI1SK = <serverAt padded>#<kind>#<id>`, projection ALL. A full restore is "since 0".
- Tombstones keep `kind`, `id`, `updatedAt`, `deleted` only, and `expiresAt` = 400 days later (TTL). A phone offline longer than that could bring a deleted record back; that is accepted.
- Item size: aim under 64 KB, hard reject over 300 KB (DynamoDB's limit is 400 KB). Big `setting` values (for example `cookingTables`) are split by the app into parts if they pass 64 KB.
- `DETAIL#<date>` lists stop being written for new data; the records replace them. `POST /v1/days` and `GET /v1/days/{date}` stay so nothing breaks.

### 5.2 Routes

| Route | What it does |
| --- | --- |
| `POST /v1/sync` | Body `{"deviceId", "records":[...]}`, at most 200 records and 512 KB. Validates each record by kind. **Unknown fields reject that record** (no silent drop, so the phone never deletes data the server did not keep). Writes with the `updatedAt` condition. For `day` it also writes `DAY#<date>` in today's shape. Answer: `{"saved":[{kind,id,updatedAt}], "stale":[{kind,id,record}], "rejected":[{kind,id,error}], "serverTime"}` (4.3) |
| `GET /v1/sync?since=<cursor>&kinds=&limit=` | Changed records in server-time order from GSI1, up to 500 records or 1 MB per page, plus `next` cursor and `total` estimate (for the progress bar). `kinds` is a filter on the query, so it still reads the skipped items; it is fine for restore step 1, not for frequent polling |
| `POST /v1/routes/{walkId}` | **Premium only** (owner, 16 Nov 2026). Returns a short-lived signed upload URL for the walk's route file. Free user: 403 `premium_required`. Premium list unreadable: 503, the phone keeps the route and tries again later |
| `GET /v1/routes/{walkId}` | Returns a short-lived signed download URL, 404 if none. **No premium check**: a route saved while premium always comes back, even after premium ends |
| `DELETE /v1/sync` | "Delete my backup": removes all `REC#`, `DAY#`, `DETAIL#` items and the routes, keeps the account |
| `DELETE /v1/me` | Already exists; must also remove the routes and the person's lake files (5.5) |

Per-user limits so one phone cannot run up cost: `POST /v1/sync` 120 calls an hour, `GET /v1/sync` 600 pages an hour (using the existing `LIMIT#` counters). The whole API today has one throttle (50 a second, burst 100); a restore wave could starve sign-in, so give `/v1/sync` its own route throttle.

**No premium check on any backup route except route-file upload.** `POST /v1/sync`, `GET /v1/sync`, `GET /v1/routes/{walkId}` and `GET /v1/days` work the same for free and premium users. Only `POST /v1/routes/{walkId}` (saving the map line of a walk) is premium (owner, 16 Nov 2026). A free user's walk record (time, steps, distance, parts) is still backed up; only the map line stays on that phone. Restore must not wait on `GET /v1/me`: it answers 503 when the premium list cannot be read, and that must never stop or empty a restore.

### 5.3 Validation, per kind

A schema per kind in `lambda_src/python/steps/data/records.py` with field names, types, ranges and list sizes (for example food `quantity` 0–10,000, a walk at most 200 parts, a note at most 500 characters). The app and server share the same field list; a test on each side checks it, so a field added to the app fails the tests until the server knows it.

**Old app, newer data.** The field list has a version `v`. If a phone on an older app edits a record that a newer app wrote (stored `v` higher than the incoming `v`), the server merges: the incoming fields replace the stored ones, and fields the older app does not know are kept. Without this, a second phone on an old version would silently strip new fields on every edit. The server must be deployed before any app version that raises `v`.

### 5.4 Walk routes in file storage (premium)

- **Premium only** (owner, 16 Nov 2026): only premium users' routes are uploaded. The app checks `premium` before asking for an upload URL, and the server checks again (403 `premium_required`). A free user who restores on a new phone gets the walk without its map; the walk screen says "Map saved on your old phone only. Premium keeps maps in your backup." When a free user upgrades, routes still on the phone are uploaded then.
- Storage moves to GCP Cloud Storage with the server move (stepsinfra docs/current-task.md): bucket in asia-south1, signed URLs instead of S3 presigned URLs, same key layout.

- Private bucket `steps-routes` (or a prefix in a new private bucket, **not** the lake): key `routes/<sub>/<walkId>.gz`, gzipped JSON of the points (`t`, lat, lon, accuracy, altitude). About 20–60 KB per hour of walking.
- Max 2 MB per file (presigned PUT with content-length limit). Server-side encryption on, public access blocked, Intelligent-Tiering.
- The `walk` record holds `routeKey`, `routeBytes`, `routeHash`. The app uploads the file first, then the walk record.
- The lake never gets routes or places. They show home and work.

### 5.5 Lake

Today the lake files are `days/dt=<date>/<aid>.json`. Deleting one person's files means listing every date folder. Either keep a list of the person's lake keys, or change the layout so the person can be removed cheaply. Must be done before `DELETE /v1/me` can say "everything is gone".

### 5.6 Cost (rough, ap-south-1)

- A normal day is about 20–60 record writes of about 1 KB each; with the index, about double. For 1,000 active people that is about 3 million writes a month: a few dollars.
- Storage: about 10–30 KB per person per day plus routes. 1,000 people for a year: a few GB, under a few dollars a month. Point-in-time recovery adds about the same again.
- The first backup and each restore are a one-time burst per person (a year of data is about 10,000–20,000 records).
- Debouncing (4.2) matters most: sending a whole day again every few minutes would multiply writes.
- **A `day` write is the expensive one.** It is a transaction (`REC#` + `DAY#` + condition), and transactions cost double; each `DAY#` change also makes one stream record, one lake Lambda run and one S3 PUT. Sent every 15 minutes, today's day alone would be about 96 of these a person a day (about 3 million lake PUTs a month for 1,000 people, around $15 a month in PUTs alone). The once-an-hour rule in 4.2 cuts this to about 15 or fewer.
- Each call also writes its `LIMIT#` counter, one more write per request.
- GSI1 with projection ALL doubles record storage. Accepted for now (restore needs the data in the index); switch to KEYS_ONLY plus BatchGet only if storage becomes the main cost.
- Add a monthly AWS budget alarm and a CloudWatch alarm on the table's consumed write units (risk 6).

## 6. Privacy (DPDP Act)

- **Notice before the first backup:** a one-time card: "Back up your data to Steps servers in India (Mumbai) so you get it back on a new phone. What we keep: steps, food, sleep, mood, blood pressure, weight, water, walks, your profile." Buttons "Back up" and "Not now". Backup starts only after "Back up" (clear yes). "Not now" asks again in 7 days, at most three times.
- **Walk routes and pinned places** are location data. They have their own switch, "Back up walk maps and places", shown on the same card. **Owner question:** on or off by default? Plan: off until turned on.
- **Settings → Backup:** turn backup off (stops uploads, keeps the server copy), "Delete my backup" (calls `DELETE /v1/sync`), and the existing "Delete account" (calls `DELETE /v1/me`), which removes the server copy, routes and lake files too.
- **Point-in-time recovery** keeps deleted data in AWS backups for up to 35 days. The privacy policy must say this.
- The server never trusts a user id from the app; every read and write uses the `sub` from the token.
- Data is used only to give the person their data back and to show their trends. The lake holds no name, email, food, walks, routes, places, weight or blood pressure.
- The privacy policy and Play "Data safety" form must be updated **before** the release that turns backup on (owner).
- **Owner decided (16 Nov 2026):** backup and restore are free for everyone, except walk map lines (route files), which are premium.

### 6.1 Premium and free users

- Free users' history is **recorded and backed up in full**, the same as premium. Premium changes only what the app shows, never what is kept, sent or restored.
- After an upgrade, older history and analytics appear at once from what is already on the phone and server. No new upload or restore is needed.
- After a downgrade or a lapsed purchase, nothing is deleted; the screens go back to the free view.
- The `premium` kv value is not backed up; after a reinstall it comes from `GET /v1/me` as today. A 503 there means "not known yet", not "free".

## 7. Phases

Opus plans each phase in `docs/current-task.md` and checks it after. Sonnet builds. Haiku only for small copy or style fixes. Server deploys need the owner's OK.

### P0 — now, no code (owner)

Tell users (section 8). Owner: switch your step source to Health Connect if your phone is Android 14+, to get back step totals.

### P1 — server records and pull (Sonnet, deploy with owner's OK)

- Files (stepsinfra): `stacks/data_stack.py` (GSI1), `stacks/api_stack.py` (routes, rights, limits), `lambda_src/python/steps/data/records.py` (new: schemas, write, pull), `lambda_src/python/steps/data/handler.py` (routes), `lambda_src/python/steps/data/days.py` (reuse for `day`), tests under `tests/`.
- Done when:
  - a batch of 200 mixed records saves; sending the same batch again answers all `saved` and changes nothing;
  - an older `updatedAt` does not replace a newer one; a newer tombstone removes the data;
  - a record with an unknown field is `rejected` and nothing of it is stored;
  - `GET /v1/sync?since=0` pages through 10,000 records with no gaps or repeats;
  - user A can never read or write user B's records (test with two tokens);
  - a `day` record also updates `DAY#` and `/v1/trends` shows it;
  - an older `updatedAt` answers `stale` with the server copy; a time more than a day ahead is clamped and the stored time returned;
  - a record with a lower `v` than the stored one keeps the stored fields it does not know;
  - a free (non-premium) token can save and pull, and a premium-list failure does not affect `/v1/sync`.

### P2 — app outbox (Sonnet)

- Files: `src/data/migrations.ts` (migration 9), `src/data/db.ts` (wrap writes, outbox), `src/data/types.ts`, `src/sync/records.ts` (new: row ↔ record per kind), `src/nutrition/my-dishes.ts` (new ids), tests in `src/data/__tests__`, `src/sync/__tests__`.
- Done when:
  - every write and delete method of the repository leaves exactly one outbox row for that record;
  - ten edits to one food entry leave one row;
  - the shared field list test matches the server's schema;
  - old `mine:<n>` dishes are renamed in migration 9, and food entries, saved foods, portion overrides, pending foods and "not for me" still point at the right dish;
  - editing a walk part or an hour of steps enqueues the parent `walk` / `day`;
  - a kv key not on the allowlist never reaches the outbox;
  - a Health Connect range swap does not delete or tombstone rows restored from the server;
  - with the phone clock set back a day, a new edit still gets a higher `updated_at` than the last one.

### P3 — upload (Sonnet; Opus checks CI screenshots)

- Files: `src/sync/upload.ts` (new), `src/sync/run.ts` and `src/sync/background.ts` (call it), `src/state/app-state.tsx` (app background trigger), Settings backup row and first-backup card (`app/settings/…`, `src/components/settings/…`).
- Done when:
  - with the network off, entries wait; when it comes back they upload and the outbox is empty;
  - a 500 from the server leads to retry with growing waits; a 400 leaves the item with an error shown in Settings;
  - a first backup of a year of test data finishes and the server count matches the phone count;
  - no upload starts before the person taps "Back up" on the notice, or before the first restore has finished;
  - today's `day` is sent at most once an hour while the step engine runs every 15 minutes;
  - with the location switch off, no `place` record and no coordinates or place names in a `walk` record reach the server.

### P4 — restore (Sonnet; Opus checks CI screenshots)

- Files: `src/sync/restore.ts` (new), `src/auth/owner.ts` and `src/auth/auth-state.tsx` (start after claim), `src/sync/engine.ts` (guard in 4.4), Today progress bar.
- Done when (test on the emulator):
  - fill phone A with test data, back it up, clear app data, sign in to the same account: every kind comes back, counts match, and the app can be used during the restore;
  - killing the app halfway and opening it again continues and does not duplicate anything;
  - restored old days keep their hourly bars and are not lowered by the step counter or backfill;
  - signing in to a different account does not show account A's data;
  - an edit made on the phone during restore is kept, not overwritten;
  - reconnecting vitals after a restore does not duplicate sleep nights or blood pressure readings;
  - a record written by a newer app version is skipped and counted, not stored half.

### P5 — walk routes (Sonnet)

- Files: stepsinfra routes bucket and the two `/v1/routes` routes; app `src/walks/route-sync.ts` (new), `src/walks/save.ts`, `app/walk/[id].tsx` (fetch on open).
- Done when a 2-hour walk's map comes back after reinstall, a route over 2 MB is refused cleanly, and deleting the walk removes the file.

### P6 — privacy and deletion (Sonnet; owner for policy text)

- Files: stepsinfra `handler.py` (`DELETE /v1/sync`, `DELETE /v1/me` removes routes and lake files), `lake.py` (layout or key list); app Settings backup screen, maps-and-places switch.
- Done when "Delete my backup" and "Delete account" leave no `REC#`, `DAY#`, `DETAIL#`, route or lake object for that user (checked by a script), and turning backup off stops all uploads.

### P7 — later: keep only recent days on the phone (Opus plans again first)

As in 4.5.

## 8. What to tell users until this ships

Short text for the app's help page, store listing note or a message to testers:

> Your Steps history is stored only on this phone for now. Please do not uninstall Steps, clear its data, or reset the phone, or your food, walks, sleep, mood, water, weight and notes will be lost. Steps counted in Health Connect can be read again after a reinstall. Backup to your account is coming in a coming update; after that, signing in on a new phone will bring everything back.

Also, for the owner and testers on Android 14+: keep "past data" allowed in Health Connect, so step totals can be read back.

## 9. Risks

1. **Data lost by silent field drop.** If the server ignored a field and still said "saved", the phone could later delete what the server never kept. Fixed by rejecting unknown fields (5.2) and the shared field-list test.
2. **The counter or backfill overwriting restored days** with lower or less detailed numbers. Fixed by the guard in 4.4; must have its own test.
3. **Wrong clock on a phone** can make old edits win. The phone adds the server clock offset and keeps its own edits moving forward, the server clamps far-future times and answers `stale` instead of a silent "saved" (4.3); small skews remain possible.
4. **Two phones on one account** editing the same record at the same time: the later edit wins and the other is lost. Accepted for a personal tracker. This includes `day`: two phones both counting steps on the same date do not add up; the later upload wins. Manual nights (`sleep-<date>`) and `mood` are one per date, so the same applies. Health Connect nights read on two phones with different Health Connect stores get different `health:<id>` ids and can show twice.5. **Dish id clash** (`mine:<n>`) mixing up dishes. Fixed by renaming before the first upload (4.1).
6. **Cost burst** if many people restore at once, or a bug loops uploads. Per-user limits (5.2), debounce, and a cost alarm on the table.
7. **Privacy of location** (routes, places). Separate switch, private bucket, never in the lake.
8. **Deletion not complete** (lake files, routes, AWS backups up to 35 days). Phase 6 and the privacy policy.
9. **Restore wiping local data.** Restore only merges; the only wipe stays `claimLocalData` for a different account, and restore runs after it.
10. **Big first backup on slow networks.** Batches are small and the cursor and outbox survive restarts.
11. **Tombstones expire after 400 days**, so a phone offline longer could bring back a deleted record. Accepted.
12. **Old app versions** still on phones keep data only locally until updated. Nothing to do but encourage the update.
13. **Restore pull missing records** written at the same moment by another phone. Fixed by the 5-minute overlap (4.4).
14. **Health Connect swaps on a new phone deleting restored rows** and tombstoning them on the server. Fixed by deleting only rows this device read (4.2).
15. **An old app version stripping new fields.** Fixed by the `v` merge (5.3).
16. **A new install uploading over the good server copy** before it is pulled. Fixed by no uploads until the first restore has finished (4.2).
17. **Premium gating hiding or losing history.** Backup routes never check premium except route-file upload; downloads of saved routes never check it; pruning never depends on it (6.1, 4.5). A phone must never delete a free user's local route file because the upload was refused.

## 10. Owner questions

1. Walk maps and places backup: on or off by default? (Plan: off until turned on.)
2. Backup free for everyone? **Decided 16 Nov 2026: yes, except walk map lines (premium).**
3. OK to deploy P1 server changes when ready? (Deploys always ask first.)
