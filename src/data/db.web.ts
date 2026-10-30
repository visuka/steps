/**
 * Repository for the web preview, where there are no step sensors or health
 * platforms. Kept in memory and mirrored to localStorage (when available) so
 * a reload doesn't send the preview back through onboarding.
 */
import type { Achievement } from '@/lib/achievements';

import type { DaySummary, LogEntry, LogKind, Repository } from './types';

const STORAGE_KEY = 'steps-preview-db';

interface Snapshot {
  kv: [string, string][];
  days: [string, DaySummary][];
  hours: [string, number[]][];
  logs: Record<LogKind, LogEntry[]>;
  achievements: [string, Achievement][];
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
    async lifetimeSteps() {
      let total = 0;
      for (const d of days.values()) total += d.steps;
      return total;
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
      persist();
    },
  };
}
