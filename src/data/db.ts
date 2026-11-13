import * as SQLite from 'expo-sqlite';

import { readFoodItem } from '@/api/food-read';
import type { Achievement } from '@/lib/achievements';
import type { Place } from '@/lib/places';
import type { WalkPoint } from '@/lib/walk';
import { applyChoice } from '@/lib/walk-totals';
import { recentRestaurants, whereOf } from '@/nutrition/place';
import type { FoodItem, OwnFood } from '@/nutrition/types';

import { type FoodRow, toFood } from './food-rows';
import { MIGRATIONS } from './migrations';
import { type PlaceRow, toPart, toPlace, toWalk, type WalkPartRow, type WalkRow } from './walk-rows';
import type {
  BloodPressureEntry,
  DaySummary,
  DayWeather,
  HeartDay,
  LogEntry,
  LogKind,
  Mood,
  MoodEntry,
  Repository,
  SleepEntry,
  SleepStages,
  SourceId,
  VitalSource,
  Walk,
  WalkPart,
  WeatherCondition,
} from './types';

interface DayRow {
  date: string;
  steps: number;
  untimed_steps: number;
  distance_m: number;
  active_kcal: number;
  active_min: number | null;
  walk_min: number | null;
  brisk_min: number | null;
  run_min: number | null;
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
  untimedSteps: r.untimed_steps,
  distanceM: r.distance_m,
  activeKcal: r.active_kcal,
  activeMin: r.active_min,
  walkMin: r.walk_min,
  briskMin: r.brisk_min,
  runMin: r.run_min,
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

interface SleepRow {
  id: string;
  date: string;
  start_at: number;
  end_at: number;
  asleep_min: number;
  rested: Mood | null;
  source: VitalSource;
  health_id: string | null;
  stages: string | null;
  updated_at: number;
}

const toSleep = (r: SleepRow): SleepEntry => ({
  id: r.id,
  date: r.date,
  startAt: r.start_at,
  endAt: r.end_at,
  asleepMin: r.asleep_min,
  rested: r.rested,
  source: r.source,
  healthId: r.health_id,
  stages: r.stages ? (JSON.parse(r.stages) as SleepStages) : null,
  updatedAt: r.updated_at,
});

interface BpRow {
  id: string;
  logged_at: number;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  source: VitalSource;
  health_id: string | null;
  updated_at: number;
}

const toBp = (r: BpRow): BloodPressureEntry => ({
  id: r.id,
  loggedAt: r.logged_at,
  systolic: r.systolic,
  diastolic: r.diastolic,
  pulse: r.pulse,
  source: r.source,
  healthId: r.health_id,
  updatedAt: r.updated_at,
});

/** Checked again on the way out, so a row from an older app version (or a bad write) can't break a screen. */
function parseSavedFood(json: string): FoodItem | null {
  try {
    return readFoodItem(JSON.parse(json));
  } catch {
    return null;
  }
}

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const next = version + 1;
    // The version is written in the same transaction as the migration: killed
    // in between, the next launch would run the ALTERs again and fail with
    // "duplicate column", and the app wouldn't open.
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

export async function openRepository(): Promise<Repository> {
  const db = await SQLite.openDatabaseAsync('steps.db');
  await db.execAsync('PRAGMA journal_mode = WAL');
  await migrate(db);

  const insertSleep = (s: SleepEntry) =>
    db.runAsync(
      `INSERT OR REPLACE INTO sleep_log
         (id, date, start_at, end_at, asleep_min, rested, source, health_id, stages, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s.id,
      s.date,
      s.startAt,
      s.endAt,
      s.asleepMin,
      s.rested,
      s.source,
      s.healthId,
      s.stages ? JSON.stringify(s.stages) : null,
      s.updatedAt,
    );

  // Walk writes run one at a time, so a step refresh and a keep/remove tapped
  // meanwhile can't interleave their reads and writes.
  let walkQueue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = walkQueue.then(task, task);
    walkQueue = run.catch(() => undefined);
    return run;
  };

  const writeWalk = async (walk: Walk, points?: WalkPoint[], parts?: WalkPart[]) => {
    // Every column, with the NOT NULL ones filled in: a column left out of
    // INSERT OR REPLACE goes back to its default (a ride would turn back
    // into a walk), and NULL into a NOT NULL column fails.
    await db.runAsync(
      `INSERT OR REPLACE INTO walk
         (id, started_at, ended_at, distance_m, moving_s, steps, active_kcal, start_place, weather, updated_at,
          activity, indoor, place_id, distance_from, steps_from, floors_up, floors_down, lift_up, lift_down,
          climb_m, top_speed_ms, effort, stretches)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      walk.activity ?? 'walk',
      walk.indoor ? 1 : 0,
      walk.placeId ?? null,
      walk.distanceFrom ?? null,
      walk.stepsFrom ?? null,
      walk.floorsUp ?? null,
      walk.floorsDown ?? null,
      walk.liftUp ?? null,
      walk.liftDown ?? null,
      walk.climbM ?? null,
      walk.topSpeedMs ?? null,
      walk.effort ?? null,
      walk.stretches ? JSON.stringify(walk.stretches) : null,
    );
    if (points) {
      await db.runAsync('DELETE FROM walk_point WHERE walk_id = ?', walk.id);
      // An hour's walk is ~1,800 fixes; one prepared statement keeps the save quick.
      const insert = await db.prepareAsync(
        'INSERT OR IGNORE INTO walk_point (walk_id, t, lat, lon, accuracy, speed, alt, part) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      );
      try {
        for (const p of points) {
          await insert.executeAsync(walk.id, p.t, p.lat, p.lon, p.acc, p.speed ?? null, p.alt ?? null, p.part ?? null);
        }
      } finally {
        await insert.finalizeAsync();
      }
    }
    if (parts) {
      await db.runAsync('DELETE FROM walk_part WHERE walk_id = ?', walk.id);
      for (const p of parts) {
        await db.runAsync(
          `INSERT OR REPLACE INTO walk_part
             (walk_id, ord, start_t, end_t, kind, steps, distance_m, moving_s, top_speed_ms, kcal_walk, kcal_ride, choice, default_keep)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          walk.id,
          p.ord,
          p.startT,
          p.endT,
          p.kind,
          p.steps,
          p.distanceM,
          p.movingS,
          p.topSpeedMs,
          p.kcalWalk,
          p.kcalRide,
          p.choice,
          p.defaultKeep ? 1 : 0,
        );
      }
    }
  };

  const readWalk = async (id: string) => {
    const row = await db.getFirstAsync<WalkRow>('SELECT * FROM walk WHERE id = ?', id);
    return row ? toWalk(row) : null;
  };
  const readParts = async (walkId: string) =>
    (await db.getAllAsync<WalkPartRow>('SELECT * FROM walk_part WHERE walk_id = ? ORDER BY ord', walkId)).map(toPart);

  const updateWalk = (id: string, change: (walk: Walk, parts: WalkPart[]) => { walk: Walk; parts?: WalkPart[] } | null) =>
    serial(async () => {
      let saved: Walk | null = null;
      await db.withTransactionAsync(async () => {
        const walk = await readWalk(id);
        if (!walk) return;
        const next = change(walk, await readParts(id));
        if (!next) {
          saved = walk;
          return;
        }
        await writeWalk(next.walk, undefined, next.parts);
        saved = next.walk;
      });
      return saved as Walk | null;
    });

  const insertBp = (b: BloodPressureEntry) =>
    db.runAsync(
      `INSERT OR REPLACE INTO bp_log (id, logged_at, systolic, diastolic, pulse, source, health_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      b.id,
      b.loggedAt,
      b.systolic,
      b.diastolic,
      b.pulse,
      b.source,
      b.healthId,
      b.updatedAt,
    );

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
          `INSERT INTO day_summary (date, steps, untimed_steps, distance_m, active_kcal, active_min, walk_min, brisk_min,
             run_min, floors, goal, source, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET
             steps = excluded.steps, untimed_steps = excluded.untimed_steps, distance_m = excluded.distance_m,
             active_kcal = excluded.active_kcal, active_min = excluded.active_min, walk_min = excluded.walk_min,
             brisk_min = excluded.brisk_min, run_min = excluded.run_min, floors = excluded.floors, goal = excluded.goal,
             source = excluded.source, updated_at = excluded.updated_at`,
          day.date,
          day.steps,
          day.untimedSteps,
          day.distanceM,
          day.activeKcal,
          day.activeMin,
          day.walkMin,
          day.briskMin,
          day.runMin,
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
    async deleteMood(date) {
      await db.runAsync('DELETE FROM mood_log WHERE date = ?', date);
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
      const w = whereOf(e.place, e.restaurant);
      await db.runAsync(
        `INSERT INTO food_log (id, logged_at, name, food_id, unit, quantity, kcal, health_sample_id, place, restaurant)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        e.id,
        e.loggedAt,
        e.name,
        e.foodId,
        e.unit,
        e.quantity,
        e.kcal,
        e.healthSampleId,
        w.place,
        w.restaurant,
      );
    },
    async updateFood(e) {
      const w = whereOf(e.place, e.restaurant);
      await db.runAsync(
        `UPDATE food_log SET logged_at = ?, name = ?, food_id = ?, unit = ?, quantity = ?, kcal = ?, health_sample_id = ?,
           place = ?, restaurant = ?
         WHERE id = ?`,
        e.loggedAt,
        e.name,
        e.foodId,
        e.unit,
        e.quantity,
        e.kcal,
        e.healthSampleId,
        w.place,
        w.restaurant,
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
        place: string | null;
        restaurant: string | null;
      }>(
        `SELECT name, kcal, food_id, unit, quantity, place, restaurant, MAX(logged_at) AS last
         FROM food_log GROUP BY COALESCE(food_id, name) ORDER BY COUNT(*) DESC, last DESC LIMIT ?`,
        limit,
      );
      return rows.map((r) => ({
        name: r.name,
        kcal: r.kcal,
        foodId: r.food_id,
        unit: r.unit,
        quantity: r.quantity,
        ...whereOf(r.place, r.restaurant),
      }));
    },
    async recentRestaurants(limit) {
      // Spellings differ ("Paradise", "paradise "); a few extra rows leave room to merge them.
      const rows = await db.getAllAsync<{ restaurant: string; last: number }>(
        `SELECT restaurant, MAX(logged_at) AS last FROM food_log
         WHERE restaurant IS NOT NULL AND place != 'home' GROUP BY restaurant ORDER BY last DESC LIMIT ?`,
        limit * 4,
      );
      return recentRestaurants(
        rows.map((r) => ({ restaurant: r.restaurant, loggedAt: r.last })),
        limit,
      );
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

    async getSavedFoods() {
      const rows = await db.getAllAsync<{ json: string }>('SELECT json FROM saved_food ORDER BY updated_at DESC');
      return rows.map((r) => parseSavedFood(r.json)).filter((f): f is FoodItem => f !== null);
    },
    async saveSavedFood(food) {
      await db.runAsync(
        'INSERT OR REPLACE INTO saved_food (id, json, updated_at) VALUES (?, ?, ?)',
        food.id,
        JSON.stringify(food),
        Date.now(),
      );
    },
    async deleteSavedFood(id) {
      await db.runAsync('DELETE FROM saved_food WHERE id = ?', id);
    },

    async saveWalk(walk, points, parts) {
      await serial(() => db.withTransactionAsync(() => writeWalk(walk, points, parts)));
    },
    async getWalks(limit) {
      const rows = await db.getAllAsync<WalkRow>('SELECT * FROM walk ORDER BY started_at DESC LIMIT ?', limit);
      return rows.map(toWalk);
    },
    async getWalk(id) {
      const row = await db.getFirstAsync<WalkRow>('SELECT * FROM walk WHERE id = ?', id);
      if (!row) return null;
      const points = await db.getAllAsync<{
        t: number;
        lat: number;
        lon: number;
        accuracy: number | null;
        speed: number | null;
        alt: number | null;
        part: number | null;
      }>('SELECT t, lat, lon, accuracy, speed, alt, part FROM walk_point WHERE walk_id = ? ORDER BY t', id);
      return {
        walk: toWalk(row),
        points: points.map(
          (p): WalkPoint => ({ t: p.t, lat: p.lat, lon: p.lon, acc: p.accuracy, speed: p.speed, alt: p.alt, part: p.part }),
        ),
      };
    },
    async getWalkParts(walkId) {
      return readParts(walkId);
    },
    async setPartChoice(walkId, ord, choice) {
      return updateWalk(walkId, (walk, parts) => applyChoice(walk, parts, ord, choice));
    },
    updateWalk,
    async deleteWalk(id) {
      await serial(() =>
        db.withTransactionAsync(async () => {
          await db.runAsync('DELETE FROM walk_point WHERE walk_id = ?', id);
          await db.runAsync('DELETE FROM walk_part WHERE walk_id = ?', id);
          await db.runAsync('DELETE FROM walk WHERE id = ?', id);
        }),
      );
    },

    async getPlaces() {
      return (await db.getAllAsync<PlaceRow>('SELECT * FROM place ORDER BY name')).map(toPlace);
    },
    async savePlace(place: Place) {
      await db.runAsync(
        'INSERT OR REPLACE INTO place (id, name, lat, lon, radius_m, last_mode, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        place.id,
        place.name,
        place.lat,
        place.lon,
        place.radiusM,
        place.lastMode,
        place.updatedAt,
      );
    },
    async deletePlace(id) {
      await serial(() =>
        db.withTransactionAsync(async () => {
          // Past walks keep the place's name as their start_place.
          await db.runAsync('UPDATE walk SET place_id = NULL WHERE place_id = ?', id);
          await db.runAsync('DELETE FROM place WHERE id = ?', id);
        }),
      );
    },

    async saveSleep(s) {
      await insertSleep(s);
    },
    async deleteSleep(id) {
      await db.runAsync('DELETE FROM sleep_log WHERE id = ?', id);
    },
    async getSleep(from, to) {
      const rows = await db.getAllAsync<SleepRow>(
        'SELECT * FROM sleep_log WHERE date >= ? AND date <= ? ORDER BY date, start_at',
        from,
        to,
      );
      return rows.map(toSleep);
    },
    async replaceHealthSleep(from, to, entries) {
      await db.withTransactionAsync(async () => {
        await db.runAsync("DELETE FROM sleep_log WHERE source = 'health' AND date >= ? AND date <= ?", from, to);
        for (const s of entries) await insertSleep(s);
      });
    },

    async upsertHeartDays(days) {
      await db.withTransactionAsync(async () => {
        for (const d of days) {
          await db.runAsync(
            'INSERT OR REPLACE INTO heart_day (date, resting_bpm, avg_bpm, min_bpm, max_bpm, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            d.date,
            d.restingBpm,
            d.avgBpm,
            d.minBpm,
            d.maxBpm,
            d.updatedAt,
          );
        }
      });
    },
    async getHeartDays(from, to) {
      const rows = await db.getAllAsync<{
        date: string;
        resting_bpm: number | null;
        avg_bpm: number | null;
        min_bpm: number | null;
        max_bpm: number | null;
        updated_at: number;
      }>('SELECT * FROM heart_day WHERE date >= ? AND date <= ? ORDER BY date', from, to);
      return rows.map(
        (r): HeartDay => ({
          date: r.date,
          restingBpm: r.resting_bpm,
          avgBpm: r.avg_bpm,
          minBpm: r.min_bpm,
          maxBpm: r.max_bpm,
          updatedAt: r.updated_at,
        }),
      );
    },

    async saveBloodPressure(b) {
      await insertBp(b);
    },
    async deleteBloodPressure(id) {
      await db.runAsync('DELETE FROM bp_log WHERE id = ?', id);
    },
    async getBloodPressure(fromMs, toMs) {
      const rows = await db.getAllAsync<BpRow>(
        'SELECT * FROM bp_log WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at DESC',
        fromMs,
        toMs,
      );
      return rows.map(toBp);
    },
    async replaceHealthBloodPressure(fromMs, toMs, entries) {
      await db.withTransactionAsync(async () => {
        await db.runAsync("DELETE FROM bp_log WHERE source = 'health' AND logged_at >= ? AND logged_at < ?", fromMs, toMs);
        for (const b of entries) await insertBp(b);
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
    async updateLog(kind, entry) {
      await db.runAsync(
        `UPDATE ${logTable(kind)} SET logged_at = ?, value = ?, health_sample_id = ? WHERE id = ?`,
        entry.loggedAt,
        entry.value,
        entry.healthSampleId,
        entry.id,
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
         DELETE FROM walk_point; DELETE FROM walk_part; DELETE FROM walk; DELETE FROM place; DELETE FROM own_food; DELETE FROM sleep_log; DELETE FROM heart_day;
         DELETE FROM bp_log; DELETE FROM saved_food;`,
      );
    },
  };
}
