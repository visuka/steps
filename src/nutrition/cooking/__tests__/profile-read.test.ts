import { describe, expect, it } from '@jest/globals';

import { ingredientsRequest, readEstimate, readFoodIngredients, readFoodItem, readIngredients, readProfile, readProfileItems } from '@/api/food-read';

import { FAKE_PROFILES as P } from './fake-tables';

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const profile = () => json(P.potato) as unknown as Record<string, unknown>;

const dish = (ingredients: unknown) => ({
  id: 'ai:0123456789ab',
  name: 'Aloo fry',
  per100g: { kcal: 150 },
  units: [{ key: 'g', label: 'grams', grams: 1 }],
  ingredients,
});

describe('readProfile', () => {
  it('keeps a good profile whole', () => {
    expect(readProfile(P.potato)).toEqual(P.potato);
    expect(readProfile(P['oil-b'])).toEqual(P['oil-b']);
    expect(readProfile(P.paste)).toEqual(P.paste); // pending, no record id
    expect(readProfile({ ...P.oil, role: null })).toMatchObject({ role: null });
  });

  it('ignores a profile with a calc version it does not know', () => {
    expect(readProfile({ ...profile(), calc: 'c2' })).toBeNull();
    expect(readProfile({ ...profile(), calc: undefined })).toBeNull();
  });

  it('drops a profile with any wrong type or out-of-range number', () => {
    const bad: Record<string, unknown>[] = [
      { kind: 'dish' },
      { basis: 'baked' },
      { per100g: 'x' },
      { cookClass: '' },
      { yieldClass: 4 },
      { asEaten: 'yes' },
      { fryAgain: undefined },
      { noMethod: 0 },
      { rawGrams: 30001 },
      { rawGrams: Number.NaN },
      { rawGrams: -1 },
      { recName: 5 },
      { id: 7 },
      { role: 'pan' },
      { coating: 'foil' },
      { yields: [] },
      { yields: { boiled: 'x' } },
      { yields: { boiled: { y: -1 } } },
      { yields: { boiled: { y: 0.9, oilU: 500 } } },
      { cooked: { boiled: { id: 'x' } } },
      { cooked: { boiled: { id: '', per100g: {} } } },
    ];
    for (const over of bad) expect(readProfile({ ...profile(), ...over })).toBeNull();
    expect(readProfile(null)).toBeNull();
    expect(readProfile('x')).toBeNull();
  });

  it('ignores methods it does not know, and never reads a negative or unknown nutrient', () => {
    const p = profile();
    p.yields = { boiled: { y: 0.9 }, poached: { y: 0.1 } };
    p.per100g = { kcal: 80, vitC: -4, bogus: 3 };
    const got = readProfile(p)!;
    expect(got.yields).toEqual({ boiled: { y: 0.9 } });
    expect(got.per100g).toEqual({ kcal: 80 });
  });
});

describe('food ingredient lines', () => {
  const row = { name: 'potato', grams: 70, rawGrams: 100, method: 'shallow-fried', oilGrams: 5, profile: P.potato };

  it('a food keeps method, rawGrams, oilGrams and a valid profile', () => {
    const f = readFoodItem(dish([row]))!;
    expect(f.ingredients).toEqual([row]);
  });

  it('a bad profile is dropped but the line stays', () => {
    const f = readFoodItem(dish([{ ...row, profile: { ...P.potato, calc: 'c9' } }]))!;
    expect(f.ingredients).toEqual([{ name: 'potato', grams: 70, rawGrams: 100, method: 'shallow-fried', oilGrams: 5 }]);
  });

  it('rawGrams comes from the profile when the line has none', () => {
    const f = readFoodItem(dish([{ name: 'potato', grams: 70, profile: { ...P.potato, rawGrams: 90 } }]))!;
    expect(f.ingredients).toEqual([{ name: 'potato', grams: 70, rawGrams: 90, profile: { ...P.potato, rawGrams: 90 } }]);
  });

  it('drops a method that is not one of ours and numbers out of range', () => {
    const f = readFoodItem(dish([{ name: 'potato', grams: 70, method: 'fried', rawGrams: -3, oilGrams: 99999 }, { name: 'x', grams: 1, method: 5 }]))!;
    expect(f.ingredients).toEqual([
      { name: 'potato', grams: 70 },
      { name: 'x', grams: 1 },
    ]);
  });

  it('lines without cooking fields read as before', () => {
    expect(readFoodIngredients([{ name: 'Moong dal (raw)', grams: 200 }])).toEqual([{ name: 'Moong dal (raw)', grams: 200 }]);
  });

  it('a recipe answer keeps the server word for the method and the profile', () => {
    const [i] = readIngredients([{ name: 'potato', grams: 70, method: 'pressure-cooked', rawGrams: 100, profile: P.potato }]);
    expect(i).toEqual({ name: 'potato', grams: 70, method: 'pressure-cooked', rawGrams: 100, profile: P.potato });
  });

  it('an estimate keeps the lines of its items, and adds the cooking amounts of the same food twice', () => {
    const item = (grams: number, raw: number) => ({
      food: dish([]),
      unit: 'g',
      quantity: 100,
      ingredients: [{ name: 'potato', grams, rawGrams: raw, method: 'boiled', profile: P.potato }],
    });
    const r = readEstimate({ items: [item(70, 100), item(35, 50)] });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].ingredients).toEqual([{ name: 'potato', grams: 105, rawGrams: 150, method: 'boiled', profile: P.potato }]);
  });
});

describe('the ingredients look-up (POST /v1/food/ingredients)', () => {
  it('sends names, the country and the dish only, trimmed', () => {
    expect(ingredientsRequest([' potato ', 'oil'], 'in', ' Aloo fry ')).toEqual({ names: ['potato', 'oil'], country: 'IN', dish: 'Aloo fry' });
    expect(ingredientsRequest(['potato'], '419')).toEqual({ names: ['potato'] });
    expect(Object.keys(ingredientsRequest(['a'], 'IN', 'x'))).not.toContain('userId');
  });

  it('reads a profile or unknown for each item, and a bad profile as unknown', () => {
    const items = readProfileItems({
      items: [
        { name: 'potato', profile: P.potato, method: 'boiled' },
        { name: 'zzq', unknown: true },
        { name: 'oil', profile: { ...profile(), calc: 'c2' } },
        { name: 'salt', profile: P.salt, method: 'flying' },
        'junk',
      ],
    });
    expect(items).toEqual([
      { name: 'potato', profile: P.potato, method: 'boiled' },
      { name: 'zzq', unknown: true },
      { name: 'oil', unknown: true },
      { name: 'salt', profile: P.salt },
    ]);
  });

  it('refuses an answer with no items list', () => {
    expect(() => readProfileItems({})).toThrow();
    expect(() => readProfileItems(null)).toThrow();
  });
});

describe('the pan oil of a food', () => {
  it('is kept with the food when it is an oil profile, and left out otherwise', () => {
    const good = readFoodItem({ ...dish(undefined), panOil: { name: 'Oil', grams: 12, profile: P.oil } });
    expect(good?.panOil).toEqual({ name: 'Oil', grams: 12, profile: P.oil });
    expect(good?.calc).toBe('c1');
    expect(readFoodItem({ ...dish(undefined), panOil: { name: 'Oil', profile: P.potato } })?.panOil).toBeUndefined();
    expect(readFoodItem({ ...dish(undefined), panOil: { name: 'Oil', profile: P.oil } })?.panOil).toEqual({ name: 'Oil', profile: P.oil });
  });
});
