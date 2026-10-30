import type { FoodEntry } from '@/data/types';
import { dayKey } from '@/lib/dates';

import { findFood, nutrientsFor, type PortionOverrides } from './catalog';
import { NUTRIENTS, percentOfDaily, sumNutrients } from './nutrients';
import type { NutrientKey, Nutrients, OwnFood } from './types';

/** What an entry contains, with the person's current portion sizes. Calorie-only entries give just kcal. */
export function entryNutrients(entry: FoodEntry, own: OwnFood[], overrides: PortionOverrides): Nutrients {
  if (entry.foodId && entry.unit && entry.quantity !== null) {
    const food = findFood(entry.foodId, own);
    if (food) return nutrientsFor(food, entry.unit, entry.quantity, overrides);
  }
  return { kcal: entry.kcal };
}

/** Daily totals averaged over the days that have any food logged. */
export function dailyAverage(
  entries: FoodEntry[],
  own: OwnFood[],
  overrides: PortionOverrides,
): { days: number; average: Nutrients } {
  const byDay = new Map<string, Nutrients[]>();
  for (const e of entries) {
    const key = dayKey(new Date(e.loggedAt));
    byDay.set(key, [...(byDay.get(key) ?? []), entryNutrients(e, own, overrides)]);
  }
  const days = byDay.size;
  if (!days) return { days: 0, average: {} };
  const total = sumNutrients([...byDay.values()].map(sumNutrients));
  const average: Nutrients = {};
  for (const [k, v] of Object.entries(total) as [NutrientKey, number][]) average[k] = v / days;
  return { days, average };
}

/** Vitamins, minerals, protein and fibre furthest below their daily value. */
export function lowestNutrients(average: Nutrients, count = 3): { key: NutrientKey; percent: number }[] {
  return NUTRIENTS.filter((n) => n.group === 'vitamin' || n.group === 'mineral' || n.key === 'protein' || n.key === 'fiber')
    .filter((n) => average[n.key] !== undefined)
    .map((n) => ({ key: n.key, percent: percentOfDaily(n.key, average[n.key]!) }))
    .filter((n) => n.percent < 100)
    .sort((a, b) => a.percent - b.percent)
    .slice(0, count);
}
