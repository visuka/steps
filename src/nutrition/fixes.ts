/**
 * Small corrections to the generated catalog, applied when it loads, so the
 * catalog needn't be regenerated. A zero the source data shows only because
 * it never measured the nutrient would read as "known: none"; removing it
 * makes it "not known", which is the truth.
 */
import type { FoodItem, NutrientKey } from './types';

/** Food id → nutrients whose 0 is a gap in the source data, not a measurement. */
export const FAKE_ZEROS: Record<string, NutrientKey[]> = {
  // USDA #175304 (goat, roasted) has no magnesium or B6 figure; goat meat has both.
  mutton: ['magnesium', 'vitB6'],
};

/** Removes the fake zeros in place; returns the same list. */
export function fixCatalog(foods: FoodItem[]): FoodItem[] {
  for (const food of foods) {
    for (const key of FAKE_ZEROS[food.id] ?? []) {
      if (food.per100g[key] === 0) delete food.per100g[key];
    }
  }
  return foods;
}
