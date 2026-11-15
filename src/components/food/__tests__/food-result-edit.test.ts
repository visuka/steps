import { describe, expect, it, jest } from '@jest/globals';

import { FAKE_PROFILES as P, FAKE_TABLES } from '@/nutrition/cooking/__tests__/fake-tables';
import type { FoodIngredient, FoodItem } from '@/nutrition/types';

import {
  addEditRow,
  applyProfiles,
  editChanged,
  editLines,
  editList,
  editProblem,
  editRowsFrom,
  fetchRowProfiles,
  fillProfiles,
  gramsInput,
  liveDish,
  LOOKING_UP,
  LOOKUP_FAILED,
  markLooking,
  oilSoakedUp,
  openRows,
  opensWithLookUp,
  patchEditRow,
  removeEditRow,
  setAllMethods,
  setRowMethod,
  sharedMethod,
  toLookUp,
  unitNutrients,
} from '../food-result-edit';
import { editRowLayout, ingredientRowLayout, RESULT } from '../food-result-layout';

const base = [
  { name: 'Rava', grams: 60 },
  { name: 'Oil (fried)', grams: 10 },
];

describe('the ingredient rows while editing', () => {
  it('start as the ingredients, with grams as text', () => {
    expect(editRowsFrom(base)).toEqual([
      { key: 'r0', name: 'Rava', grams: '60', added: false },
      { key: 'r1', name: 'Oil (fried)', grams: '10', added: false },
    ]);
  });
  it('add a new row with a key no other row has, even after a removal', () => {
    const rows = removeEditRow(editRowsFrom(base), 'r0');
    const next = addEditRow(rows);
    expect(next.map((r) => r.key)).toEqual(['r1', 'r2']);
    expect(next[1]).toMatchObject({ name: '', grams: '', added: true });
  });
  it('change one row by key', () => {
    const rows = patchEditRow(editRowsFrom(base), 'r1', { grams: '25' });
    expect(rows.map((r) => r.grams)).toEqual(['60', '25']);
  });
  it('keep only digits, at most 4, in the grams field', () => {
    expect(gramsInput('12a.5')).toBe('125');
    expect(gramsInput('123456')).toBe('1234');
  });
  it('make the list to send, with a missing amount as NaN', () => {
    const list = editList([...editRowsFrom(base), ...addEditRow([])]);
    expect(list.slice(0, 2)).toEqual(base);
    expect(Number.isNaN(list[2].grams)).toBe(true);
  });
  it('say what is wrong, or nothing', () => {
    const rows = editRowsFrom(base);
    expect(editProblem(rows)).toBeNull();
    expect(editProblem(patchEditRow(rows, 'r0', { grams: '0' }))).toMatch(/whole grams/);
    expect(editProblem(patchEditRow(rows, 'r0', { grams: '' }))).toMatch(/whole grams/);
    expect(editProblem(patchEditRow(rows, 'r0', { grams: '2001' }))).toMatch(/whole grams/);
    expect(editProblem(addEditRow(rows))).toMatch(/needs a name/);
    expect(editProblem([])).toMatch(/at least one/);
  });
  it('know when nothing changed', () => {
    const rows = editRowsFrom(base);
    expect(editChanged(rows, base)).toBe(false);
    expect(editChanged(patchEditRow(rows, 'r0', { grams: '61' }), base)).toBe(true);
    expect(editChanged(removeEditRow(rows, 'r1'), base)).toBe(true);
  });
});

describe('an edited row', () => {
  it('leaves the name less room than a plain row: field 72 and remove 48 beside it', () => {
    const plain = ingredientRowLayout('Rava', '60 g', 312);
    const edit = editRowLayout('Rava', 312);
    expect(edit.nameWidth).toBe(312 - RESULT.circle - 2 * RESULT.ingredientGap - RESULT.gramsFieldWidth - RESULT.removeTouch);
    expect(edit.nameWidth).toBeLessThan(plain.nameWidth);
  });
  it('is 48 high, and grows for a long name or large text', () => {
    expect(editRowLayout('Rava', 312).minHeight).toBe(RESULT.ingredientRowHeight);
    expect(editRowLayout('Dried anchovy cooked in coconut and tamarind sauce', 312).lines).toBe(2);
    expect(editRowLayout('Dried anchovy cooked in coconut and tamarind sauce', 312, 1.5).minHeight).toBeGreaterThan(48);
  });
});

const aloo: FoodIngredient[] = [
  { name: 'potato', grams: 70, rawGrams: 100, profile: P.potato },
  { name: 'oil', grams: 10, profile: P.oil },
  { name: 'salt', grams: 2, profile: P.salt },
];
const ctx = { tables: FAKE_TABLES, dishName: 'aloo fry', country: 'IN' };

describe('how it was cooked', () => {
  it('shows the amount before cooking, and the method a row has', () => {
    const rows = editRowsFrom([{ ...aloo[0], method: 'boiled' }]);
    expect(rows[0]).toMatchObject({ grams: '100', method: 'boiled' });
    expect(editChanged(rows, [{ ...aloo[0], method: 'boiled' }])).toBe(false);
    expect(editChanged(rows, [aloo[0]])).toBe(true);
  });
  it('sets every cookable row, never salt, oil or a row with no profile', () => {
    const rows = setAllMethods([...editRowsFrom(aloo), ...addEditRow([])], 'deep-fried');
    expect(rows.map((r) => r.method)).toEqual(['deep-fried', undefined, undefined, undefined]);
    expect(sharedMethod(rows)).toBe('deep-fried');
  });
  it('sets one row, and no chip is selected when the rows differ', () => {
    const two = editRowsFrom([aloo[0], { ...aloo[0], name: 'potato 2' }]);
    const all = setAllMethods(two, 'boiled');
    const one = setRowMethod(all, 'r1', 'roasted');
    expect(one.map((r) => r.method)).toEqual(['boiled', 'roasted']);
    expect(sharedMethod(one)).toBeNull();
    expect(setRowMethod(editRowsFrom(aloo), 'r2', 'boiled')[2].method).toBeUndefined();
    expect(sharedMethod(editRowsFrom(aloo))).toBeNull();
  });
  it('confirms the list with each method and profile', () => {
    const lines = editLines(setAllMethods(editRowsFrom(aloo), 'shallow-fried'));
    expect(lines[0]).toMatchObject({ name: 'potato', grams: 100, method: 'shallow-fried', profile: P.potato });
    expect(lines[2]).not.toHaveProperty('method');
  });
});

describe('the numbers while editing', () => {
  it('are worked out on the phone on every change', () => {
    const rows = setAllMethods(editRowsFrom(aloo), 'shallow-fried');
    const a = liveDish(rows, ctx);
    const more = liveDish(patchEditRow(rows, 'r0', { grams: '200' }), ctx);
    const boiled = liveDish(setAllMethods(rows, 'boiled'), ctx);
    expect(a?.kcal).toBeGreaterThan(0);
    expect(more?.kcal).toBeGreaterThan(a?.kcal ?? 0);
    expect(boiled?.kcal).not.toBe(a?.kcal);
    expect(a && unitNutrients(a).kcal).toBeCloseTo(a?.kcal ?? 0, 0);
  });
  it('show the oil soaked up for a fried item with no oil row, whole grams', () => {
    const rows = setAllMethods(editRowsFrom([aloo[0]]), 'shallow-fried');
    const dish = liveDish(rows, ctx);
    expect(oilSoakedUp(dish)).toBe(Math.round(dish?.oilAdded ?? 0));
    expect(oilSoakedUp(dish)).toBeGreaterThan(0);
    expect(oilSoakedUp(null)).toBe(0);
  });
  it('are nothing while a row with a name and an amount has no profile (the recipe look-up will work it out), or none has one', () => {
    const rows = editRowsFrom([aloo[0]]);
    expect(liveDish(rows, ctx)).not.toBeNull();
    for (const lookup of ['looking', 'failed', 'unknown', undefined] as const) {
      const withNew = [...rows, { key: 'r9', name: 'mystery', grams: '50', added: true, ...(lookup ? { lookup } : {}) }];
      expect(liveDish(withNew, ctx)).toBeNull();
    }
    // A row still empty (no name or amount yet) is not counted.
    expect(liveDish([...rows, { key: 'r8', name: '', grams: '', added: true }], ctx)).not.toBeNull();
    // A profile of another cooking version is not worked out here either.
    expect(liveDish([{ ...rows[0], profile: { ...(rows[0].profile as object), calc: 'c0' } as never }], ctx)).toBeNull();
    expect(liveDish(editRowsFrom([{ name: 'x', grams: 5 }]), ctx)).toBeNull();
  });
});

describe('profiles for added rows', () => {
  const named = (name: string) => {
    const rows = addEditRow(editRowsFrom([aloo[0]]));
    return patchEditRow(patchEditRow(rows, 'r1', { name }), 'r1', { grams: '30' });
  };
  it('look up the added rows that have a name and no profile, once', () => {
    const rows = named('Oil');
    expect(toLookUp(rows)).toEqual([{ key: 'r1', name: 'Oil' }]);
    expect(toLookUp(markLooking(rows, toLookUp(rows)))).toEqual([]);
    expect(toLookUp(addEditRow([]))).toEqual([]);
  });
  it('say "Looking up..." and keep Use these ingredients off until the answer is in', async () => {
    const rows = named('oil');
    const sent = toLookUp(rows);
    const looking = markLooking(rows, sent);
    expect(editProblem(looking)).toBe(LOOKING_UP);
    const fetch = jest.fn(async (_names: string[], _dish?: string) => [{ name: 'oil', profile: P.oil }]);
    const done = applyProfiles(looking, sent, await fetchRowProfiles(fetch, sent, 'aloo fry'));
    expect(fetch).toHaveBeenCalledWith(['oil'], 'aloo fry');
    expect(editProblem(done)).toBeNull();
    // An oil the person adds is eaten in the dish.
    expect(done[1].profile).toMatchObject({ kind: 'oil', role: 'in-dish' });
    expect(done[1].lookup).toBeUndefined();
  });
  it("take the server's usual method, else the one the other rows share", () => {
    const base = setAllMethods(editRowsFrom([aloo[0]]), 'roasted');
    const rows = patchEditRow(patchEditRow(addEditRow(base), 'r1', { name: 'onion' }), 'r1', { grams: '40' });
    const sent = toLookUp(rows);
    expect(applyProfiles(markLooking(rows, sent), sent, [{ name: 'onion', profile: P.potato }])[1].method).toBe('roasted');
    expect(applyProfiles(markLooking(rows, sent), sent, [{ name: 'onion', profile: P.potato, method: 'boiled' }])[1].method).toBe('boiled');
    expect(applyProfiles(markLooking(rows, sent), sent, [{ name: 'onion', profile: P.salt }])[1].method).toBeUndefined();
  });
  it('say they could not look it up when offline, and stay off until it works', async () => {
    const rows = named('oil');
    const sent = toLookUp(rows);
    const items = await fetchRowProfiles(async () => Promise.reject(new Error('offline')), sent);
    const failed = applyProfiles(markLooking(rows, sent), sent, items);
    expect(failed[1].lookup).toBe('failed');
    expect(editProblem(failed)).toBe(LOOKUP_FAILED);
    expect(toLookUp(failed)).toEqual([{ key: 'r1', name: 'oil' }]);
  });
  it('mark a name the server does not know, which can still be saved the recipe way', () => {
    const rows = named('zzq');
    const sent = toLookUp(rows);
    const done = applyProfiles(markLooking(rows, sent), sent, [{ name: 'zzq', unknown: true }]);
    expect(done[1].lookup).toBe('unknown');
    expect(editProblem(done)).toBeNull();
    expect(toLookUp(done)).toEqual([]);
  });
  it('ignore an answer for a row that was removed or renamed meanwhile', () => {
    const rows = named('oil');
    const sent = toLookUp(rows);
    const looking = markLooking(rows, sent);
    const renamed = patchEditRow(looking, 'r1', { name: 'ghee' });
    expect(applyProfiles(renamed, sent, [{ name: 'oil', profile: P.oil }])[1].profile).toBeUndefined();
    expect(applyProfiles(removeEditRow(looking, 'r1'), sent, [{ name: 'oil', profile: P.oil }])).toHaveLength(1);
  });
  it('lose the profile and method when a name is changed', () => {
    const rows = setAllMethods(editRowsFrom([aloo[0]]), 'boiled');
    expect(patchEditRow(rows, 'r0', { name: 'sweet potato' })[0]).toEqual({ key: 'r0', name: 'sweet potato', grams: '100', added: false });
    expect(patchEditRow(rows, 'r0', { grams: '120' })[0].profile).toBe(P.potato);
  });
});

describe('a food with no profiles, on opening Edit recipe', () => {
  const old: FoodIngredient[] = [
    { name: 'potato', grams: 100 },
    { name: 'zzq', grams: 20 },
  ];
  it('gets them from one call for all rows, the amounts counting as before cooking', async () => {
    const fetch = jest.fn(async (_names: string[], _dish?: string) => [
      { name: 'potato', profile: P.potato, method: 'boiled' as const },
      { name: 'zzq', unknown: true as const },
    ]);
    const out = await fillProfiles(fetch, old, 'Aloo');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(['potato', 'zzq'], 'Aloo');
    expect(out?.[0]).toMatchObject({ name: 'potato', rawGrams: 100, method: 'boiled', profile: P.potato });
    expect(out?.[1]).toEqual(old[1]);
  });
  it('asks nothing when every row has one, and gives null when the call fails', async () => {
    const fetch = jest.fn(async (_names: string[], _dish?: string) => []);
    expect(await fillProfiles(fetch, aloo)).toBe(aloo);
    expect(fetch).not.toHaveBeenCalled();
    expect(await fillProfiles(async () => Promise.reject(new Error('x')), old)).toBeNull();
  });
});

describe('opening Edit recipe with no tables on the phone', () => {
  const food = { id: 'ai:x', name: 'Aloo', ingredients: aloo } as unknown as FoodItem;
  it('goes to the server first even when every row has a profile, so the tables are asked for', async () => {
    const withProfiles = jest.fn(async (_f: FoodItem) => aloo);
    expect(opensWithLookUp(food, withProfiles, true)).toBe(false);
    expect(opensWithLookUp(food, withProfiles, false)).toBe(true);
    expect(opensWithLookUp(food, undefined, false)).toBe(false);
    await openRows(food, withProfiles, true);
    expect(withProfiles).not.toHaveBeenCalled();
    await openRows(food, withProfiles, false);
    expect(withProfiles).toHaveBeenCalledTimes(1);
  });
});
