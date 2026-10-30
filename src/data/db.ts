import * as SQLite from 'expo-sqlite';

import type { Achievement } from '@/lib/achievements';
import type { WalkPoint } from '@/lib/walk';
import type { OwnFood } from '@/nutrition/types';

import type {
  DaySummary,
  DayWeather,
  FoodEntry,
  LogEntry,
  LogKind,
  Mood,
  MoodEntry,
  Repository,
  SourceId,
  Walk,
  WeatherCondition,
} from './types';

/** Each entry runs once, in order; PRAGMA user_version records how many have run. */
const MIGRATIONS = [
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
];

interface DayRow {
  date: string;
  steps: number;
  distance_m: number;
  active_kcal: number;
  active_min: number | null;
  floors: number | null;
  goal: number;
  source: SourceId;
  updated_at: number;
}

interface LogRow {
  id: string;
  logged_at: number;
  value: number;
  health_sample_id: string | null;
}

const toDay = (r: DayRow): DaySummary => ({
  date: r.date,
  steps: r.steps,
  distanceM: r.distance_m,
  activeKcal: r.active_kcal,
  activeMin: r.active_min,
  floors: r.floors,
  goal: r.goal,
  source: r.source,
  updatedAt: r.updated_at,
});

const toLog = (r: LogRow): LogEntry => ({
  id: r.id,
  loggedAt: r.logged_at,
  value: r.value,
  healthSampleId: r.health_sample_id,
});

const logTable = (kind: LogKind) => (kind === 'weight' ? 'weight_log' : 'water_log');

interface WeatherRow {
  date: string;
  temp_max_c: number;
  temp_min_c: number;
  precip_mm: number;
  condition: WeatherCondition;
  place: string | null;
  hours: string;
  updated_at: number;
}

const toWeather = (r: WeatherRow): DayWeather => ({
  date: r.date,
  tempMaxC: r.temp_max_c,
  tempMinC: r.temp_min_c,
  precipMm: r.precip_mm,
  condition: r.condition,
  place: r.place,
  hours: JSON.parse(r.hours) as DayWeather['hours'],
  updatedAt: r.updated_at,
});

interface FoodRow {
  id: string;
  logged_at: number;
  name: string;
  food_id: string | null;
  unit: string | null;
  quantity: number | null;
  kcal: number;
  health_sample_id: string | null;
}

const toFood = (r: FoodRow): FoodEntry => ({
  id: r.id,
  loggedAt: r.logged_at,
  name: r.name,
  foodId: r.food_id,
  unit: r.unit,
  quantity: r.quantity,
  kcal: r.kcal,
  healthSampleId: r.health_sample_id,
});

interface WalkRow {
  id: string;
  started_at: number;
  ended_at: number;
  distance_m: number;
  moving_s: number;
  steps: number | null;
  active_kcal: number;
  start_place: string | null;
  weather: string | null;
  updated_at: number;
}

const toWalk = (r: WalkRow): Walk => ({
  id: r.id,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  distanceM: r.distance_m,
  movingS: r.moving_s,
  steps: r.steps,
  activeKcal: r.active_kcal,
  startPlace: r.start_place,
  weather: r.weather ? (JSON.parse(r.weather) as Walk['weather']) : null,
  updatedAt: r.updated_at,
});

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

export async function openRepository(): Promise<Repository> {
  const db = await SQLite.openDatabaseAsync('steps.db');
  await db.execAsync('PRAGMA journal_mode = WAL');
  await migrate(db);

  return {
    async getKv<T>(key: string) {
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
      return row ? (JSON.parse(row.value) as T) : null;
    },
    async setKv(key, value) {
      await db.runAsync(
        'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        JSON.stringify(value),
      );
    },

    async upsertDay(day, hourly) {
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO day_summary (date, steps, distance_m, active_kcal, active_min, floors, goal, source, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET
             steps = excluded.steps, distance_m = excluded.distance_m, active_kcal = excluded.active_kcal,
             active_min = excluded.active_min, floors = excluded.floors, goal = excluded.goal,
             source = excluded.source, updated_at = excluded.updated_at`,
          day.date,
          day.steps,
          day.distanceM,
          day.activeKcal,
          day.activeMin,
          day.floors,
          day.goal,
          day.source,
          day.updatedAt,
        );
        if (hourly) {
          await db.runAsync('DELETE FROM hour_steps WHERE date = ?', day.date);
          for (let hour = 0; hour < 24; hour++) {
            if (hourly[hour] > 0) {
              await db.runAsync(
                'INSERT INTO hour_steps (date, hour, steps) VALUES (?, ?, ?)',
                day.date,
                hour,
                hourly[hour],
              );
            }
          }
        }
      });
    },
    async getDay(date) {
      const row = await db.getFirstAsync<DayRow>('SELECT * FROM day_summary WHERE date = ?', date);
      return row ? toDay(row) : null;
    },
    async getDays(from, to) {
      const rows = await db.getAllAsync<DayRow>(
        'SELECT * FROM day_summary WHERE date >= ? AND date <= ? ORDER BY date',
        from,
        to,
      );
      return rows.map(toDay);
    },
    async getHourly(date) {
      const rows = await db.getAllAsync<{ hour: number; steps: number }>(
        'SELECT hour, steps FROM hour_steps WHERE date = ?',
        date,
      );
      const hourly = new Array<number>(24).fill(0);
      for (const r of rows) hourly[r.hour] = r.steps;
      return hourly;
    },
    async getHourlyRange(from, to) {
      const rows = await db.getAllAsync<{ date: string; hour: number; steps: number }>(
        'SELECT date, hour, steps FROM hour_steps WHERE date >= ? AND date <= ?',
        from,
        to,
      );
      const byDay = new Map<string, number[]>();
      for (const r of rows) {
        let hourly = byDay.get(r.date);
        if (!hourly) byDay.set(r.date, (hourly = new Array<number>(24).fill(0)));
        hourly[r.hour] = r.steps;
      }
      return byDay;
    },
    async lifetimeSteps() {
      const row = await db.getFirstAsync<{ total: number | null }>('SELECT SUM(steps) AS total FROM day_summary');
      return row?.total ?? 0;
    },

    async setMood(entry) {
      await db.runAsync(
        `INSERT INTO mood_log (date, mood, note, logged_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET mood = excluded.mood, note = excluded.note, logged_at = excluded.logged_at`,
        entry.date,
        entry.mood,
        entry.note,
        entry.loggedAt,
      );
    },
    async getMoods(from, to) {
      const rows = await db.getAllAsync<{ date: string; mood: Mood; note: string | null; logged_at: number }>(
        'SELECT * FROM mood_log WHERE date >= ? AND date <= ? ORDER BY date',
        from,
        to,
      );
      return rows.map((r): MoodEntry => ({ date: r.date, mood: r.mood, note: r.note, loggedAt: r.logged_at }));
    },

    async upsertWeather(w) {
      await db.runAsync(
        `INSERT INTO day_weather (date, temp_max_c, temp_min_c, precip_mm, condition, place, hours, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           temp_max_c = excluded.temp_max_c, temp_min_c = excluded.temp_min_c, precip_mm = excluded.precip_mm,
           condition = excluded.condition, place = excluded.place, hours = excluded.hours, updated_at = excluded.updated_at`,
        w.date,
        w.tempMaxC,
        w.tempMinC,
        w.precipMm,
        w.condition,
        w.place,
        JSON.stringify(w.hours),
        w.updatedAt,
      );
    },
    async getWeather(date) {
      const row = await db.getFirstAsync<WeatherRow>('SELECT * FROM day_weather WHERE date = ?', date);
      return row ? toWeather(row) : null;
    },
    async getWeatherRange(from, to) {
      const rows = await db.getAllAsync<WeatherRow>(
        'SELECT * FROM day_weather WHERE date >= ? AND date <= ? ORDER BY date',
        from,
        to,
      );
      return rows.map(toWeather);
    },

    async addFood(e) {
      await db.runAsync(
        `INSERT INTO food_log (id, logged_at, name, food_id, unit, quantity, kcal, health_sample_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        e.id,
        e.loggedAt,
        e.name,
        e.foodId,
        e.unit,
        e.quantity,
        e.kcal,
        e.healthSampleId,
      );
    },
    async updateFood(e) {
      await db.runAsync(
        'UPDATE food_log SET logged_at = ?, name = ?, food_id = ?, unit = ?, quantity = ?, kcal = ? WHERE id = ?',
        e.loggedAt,
        e.name,
        e.foodId,
        e.unit,
        e.quantity,
        e.kcal,
        e.id,
      );
    },
    async deleteFood(id) {
      await db.runAsync('DELETE FROM food_log WHERE id = ?', id);
    },
    async getFoods(fromMs, toMs) {
      const rows = await db.getAllAsync<FoodRow>(
        'SELECT * FROM food_log WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at DESC',
        fromMs,
        toMs,
      );
      return rows.map(toFood);
    },
    async recentFoods(limit) {
      // With MAX() in the select, SQLite takes the other columns from the latest row: the last portion used.
      const rows = await db.getAllAsync<{
        name: string;
        kcal: number;
        food_id: string | null;
        unit: string | null;
        quantity: number | null;
      }>(
        `SELECT name, kcal, food_id, unit, quantity, MAX(logged_at) AS last
         FROM food_log GROUP BY COALESCE(food_id, name) ORDER BY COUNT(*) DESC, last DESC LIMIT ?`,
        limit,
      );
      return rows.map((r) => ({ name: r.name, kcal: r.kcal, foodId: r.food_id, unit: r.unit, quantity: r.quantity }));
    },

    async getOwnFoods() {
      const rows = await db.getAllAsync<{ id: string; name: string; serving: string; nutrients: string; updated_at: number }>(
        'SELECT * FROM own_food ORDER BY name',
      );
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        serving: r.serving,
        nutrients: JSON.parse(r.nutrients) as OwnFood['nutrients'],
        updatedAt: r.updated_at,
      }));
    },
    async saveOwnFood(f) {
      await db.runAsync(
        'INSERT OR REPLACE INTO own_food (id, name, serving, nutrients, updated_at) VALUES (?, ?, ?, ?, ?)',
        f.id,
        f.name,
        f.serving,
        JSON.stringify(f.nutrients),
        f.updatedAt,
      );
    },
    async deleteOwnFood(id) {
      await db.runAsync('DELETE FROM own_food WHERE id = ?', id);
    },

    async saveWalk(walk, points) {
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT OR REPLACE INTO walk
             (id, started_at, ended_at, distance_m, moving_s, steps, active_kcal, start_place, weather, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          walk.id,
          walk.startedAt,
          walk.endedAt,
          walk.distanceM,
          walk.movingS,
          walk.steps,
          walk.activeKcal,
          walk.startPlace,
          walk.weather ? JSON.stringify(walk.weather) : null,
          walk.updatedAt,
        );
        if (points) {
          await db.runAsync('DELETE FROM walk_point WHERE walk_id = ?', walk.id);
          // An hour's walk is ~1,800 fixes; one prepared statement keeps the save quick.
          const insert = await db.prepareAsync(
            'INSERT OR IGNORE INTO walk_point (walk_id, t, lat, lon, accuracy) VALUES (?, ?, ?, ?, ?)',
          );
          try {
            for (const p of points) await insert.executeAsync(walk.id, p.t, p.lat, p.lon, p.acc);
          } finally {
            await insert.finalizeAsync();
          }
        }
      });
    },
    async getWalks(limit) {
      const rows = await db.getAllAsync<WalkRow>('SELECT * FROM walk ORDER BY started_at DESC LIMIT ?', limit);
      return rows.map(toWalk);
    },
    async getWalk(id) {
      const row = await db.getFirstAsync<WalkRow>('SELECT * FROM walk WHERE id = ?', id);
      if (!row) return null;
      const points = await db.getAllAsync<{ t: number; lat: number; lon: number; accuracy: number | null }>(
        'SELECT t, lat, lon, accuracy FROM walk_point WHERE walk_id = ? ORDER BY t',
        id,
      );
      return { walk: toWalk(row), points: points.map((p): WalkPoint => ({ t: p.t, lat: p.lat, lon: p.lon, acc: p.accuracy })) };
    },
    async deleteWalk(id) {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM walk_point WHERE walk_id = ?', id);
        await db.runAsync('DELETE FROM walk WHERE id = ?', id);
      });
    },

    async addLog(kind, entry) {
      await db.runAsync(
        `INSERT INTO ${logTable(kind)} (id, logged_at, value, health_sample_id) VALUES (?, ?, ?, ?)`,
        entry.id,
        entry.loggedAt,
        entry.value,
        entry.healthSampleId,
      );
    },
    async deleteLog(kind, id) {
      await db.runAsync(`DELETE FROM ${logTable(kind)} WHERE id = ?`, id);
    },
    async getLogs(kind, limit) {
      const rows = await db.getAllAsync<LogRow>(
        `SELECT * FROM ${logTable(kind)} ORDER BY logged_at DESC LIMIT ?`,
        limit,
      );
      return rows.map(toLog);
    },

    async getAchievements() {
      const rows = await db.getAllAsync<{ id: string; kind: Achievement['kind']; value: number; earned_at: number }>(
        'SELECT * FROM achievement ORDER BY earned_at',
      );
      return rows.map((r) => ({ id: r.id, kind: r.kind, value: r.value, earnedAt: r.earned_at }));
    },
    async addAchievements(list) {
      for (const a of list) {
        await db.runAsync(
          'INSERT OR IGNORE INTO achievement (id, kind, value, earned_at) VALUES (?, ?, ?, ?)',
          a.id,
          a.kind,
          a.value,
          a.earnedAt,
        );
      }
    },

    async clearAll() {
      await db.execAsync(
        `DELETE FROM kv; DELETE FROM day_summary; DELETE FROM hour_steps; DELETE FROM weight_log; DELETE FROM water_log;
         DELETE FROM achievement; DELETE FROM mood_log; DELETE FROM day_weather; DELETE FROM food_log;
         DELETE FROM walk_point; DELETE FROM walk; DELETE FROM own_food;`,
      );
    },
  };
}
