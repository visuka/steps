import { describe, expect, it } from '@jest/globals';

import type { FoodEntry } from '@/data/types';
import { entryNutrients, partialKeys } from '@/nutrition/day';
import type { FoodItem } from '@/nutrition/types';

import { todayKcal } from '../today-kcal';

const noon = new Date(2026, 10, 14, 12).getTime();

let n = 0;
const entry = (over: Partial<FoodEntry>): FoodEntry => ({
  id: `e${n++}`,
  loggedAt: noon,
  name: 'x',
  foodId: null,
  unit: null,
  quantity: null,
  kcal: 0,
  healthSampleId: null,
  place: 'home',
  restaurant: null,
  ...over,
});

const dal = (over: Partial<FoodItem> = {}): FoodItem => ({
  id: 'ai:dal',
  name: 'Dal',
  aliases: [],
  category: 'dish',
  per100g: { kcal: 100 },
  units: [{ key: 'g', label: 'grams', grams: 1 }],
  defaultUnit: 'g',
  source: 'test',
  ...over,
});

const run = (foods: FoodEntry[], saved: FoodItem[] = []) =>
  todayKcal({
    foods,
    nutrientsOf: (e) => entryNutrients(e, [], {}, saved),
    partial: partialKeys(foods, [], saved),
  });

describe('todayKcal', () => {
  it('counts a calories-only entry', () => {
    expect(run([entry({ kcal: 85 }), entry({ kcal: 100 })])).toEqual({ eaten: 185, partial: false });
  });

  it('counts a catalogued food entry from its portion', () => {
    const foods = [entry({ foodId: 'ai:dal', unit: 'g', quantity: 185, kcal: 185 })];
    expect(run(foods, [dal()]).eaten).toBe(185);
  });

  it('adds both kinds of entry', () => {
    const foods = [entry({ kcal: 85 }), entry({ foodId: 'ai:dal', unit: 'g', quantity: 100, kcal: 100 })];
    expect(run(foods, [dal()]).eaten).toBe(185);
  });

  it('flags partial when part of a food is not counted', () => {
    const foods = [entry({ foodId: 'ai:dal', unit: 'g', quantity: 185, kcal: 185 })];
    expect(run(foods, [dal({ missing: ['kcal'] })]).partial).toBe(true);
  });

  it('rounds', () => {
    expect(run([entry({ kcal: 10.4 }), entry({ kcal: 10.4 })]).eaten).toBe(21);
  });
});
