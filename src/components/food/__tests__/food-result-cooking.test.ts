import { describe, expect, it, jest } from '@jest/globals';

import { SAMPLE_COOKING_FOOD, SAMPLE_COOKING_TABLES } from '@/design-preview/cooking-sample';
import { FAKE_PROFILES as P, FAKE_TABLES } from '@/nutrition/cooking/__tests__/fake-tables';
import { methodLabel } from '@/nutrition/cooking/methods';
import type { FoodIngredient, FoodItem } from '@/nutrition/types';

import {
  amountsCaption,
  chipSelected,
  chipSpoken,
  COOKED_QUESTION,
  METHOD_CHIPS,
  moreSelected,
  OIL_NAME,
  oilLine,
  resultLine,
  rowMethodSpoken,
  rowMethodWord,
  rowNote,
  sheetChoices,
  sheetTitle,
  showsMethods,
  UNKNOWN_ROW,
} from '../food-result-cooking';
import {
  addEditRow,
  editRowsFrom,
  liveDish,
  liveFood,
  lookUpAddedRows,
  openRows,
  opensWithLookUp,
  patchEditRow,
  setAllMethods,
  setRowMethod,
} from '../food-result-edit';
import { ingredientSuffix, ingredientTitle } from '../food-result-layout';

const aloo: FoodIngredient[] = [
  { name: 'potato', grams: 150, profile: P.potato },
  { name: 'salt', grams: 2, profile: P.salt },
];
const ctx = { tables: FAKE_TABLES, dishName: 'aloo fry', country: 'IN' };

describe('the "How was it cooked?" chips', () => {
  it('are the plan seven, in order', () => {
    expect(COOKED_QUESTION).toBe('How was it cooked?');
    expect(METHOD_CHIPS.map((c) => c.label)).toEqual([
      'Raw / salad',
      'Boiled',
      'In a curry',
      'Tadka',
      'Shallow fried',
      'Deep fried',
      'Roasted / baked',
    ]);
    expect(METHOD_CHIPS.map((c) => c.method)).toEqual(['raw', 'boiled', 'simmered', 'stir-fried', 'shallow-fried', 'deep-fried', 'roasted']);
  });
  it('show only when some row can take a method', () => {
    expect(showsMethods(editRowsFrom(aloo))).toBe(true);
    expect(showsMethods(editRowsFrom([aloo[1]]))).toBe(false);
    expect(showsMethods(editRowsFrom([{ name: 'x', grams: 5 }]))).toBe(false);
  });
  it('select one only when every cookable row shares it', () => {
    const one = setAllMethods(editRowsFrom(aloo), 'deep-fried');
    expect(chipSelected(one, 'deep-fried')).toBe(true);
    expect(chipSelected(one, 'boiled')).toBe(false);
    expect(moreSelected(one)).toBe(false);
    const two = editRowsFrom([aloo[0], { ...aloo[0], name: 'potato 2' }]);
    const mixed = setRowMethod(setAllMethods(two, 'boiled'), 'r1', 'roasted');
    expect(METHOD_CHIPS.some((c) => chipSelected(mixed, c.method))).toBe(false);
    expect(moreSelected(mixed)).toBe(false);
  });
  it('mark "More..." when the shared method is not on a chip', () => {
    const rows = setAllMethods(editRowsFrom(aloo), 'grilled');
    expect(moreSelected(rows)).toBe(true);
    expect(METHOD_CHIPS.some((c) => chipSelected(rows, c.method))).toBe(false);
  });
  it('have spoken labels', () => {
    expect(chipSpoken('Deep fried')).toBe('Cooked deep fried for every ingredient');
  });
});

describe('the method sheet', () => {
  it('lists every method of decision 6 with its plain label, and nothing else', () => {
    const list = sheetChoices();
    expect(list.map((c) => c.method)).toEqual([
      'raw',
      'boiled',
      'boiled-drained',
      'pressure-cooked',
      'steamed',
      'simmered',
      'stir-fried',
      'shallow-fried',
      'deep-fried',
      'roasted',
      'grilled',
    ]);
    expect(list.find((c) => c.method === 'boiled-drained')?.label).toBe('Boiled, water drained');
    expect(list.every((c) => c.label === methodLabel(c.method))).toBe(true);
  });
  it('adds a method the server gave that is not offered', () => {
    expect(sheetChoices('sprouted').map((c) => c.method)).toContain('sprouted');
    expect(sheetChoices('boiled')).toHaveLength(11);
  });
  it('is titled for every row, or one', () => {
    expect(sheetTitle(null)).toBe('How was it cooked?');
    expect(sheetTitle('Potato')).toBe('How was Potato cooked?');
  });
});

describe('the method text on a row', () => {
  it('says the method, or "how cooked?"', () => {
    expect(rowMethodWord({ method: 'boiled' })).toBe('boiled');
    expect(rowMethodWord({ method: 'shallow-fried' })).toBe('shallow fried');
    expect(rowMethodWord({})).toBe('how cooked?');
  });
  it('is spoken as a button that changes it', () => {
    expect(rowMethodSpoken({ name: 'Potato', method: 'shallow-fried' })).toBe('Cooking method for Potato: shallow fried. Change');
    expect(rowMethodSpoken({ name: 'Potato' })).toBe('Cooking method for Potato: not set. Change');
  });
  it('says the look-up state of a row with no profile, in words', () => {
    expect(rowNote({ lookup: 'looking' }, 'Looking up…', 'Failed')).toBe('Looking up…');
    expect(rowNote({ lookup: 'failed' }, 'Looking up…', 'Failed')).toBe('Failed');
    expect(rowNote({ lookup: 'unknown' }, 'a', 'b')).toBe(UNKNOWN_ROW);
    expect(rowNote({}, 'a', 'b')).toBeNull();
  });
});

describe('the oil soaked up line and the caption', () => {
  it('has its name and whole grams', () => {
    const dish = liveDish(setAllMethods(editRowsFrom([aloo[0]]), 'shallow-fried'), ctx);
    const line = oilLine(dish);
    expect(line?.name).toBe(OIL_NAME);
    expect(line?.name).toBe('Oil soaked up in frying');
    expect(line?.grams).toMatch(/^\d+ g$/);
    expect(line?.spoken).toBe(`Oil soaked up in frying, ${line?.grams.replace(' g', '')} grams`);
  });
  it('is absent when none was soaked up', () => {
    expect(oilLine(null)).toBeNull();
    expect(oilLine(liveDish(setAllMethods(editRowsFrom([aloo[0]]), 'boiled'), ctx))).toBeNull();
  });
  it('says the amounts are before cooking, only with the cooking part', () => {
    expect(amountsCaption('bowl', true)).toBe('Amounts in 1 bowl, before cooking');
    expect(amountsCaption(undefined, true)).toBe('Amounts in 1 serving, before cooking');
    expect(amountsCaption('bowl', false)).toBe('Amounts in 1 bowl');
  });
});

describe('the result screen rows', () => {
  it('read "Potato · shallow fried" from the method', () => {
    const line = resultLine({ name: 'Potato', method: 'shallow-fried' });
    expect(`${ingredientTitle(line)}${ingredientSuffix(line)}`).toBe('Potato · shallow fried');
  });
  it('keep the method in the name, and say nothing for none or not sure', () => {
    const own = resultLine({ name: 'Egg (boiled)', method: 'deep-fried' });
    expect(`${ingredientTitle(own)}${ingredientSuffix(own)}`).toBe('Egg · boiled');
    expect(ingredientSuffix(resultLine({ name: 'Potato' }))).toBe('');
    expect(ingredientSuffix(resultLine({ name: 'Potato', method: 'unknown' }))).toBe('');
  });
  it('never has words about how a number was worked out', () => {
    const text = JSON.stringify([METHOD_CHIPS, sheetChoices(), OIL_NAME, amountsCaption('bowl', true)]).toLowerCase();
    for (const word of ['yield', 'retention', 'raw weight', 'source', 'usda']) expect(text).not.toContain(word);
  });
});

describe('the live food while editing', () => {
  const food = {
    id: 'x',
    name: 'Aloo fry',
    category: 'home',
    source: 'estimate',
    defaultUnit: 'plate',
    units: [
      { key: 'plate', label: 'plate', grams: 200 },
      { key: 'g', label: 'g', grams: 1 },
    ],
    per100g: { kcal: 10 },
    ingredients: aloo,
    missing: ['vitC'],
  } as unknown as FoodItem;
  it('is the food when nothing can be worked out', () => {
    expect(liveFood(food, null)).toBe(food);
  });
  it('takes the dish values and weight, in the default unit', () => {
    const dish = liveDish(setAllMethods(editRowsFrom(aloo), 'shallow-fried'), ctx)!;
    const out = liveFood(food, dish);
    expect(out.per100g).toBe(dish.per100g);
    expect(out.units.find((u) => u.key === 'plate')?.grams).toBe(Math.min(5000, Math.max(5, Math.round(dish.weight / 5) * 5)));
    expect(out.units.find((u) => u.key === 'g')?.grams).toBe(1);
    expect(out).not.toBe(food);
  });
  it('drops the old "at least" keys and takes the dish ones', () => {
    const dish = liveDish(setAllMethods(editRowsFrom(aloo), 'boiled'), ctx)!;
    expect(liveFood(food, dish).missing ?? []).toEqual(dish.missing);
  });
  it('changes with the method, with no network', () => {
    const rows = editRowsFrom(aloo);
    const a = liveFood(food, liveDish(setAllMethods(rows, 'boiled'), ctx));
    const b = liveFood(food, liveDish(setAllMethods(rows, 'deep-fried'), ctx));
    expect(b.per100g.kcal).not.toBe(a.per100g.kcal);
  });
});

describe('opening Edit recipe', () => {
  const food = { id: 'f', name: 'Aloo', ingredients: [{ name: 'potato', grams: 100 }] } as unknown as FoodItem;
  it('looks up only when some ingredient has no profile and the phone can', () => {
    const ask = async () => null;
    expect(opensWithLookUp(food, ask)).toBe(true);
    expect(opensWithLookUp(food, undefined)).toBe(false);
    expect(opensWithLookUp({ ...food, ingredients: aloo } as FoodItem, ask)).toBe(false);
  });
  it('takes the ingredients with their profiles', async () => {
    const withProfiles = jest.fn(async (_f: FoodItem): Promise<FoodIngredient[] | null> => [
      { name: 'potato', grams: 100, rawGrams: 100, method: 'boiled', profile: P.potato },
    ]);
    const rows = await openRows(food, withProfiles);
    expect(rows[0]).toMatchObject({ name: 'potato', method: 'boiled', profile: P.potato });
    expect(withProfiles).toHaveBeenCalledTimes(1);
  });
  it('asks nothing when every ingredient has a profile', async () => {
    const withProfiles = jest.fn(async (_f: FoodItem): Promise<FoodIngredient[] | null> => null);
    const rows = await openRows({ ...food, ingredients: aloo } as FoodItem, withProfiles);
    expect(rows).toHaveLength(2);
    expect(withProfiles).not.toHaveBeenCalled();
  });
  it('goes the recipe way when the call fails or says no', async () => {
    expect((await openRows(food, async () => null))[0]).toMatchObject({ name: 'potato', grams: '100' });
    expect((await openRows(food, async () => Promise.reject(new Error('offline'))))[0].profile).toBeUndefined();
    expect((await openRows(food))[0].profile).toBeUndefined();
  });
});

describe('adding an ingredient', () => {
  type Rows = ReturnType<typeof editRowsFrom>;
  const start = (): Rows => patchEditRow(patchEditRow(addEditRow(editRowsFrom([aloo[0]])), 'r1', { name: 'oil' }), 'r1', { grams: '5' });
  const holder = (rows: Rows | null) => {
    const box = { rows };
    return {
      box,
      get: () => box.rows,
      update: (change: (r: Rows) => Rows) => {
        if (box.rows) box.rows = change(box.rows);
      },
    };
  };
  it('looks up the named row, says "Looking up…" meanwhile, then takes the profile', async () => {
    const h = holder(start());
    let seen: string | undefined;
    const fetch = jest.fn(async (names: string[], _dish?: string) => {
      seen = h.box.rows?.find((r) => r.key === 'r1')?.lookup;
      return [{ name: names[0], profile: P.oil }];
    });
    expect(await lookUpAddedRows(h.get, h.update, fetch, 'Aloo fry')).toBe(true);
    expect(seen).toBe('looking');
    expect(fetch).toHaveBeenCalledWith(['oil'], 'Aloo fry');
    expect(h.box.rows?.[1].lookup).toBeUndefined();
    expect(h.box.rows?.[1].profile?.role).toBe('in-dish');
  });
  it('marks the row failed when offline, and tries again later', async () => {
    const h = holder(start());
    await lookUpAddedRows(h.get, h.update, async () => Promise.reject(new Error('offline')));
    expect(h.box.rows?.[1].lookup).toBe('failed');
    const fetch = jest.fn(async (names: string[], _dish?: string) => [{ name: names[0], profile: P.oil }]);
    expect(await lookUpAddedRows(h.get, h.update, fetch)).toBe(true);
    expect(h.box.rows?.[1].profile).toBeDefined();
  });
  it('does nothing with no named row without a profile', async () => {
    const fetch = jest.fn(async () => []);
    expect(await lookUpAddedRows(() => editRowsFrom(aloo), () => undefined, fetch)).toBe(false);
    expect(await lookUpAddedRows(() => null, () => undefined, fetch)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('the design preview sample', () => {
  it('shows the chips and one deep fried row with its oil line', () => {
    const rows = editRowsFrom(SAMPLE_COOKING_FOOD.ingredients ?? []);
    expect(showsMethods(rows)).toBe(true);
    expect(rows.map((r) => r.method)).toEqual(['deep-fried', 'boiled', 'stir-fried', 'simmered', undefined]);
    const dish = liveDish(rows, { tables: SAMPLE_COOKING_TABLES, dishName: SAMPLE_COOKING_FOOD.name, country: '*' });
    expect(dish).not.toBeNull();
    expect(oilLine(dish)?.grams).toMatch(/^\d+ g$/);
    expect(dish?.kcal).toBeGreaterThan(0);
  });
});
