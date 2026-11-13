/**
 * Repository for the web preview, where there are no step sensors or health
 * platforms. Kept in memory and mirrored to localStorage (when available) so
 * a reload doesn't send the preview back through onboarding.
 */
import { readFoodItem } from '@/api/food-read';
import type { Achievement } from '@/lib/achievements';
import type { Place } from '@/lib/places';
import type { WalkPoint } from '@/lib/walk';
import { applyChoice } from '@/lib/walk-totals';
import { recentRestaurants, whereOf } from '@/nutrition/place';
import type { FoodItem, OwnFood } from '@/nutrition/types';

import { readSnapshotFood } from './food-rows';
import type {
  BloodPressureEntry,
  DaySummary,
  DayWeather,
  FoodEntry,
  HeartDay,
  LogEntry,
  LogKind,
  MoodEntry,
  Repository,
  SleepEntry,
  Walk,
  WalkPart,
} from './types';

const STORAGE_KEY = 'steps-preview-db';

interface Snapshot {
  kv: [string, string][];
  days: [string, DaySummary][];
  hours: [string, number[]][];
  logs: Record<LogKind, LogEntry[]>;
  achievements: [string, Achievement][];
  moods?: [string, MoodEntry][];
  weather?: [string, DayWeather][];
  foods?: FoodEntry[];
  walks?: [string, { walk: Walk; points: WalkPoint[]; parts?: WalkPart[] }][];
  places?: Place[];
  ownFoods?: OwnFood[];
  savedFoods?: FoodItem[];
  sleep?: SleepEntry[];
  heart?: [string, HeartDay][];
  bp?: BloodPressureEntry[];
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export async function openRepository(): Promise<Repository> {
  let saved: Snapshot | null = null;
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    saved = raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    saved = null;
  }

  const kv = new Map<string, string>(saved?.kv);
  // Rows saved before untimed steps and pace minutes existed.
  const days = new Map<string, DaySummary>(
    saved?.days.map(([date, d]) => [date, Object.assign({ untimedSteps: 0, walkMin: null, briskMin: null, runMin: null }, d)]),
  );
  const hours = new Map<string, number[]>(saved?.hours);
  const logs: Record<LogKind, LogEntry[]> = saved?.logs ?? { weight: [], water: [] };
  const achievements = new Map<string, Achievement>(saved?.achievements);
  const moods = new Map<string, MoodEntry>(saved?.moods);
  const weather = new Map<string, DayWeather>(saved?.weather);
  // Entries saved before place and restaurant existed read as home-made.
  let foods: FoodEntry[] = (saved?.foods ?? []).map(readSnapshotFood);
  const walks = new Map<string, { walk: Walk; points: WalkPoint[]; parts?: WalkPart[] }>(saved?.walks);
  let places: Place[] = saved?.places ?? [];
  let ownFoods: OwnFood[] = saved?.ownFoods ?? [];
  // Newest first; checked again like the SQLite rows.
  let savedFoods: FoodItem[] = (saved?.savedFoods ?? []).map(readFoodItem).filter((f): f is FoodItem => f !== null);
  let sleep: SleepEntry[] = saved?.sleep ?? [];
  const heart = new Map<string, HeartDay>(saved?.heart);
  let bp: BloodPressureEntry[] = saved?.bp ?? [];

  // Backfill writes hundreds of rows in a burst; save once after it settles.
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    const store = storage();
    if (!store || flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      try {
        const snapshot: Snapshot = {
          kv: [...kv],
          days: [...days],
          hours: [...hours],
          logs,
          achievements: [...achievements],
          moods: [...moods],
          weather: [...weather],
          foods,
          walks: [...walks],
          places,
          ownFoods,
          savedFoods,
          sleep,
          heart: [...heart],
          bp,
        };
        store.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // Storage full or blocked: the preview still works for this tab.
      }
    }, 300);
  };

  return {
    async getKv<T>(key: string) {
      const v = kv.get(key);
      return v === undefined ? null : (JSON.parse(v) as T);
    },
    async setKv(key, value) {
      kv.set(key, JSON.stringify(value));
      persist();
    },

    async upsertDay(day, hourly) {
      days.set(day.date, { ...day });
      if (hourly) hours.set(day.date, [...hourly]);
      persist();
    },
    async getDay(date) {
      return days.get(date) ?? null;
    },
    async getDays(from, to) {
      return [...days.values()].filter((d) => d.date >= from && d.date <= to).sort((a, b) => (a.date < b.date ? -1 : 1));
    },
    async getHourly(date) {
      return hours.get(date) ?? new Array<number>(24).fill(0);
    },
    async getHourlyRange(from, to) {
      return new Map([...hours].filter(([date]) => date >= from && date <= to));
    },
    async lifetimeSteps() {
      let total = 0;
      for (const d of days.values()) total += d.steps;
      return total;
    },

    async setMood(entry) {
      moods.set(entry.date, { ...entry });
      persist();
    },
    async deleteMood(date) {
      moods.delete(date);
      persist();
    },
    async getMoods(from, to) {
      return [...moods.values()].filter((m) => m.date >= from && m.date <= to).sort((a, b) => (a.date < b.date ? -1 : 1));
    },

    async upsertWeather(w) {
      weather.set(w.date, { ...w });
      persist();
    },
    async getWeather(date) {
      return weather.get(date) ?? null;
    },
    async getWeatherRange(from, to) {
      return [...weather.values()].filter((w) => w.date >= from && w.date <= to).sort((a, b) => (a.date < b.date ? -1 : 1));
    },

    async addFood(entry) {
      foods.push({ ...entry, ...whereOf(entry.place, entry.restaurant) });
      persist();
    },
    async updateFood(entry) {
      foods = foods.map((f) => (f.id === entry.id ? { ...entry, ...whereOf(entry.place, entry.restaurant) } : f));
      persist();
    },
    async deleteFood(id) {
      foods = foods.filter((f) => f.id !== id);
      persist();
    },
    async getFoods(fromMs, toMs) {
      return foods.filter((f) => f.loggedAt >= fromMs && f.loggedAt < toMs).sort((a, b) => b.loggedAt - a.loggedAt);
    },
    async recentFoods(limit) {
      const byKey = new Map<string, { latest: FoodEntry; count: number }>();
      for (const f of foods) {
        const key = f.foodId ?? f.name;
        const seen = byKey.get(key);
        if (!seen) byKey.set(key, { latest: f, count: 1 });
        else {
          seen.count += 1;
          if (f.loggedAt > seen.latest.loggedAt) seen.latest = f;
        }
      }
      return [...byKey.values()]
        .sort((a, b) => b.count - a.count || b.latest.loggedAt - a.latest.loggedAt)
        .slice(0, limit)
        .map(({ latest: f }) => ({
          name: f.name,
          kcal: f.kcal,
          foodId: f.foodId,
          unit: f.unit,
          quantity: f.quantity,
          place: f.place,
          restaurant: f.restaurant,
        }));
    },
    async recentRestaurants(limit) {
      return recentRestaurants(
        foods.filter((f) => f.place !== 'home'),
        limit,
      );
    },

    async getOwnFoods() {
      return [...ownFoods].sort((a, b) => a.name.localeCompare(b.name));
    },
    async saveOwnFood(food) {
      ownFoods = [...ownFoods.filter((f) => f.id !== food.id), { ...food }];
      persist();
    },
    async deleteOwnFood(id) {
      ownFoods = ownFoods.filter((f) => f.id !== id);
      persist();
    },

    async getSavedFoods() {
      return [...savedFoods];
    },
    async saveSavedFood(food) {
      savedFoods = [{ ...food }, ...savedFoods.filter((f) => f.id !== food.id)];
      persist();
    },
    async deleteSavedFood(id) {
      savedFoods = savedFoods.filter((f) => f.id !== id);
      persist();
    },

    async saveWalk(walk, points, parts) {
      const before = walks.get(walk.id);
      walks.set(walk.id, {
        walk: { ...walk },
        points: points ?? before?.points ?? [],
        parts: parts ? parts.map((p) => ({ ...p, walkId: walk.id })) : (before?.parts ?? []),
      });
      persist();
    },
    async getWalks(limit) {
      return [...walks.values()]
        .map((w) => w.walk)
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, limit);
    },
    async getWalk(id) {
      const w = walks.get(id);
      return w ? { walk: w.walk, points: w.points } : null;
    },
    async getWalkParts(walkId) {
      return [...(walks.get(walkId)?.parts ?? [])].sort((a, b) => a.ord - b.ord);
    },
    async setPartChoice(walkId, ord, choice) {
      const w = walks.get(walkId);
      if (!w) return null;
      const next = applyChoice(w.walk, w.parts ?? [], ord, choice);
      if (!next) return w.walk;
      walks.set(walkId, { ...w, walk: next.walk, parts: next.parts });
      persist();
      return next.walk;
    },
    async updateWalk(id, change) {
      const w = walks.get(id);
      if (!w) return null;
      const next = change(w.walk, w.parts ?? []);
      if (!next) return w.walk;
      walks.set(id, { ...w, walk: { ...next.walk }, parts: next.parts ?? w.parts ?? [] });
      persist();
      return next.walk;
    },
    async deleteWalk(id) {
      walks.delete(id);
      persist();
    },

    async getPlaces() {
      return [...places].sort((a, b) => a.name.localeCompare(b.name));
    },
    async savePlace(place) {
      places = [...places.filter((p) => p.id !== place.id), { ...place }];
      persist();
    },
    async deletePlace(id) {
      places = places.filter((p) => p.id !== id);
      for (const [key, w] of walks) if (w.walk.placeId === id) walks.set(key, { ...w, walk: { ...w.walk, placeId: null } });
      persist();
    },

    async saveSleep(entry) {
      sleep = [...sleep.filter((s) => s.id !== entry.id), { ...entry }];
      persist();
    },
    async deleteSleep(id) {
      sleep = sleep.filter((s) => s.id !== id);
      persist();
    },
    async getSleep(from, to) {
      return sleep
        .filter((s) => s.date >= from && s.date <= to)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.startAt - b.startAt));
    },
    async replaceHealthSleep(from, to, entries) {
      sleep = [...sleep.filter((s) => s.source !== 'health' || s.date < from || s.date > to), ...entries];
      persist();
    },

    async upsertHeartDays(list) {
      for (const d of list) heart.set(d.date, { ...d });
      persist();
    },
    async getHeartDays(from, to) {
      return [...heart.values()].filter((d) => d.date >= from && d.date <= to).sort((a, b) => (a.date < b.date ? -1 : 1));
    },

    async saveBloodPressure(entry) {
      bp = [...bp.filter((b) => b.id !== entry.id), { ...entry }];
      persist();
    },
    async deleteBloodPressure(id) {
      bp = bp.filter((b) => b.id !== id);
      persist();
    },
    async getBloodPressure(fromMs, toMs) {
      return bp.filter((b) => b.loggedAt >= fromMs && b.loggedAt < toMs).sort((a, b) => b.loggedAt - a.loggedAt);
    },
    async replaceHealthBloodPressure(fromMs, toMs, entries) {
      bp = [...bp.filter((b) => b.source !== 'health' || b.loggedAt < fromMs || b.loggedAt >= toMs), ...entries];
      persist();
    },

    async addLog(kind, entry) {
      logs[kind].push(entry);
      persist();
    },
    async updateLog(kind, entry) {
      logs[kind] = logs[kind].map((e) => (e.id === entry.id ? { ...entry } : e));
      persist();
    },
    async deleteLog(kind, id) {
      logs[kind] = logs[kind].filter((e) => e.id !== id);
      persist();
    },
    async getLogs(kind, limit) {
      return [...logs[kind]].sort((a, b) => b.loggedAt - a.loggedAt).slice(0, limit);
    },

    async getAchievements() {
      return [...achievements.values()].sort((a, b) => a.earnedAt - b.earnedAt);
    },
    async addAchievements(list) {
      for (const a of list) if (!achievements.has(a.id)) achievements.set(a.id, a);
      persist();
    },

    async clearAll() {
      kv.clear();
      days.clear();
      hours.clear();
      logs.weight = [];
      logs.water = [];
      achievements.clear();
      moods.clear();
      weather.clear();
      foods = [];
      walks.clear();
      places = [];
      ownFoods = [];
      savedFoods = [];
      sleep = [];
      heart.clear();
      bp = [];
      persist();
    },
  };
}
