import * as SQLite from 'expo-sqlite';

import type { Achievement } from '@/lib/achievements';

import type { DaySummary, LogEntry, LogKind, Repository, SourceId } from './types';

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
    async lifetimeSteps() {
      const row = await db.getFirstAsync<{ total: number | null }>('SELECT SUM(steps) AS total FROM day_summary');
      return row?.total ?? 0;
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
        'DELETE FROM kv; DELETE FROM day_summary; DELETE FROM hour_steps; DELETE FROM weight_log; DELETE FROM water_log; DELETE FROM achievement;',
      );
    },
  };
}
