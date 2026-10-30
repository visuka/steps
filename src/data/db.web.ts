/**
 * Repository for the web preview, where there are no step sensors or health
 * platforms. Kept in memory and mirrored to localStorage (when available) so
 * a reload doesn't send the preview back through onboarding.
 */
import type { Achievement } from '@/lib/achievements';
import type { WalkPoint } from '@/lib/walk';
import type { OwnFood } from '@/nutrition/types';

import type { DaySummary, DayWeather, FoodEntry, LogEntry, LogKind, MoodEntry, Repository, Walk } from './types';

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
  walks?: [string, { walk: Walk; points: WalkPoint[] }][];
  ownFoods?: OwnFood[];
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
  const days = new Map<string, DaySummary>(saved?.days);
  const hours = new Map<string, number[]>(saved?.hours);
  const logs: Record<LogKind, LogEntry[]> = saved?.logs ?? { weight: [], water: [] };
  const achievements = new Map<string, Achievement>(saved?.achievements);
  const moods = new Map<string, MoodEntry>(saved?.moods);
  const weather = new Map<string, DayWeather>(saved?.weather);
  let foods: FoodEntry[] = saved?.foods ?? [];
  const walks = new Map<string, { walk: Walk; points: WalkPoint[] }>(saved?.walks);
  let ownFoods: OwnFood[] = saved?.ownFoods ?? [];

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
          ownFoods,
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
      foods.push(entry);
      persist();
    },
    async updateFood(entry) {
      foods = foods.map((f) => (f.id === entry.id ? { ...entry } : f));
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
        .map(({ latest: f }) => ({ name: f.name, kcal: f.kcal, foodId: f.foodId, unit: f.unit, quantity: f.quantity }));
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

    async saveWalk(walk, points) {
      walks.set(walk.id, { walk: { ...walk }, points: points ?? walks.get(walk.id)?.points ?? [] });
      persist();
    },
    async getWalks(limit) {
      return [...walks.values()]
        .map((w) => w.walk)
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, limit);
    },
    async getWalk(id) {
      return walks.get(id) ?? null;
    },
    async deleteWalk(id) {
      walks.delete(id);
      persist();
    },

    async addLog(kind, entry) {
      logs[kind].push(entry);
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
      ownFoods = [];
      persist();
    },
  };
}
