import { describe, expect, it } from '@jest/globals';

import type { FoodEntry } from '@/data/types';
import {
  findFood,
  goodSources,
  gramsFor,
  isSavedFoodId,
  keepPastEntries,
  OWN_PREFIX,
  searchFoods,
  searchIn,
} from '@/nutrition/catalog';
import { byStorage, dailyAverage, entryNutrients, lowestNutrients, overLimits } from '@/nutrition/day';
import { FOODS } from '@/nutrition/foods.generated';
import { NUTRIENTS } from '@/nutrition/nutrients';
import type { FoodItem, Nutrients, OwnFood } from '@/nutrition/types';

/** Synthetic foods only: the built-in list is regenerated separately. */
const item = (id: string, name: string, over: Partial<FoodItem> = {}): FoodItem => ({
  id,
  name,
  aliases: [],
  category: 'dish',
  per100g: { kcal: 100 },
  units: [
    { key: 'bowl', label: 'bowl', grams: 200 },
    { key: 'g', label: 'grams', grams: 1 },
  ],
  defaultUnit: 'bowl',
  source: 'test',
  ...over,
});

const entry = (over: Partial<FoodEntry>): FoodEntry => ({
  id: 'e',
  loggedAt: new Date(2026, 9, 30, 13).getTime(),
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

const kootu = item('recipe:0123456789ab', 'Zqxv kootu', { per100g: { kcal: 80, protein: 4, vitC: 5 } });
const dosa = item('ai:abcdef012345', 'Zqxv masala dosa', { aliases: ['zqxv dose'] });

describe('saved foods in the catalog', () => {
  it('tells saved ids from the rest', () => {
    expect(isSavedFoodId(kootu.id)).toBe(true);
    expect(isSavedFoodId(dosa.id)).toBe(true);
    expect(isSavedFoodId(`${OWN_PREFIX}k1`)).toBe(false);
    expect(isSavedFoodId('rice')).toBe(false);
  });

  it('finds saved foods by id, after own and built-in foods', () => {
    expect(findFood(kootu.id, [], [kootu, dosa])).toBe(kootu);
    expect(findFood(kootu.id, [])).toBeNull();
    expect(findFood('ai:missing', [], [kootu])).toBeNull();
    // A saved copy of a built-in food never hides the built-in one.
    const builtIn = FOODS[0];
    expect(findFood(builtIn.id, [], [item(builtIn.id, 'Stale copy')])).toBe(builtIn);
  });

  it('searches saved foods by name and alias', () => {
    expect(searchFoods('zqxv', [], [kootu, dosa]).map((f) => f.id).sort()).toEqual([dosa.id, kootu.id].sort());
    expect(searchFoods('zqxv koo', [], [kootu])[0]).toBe(kootu);
    expect(searchFoods('zqxv dose', [], [kootu, dosa])[0]).toBe(dosa);
    expect(searchFoods('zqxv', [])).toEqual([]);
  });

  it('ranks own foods, then saved ones, then the rest on ties', () => {
    const own: OwnFood = { id: 'k1', name: 'Zqxv halwa', serving: 'plate', nutrients: { kcal: 300 }, updatedAt: 0 };
    const plain = item('zqxv-ladoo', 'Zqxv ladoo');
    const ids = searchIn('zqxv', [plain, item(dosa.id, 'Zqxv ladoo'), { ...item(`${OWN_PREFIX}k1`, own.name), category: 'own' }]).map(
      (f) => f.id,
    );
    expect(ids).toEqual([`${OWN_PREFIX}k1`, dosa.id, 'zqxv-ladoo']);
    expect(searchFoods('zqxv', [own], [dosa])[0].id).toBe(`${OWN_PREFIX}k1`);
  });

  it('leaves recipe ingredients out of search', () => {
    const raw = item('zqxv-dal-raw', 'Zqxv dal (raw)', { ingredientOnly: true });
    const cooked = item('zqxv-dal', 'Zqxv dal', { cooked: true });
    expect(searchIn('zqxv dal', [raw, cooked]).map((f) => f.id)).toEqual(['zqxv-dal']);
    // Whatever the built-in list holds, its ingredient-only foods never show.
    for (const f of FOODS.filter((x) => x.ingredientOnly)) {
      expect(searchFoods(f.name, []).some((r) => r.id === f.id)).toBe(false);
    }
  });

  it('shows a duplicate id once', () => {
    expect(searchIn('zqxv', [dosa, { ...dosa, name: 'Zqxv dosa again' }])).toHaveLength(1);
  });

  it('suggests good sources only among everyday foods', () => {
    const iron = (id: string, ironPer100: number, over: Partial<FoodItem> = {}) =>
      item(id, id, { per100g: { kcal: 100, iron: ironPer100 }, ...over });
    const list = [
      iron('greens', 3),
      iron('dal', 2),
      iron('raw-dal', 8, { ingredientOnly: true }),
      iron('samosa', 6, { flags: ['deep-fried'] }),
      iron('masala', 30, { category: 'spice' }),
      iron('jaggery', 10, { category: 'sweet' }),
      iron('rice', 0),
      iron('egg', 1, { units: [{ key: 'piece', label: 'egg', grams: 50 }], defaultUnit: 'piece' }),
    ];
    expect(goodSources('iron', 5, list).map((s) => [s.food.id, s.amount])).toEqual([
      ['greens', 6],
      ['dal', 4],
      ['egg', 0.5],
    ]);
  });
});

describe('saving a food again', () => {
  const asPlates = item(kootu.id, kootu.name, {
    units: [
      { key: 'plate', label: 'plate', grams: 400 },
      { key: 'g', label: 'grams', grams: 1 },
    ],
    defaultUnit: 'plate',
  });

  it('replaces a saved food when its units are unchanged', () => {
    const updated = { ...kootu, per100g: { kcal: 85 } };
    expect(keepPastEntries(updated, [kootu, dosa])).toBe(updated);
    expect(keepPastEntries(kootu, [])).toBe(kootu);
  });

  it('gives a recipe entered with another unit or size its own id, so past entries stay as they were', () => {
    const kept = keepPastEntries(asPlates, [kootu]);
    expect(kept.id).not.toBe(kootu.id);
    expect(isSavedFoodId(kept.id)).toBe(true);
    // The entry logged as 2 bowls still reads 2 × 200 g from the old food.
    expect(gramsFor(findFood(kootu.id, [], [kootu, kept])!, 'bowl', 2, {})).toBe(400);

    const twoBowls = item(kootu.id, kootu.name, { units: [{ key: 'bowl', label: 'bowl', grams: 400 }, { key: 'g', label: 'grams', grams: 1 }] });
    expect(keepPastEntries(twoBowls, [kootu]).id).not.toBe(kootu.id);
  });

  it('reuses the same new id for the same units, and keeps ids short enough to read back', () => {
    const once = keepPastEntries(asPlates, [kootu]);
    expect(keepPastEntries(asPlates, [kootu, once]).id).toBe(once.id);
    const long = item(`ai:${'x'.repeat(77)}`, 'Long');
    const changed = { ...long, units: [{ key: 'g', label: 'grams', grams: 1 }] };
    expect(keepPastEntries(changed, [long]).id.length).toBeLessThanOrEqual(80);
  });
});

describe('day helpers', () => {
  it('works out entries of saved foods, and falls back to calories when one is gone', () => {
    const e = entry({ foodId: kootu.id, unit: 'bowl', quantity: 2, kcal: 999 });
    expect(entryNutrients(e, [], {}, [kootu])).toEqual({ kcal: 320, protein: 16, vitC: 20 });
    expect(entryNutrients(e, [], { [`${kootu.id}:bowl`]: 100 }, [kootu]).kcal).toBeCloseTo(160);
    expect(entryNutrients(e, [], {})).toEqual({ kcal: 999 });
  });

  it('averages days with saved foods in them', () => {
    const days = [29, 30].map((d) =>
      entry({ loggedAt: new Date(2026, 9, d, 9).getTime(), foodId: kootu.id, unit: 'bowl', quantity: d === 29 ? 1 : 3 }),
    );
    const { days: n, average } = dailyAverage(days, [], {}, [kootu]);
    expect(n).toBe(2);
    expect(average.kcal).toBeCloseTo(320);
    expect(average.vitC).toBeCloseTo(20);
  });

  it('finds what is low only among nutrients with a daily target', () => {
    const average: Nutrients = {
      vitC: 45, // 50%
      iron: 9, // 50%
      protein: 10, // 20%
      calcium: 1300, // 100%: not low
      sodium: 10, // a limit, never "low"
      sugars: 1,
      gl: 1,
      kcal: 100, // energy is not on the list
      omega3: 0.1, // a macro, but not one of protein and fibre
    };
    const low = lowestNutrients(average, 10);
    expect(low.map((l) => l.key)).toEqual(['protein', 'vitC', 'iron']);
    expect(low[0].percent).toBe(20);
    expect(lowestNutrients({}, 3)).toEqual([]);
  });

  it('lists limits reached or passed, furthest over first', () => {
    const over = overLimits({ sodium: 2500, addedSugar: 50, satFat: 10, alcohol: 40, caffeine: 800, vitA: 5000 });
    expect(over).toEqual([
      { key: 'caffeine', percent: 200 },
      { key: 'sodium', percent: 125 },
      { key: 'addedSugar', percent: 100 },
    ]);
    expect(overLimits({})).toEqual([]);
  });

  it('splits vitamins and minerals by how the body keeps them', () => {
    const { daily, stored } = byStorage();
    const micros = NUTRIENTS.filter((n) => n.group === 'vitamin' || n.group === 'mineral').map((n) => n.key);
    expect([...daily, ...stored].map((n) => n.key).sort()).toEqual([...micros].sort());
    expect(daily.map((n) => n.key)).toContain('vitC');
    expect(stored.map((n) => n.key)).toContain('vitA');
    expect(daily.every((n) => n.storage !== 'stored')).toBe(true);
    expect(stored.every((n) => n.storage === 'stored')).toBe(true);
  });
});
