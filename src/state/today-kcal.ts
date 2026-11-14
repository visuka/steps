import type { FoodEntry } from '@/data/types';
import type { Nutrients } from '@/nutrition/types';

export interface TodayKcal {
  /** Calories eaten today, rounded. */
  eaten: number;
  /** Part of a logged food isn't counted yet, so `eaten` is "at least". */
  partial: boolean;
}

/**
 * The one figure for calories eaten today, shared by Today and the Food tab.
 * `foods` must already be today's. `partial` is the partial-keys map of those foods.
 */
export function todayKcal(input: {
  foods: FoodEntry[];
  nutrientsOf: (entry: FoodEntry) => Nutrients;
  partial: { kcal?: true };
}): TodayKcal {
  const { foods, nutrientsOf, partial } = input;
  let total = 0;
  for (const f of foods) total += nutrientsOf(f).kcal ?? 0;
  return { eaten: Math.round(total), partial: Boolean(partial.kcal) };
}
