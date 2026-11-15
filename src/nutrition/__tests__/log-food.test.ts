import { describe, expect, it, jest } from '@jest/globals';

import { type EstimateResult, FoodApiError, type RecipeResult } from '@/api/food-read';
import { memoryRepository } from '@/data/db.web';
import type { FoodEntry } from '@/data/types';
import {
  confirmIngredients,
  dishUnits,
  keepLookedFood,
  logFood,
  lookUpFood,
  ourGuessAgain,
  restaurantVersionFor,
  saveFoodEntry,
} from '@/nutrition/log-food';
import { myDishesAfterConfirm, NO_DISHES } from '@/nutrition/my-dishes';
import { isPending } from '@/nutrition/pending';
import { FAKE_PROFILES as P, FAKE_TABLES } from '@/nutrition/cooking/__tests__/fake-tables';
import { cookDish, cookInputOf } from '@/nutrition/cooking/cook';
import type { CookingTables, CookMethod } from '@/nutrition/cooking/types';
import { HOME } from '@/nutrition/place';
import type { FoodItem } from '@/nutrition/types';

const dish: FoodItem = {
  id: 'ai:upma',
  name: 'Upma',
  aliases: [],
  category: 'dish',
  per100g: { kcal: 120 },
  units: [{ key: 'bowl', label: 'bowl', grams: 200 }],
  defaultUnit: 'bowl',
  source: 'x',
  ingredients: [{ name: 'Rava', grams: 60 }],
  style: 'home',
};
const day = new Date(2026, 10, 14, 12).getTime();
const make = () => memoryRepository(null);
const entry = (): FoodEntry => ({
  id: 'e1',
  loggedAt: day,
  name: 'Upma',
  foodId: 'ai:upma',
  unit: 'bowl',
  quantity: 1,
  kcal: 240,
  healthSampleId: null,
  place: 'home',
  restaurant: null,
});
const rows = (repo: ReturnType<typeof make>) => repo.getFoods(day - 1000, day + 1000);
const source = (over: object = {}) => ({
  label: 'Health Connect',
  writeFood: jest.fn(async () => 'h1' as string | null),
  deleteSample: jest.fn(async (_kind: unknown, _id: string) => undefined),
  ...over,
});

describe('saving an entry', () => {
  it('writes the local row first, then links the Health copy', async () => {
    const repo = make();
    expect(await saveFoodEntry({ repo, source: source() }, entry(), { kcal: 240 })).toEqual({ notice: null });
    expect((await rows(repo))[0].healthSampleId).toBe('h1');
  });
  it('keeps the row and says so when the Health copy fails', async () => {
    const repo = make();
    const s = source({
      writeFood: async () => {
        throw new Error('no');
      },
    });
    const out = await saveFoodEntry({ repo, source: s }, entry(), { kcal: 240 });
    expect(out.notice).toBe("Saved here, but couldn't copy it to Health Connect.");
    expect(await rows(repo)).toHaveLength(1);
  });
  it('leaves no Health sample behind when the local insert fails', async () => {
    const repo = make();
    repo.addFood = async () => {
      throw new Error('disk');
    };
    const s = source();
    await expect(saveFoodEntry({ repo, source: s }, entry(), { kcal: 1 })).rejects.toThrow('disk');
    expect(s.writeFood).not.toHaveBeenCalled();
  });
  it('takes the copy back out when the row cannot be linked to it', async () => {
    const repo = make();
    repo.updateFood = async () => {
      throw new Error('disk');
    };
    const s = source();
    const out = await saveFoodEntry({ repo, source: s }, entry(), { kcal: 1 });
    expect(out.notice).toMatch(/couldn't copy/);
    expect(s.deleteSample).toHaveBeenCalledWith('food', 'h1');
  });
  it('logs a food with whole kcal and its place', async () => {
    const repo = make();
    await logFood(
      { repo, source: source({ writeFood: undefined }) },
      { foodId: 'ai:upma', name: 'Upma', unit: 'bowl', quantity: 1, nutrients: { kcal: 240.4 }, where: { place: 'dine-in', restaurant: 'Paradise' }, at: day },
    );
    expect((await rows(repo))[0]).toMatchObject({ kcal: 240, place: 'dine-in', restaurant: 'Paradise' });
  });
});

describe('looking a description up', () => {
  const result = { items: [{ food: dish, unit: 'bowl', quantity: 2, style: 'home', cached: false }], unknown: [], where: null } as unknown as EstimateResult;
  it('checks the text first', async () => {
    const estimate = jest.fn<() => Promise<EstimateResult>>();
    expect((await lookUpFood({ estimate }, '', null)).ok).toBe(false);
    expect(estimate).not.toHaveBeenCalled();
  });
  it('maps errors to words', async () => {
    const offline = new FoodApiError('offline', 'You are offline.');
    expect(await lookUpFood({ estimate: async () => Promise.reject(offline) }, '2 upma', null)).toEqual({ ok: false, message: 'You are offline.' });
    expect(await lookUpFood({ estimate: async () => Promise.reject(new Error('x')) }, '2 upma', null)).toEqual({
      ok: false,
      message: 'Something went wrong. Please try again.',
    });
  });
  it("swaps in the person's version", async () => {
    const mine = { ...dish, id: 'mine:1', source: 'mine', basedOn: 'ai:upma' };
    const dishes = myDishesAfterConfirm(NO_DISHES, { basedOn: 'ai:upma', mineId: 'mine:1' });
    const out = await lookUpFood({ estimate: async () => result, dishes, find: (id) => (id === 'mine:1' ? mine : null) }, '2 upma', HOME);
    expect(out.ok && out.result.items[0].food.id).toBe('mine:1');
    expect(out.ok && out.where).toEqual(HOME);
  });
});

describe('keeping a looked-up dish', () => {
  const item = { food: dish, unit: 'bowl', quantity: 1, style: 'home', cached: false } as never;
  it("does not overwrite the person's version", async () => {
    const saveFood = jest.fn(async (f: FoodItem) => f);
    const mine = { ...dish, id: 'mine:1', source: 'mine' };
    expect(await keepLookedFood({ saved: [], saveFood }, { food: mine, unit: 'bowl', quantity: 1 } as never, null)).toBe(mine);
    expect(saveFood).not.toHaveBeenCalled();
  });
  it('keeps anything else on the phone', async () => {
    const saveFood = jest.fn(async (f: FoodItem) => f);
    expect((await keepLookedFood({ saved: [], saveFood }, item, null)).id).toBe('ai:upma');
    expect(saveFood).toHaveBeenCalledTimes(1);
  });
});

describe('the restaurant version', () => {
  const w = { place: 'dine-in' as const, restaurant: 'Paradise' };
  const deps = (fetchVersion: () => Promise<never>) => ({
    find: () => null,
    saved: [],
    overrides: {},
    saveFood: async (f: FoodItem) => f,
    fetchVersion,
  });
  it('logs the food as it is, with a notice, when the look-up fails', async () => {
    const working = jest.fn();
    const out = await restaurantVersionFor(
      { ...deps(async () => Promise.reject(new Error('offline'))), working },
      dish,
      'bowl',
      1,
      w,
    );
    expect(out.food).toBe(dish);
    expect(out.notice).toMatch(/home-style values were used/);
    expect(working.mock.calls).toEqual([[true], [false]]);
  });
  it('needs nothing when eaten at home', async () => {
    const fetchVersion = jest.fn<() => Promise<never>>();
    const out = await restaurantVersionFor(deps(fetchVersion), dish, 'bowl', 1, HOME);
    expect(out).toMatchObject({ food: dish, notice: null });
    expect(fetchVersion).not.toHaveBeenCalled();
  });
});

describe('confirming a corrected list', () => {
  const recipeAnswer = { food: { ...dish, id: 'recipe:r', per100g: { kcal: 200 } } } as RecipeResult;
  const list = [{ name: 'Rava', grams: 90 }];
  it("makes the person's version and the mappings", async () => {
    const recipe = jest.fn(async (_request: unknown) => recipeAnswer);
    const out = await confirmIngredients({ saved: [dish], dishes: NO_DISHES, recipe }, dish, list, 'Upma ');
    expect(out.ok && out.food).toMatchObject({ id: 'mine:1', basedOn: 'ai:upma', source: 'mine' });
    expect(out.ok && out.dishes).toEqual({ byFood: { 'ai:upma': 'mine:1' }, byText: { upma: 'mine:1' } });
    expect(recipe).toHaveBeenCalledWith(expect.objectContaining({ ingredients: 'Rava 90 g' }));
  });
  it('does nothing for an unchanged list', async () => {
    const recipe = jest.fn<() => Promise<RecipeResult>>();
    const out = await confirmIngredients({ saved: [], dishes: NO_DISHES, recipe }, dish, [{ name: 'Rava', grams: 60 }], null);
    expect(out).toMatchObject({ ok: true, changed: false });
    expect(recipe).not.toHaveBeenCalled();
  });
  it('saves nothing offline, and refuses an invalid list', async () => {
    const offline = await confirmIngredients({ saved: [], dishes: NO_DISHES, recipe: async () => Promise.reject(new Error('x')) }, dish, list, null);
    expect(offline).toEqual({ ok: false, message: "Couldn't work it out. Check the connection and try again." });
    const empty = await confirmIngredients({ saved: [], dishes: NO_DISHES, recipe: async () => recipeAnswer }, dish, [], null);
    expect(empty.ok).toBe(false);
  });
  it('updates its own version in place, and "use our guess again" brings the original back', async () => {
    const first = await confirmIngredients({ saved: [dish], dishes: NO_DISHES, recipe: async () => recipeAnswer }, dish, list, null);
    if (!first.ok) throw new Error('not ok');
    const again = await confirmIngredients(
      { saved: [dish, first.food], dishes: first.dishes, recipe: async () => recipeAnswer },
      first.food,
      [{ name: 'Rava', grams: 100 }],
      null,
    );
    expect(again.ok && again.food.id).toBe('mine:1');
    const back = ourGuessAgain(first.dishes, first.food, (id) => (id === 'ai:upma' ? dish : null));
    expect(back.food).toBe(dish);
    expect(back.dishes).toEqual(NO_DISHES);
  });
});

describe('confirming a list worked out on the phone', () => {
  const aloo: FoodItem = {
    id: 'ai:aloo',
    name: 'Aloo fry',
    aliases: [],
    category: 'dish',
    per100g: { kcal: 100 },
    units: [
      { key: 'bowl', label: 'bowl', grams: 150 },
      { key: 'g', label: 'g', grams: 1 },
    ],
    defaultUnit: 'bowl',
    source: 'x',
    ingredients: [
      { name: 'potato', grams: 100 },
      { name: 'oil', grams: 10 },
    ],
  };
  const recipeAnswer = { food: { ...aloo, id: 'recipe:r', per100g: { kcal: 200 } } } as RecipeResult;
  const line = (name: string, grams: number, key: keyof typeof P, method?: CookMethod) => ({
    name,
    grams,
    ...(method ? { method } : {}),
    profile: P[key],
  });
  const list = [line('potato', 100, 'potato', 'shallow-fried'), line('oil', 10, 'oil')];
  const make = (over: object = {}) => ({
    saved: [aloo],
    dishes: NO_DISHES,
    recipe: jest.fn(async (_request: unknown) => recipeAnswer),
    tables: FAKE_TABLES,
    country: 'IN',
    ...over,
  });

  it('saves the phone\'s result without a recipe call when every row has a profile', async () => {
    const deps = make();
    const out = await confirmIngredients(deps, aloo, list, 'aloo fry');
    expect(deps.recipe).not.toHaveBeenCalled();
    if (!out.ok) throw new Error('not ok');
    const expected = cookDish(
      cookInputOf(
        [
          { name: 'potato', grams: 100, rawGrams: 100, method: 'shallow-fried', profile: P.potato },
          { name: 'oil', grams: 10, rawGrams: 10, profile: P.oil },
        ],
        'Aloo fry',
        'IN',
        FAKE_TABLES,
      ),
      FAKE_TABLES,
    );
    expect(out.changed).toBe(true);
    expect(out.food).toMatchObject({ id: 'mine:1', basedOn: 'ai:aloo', source: 'mine', calc: 'c1' });
    expect(out.food.per100g).toEqual(expected.per100g);
    expect(out.food.ingredients?.[0]).toMatchObject({ name: 'potato', rawGrams: 100, method: 'shallow-fried', profile: P.potato });
    expect(out.food.ingredients?.[0].grams).toBeCloseTo(expected.lines[0].grams, 0);
    expect(out.dishes).toEqual({ byFood: { 'ai:aloo': 'mine:1' }, byText: { 'aloo fry': 'mine:1' } });
  });
  it('weighs the unit by the dish, and leaves the other units as they were', async () => {
    const out = await confirmIngredients(make(), aloo, list, null);
    if (!out.ok) throw new Error('not ok');
    const weight = cookDish(
      cookInputOf(
        [
          { name: 'potato', grams: 100, rawGrams: 100, method: 'shallow-fried', profile: P.potato },
          { name: 'oil', grams: 10, rawGrams: 10, profile: P.oil },
        ],
        'Aloo fry',
        'IN',
        FAKE_TABLES,
      ),
      FAKE_TABLES,
    ).weight;
    // The sum of the cooked grams, to the gram (decision 11): no 5 g steps.
    expect(out.food.units[0].grams).toBe(Math.max(1, Math.round(weight)));
    expect(dishUnits(aloo, 81.04)[0].grams).toBe(81);
    expect(dishUnits(aloo, 0.2)[0].grams).toBe(1);
    expect(dishUnits(aloo, 9000)[0].grams).toBe(5000);
    expect(out.food.units[1]).toEqual({ key: 'g', label: 'g', grams: 1 });
  });
  it('goes the recipe way (T15) when a row has no profile', async () => {
    const deps = make();
    const out = await confirmIngredients(deps, aloo, [list[0], { name: 'mystery', grams: 5 }], null);
    expect(deps.recipe).toHaveBeenCalledWith(expect.objectContaining({ ingredients: 'potato 100 g\nmystery 5 g' }));
    expect(out.ok && out.food.per100g).toEqual({ kcal: 200 });
    expect(out.ok && out.food.ingredients?.[0]).toEqual({ name: 'potato', grams: 100 });
  });
  it('goes the recipe way when there are no tables, or they are another version', async () => {
    for (const tables of [null, undefined, { ...FAKE_TABLES, calc: 'c2' } as unknown as CookingTables]) {
      const deps = make({ tables });
      const out = await confirmIngredients(deps, aloo, list, null);
      expect(deps.recipe).toHaveBeenCalledTimes(1);
      expect(out.ok && out.food.per100g).toEqual({ kcal: 200 });
    }
  });
  it('counts a changed method as a change, and the same list as none', async () => {
    const first = await confirmIngredients(make(), aloo, list, null);
    if (!first.ok) throw new Error('not ok');
    const deps = make({ saved: [aloo, first.food], dishes: first.dishes });
    const same = await confirmIngredients(deps, first.food, list, null);
    expect(same).toMatchObject({ ok: true, changed: false });
    const boiled = await confirmIngredients(deps, first.food, [line('potato', 100, 'potato', 'boiled'), list[1]], null);
    expect(boiled.ok && boiled.changed).toBe(true);
    expect(boiled.ok && boiled.food.id).toBe('mine:1');
    expect(boiled.ok && boiled.food.per100g).not.toEqual(first.food.per100g);
    expect(deps.recipe).not.toHaveBeenCalled();
  });
  it('keeps the dish\'s pan oil with the food and never marks it pending', async () => {
    const withPan: FoodItem = { ...aloo, pending: true, panOil: { name: 'Oil', profile: P.oil } };
    const out = await confirmIngredients(make(), withPan, list, null);
    expect(out.ok && out.food.panOil).toEqual({ name: 'Oil', profile: P.oil });
    expect(out.ok && out.food.pending).toBeUndefined();
  });
  it('shows a pending note when a row has AI-only numbers, and leaves the food out of the pending repeat', async () => {
    const masala = { ...line('masala', 5, 'potato'), profile: { ...P.potato, pending: true as const } };
    const out = await confirmIngredients(make(), aloo, [list[0], masala], null);
    if (!out.ok) throw new Error('not ok');
    expect(out.food).toMatchObject({ calc: 'c1', pending: true, madeHere: true });
    expect(isPending(out.food)).toBe(false);
    const plain = await confirmIngredients(make(), aloo, list, null);
    expect(plain.ok && plain.food.pending).toBeUndefined();
  });
  it('refuses an invalid list before any maths', async () => {
    const out = await confirmIngredients(make(), aloo, [{ ...list[0], grams: 0 }], null);
    expect(out.ok).toBe(false);
  });
});
