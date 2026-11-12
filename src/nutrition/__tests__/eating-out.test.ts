import { describe, expect, it } from '@jest/globals';

import type { FoodEntry, FoodPlace } from '@/data/types';
import { eatingOut, eatingOutSummary, MEAL_MIN_KCAL, MEAL_SPAN_MIN, meals, MIN_MEALS } from '@/nutrition/eating-out';
import type { Nutrients } from '@/nutrition/types';

const DAY = 86_400_000;
const MIN = 60_000;
const start = new Date(2026, 10, 2, 13).getTime();

let next = 0;
/** One food: its nutrients ride along in a map the test's nutrientsOf reads. */
const contents = new Map<string, Nutrients>();
const food = (at: number, place: FoodPlace, n: Nutrients, restaurant: string | null = null): FoodEntry => {
  const id = `e${next++}`;
  contents.set(id, n);
  return {
    id,
    loggedAt: at,
    name: id,
    foodId: null,
    unit: null,
    quantity: null,
    kcal: n.kcal ?? 0,
    healthSampleId: null,
    place,
    restaurant,
  };
};
const nutrientsOf = (e: FoodEntry) => contents.get(e.id)!;

/** `count` meals a day apart from one place, each one food. */
const days = (count: number, place: FoodPlace, n: Nutrients, from = start) =>
  Array.from({ length: count }, (_, i) => food(from + i * DAY, place, n));

describe('meals', () => {
  it('groups foods from one place within an hour into one meal', () => {
    const biryani = food(start, 'dine-in', { kcal: 600, sodium: 1200, satFat: 10 }, 'Paradise');
    const raita = food(start + 10 * MIN, 'dine-in', { kcal: 100, sodium: 200, satFat: 2 }, 'paradise');
    const later = food(start + (MEAL_SPAN_MIN + 1) * MIN, 'dine-in', { kcal: 300, sodium: 500, satFat: 4 }, 'Paradise');
    const m = meals([later, raita, biryani], nutrientsOf);
    expect(m).toHaveLength(2);
    expect(m[0]).toEqual({ out: true, at: start, nutrients: { kcal: 700, sodium: 1400, satFat: 12 } });
  });

  it('keeps different places apart, even at the same time', () => {
    const m = meals(
      [
        food(start, 'dine-in', { kcal: 500 }, 'Paradise'),
        food(start + MIN, 'delivery', { kcal: 500 }),
        food(start + 2 * MIN, 'home', { kcal: 500 }),
      ],
      nutrientsOf,
    );
    expect(m.map((x) => x.out)).toEqual([true, true, false]);
  });

  it('leaves out tea and snacks under a meal', () => {
    const m = meals([food(start, 'home', { kcal: MEAL_MIN_KCAL - 1 }), food(start + DAY, 'home', { kcal: MEAL_MIN_KCAL })], nutrientsOf);
    expect(m).toHaveLength(1);
  });

  it('treats a nutrient one food lacks as unknown for the meal, not lower', () => {
    const m = meals([food(start, 'home', { kcal: 400, sodium: 600 }), food(start + MIN, 'home', { kcal: 200 })], nutrientsOf);
    expect(m[0].nutrients).toEqual({ kcal: 600 });
  });
});

describe('eating out against home-made', () => {
  const out = { kcal: 900, sodium: 1800, satFat: 15 };
  const home = { kcal: 500, sodium: 700, satFat: 5 };

  it(`compares only with at least ${MIN_MEALS} meals of each`, () => {
    const few = eatingOut([...days(MIN_MEALS - 1, 'dine-in', out), ...days(5, 'home', home)], nutrientsOf);
    expect(few).toEqual({ out: MIN_MEALS - 1, home: 5, averages: [] });

    const fewHome = eatingOut([...days(5, 'delivery', out), ...days(MIN_MEALS - 1, 'home', home)], nutrientsOf);
    expect(fewHome.averages).toEqual([]);

    const enough = eatingOut([...days(MIN_MEALS, 'dine-in', out), ...days(MIN_MEALS, 'home', home)], nutrientsOf);
    expect(enough).toEqual({
      out: MIN_MEALS,
      home: MIN_MEALS,
      averages: [
        { key: 'kcal', out: 900, home: 500 },
        { key: 'sodium', out: 1800, home: 700 },
        { key: 'satFat', out: 15, home: 5 },
      ],
    });
  });

  it('counts dine-in and ordered in together as eating out', () => {
    const r = eatingOut(
      [...days(2, 'dine-in', out), ...days(1, 'delivery', out, start + 5 * DAY), ...days(3, 'home', home)],
      nutrientsOf,
    );
    expect(r.out).toBe(3);
    expect(r.averages.map((a) => a.key)).toEqual(['kcal', 'sodium', 'satFat']);
  });

  it('leaves out a nutrient too few meals know', () => {
    const calorieOnly = { kcal: 800 };
    const r = eatingOut(
      [...days(2, 'dine-in', out), ...days(1, 'dine-in', calorieOnly, start + 5 * DAY), ...days(3, 'home', home)],
      nutrientsOf,
    );
    expect(r.averages).toEqual([{ key: 'kcal', out: (900 * 2 + 800) / 3, home: 500 }]);
  });

  it('says how many in plain words', () => {
    expect(eatingOutSummary({ out: 1, home: 9, averages: [] })).toBe('1 meal eaten out (dine-in or ordered in) and 9 home-made.');
    expect(eatingOutSummary({ out: 4, home: 0, averages: [] })).toBe('4 meals eaten out (dine-in or ordered in) and 0 home-made.');
  });
});
