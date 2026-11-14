import { describe, expect, it } from '@jest/globals';

import { readFoodItem } from '@/api/food-read';
import { searchFoods } from '@/nutrition/catalog';
import {
  activeMineIds,
  mineFood,
  mineFor,
  myDishesAfterConfirm,
  myDishesAfterReset,
  nextMineId,
  NO_DISHES,
  readMyDishes,
  recipeTextFor,
  sameIngredients,
  scaledUnits,
  searchWithMine,
  startAmount,
  validIngredients,
  withMine,
} from '@/nutrition/my-dishes';
import { refreshedFood, refreshQuery } from '@/nutrition/pending';
import type { FoodItem } from '@/nutrition/types';

const original: FoodItem = {
  id: 'ai:upma',
  name: 'Upma',
  aliases: ['uppittu'],
  category: 'dish',
  per100g: { kcal: 120 },
  units: [
    { key: 'bowl', label: 'bowl', grams: 200 },
    { key: 'g', label: 'grams', grams: 1 },
  ],
  defaultUnit: 'bowl',
  source: 'Worked out from its ingredients',
  ingredients: [
    { name: 'Rava', grams: 60 },
    { name: 'Oil', grams: 10 },
  ],
  style: 'home',
};
const edited = [
  { name: 'Rava', grams: 90 },
  { name: 'Oil', grams: 30 },
];
const answer: FoodItem = { ...original, id: 'recipe:x', per100g: { kcal: 200 }, ingredients: [{ name: 'Server', grams: 1 }] };
const mine = (id = 'mine:1') =>
  mineFood({ current: original, ingredients: edited, answer, id, request: recipeTextFor(original, edited) });

describe('the recipe text', () => {
  it('has the name, one line per ingredient, and home or restaurant', () => {
    const r = recipeTextFor(original, edited);
    expect(r).toMatchObject({ name: 'Upma', ingredients: 'Rava 90 g\nOil 30 g', steps: 'Upma (home)', servings: 1, unit: 'bowl' });
    expect(recipeTextFor({ ...original, defaultUnit: 'thali' }, edited).unit).toBe('serving');
    expect(recipeTextFor({ ...original, style: 'restaurant' }, edited).steps).toBe('Upma (restaurant)');
  });
});

describe('limits', () => {
  const ok = { name: 'Rava', grams: 5 };
  it('accepts 1 to 30 ingredients', () => {
    expect(validIngredients([ok]).problem).toBeNull();
    expect(validIngredients([]).problem).toMatch(/at least one/);
    expect(validIngredients(Array.from({ length: 31 }, () => ok)).problem).toMatch(/at most 30/);
  });
  it('wants names of 1 to 60 characters, trimmed', () => {
    expect(validIngredients([{ name: '   ', grams: 5 }]).problem).toMatch(/needs a name/);
    expect(validIngredients([{ name: 'a'.repeat(61), grams: 5 }]).problem).toMatch(/60/);
    expect(validIngredients([{ name: '  Rava  ', grams: 5 }]).ingredients[0].name).toBe('Rava');
  });
  it('wants whole grams from 1 to 2,000', () => {
    for (const grams of [0, 2001, 1.5, NaN]) expect(validIngredients([{ name: 'a', grams }]).problem).toMatch(/whole grams/);
    expect(validIngredients([{ name: 'a', grams: 2000 }]).problem).toBeNull();
  });
  it('refuses a list too long to send', () => {
    const long = Array.from({ length: 30 }, () => ({ name: 'x'.repeat(60), grams: 1000 }));
    expect(validIngredients(long).problem).toMatch(/too long/);
  });
});

describe('unit scaling', () => {
  it('scales the default unit by the new total, to the nearest 5 g, at least 5', () => {
    // 70 g to 120 g: 200 x 120 / 70 = 342.9, so 345
    expect(scaledUnits(original, original.ingredients, edited).map((u) => u.grams)).toEqual([345, 1]);
    expect(scaledUnits(original, original.ingredients, [{ name: 'a', grams: 1 }])[0].grams).toBe(5);
  });
  it('keeps units when the total is the same or unknown', () => {
    expect(scaledUnits(original, original.ingredients, original.ingredients!)[0].grams).toBe(200);
    expect(scaledUnits(original, undefined, edited)[0].grams).toBe(200);
  });
});

describe("the person's version", () => {
  it('is its own food, with the typed list and the answer numbers', () => {
    const m = mine();
    expect(m).toMatchObject({ id: 'mine:1', source: 'mine', basedOn: 'ai:upma', name: 'Upma', per100g: { kcal: 200 } });
    expect(m.ingredients).toEqual(edited);
    expect(m.aliases).toEqual(['uppittu']);
  });
  it('stays based on the first original when edited again', () => {
    const again = mineFood({ current: mine(), ingredients: edited, answer, id: 'mine:1', request: recipeTextFor(original, edited) });
    expect(again.basedOn).toBe('ai:upma');
  });
  it('is read back from the phone with basedOn, and a server food cannot carry one', () => {
    expect(readFoodItem(JSON.parse(JSON.stringify(mine())))?.basedOn).toBe('ai:upma');
    expect(readFoodItem({ ...JSON.parse(JSON.stringify(original)), basedOn: 'x' })?.basedOn).toBeUndefined();
  });
  it('compares lists ignoring case and spaces', () => {
    expect(sameIngredients(edited, [{ name: ' rava ', grams: 90 }, { name: 'OIL', grams: 30 }])).toBe(true);
    expect(sameIngredients(edited, original.ingredients!)).toBe(false);
  });
});

describe('mappings', () => {
  const d = myDishesAfterConfirm(NO_DISHES, { basedOn: 'ai:upma', mineId: 'mine:1', text: '  Uppittu!! ' });
  it('match typed text by its normalised form, and a dish by its id', () => {
    expect(mineFor(d, { text: 'uppittu' })).toBe('mine:1');
    expect(mineFor(d, { foodId: 'ai:upma' })).toBe('mine:1');
    expect(mineFor(d, { text: 'idli', foodId: 'x' })).toBeNull();
  });
  it('are removed by "use our guess again"', () => {
    const r = myDishesAfterReset(d, 'mine:1');
    expect(mineFor(r, { text: 'uppittu', foodId: 'ai:upma' })).toBeNull();
    expect(activeMineIds(r).size).toBe(0);
  });
  it('are read safely', () => {
    const proto = JSON.parse('{"__proto__":"mine:3"}');
    expect(readMyDishes(null)).toEqual(NO_DISHES);
    expect(readMyDishes({ byFood: { a: 'ai:no', b: 'mine:2' }, byText: proto }).byFood).toEqual({ b: 'mine:2' });
  });
  it('number the next version past every one in use', () => {
    expect(nextMineId([mine('mine:4')], d)).toBe('mine:5');
    expect(nextMineId([], NO_DISHES)).toBe('mine:1');
  });
});

describe("finding the person's version", () => {
  const d = myDishesAfterConfirm(NO_DISHES, { basedOn: 'ai:upma', mineId: 'mine:1', text: 'uppittu' });
  const saved = [original, mine()];
  it('lists it once, first for the text it was confirmed for, and hides the original', () => {
    const found = searchWithMine('uppittu', [], saved, d);
    expect(found[0].id).toBe('mine:1');
    expect(found.filter((f) => f.id === 'mine:1')).toHaveLength(1);
    expect(found.find((f) => f.id === 'ai:upma')).toBeUndefined();
  });
  it('is not listed once reset, and the original is back', () => {
    const ids = searchWithMine('upma', [], saved, myDishesAfterReset(d, 'mine:1')).map((f) => f.id);
    expect(ids).toContain('ai:upma');
    expect(ids).not.toContain('mine:1');
  });
  it('swaps a look-up result for it, keeping the amount when the unit is known', () => {
    const item = { food: original, unit: 'bowl', quantity: 2 };
    expect(withMine(item, d, (id) => saved.find((f) => f.id === id) ?? null)).toMatchObject({
      unit: 'bowl',
      quantity: 2,
      food: { id: 'mine:1' },
    });
    expect(withMine(item, NO_DISHES, () => null)).toBe(item);
  });
  it('is not listed by plain search unless in use', () => {
    expect(searchFoods('upma', [], saved).map((f) => f.id)).not.toContain('mine:1');
  });
});

describe('the amount next time', () => {
  const recent = [
    { foodId: 'ai:upma', unit: 'bowl', quantity: 1.5 },
    { foodId: 'x', unit: 'g', quantity: 50 },
  ];
  it('is the last one logged, also for the version based on it', () => {
    expect(startAmount(original, recent)).toEqual({ unit: 'bowl', quantity: 1.5 });
    expect(startAmount(mine(), recent)).toEqual({ unit: 'bowl', quantity: 1.5 });
  });
  it('is null for a dish never logged, or a unit it no longer has', () => {
    expect(startAmount({ ...original, id: 'ai:other' }, recent)).toBeNull();
    expect(startAmount({ ...original, units: [{ key: 'g', label: 'g', grams: 1 }] }, recent)).toBeNull();
  });
});

describe('refreshing a pending version', () => {
  const pending: FoodItem = { ...mine(), pending: true, recipe: recipeTextFor(original, edited) };
  it('asks again with the same recipe', () => {
    expect(refreshQuery(pending)).toEqual({ kind: 'recipe', request: pending.recipe });
    expect(refreshQuery(mine())).toBeNull();
  });
  it('never replaces the ingredients the person typed', () => {
    const fresh: FoodItem = { ...answer, ingredients: [{ name: 'Server', grams: 5 }], per100g: { kcal: 250 } };
    const out = refreshedFood(pending, fresh);
    expect(out.ingredients).toEqual(edited);
    expect(out.per100g.kcal).toBe(250);
    expect(out.id).toBe('mine:1');
  });
});
