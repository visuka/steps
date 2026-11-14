import { describe, expect, it } from '@jest/globals';

import { readEstimate, readFoodItem, readRecipe } from '@/api/food-read';
import { DEFAULT_PROFILE } from '@/data/profile';
import type { FoodEntry } from '@/data/types';
import { entryMissing, partialKeys } from '@/nutrition/day';
import { averageOfJudged, type DayIntake, dayIntakes, dayTotals, pickGapNote } from '@/nutrition/gaps';
import { nutrientState, PARTIAL_WORD, spokenNutrient, valueText } from '@/nutrition/state';
import type { FoodItem, NutrientKey, Nutrients } from '@/nutrition/types';
import { nutrientRows, type ViewContext } from '@/nutrition/view';

const TODAY = '2026-11-13';
const NOW = new Date(2026, 10, 13, 20);
const ctx: ViewContext = { sex: 'unspecified', weightKg: 65, heightCm: 165, age: 40, kcalTarget: 2000, plain: false };

/** Endu chepalu with egg curry, before dried anchovy is in the ingredient database (synthetic numbers). */
const curry = (over: Partial<FoodItem> = {}): FoodItem => ({
  id: 'ai:endu-chepalu-egg-curry',
  name: 'Endu chepalu with egg curry',
  aliases: [],
  category: 'dish',
  per100g: { kcal: 160, protein: 12, fat: 10, carbs: 5, calcium: 60, iron: 1.5, vitB12: 0.5, sodium: 500 },
  units: [
    { key: 'bowl', label: 'bowl', grams: 200 },
    { key: 'g', label: 'grams', grams: 1 },
  ],
  defaultUnit: 'bowl',
  source: 'Worked out from its ingredients',
  missing: ['calcium', 'iron', 'vitB12', 'sodium'],
  pending: true,
  ...over,
});

let n = 0;
const entry = (over: Partial<FoodEntry>): FoodEntry => ({
  id: `e${n++}`,
  loggedAt: new Date(2026, 10, 13, 13).getTime(),
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
const book = (saved: FoodItem[]) => ({ own: [], overrides: {}, saved });

describe('reading "missing" and "pending"', () => {
  const raw = (over: Record<string, unknown> = {}) => ({ ...curry(), missing: ['calcium', 'iron', 'iron', 'bogus', 'toString'], ...over });

  it('keeps known nutrient keys once, and the pending mark', () => {
    const food = readFoodItem(raw())!;
    expect(food.missing).toEqual(['calcium', 'iron']);
    expect(food.pending).toBe(true);
    expect(readFoodItem(raw({ missing: 'calcium', pending: 'yes' }))).not.toHaveProperty('missing');
    expect(readFoodItem(raw({ missing: [], pending: false }))).not.toHaveProperty('pending');
  });

  it('takes them from the food or from beside it in an estimate', () => {
    const inFood = readEstimate({ items: [{ food: raw(), unit: 'bowl', quantity: 1 }] });
    expect(inFood.items[0].food.missing).toEqual(['calcium', 'iron']);
    const beside = readEstimate({
      items: [{ food: { ...curry(), missing: undefined, pending: undefined }, unit: 'bowl', quantity: 1, missing: ['vitB12'], pending: true }],
    });
    expect(beside.items[0].food.missing).toEqual(['vitB12']);
    expect(beside.items[0].food.pending).toBe(true);
    const recipe = readRecipe({ food: { ...curry(), missing: undefined }, missing: ['zinc'], servings: 2 });
    expect(recipe.food.missing).toEqual(['zinc']);
  });

  it('keeps a recipe to send again only while pending, and only when it can be sent', () => {
    const recipe = { name: 'Endu chepalu pulusu', ingredients: '100 g dried anchovy, 2 eggs, onion', steps: 'Fry, simmer', servings: 2, unit: 'bowl' };
    expect(readFoodItem({ ...curry({ id: 'recipe:x' }), recipe })!.recipe).toEqual(recipe);
    expect(readFoodItem({ ...curry({ id: 'recipe:x', pending: false }), recipe })).not.toHaveProperty('recipe');
    expect(readFoodItem({ ...curry({ id: 'recipe:x' }), recipe: { ...recipe, unit: 'bucket' } })).not.toHaveProperty('recipe');
    expect(readFoodItem({ ...curry({ id: 'recipe:x' }), recipe: { ...recipe, servings: 0 } })).not.toHaveProperty('recipe');
    // The server never sets it.
    expect(readEstimate({ items: [{ food: { ...curry(), recipe }, unit: 'bowl', quantity: 1 }] }).items[0].food).not.toHaveProperty('recipe');
  });
});

describe('"at least" totals', () => {
  const rice: FoodItem = {
    ...curry({ id: 'ai:rice', name: 'Rice', missing: undefined, pending: undefined }),
    per100g: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, iron: 0.2, calcium: 10 },
  };

  it('marks keys any logged food knows only partly', () => {
    const entries = [
      entry({ foodId: curry().id, unit: 'bowl', quantity: 1, kcal: 320 }),
      entry({ foodId: rice.id, unit: 'bowl', quantity: 1, kcal: 260 }),
      entry({ kcal: 100 }), // calorie-only
    ];
    expect(entryMissing(entries[0], [], [curry(), rice])).toEqual(curry().missing);
    expect(entryMissing(entries[2], [], [curry()])).toEqual([]);
    const t = dayTotals(entries, book([curry(), rice]));
    expect(t.partial).toEqual({ calcium: true, iron: true, vitB12: true, sodium: true });
    expect(t.total.iron).toBeCloseTo(3.4);
    expect(partialKeys(entries.slice(1), [], [curry(), rice])).toEqual({});
  });

  it('shows a partial value as "≥", spoken "at least", and never as complete', () => {
    const [iron] = nutrientRows(['iron'], { iron: 3.4 }, { iron: 1 }, ctx, false, 'percent', { iron: true });
    expect(iron.partial).toBe(true);
    expect(iron.state.atLeast).toBe(true);
    expect(iron.valueText).toBe('≥ 3.4 mg · 19%');
    expect(iron.spoken).toContain('at least 3.4 milligrams');
    const [full] = nutrientRows(['iron'], { iron: 3.4 }, { iron: 1 }, ctx, false, 'percent');
    expect(full.valueText).toBe('3.4 mg · 19%');
  });

  it('keeps unknown apart from zero and from a partial zero', () => {
    const s = nutrientState('vitB12', undefined, { ...ctx, coverage: 0, judged: true, partial: true });
    expect(s.state).toBe('unknown');
    expect(valueText('vitB12', undefined, s)).toBe('Not known');
    const zero = nutrientState('vitB12', 0, { ...ctx, coverage: 1, judged: true, partial: true });
    expect(zero.state).not.toBe('unknown');
    expect(valueText('vitB12', 0, zero)).toBe('≥ 0.0 µg');
  });

  it('never calls a partial figure under the line "Low", even on a judged day', () => {
    const low = nutrientState('iron', 2, { ...ctx, coverage: 1, judged: true, partial: true });
    expect(low.state).toBe('soFar');
    expect(low.word).toBe(PARTIAL_WORD);
    expect(spokenNutrient('iron', 2, low)).toContain('not all counted');
    // Above the line stays above it whatever else is found; over a limit stays over.
    expect(nutrientState('iron', 15, { ...ctx, coverage: 1, judged: true, partial: true }).state).toBe('ok');
    expect(nutrientState('sodium', 2500, { ...ctx, coverage: 1, judged: true, partial: true }).state).toBe('over');
  });

  it('carries partial days into the day list and the week, and keeps them out of gap notes', () => {
    const entries = [entry({ foodId: curry().id, unit: 'bowl', quantity: 1, kcal: 320 })];
    const [day] = dayIntakes(entries, book([curry()]), DEFAULT_PROFILE, { now: NOW });
    expect(day.partial?.iron).toBe(true);

    const judged = (ago: number, total: Nutrients, partial?: Partial<Record<NutrientKey, true>>): DayIntake => {
      const d = new Date(2026, 10, 13 - ago);
      return {
        day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        total: { kcal: 1800, ...total },
        coverage: Object.fromEntries(Object.keys({ kcal: 0, ...total }).map((k) => [k, 1])),
        partial,
        judged: true,
        kcal: 1800,
        entries: 5,
      };
    };
    const lowVitC = [1, 2, 3, 4].map((a) => judged(a, { vitC: 20 }));
    expect(pickGapNote({ days: lowVitC, today: TODAY, profile: DEFAULT_PROFILE, log: {} })?.key).toBe('vitC');
    const partialVitC = [1, 2, 3, 4].map((a) => judged(a, { vitC: 20 }, { vitC: true }));
    expect(pickGapNote({ days: partialVitC, today: TODAY, profile: DEFAULT_PROFILE, log: {} })).toBeNull();

    const week = averageOfJudged([judged(1, { iron: 5 }, { iron: true }), judged(2, { iron: 9 })]);
    expect(week.partial).toEqual({ iron: true });
    expect(week.average.iron).toBe(7);
  });
});
