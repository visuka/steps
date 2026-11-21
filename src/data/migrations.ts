/**
 * The tables the backup migration put triggers on, as they were then:
 * [record type t, table, key column]. Frozen with it; a table added later
 * gets its triggers in a migration of its own.
 */
const BACKUP_V1: readonly (readonly [string, string, string])[] = [
  ['day_summary', 'day_summary', 'date'],
  ['hour_steps', 'hour_steps', 'date'],
  ['weight_log', 'weight_log', 'id'],
  ['water_log', 'water_log', 'id'],
  ['food_log', 'food_log', 'id'],
  ['bp_log', 'bp_log', 'id'],
  ['sleep_log', 'sleep_log', 'id'],
  ['achievement', 'achievement', 'id'],
  ['mood_log', 'mood_log', 'date'],
  ['day_weather', 'day_weather', 'date'],
  ['heart_day', 'heart_day', 'date'],
  ['own_food', 'own_food', 'id'],
  ['saved_food', 'saved_food', 'id'],
  ['place', 'place', 'id'],
  ['walk', 'walk', 'id'],
  ['walk_part', 'walk_part', 'walk_id'],
  ['walk_point', 'walk_point', 'walk_id'],
  ['kv', 'kv', 'key'],
];

/** Now, in ms since 1970, inside SQLite. */
const NOW_MS = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)";

/**
 * The next seq, and the change's time: now, but never earlier than the last
 * change stamped (sync_seq.ms), so a clock put back can't make a later change
 * look older than one the server already holds (it keeps the newest u).
 */
const NEXT_STAMP = `UPDATE sync_seq SET n = n + 1, ms = MAX(${NOW_MS}, ms + 1);`;

/**
 * Queues (t, key) with the seq and time NEXT_STAMP just took. DELETE then a
 * plain INSERT, never INSERT OR REPLACE: a trigger takes the conflict rule of
 * the statement that fired it, so under an INSERT OR IGNORE the newer change
 * would be dropped and the older seq kept.
 */
function queueRow(t: string, key: string, when = '') {
  return `
    DELETE FROM sync_queue WHERE t = '${t}' AND k = ${key}${when ? ` AND ${when}` : ''};
    INSERT INTO sync_queue (t, k, changed_ms, seq) SELECT '${t}', ${key}, ms, n FROM sync_seq${when ? ` WHERE ${when}` : ''};`;
}

/**
 * When a row queued by the first backup last changed, as far as the phone can
 * tell: its own updated_at; a walk's parts and points the walk's, a day's
 * hours the day's; 0 where nothing says (a change tracked anywhere is newer).
 * So an older copy on a second phone can't beat a newer one already in the
 * backup.
 */
const SEEDED_AT: Readonly<Record<string, string>> = {
  hour_steps: 'COALESCE((SELECT d.updated_at FROM day_summary d WHERE d.date = hour_steps.date), 0)',
  walk_part: 'COALESCE((SELECT w.updated_at FROM walk w WHERE w.id = walk_part.walk_id), 0)',
  walk_point: 'COALESCE((SELECT w.updated_at FROM walk w WHERE w.id = walk_point.walk_id), 0)',
  day_summary: 'updated_at',
  day_weather: 'updated_at',
  walk: 'updated_at',
  own_food: 'updated_at',
  sleep_log: 'updated_at',
  heart_day: 'updated_at',
  bp_log: 'updated_at',
  saved_food: 'updated_at',
  place: 'updated_at',
};

function backupTriggers(t: string, table: string, key: string): string {
  const free = 'NOT EXISTS (SELECT 1 FROM sync_pause)';
  const kv = table === 'kv';
  const allowed = (row: string) => (kv ? `${row}.key IN (SELECT key FROM sync_kv_allow)` : '');
  const onlyIf = (row: string) => (kv ? ` AND ${allowed(row)}` : '');
  return `
  CREATE TRIGGER backup_${table}_insert AFTER INSERT ON ${table} WHEN ${free}${onlyIf('NEW')}
  BEGIN
    ${NEXT_STAMP}${queueRow(t, `NEW.${key}`)}
  END;
  CREATE TRIGGER backup_${table}_update AFTER UPDATE ON ${table}
    WHEN ${free}${kv ? ` AND (${allowed('NEW')} OR ${allowed('OLD')})` : ''}
  BEGIN
    ${NEXT_STAMP}${queueRow(t, `NEW.${key}`, allowed('NEW'))}${queueRow(
      t,
      `OLD.${key}`,
      `OLD.${key} IS NOT NEW.${key}${onlyIf('OLD')}`,
    )}
  END;
  CREATE TRIGGER backup_${table}_delete AFTER DELETE ON ${table} WHEN ${free}${onlyIf('OLD')}
  BEGIN
    ${NEXT_STAMP}${queueRow(t, `OLD.${key}`)}
  END;`;
}

function backupMigration(): string {
  const first = BACKUP_V1.filter(([, table]) => table !== 'kv')
    .map(
      ([t, table, key]) =>
        `INSERT INTO sync_queue (t, k, changed_ms, seq) SELECT '${t}', ${key}, MAX(${SEEDED_AT[table] ?? '0'}), 0 FROM ${table} GROUP BY ${key};`,
    )
    .join('\n  ');
  return `
  CREATE TABLE sync_queue (t TEXT NOT NULL, k TEXT NOT NULL, changed_ms INTEGER NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY (t, k));
  CREATE INDEX sync_queue_seq ON sync_queue (seq);
  CREATE TABLE sync_pause (id INTEGER PRIMARY KEY NOT NULL);
  CREATE TABLE sync_seq (n INTEGER NOT NULL, ms INTEGER NOT NULL);
  INSERT INTO sync_seq (n, ms) VALUES (0, ${NOW_MS});
  CREATE TABLE sync_kv_allow (key TEXT PRIMARY KEY NOT NULL);
  CREATE TABLE sync_chunks (walk_id TEXT PRIMARY KEY NOT NULL, n INTEGER NOT NULL);
  ${BACKUP_V1.map(([t, table, key]) => backupTriggers(t, table, key)).join('\n')}
  ${first}
  `;
}

/**
 * The phone's SQLite schema, as steps. Each entry runs once, in order; PRAGMA
 * user_version records how many have run. Plain SQL in its own file, so tests
 * can run it against an in-memory database.
 */
export const MIGRATIONS = [
  `
  CREATE TABLE kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE day_summary (
    date TEXT PRIMARY KEY NOT NULL,
    steps INTEGER NOT NULL,
    distance_m INTEGER NOT NULL,
    active_kcal INTEGER NOT NULL,
    active_min INTEGER,
    floors INTEGER,
    goal INTEGER NOT NULL,
    source TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE hour_steps (
    date TEXT NOT NULL,
    hour INTEGER NOT NULL,
    steps INTEGER NOT NULL,
    PRIMARY KEY (date, hour)
  );
  CREATE TABLE weight_log (id TEXT PRIMARY KEY NOT NULL, logged_at INTEGER NOT NULL, value REAL NOT NULL, health_sample_id TEXT);
  CREATE TABLE water_log (id TEXT PRIMARY KEY NOT NULL, logged_at INTEGER NOT NULL, value REAL NOT NULL, health_sample_id TEXT);
  CREATE INDEX weight_log_time ON weight_log (logged_at);
  CREATE INDEX water_log_time ON water_log (logged_at);
  CREATE TABLE achievement (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, value INTEGER NOT NULL, earned_at INTEGER NOT NULL);
  `,
  // Walking context: moods, weather, food and recorded walks. Rows carry ids and
  // timestamps so they can be synced to a server later without reshaping.
  `
  CREATE TABLE mood_log (date TEXT PRIMARY KEY NOT NULL, mood INTEGER NOT NULL, note TEXT, logged_at INTEGER NOT NULL);
  CREATE TABLE day_weather (
    date TEXT PRIMARY KEY NOT NULL,
    temp_max_c REAL NOT NULL,
    temp_min_c REAL NOT NULL,
    precip_mm REAL NOT NULL,
    condition TEXT NOT NULL,
    place TEXT,
    hours TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE food_log (
    id TEXT PRIMARY KEY NOT NULL,
    logged_at INTEGER NOT NULL,
    name TEXT NOT NULL,
    kcal REAL NOT NULL,
    health_sample_id TEXT
  );
  CREATE INDEX food_log_time ON food_log (logged_at);
  CREATE TABLE walk (
    id TEXT PRIMARY KEY NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    distance_m REAL NOT NULL,
    moving_s INTEGER NOT NULL,
    steps INTEGER,
    active_kcal REAL NOT NULL,
    start_place TEXT,
    weather TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX walk_start ON walk (started_at);
  CREATE TABLE walk_point (
    walk_id TEXT NOT NULL,
    t INTEGER NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    accuracy REAL,
    PRIMARY KEY (walk_id, t)
  );
  `,
  // Food from the catalog: the entry keeps food, unit and quantity so portion
  // corrections recalculate it. Foods the person adds live in own_food.
  `
  ALTER TABLE food_log ADD COLUMN food_id TEXT;
  ALTER TABLE food_log ADD COLUMN unit TEXT;
  ALTER TABLE food_log ADD COLUMN quantity REAL;
  CREATE TABLE own_food (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    serving TEXT NOT NULL,
    nutrients TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  `,
  // Sleep, heart rate and blood pressure: typed in, or read from Apple Health / Health Connect.
  `
  CREATE TABLE sleep_log (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    start_at INTEGER NOT NULL,
    end_at INTEGER NOT NULL,
    asleep_min INTEGER NOT NULL,
    rested INTEGER,
    source TEXT NOT NULL,
    health_id TEXT,
    stages TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX sleep_log_date ON sleep_log (date);
  CREATE TABLE heart_day (
    date TEXT PRIMARY KEY NOT NULL,
    resting_bpm REAL,
    avg_bpm REAL,
    min_bpm REAL,
    max_bpm REAL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE bp_log (
    id TEXT PRIMARY KEY NOT NULL,
    logged_at INTEGER NOT NULL,
    systolic INTEGER NOT NULL,
    diastolic INTEGER NOT NULL,
    pulse INTEGER,
    source TEXT NOT NULL,
    health_id TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX bp_log_time ON bp_log (logged_at);
  `,
  // Steps with no known time, and minutes by pace.
  `
  ALTER TABLE day_summary ADD COLUMN untimed_steps INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE day_summary ADD COLUMN walk_min INTEGER;
  ALTER TABLE day_summary ADD COLUMN brisk_min INTEGER;
  ALTER TABLE day_summary ADD COLUMN run_min INTEGER;
  `,
  // Foods the food API worked out (AI estimates and recipes), kept whole so
  // they can be searched and logged again offline.
  `
  CREATE TABLE saved_food (id TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, updated_at INTEGER NOT NULL);
  `,
  // Where each food came from: home-made, dine-in or ordered in, and which
  // restaurant. Entries from before are home-made, the usual case.
  `
  ALTER TABLE food_log ADD COLUMN place TEXT NOT NULL DEFAULT 'home';
  ALTER TABLE food_log ADD COLUMN restaurant TEXT;
  `,
  // Rides, indoor walks at pinned places, vehicle parts and stairs. Walks
  // from before read as outdoor walks, with the distance and steps worked out
  // as they were (distance_from and steps_from NULL). No foreign key with
  // ON DELETE CASCADE on walk_part: saveWalk's INSERT OR REPLACE would
  // delete the parts with it.
  `
  ALTER TABLE walk ADD COLUMN activity TEXT NOT NULL DEFAULT 'walk';
  ALTER TABLE walk ADD COLUMN indoor INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE walk ADD COLUMN place_id TEXT;
  ALTER TABLE walk ADD COLUMN distance_from TEXT;
  ALTER TABLE walk ADD COLUMN steps_from TEXT;
  ALTER TABLE walk ADD COLUMN floors_up INTEGER;
  ALTER TABLE walk ADD COLUMN floors_down INTEGER;
  ALTER TABLE walk ADD COLUMN lift_up INTEGER;
  ALTER TABLE walk ADD COLUMN lift_down INTEGER;
  ALTER TABLE walk ADD COLUMN climb_m REAL;
  ALTER TABLE walk ADD COLUMN top_speed_ms REAL;
  ALTER TABLE walk ADD COLUMN effort TEXT;
  ALTER TABLE walk ADD COLUMN stretches TEXT;
  ALTER TABLE walk_point ADD COLUMN speed REAL;
  ALTER TABLE walk_point ADD COLUMN alt REAL;
  ALTER TABLE walk_point ADD COLUMN part INTEGER;
  CREATE TABLE walk_part (
    walk_id TEXT NOT NULL,
    ord INTEGER NOT NULL,
    start_t INTEGER NOT NULL,
    end_t INTEGER NOT NULL,
    kind TEXT NOT NULL,
    steps INTEGER,
    distance_m REAL NOT NULL,
    moving_s INTEGER NOT NULL,
    top_speed_ms REAL,
    kcal_walk REAL NOT NULL,
    kcal_ride REAL NOT NULL,
    choice TEXT,
    default_keep INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (walk_id, ord)
  );
  CREATE TABLE place (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    radius_m REAL NOT NULL DEFAULT 100,
    last_mode TEXT,
    updated_at INTEGER NOT NULL
  );
  `,
  // Cloud backup (docs/backup.md): triggers queue every changed record in
  // sync_queue, one row per record, and the uploader (src/sync/backup-core.ts)
  // sends them. Nothing is queued while sync_pause has a row (a restore, a
  // reset). Every row that exists already is queued here: the first backup.
  // kv rows are queued only for keys in sync_kv_allow, which the app fills
  // from src/sync/kv-keys.ts on every open (and queues those rows then).
  backupMigration(),
];
