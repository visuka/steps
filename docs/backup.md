# Cloud backup and restore

Owner, 21 Nov 2026: "Send all the data to cloud if someone has to reset or
reinstall they should get their data back."

Everything a person records on the phone is copied to their own partition on
our server (steps-data, DynamoDB `steps-user-data`, AWS Mumbai) and comes back
after a reinstall, a reset or a new phone, once they sign in with their
passkey. Free and premium alike: free users' history is kept too (shown once
they upgrade, as decided 12 Nov).

## What is backed up

Every row of these phone tables (src/data/migrations.ts):

| Phone table | Record `t` | Record key `k` | Notes |
|---|---|---|---|
| day_summary | `day_summary` | date | |
| hour_steps | `hour_steps` | date | the day's 24 hours in one record |
| weight_log, water_log, food_log, bp_log, sleep_log | same name | id | |
| achievement | `achievement` | id | |
| mood_log, day_weather, heart_day | same name | date | |
| own_food, saved_food, place | same name | id | |
| walk | `walk` | id | |
| walk_part | `walk_part` | walk id | all parts of a walk in one record |
| walk_point | `walk_point` | `<walk id>#<n>` | a walk's points in chunks of at most 2,000 (n from 0) |
| kv | `kv` | key | **only the keys on the allow list** in src/sync/kv-keys.ts: the person's settings, goal, profile and choices. Never caches, sign-in, sync state or device-only keys |

## Server routes (steps-data Lambda, behind the authorizer)

```
POST /v1/backup   {"records": [{"t", "k", "u", "d"}, ...]}
     t: one of the record types above; k: 1–200 chars; u: when it changed,
     ms since 1970 (integer); d: the row as a JSON object, or null when
     deleted. At most 200 records and 1 MB per call; a record's d at most
     300 KB as JSON.
     A record with d null and k ending in "#*" deletes every stored record of
     that type whose key starts with the part before "*" (used for a walk's
     point chunks).
     Last writer wins per record: written only when the server has no copy or
     an older u. Deletes are kept as tombstones (so another phone learns of
     them), with the same rule.
     200 {"saved": n, "rejected": [{"t", "k", "error"}]}: a record already
     stored at the same or a newer u counts as saved.
     401 when the account is deleted or being deleted (nothing written).

GET  /v1/backup?after=<cursor>
     One page (up to ~1 MB) of the person's records, tombstones included:
     200 {"records": [{"t", "k", "u", "d"}], "next": "<cursor>" | null}
```

Stored as `PK = USER#<sub>`, `SK = REC#<t>#<k>`, with `t`, `k`, `u`, and
`j` (the row as a JSON string) or `x: true` for a tombstone (plus `n`, the
item's size, for the per-account limit below). DELETE /v1/me
already deletes every item in the partition, so backups go with the account.
The analytics lake stream must ignore `REC#` items. Health values are never
logged.

Server details the routes above leave open (stepsinfra
`lambda_src/python/steps/data/backup.py`, its docs/architecture.md
2026-11-21):

- `rejected[].error` is one of `bad record`, `bad t`, `bad k`, `bad u`,
  `bad d`, `too_large`, `too_many`, `quota`; `t` and `k` are echoed when they
  are strings of at most 200 characters, else null. A rejected record is not
  saved; only `too_many` is worth sending again.
- `quota`: one account keeps at most 1,000,000 backup items and 2 GiB (an
  item's size is its `k` and its `d` as compact UTF-8 JSON). A row that would
  add an item or bytes past that is rejected `quota`, and so is a delete of a
  row the server never had (it would add a tombstone). A delete of a stored
  row, or a row that gets smaller, always goes through. Ten years of daily
  GPS walks is about 1 GB, so only abuse meets it.
- `u` must be an integer from 0 to the server's clock plus one day. `d` must
  be present (an object, or null to delete). A `k` ending `#*` is valid only
  with `d` null and something before it (`w1#*`, never `#*`). A record's size
  is its `d` as compact UTF-8 JSON.
- The same `(t, k)` twice in one call: the newest `u` is kept (the later one
  on a tie). A `#*` delete never beats a row sent in the same call at the
  same or a newer `u`, so a walk's new point chunks can go in the same call as
  the delete of its old ones. A `#*` delete also moves older tombstones up to
  its `u`.
- `#*` deletes write at most 1,000 tombstones per call; past that the record
  is rejected `too_many` and must be sent again to finish (each send makes
  progress). The same `#*` record more than once in a call is read once, at
  the newest `u`. All the `#*` deletes of one call read at most about 16 MB
  of stored records between them (4,096 DynamoDB read units), counting the
  ones they don't match; past that the record, and every `#*` record after
  it in the call, is rejected `too_many`. A walk's point chunks are well
  under that.
- DELETE /v1/me deletes the partition page by page; when the call runs short
  of time the rest goes to a server queue that finishes it within minutes.
  The answer is the same (`dataDeleted: true`), and nothing can be written to
  or signed in to the account meanwhile.
- 503 `unavailable`: a write failed for a reason that isn't the record's
  (throttling); send the whole batch again (last writer wins makes that safe).
  400 for a body that isn't `{"records": [...]}` or has over 200 records; 413
  over 1 MB.
- `next` is URL-safe base64 without padding; any other `after` is a 400.

## On the phone (src/sync/)

- **Change tracking in SQLite, not in screens.** A migration adds
  `sync_queue (t, k, changed_ms, seq)` and `sync_pause`, and triggers on every
  table above: after INSERT, UPDATE or DELETE they put `(t, k)` in the queue
  (one row per record; a newer change replaces the older), unless
  `sync_pause` has a row. No screen or store calls the backup; any new write
  path is covered automatically.
- The same migration queues every row that exists already (first backup).
- **Upload** when signed in and online: at start, when the app comes to the
  front, and a short while after changes. Batches of up to 200 records and
  about 800 KB. A queue row is removed only if it hasn't changed since it was
  sent (`seq`). Failures retry later with back-off; nothing is lost while
  offline.
- **Restore** once per account per install (a kv flag, which reset wipes):
  after sign-in it pages through GET /v1/backup and writes the rows with
  `sync_pause` set. A row with a local change still waiting to upload, or a
  local copy newer than the record (`updated_at`), is kept. Tombstones are
  skipped. Rows read from Health Connect or Apple Health are not duplicated.
- **Reset and sign-out never delete the backup.** `clearAll` runs with
  `sync_pause` set and empties the queue. Sign-out first tries to upload what
  is waiting.
- The account screen shows when the data was last backed up; Today shows a
  quiet line while a restore runs. Both use the shared components and theme
  only.
- Web (design preview): no backup.

Phone details the list above leaves open (src/sync/backup-core.ts,
src/sync/backup.ts, the backup migration in src/data/migrations.ts):

- **Record shapes.** A row record's `d` is the phone row as it is in SQLite
  (column names as keys). `hour_steps`, `walk_part` and each `walk_point`
  chunk are `{"cols": [...], "rows": [[...], ...]}`, the key column left out
  (`hour_steps` ordered by hour, `walk_part` by ord, points by t). `u` is when
  the change was queued on the phone (`sync_queue.changed_ms`), not the row's
  own `updated_at`.
- **Stamps never go back.** `sync_seq` also keeps the last stamp given (`ms`);
  each change is stamped `max(now, last + 1)`, so a clock set back (or a
  phone whose clock was behind) can't give a newer change an older `u` than
  the one already sent. After a restore `ms` is raised to the newest `u`
  brought back, so a change made here then is newer than the backup's copy.
- **First backup.** The rows already on the phone when the migration runs (or
  a kv key newly on the allow list) are queued with `seq` 0 and the row's own
  last change as `u`: the newest `updated_at` of its row (for `hour_steps`
  the day's, for `walk_part` and `walk_point` the walk's), or 0 for tables
  without one. So an old copy on a phone never wins over a newer one in the
  backup.
- **Walk point chunks.** The phone remembers how many chunks it last sent for
  each walk (`sync_chunks`). Fewer chunks now: `<walk id>#*` goes first at
  `u - 1` (never below 0), then the chunks at `u`, so the server keeps the new ones and drops
  the rest. The walk's points all gone: `<walk id>#*` at `u` alone.
- **Queue order.** `sync_seq` is a one-row counter; every trigger takes the
  next number, so `seq` says which change is newer even within one
  millisecond. A trigger deletes and re-inserts its queue row (a plain INSERT
  inside a trigger would take on an outer `INSERT OR IGNORE` and be dropped).
  Changing a row's key queues the old key too, so its delete goes up.
- **kv allow list on the phone.** The kv triggers read `sync_kv_allow`, which
  the app refills from src/sync/kv-keys.ts on every open; a key newly on the
  list has its row queued then. The migration's text never changes with the
  list. src/sync/__tests__/kv-keys.test.ts fails for any kv key the code uses
  that is on neither list.
- **Paused writes** (restore pages, `clearAll`) run as one SQLite exec:
  savepoint, the `sync_pause` row, the statements, the row removed, release.
  On an error the rollback is a second call, so the app's own database calls
  go through a gate (src/data/sql-gate.ts): while a paused write runs,
  rollback included, every other call waits, so nothing can land inside the
  savepoint (unqueued, then rolled back with it). A paused write first waits
  up to 5 s for the app's open transactions to end. `sync_pause` is emptied
  on every open in case the app died mid-way.
- **Reset during an upload.** The store counts `clearAll` runs; an upload that
  sees one start or finish stops before its next call, so rows it read before
  the clear never go up as deletes.
- **Limits.** Batches of at most 200 records and 800,000 bytes as JSON; a
  record whose `d` is over 300 KB or whose key is over 200 characters is left
  out with a log line naming only its type. At most 5,000 queue rows per run
  (the rest go on the next). Only the type, the error and a count of rejected
  records are logged.
- **Rejected records.** `too_many`: the queue row stays and the record is
  sent again in the same run (up to 5 passes; the rest on the next run).
  `bad u` for a change stamped in the future (a clock that was ahead): it is
  stamped again with the phone's time now and sent again. `bad u` otherwise:
  the row stays, and the run ends as failed (status "trying again soon",
  with the usual back-off) instead of dropping the change. Any other error
  drops the record from the queue.
- **Slow links.** A POST may take up to 120 s and a GET page up to 90 s (the
  backup passes its own time limit; authFetch's default is 20 s). Batches
  start at 200 KB: a call that times out (or finds no connection) halves the
  size for the next one, down to 50 KB, and each batch that goes through
  doubles it, up to 800 KB.
- **When it runs.** Only for the account that owns the data on this phone,
  once `claimLocalData` is done and the email step is closed. At start, on
  sign-in and when the app comes to the front; while it is open the queue is
  looked at every 10 s and uploaded once nothing has changed for 25 s, or
  once the oldest change has waited 3 minutes. One run at a time. After a
  failure: 30 s, doubling to at most 30 minutes; coming to the front tries
  again at most every 30 s. A 401 or 403 (after authFetch's own refresh)
  stops it until the next sign-in. Every call checks the run is still for
  the signed-in account. Sign-out waits at most 4 s for the last upload.
- **Restore first, then upload**, in the same run. The restore runs only at
  start or sign-in: after "Delete all app data" with the app open, the data
  comes back on the next start, not under the person's eyes. The flag is kv
  `backupRestoredFor` (the account id; reset wipes it); `backupLastAt` is
  when an upload run last finished. Both are local only.
- **Merge rules.** Each restored row is written only if the phone has no
  change of it waiting to upload and no copy with a newer `updated_at` than
  the record's `u`. A row queued only for the first backup (`seq` 0) makes
  way: the backup's copy is written and the queue row dropped, unless the
  phone's `updated_at` is newer. `day_summary` and `hour_steps` for today are
  not replaced when the phone already had today's row as the restore began.
- **The profile.** It goes up without the name (`name` is left out), and
  comes back with this phone's own `name` and `onboarded`, so onboarding (and
  its permission questions) still runs on a new phone, with the restored
  answers filled in. Onboarding keeps only what is answered on its screens
  and saves just that over the stored profile. A profile change made before
  this account's backup has come back (onboarding, Settings) is also kept in
  kv `profileEdits` (local only); the restore lays those fields over the
  backup's profile (and stamps the queue row later than the backup's `u`,
  so the merged profile goes up), and the key is removed once the restore
  is done. Profile changes and restore pages are written one at a time, and
  the app re-reads the profile as soon as the page that held it is written,
  not only at the end.
- **Health dedupe** (`bp_log`, `sleep_log`): a copy read from
  the health app (`source = 'health'`, id `health:<their id>`) is not written
  beside the person's own entry with the same `health_id`; the person's own
  entry replaces a health app copy of it. A walk's points are replaced as a
  whole by the backup's chunks. Records of unknown types, kv keys off the
  allow list, and records missing a required column are skipped. A page that
  fails is written again one record at a time. After a restore the app
  re-reads the profile and today, and every screen re-reads its data.
- A Health Connect / Apple Health history fill keeps a day's hourly detail
  when its total and source are the same as the phone's (a day brought back
  from the backup).
- **Status lines** (shared Notice component, theme only): the account card
  shows "Backed up: 5 min ago", "Backing up…", "Not backed up yet",
  "Not backed up yet: no connection" or "Not backed up yet: trying again
  soon"; Today's steps tile sync line shows "Bringing back your data…" while
  a restore runs.

## Only this person's data (owner, 21 Nov 2026)

"Once the email is confirmed it should check if relevant data is available
in the mobile as well; only the data of this particular user needs to be
picked."

- The phone's data belongs to one account: kv `accountId`
  (src/auth/owner.ts, `claimLocalData`). Upload and restore run only when
  that owner is the signed-in account, after `claimLocalData` has finished
  for it, never for another id.
- A reinstall first makes a new, empty account; confirming the email then
  finds the person's old account and signs the phone in to it
  (`confirmFirstEmailCode` → `finishRecovery`). Nothing is uploaded or
  restored while the email step is still open (`auth.confirmingEmail`), so the
  throwaway account never gets a backup. Once the phone is in the old account,
  `claimLocalData` wipes what the throwaway account left (with the backup
  paused, so nothing is deleted in the cloud) and the restore brings back the
  old account's data.
- When another account signs in on the phone, the previous person's data is
  wiped first (as today) and only the new account's backup is restored. The
  server reads and writes only the partition of the account in the access
  token, so one person's records can never reach another.
