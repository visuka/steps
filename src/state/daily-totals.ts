/** The adding up behind the Week and Month charts (use-daily-totals.ts), kept apart so jest can check it. */

import { addDaysToKey } from '@/lib/dates';

export type TotalsKind = 'steps' | 'active' | 'food' | 'water' | 'sleep' | 'walk';

export interface DayTotal {
  /** YYYY-MM-DD. */
  key: string;
  /** Steps, active minutes, kcal, ml, minutes asleep, or metres walked. */
  value: number;
}

/** The `days` day keys ending on `today`, oldest first. */
export function dayKeysEnding(today: string, days: number): string[] {
  return Array.from({ length: Math.max(1, days) }, (_, i) => addDaysToKey(today, i - (days - 1)));
}

/** Adds each item's value to its day; days with nothing are 0 and days outside are left out. */
export function totalsByDay<T>(keys: readonly string[], items: readonly T[], dayOf: (item: T) => string, valueOf: (item: T) => number): DayTotal[] {
  const sums = new Map(keys.map((k) => [k, 0]));
  for (const item of items) {
    const k = dayOf(item);
    const v = valueOf(item);
    if (sums.has(k) && Number.isFinite(v) && v > 0) sums.set(k, (sums.get(k) ?? 0) + v);
  }
  return keys.map((key) => ({ key, value: sums.get(key) ?? 0 }));
}

/** The average of the days that have something, or 0. */
export function averageOfLogged(totals: readonly DayTotal[]): number {
  const logged = totals.filter((t) => t.value > 0);
  return logged.length ? logged.reduce((s, t) => s + t.value, 0) / logged.length : 0;
}
