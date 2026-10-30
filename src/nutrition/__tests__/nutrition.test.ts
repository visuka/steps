import { describe, expect, it } from '@jest/globals';

import type { FoodEntry } from '@/data/types';
import { findFood, goodSources, nutrientsFor, OWN_PREFIX, portionLabel, searchFoods } from '@/nutrition/catalog';
import { dailyAverage, entryNutrients, lowestNutrients } from '@/nutrition/day';
import { FOODS } from '@/nutrition/foods.generated';
import { percentOfDaily, sumNutrients } from '@/nutrition/nutrients';
import type { OwnFood } from '@/nutrition/types';

const own: OwnFood[] = [
  { id: 'k1', name: 'Rava kesari', serving: 'plate', nutrients: { kcal: 320, protein: 4 }, updatedAt: 0 },
];

const entry = (over: Partial<FoodEntry>): FoodEntry => ({
  id: 'e',
  loggedAt: new Date(2026, 9, 30, 13).getTime(),
  name: 'x',
  foodId: null,
  unit: null,
  quantity: null,
  kcal: 0,
  healthSampleId: null,
  ...over,
});

describe('food catalog', () => {
  it('has unique ids and a default unit for every food', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    for (const f of FOODS) {
      expect(f.units.some((u) => u.key === f.defaultUnit)).toBe(true);
      expect(f.per100g.kcal).toBeGreaterThanOrEqual(0);
    }
  });

  it('finds foods by local names', () => {
    expect(searchFoods('roti', [])[0].id).toBe('chapati');
    expect(searchFoods('dahi', [])[0].id).toBe('curd');
    expect(searchFoods('kela', [])[0].id).toBe('banana');
    expect(searchFoods('surmai', []).map((f) => f.id)).toContain('fish-seer');
    expect(searchFoods('rava', own)[0].id).toBe(`${OWN_PREFIX}k1`);
    expect(searchFoods('  ', [])).toEqual([]);
  });

  it('works out a portion', () => {
    const rice = findFood('rice', [])!;
    // A 150 g bowl of cooked rice at 130 kcal / 100 g.
    expect(nutrientsFor(rice, 'bowl', 1, {}).kcal).toBeCloseTo(195, 0);
    expect(nutrientsFor(rice, 'g', 50, {}).kcal).toBeCloseTo(65, 0);
    expect(portionLabel(rice, 'bowl', 1.5)).toBe('1.5 bowl (katori)');
  });

  it('applies the person’s portion size to past entries too', () => {
    const lunch = entry({ foodId: 'rice', unit: 'bowl', quantity: 1, kcal: 195 });
    expect(entryNutrients(lunch, [], {}).kcal).toBeCloseTo(195, 0);
    expect(entryNutrients(lunch, [], { 'rice:bowl': 200 }).kcal).toBeCloseTo(260, 0);
  });

  it('scales own foods per serving', () => {
    const e = entry({ foodId: `${OWN_PREFIX}k1`, unit: 'serving', quantity: 2 });
    expect(entryNutrients(e, own, {})).toEqual({ kcal: 640, protein: 8 });
  });

  it('keeps calorie-only entries to calories', () => {
    expect(entryNutrients(entry({ kcal: 450 }), [], {})).toEqual({ kcal: 450 });
  });

  it('only sums nutrients that something reported', () => {
    expect(sumNutrients([{ kcal: 100, vitC: 5 }, { kcal: 50 }])).toEqual({ kcal: 150, vitC: 5 });
  });

  it('averages days and finds what is low', () => {
    const days = [29, 30].map((d) =>
      entry({ loggedAt: new Date(2026, 9, d, 9).getTime(), foodId: 'rice', unit: 'bowl', quantity: 2 }),
    );
    const { days: n, average } = dailyAverage(days, [], {});
    expect(n).toBe(2);
    expect(average.kcal).toBeCloseTo(390, 0);
    const low = lowestNutrients(average);
    expect(low).toHaveLength(3);
    expect(low[0].percent).toBeLessThanOrEqual(low[1].percent);
    expect(percentOfDaily('vitC', 45)).toBe(50);
  });

  it('suggests good sources of a nutrient', () => {
    const calcium = goodSources('calcium').map((s) => s.food.category);
    expect(calcium).toContain('dairy');
  });
});
