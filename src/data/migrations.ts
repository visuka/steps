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
];
