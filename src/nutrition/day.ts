import type { FoodEntry } from '@/data/types';
import { dayKey } from '@/lib/dates';

import { findFood, nutrientsFor, type PortionOverrides } from './catalog';
import { type NutrientInfo, NUTRIENTS, percentOfDaily, percentOfLimit, sumNutrients } from './nutrients';
import type { FoodItem, NutrientKey, Nutrients, OwnFood } from './types';

/**
 * What an entry contains, with the person's current portion sizes. Calorie-only
 * entries give just kcal, and so does a food that can't be found any more.
 */
export function entryNutrients(
  entry: FoodEntry,
  own: OwnFood[],
  overrides: PortionOverrides,
  saved: FoodItem[] = [],
): Nutrients {
  if (entry.foodId && entry.unit && entry.quantity !== null) {
    const food = findFood(entry.foodId, own, saved);
    if (food) return nutrientsFor(food, entry.unit, entry.quantity, overrides);
  }
  return { kcal: entry.kcal };
}

/** Daily totals averaged over the days that have any food logged. */
export function dailyAverage(
  entries: FoodEntry[],
  own: OwnFood[],
  overrides: PortionOverrides,
  saved: FoodItem[] = [],
): { days: number; average: Nutrients } {
  const byDay = new Map<string, Nutrients[]>();
  for (const e of entries) {
    const key = dayKey(new Date(e.loggedAt));
    byDay.set(key, [...(byDay.get(key) ?? []), entryNutrients(e, own, overrides, saved)]);
  }
  const days = byDay.size;
  if (!days) return { days: 0, average: {} };
  const total = sumNutrients([...byDay.values()].map(sumNutrients));
  const average: Nutrients = {};
  for (const [k, v] of Object.entries(total) as [NutrientKey, number][]) average[k] = v / days;
  return { days, average };
}

/**
 * Vitamins, minerals, protein and fibre furthest below their daily value.
 * Only nutrients with a daily target count: sugars or salt are never "low".
 */
export function lowestNutrients(average: Nutrients, count = 3): { key: NutrientKey; percent: number }[] {
  const low: { key: NutrientKey; percent: number }[] = [];
  for (const n of NUTRIENTS) {
    if (!(n.group === 'vitamin' || n.group === 'mineral' || n.key === 'protein' || n.key === 'fiber')) continue;
    const value = average[n.key];
    const percent = value === undefined ? null : percentOfDaily(n.key, value);
    if (percent !== null && percent < 100) low.push({ key: n.key, percent });
  }
  return low.sort((a, b) => a.percent - b.percent).slice(0, count);
}

/** "Keep low" nutrients at or over their most-per-day limit, furthest over first. */
export function overLimits(totals: Nutrients): { key: NutrientKey; percent: number }[] {
  const over: { key: NutrientKey; percent: number }[] = [];
  for (const n of NUTRIENTS) {
    const value = totals[n.key];
    if (n.group !== 'limit' || n.limit === undefined || value === undefined || value < n.limit) continue;
    over.push({ key: n.key, percent: percentOfLimit(n.key, value) ?? 100 });
  }
  return over.sort((a, b) => b.percent - a.percent);
}

/**
 * Vitamins and minerals split by how the body keeps them: "daily" ones are
 * needed most days, "stored" ones are judged on the week's average.
 */
export function byStorage(): { daily: NutrientInfo[]; stored: NutrientInfo[] } {
  const micros = NUTRIENTS.filter((n) => n.group === 'vitamin' || n.group === 'mineral');
  return {
    daily: micros.filter((n) => n.storage !== 'stored'),
    stored: micros.filter((n) => n.storage === 'stored'),
  };
}
