import { describe, expect, it } from '@jest/globals';

import type { FoodIngredient } from '../../types';
import { cookDish, cookInputOf } from '../cook';
import { CALC, type CookLine, type CookMethod, type CookingTables, type IngredientProfile } from '../types';
import { FAKE_PROFILES as P, FAKE_TABLES } from './fake-tables';

/** A line of the fake dish: grams as said (raw by default). */
const line = (key: string, grams: number, method?: CookMethod, over: Partial<CookLine> = {}): CookLine => ({
  name: key,
  kind: P[key].kind,
  grams,
  basis: 'raw',
  method,
  profile: P[key],
  ...over,
});

const inDish = { role: 'in-dish' } as const;

const dish = (lines: CookLine[], over: { name?: string; country?: string } = {}) =>
  cookDish({ lines, dishName: over.name ?? 'dish', country: over.country ?? 'IN' }, FAKE_TABLES);

/** Tables with nothing in them: every factor is missing. */
const EMPTY: CookingTables = {
  calc: CALC,
  methods: {},
  retentionMap: {},
  retention: { proxies: {}, codes: {} },
  yields: { limits: [0.25, 4], classes: {}, methods: {}, gravyWater: {} },
  fatDrip: {},
  oilUptake: [],
  oils: { byCountry: {}, foods: {} },
};

const near = (a: number, b: number, rel = 0.01) => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b));

describe('cookDish: unknown stays unknown', () => {
  it('a nutrient no line has is left out, never 0', () => {
    const d = dish([line('rice', 100, 'boiled')]);
    expect(d.per100g.kcal).toBeGreaterThan(0);
    expect('vitC' in d.per100g).toBe(false);
    expect('vitA' in d.per100g).toBe(false);
  });

  it('a nutrient only some lines have is added up from those and named as "at least"', () => {
    const d = dish([line('dal', 50, 'boiled'), line('spinach', 100, 'boiled')]);
    expect(d.per100g.vitC).toBeGreaterThan(0);
    expect(d.missing).toContain('vitC');
    expect(d.missing).not.toContain('protein');
  });

  it('a key the profile says is only "at least" is carried into missing', () => {
    expect(dish([line('dal', 50, 'boiled')]).missing).toContain('folate');
  });

  it('an unknown method keeps the food as it is and says so in a note', () => {
    const d = dish([line('potato', 100, 'unknown')]);
    expect(d.lines[0].grams).toBeCloseTo(100);
    expect(d.lines[0].rawGrams).toBeCloseTo(100);
    expect(d.per100g.vitC).toBeCloseTo(20);
    expect(d.notes).toEqual([{ kind: 'unknown-method', name: 'potato' }]);
  });

  it('a method that was not said does the same without a note', () => {
    const d = dish([line('potato', 100)]);
    expect(d.lines[0].grams).toBeCloseTo(100);
    expect(d.per100g.vitC).toBeCloseTo(20);
    expect(d.notes).toEqual([]);
  });

  it('with no table entries a yield is 1, nothing is lost and no oil is added', () => {
    const lines = [line('chicken', 100, 'deep-fried'), line('spinach', 50, 'stir-fried')];
    const d = cookDish({ lines, dishName: 'x', country: 'IN' }, EMPTY);
    expect(d.lines.map((l) => l.grams)).toEqual([100, 50]);
    expect(d.oilAdded).toBe(0);
    expect(d.per100g.vitC).toBeCloseTo((28 * 50) / 150, 0);
  });

  it('a food class named like an Object property finds nothing', () => {
    const odd: IngredientProfile = { ...P.potato, cookClass: 'constructor', yieldClass: '__proto__', yields: {}, cooked: {} };
    const d = dish([{ ...line('potato', 100, 'boiled'), profile: odd }]);
    expect(d.lines[0].grams).toBeCloseTo(100);
    expect(d.per100g.vitC).toBeCloseTo(20);
  });

  it('bad grams count as nothing and never produce NaN', () => {
    const d = dish([line('potato', Number.NaN, 'boiled'), line('rice', 100, 'boiled')]);
    expect(d.lines[0].grams).toBe(0);
    expect(Number.isFinite(d.kcal)).toBe(true);
    expect(Number.isFinite(d.per100g.kcal!)).toBe(true);
  });

  it('an empty dish is an empty answer', () => {
    expect(dish([])).toMatchObject({ weight: 0, kcal: 0, per100g: {}, missing: [], lines: [] });
  });
});

describe('cookDish: oil is never counted twice', () => {
  it('oil listed in the dish covers a shallow fry: no extra oil is taken up', () => {
    const d = dish([line('potato', 100, 'shallow-fried'), line('oil', 10, undefined, inDish)]);
    expect(d.oilAdded).toBe(0);
    expect(d.lines[1]).toMatchObject({ grams: 10, oilGrams: 0, role: 'in-dish' });
  });

  it('without oil in the dish the same fry takes up the default oil of the country', () => {
    const d = dish([line('potato', 100, 'shallow-fried')]);
    expect(d.oilAdded).toBeCloseTo(5);
    expect(d.lines[0].grams).toBeCloseTo(50 + 5);
    const other = dish([line('potato', 100, 'shallow-fried')], { country: 'XX' });
    expect(other.kcal).toBeLessThan(d.kcal); // the other country's oil has fewer kcal per gram
  });

  it('a fried record is worked out from raw when the dish lists its oil', () => {
    const alone = dish([line('potato', 150, 'deep-fried')]);
    expect(alone.oilAdded).toBe(0); // the record's own numbers already hold its frying oil
    expect(alone.lines[0].grams).toBeCloseTo(150 * (0.45 + 0.1));
    const withOil = dish([line('potato', 150, 'deep-fried'), line('oil', 10, undefined, inDish)]);
    expect(withOil.lines[0].rawGrams).toBeCloseTo(150);
    expect(withOil.lines[0].grams - withOil.lines[0].oilGrams).toBeCloseTo(150 * 0.45); // the record's oil is not in it
    expect(withOil.oilAdded).toBeCloseTo(12); // deep-fried food always takes up its own oil
  });

  it('oil listed without a role is never counted on top of what the frying takes up', () => {
    const fry = (g: number) => dish([line('potato', 200, 'deep-fried'), line('oil', g)]);
    const taken = fry(0.0001).oilAdded;
    expect(taken).toBeCloseTo(16, 1);
    const small = fry(5); // eaten 5 g, so the frying only takes up the rest
    expect(small.oilAdded + 5).toBeCloseTo(taken, 1);
    expect(small.lines[1]).toMatchObject({ role: 'in-dish', grams: 5 });
    const big = fry(500); // at least what is taken up: the pan's oil, not eaten
    expect(big.oilAdded).toBeCloseTo(taken, 1);
    expect(big.lines[1]).toMatchObject({ role: 'frying-medium', grams: 0 });
  });

  // Chicken has no fried record of its own, so its oil is always worked out.
  it('oil listed as the pan is taken up no more than it holds', () => {
    const none = dish([line('chicken', 200, 'deep-fried')]);
    const big = dish([line('chicken', 200, 'deep-fried'), line('oil', 500, undefined, { role: 'frying-medium' })]);
    expect(big.oilAdded).toBeCloseTo(none.oilAdded);
    const small = dish([line('chicken', 200, 'deep-fried'), line('oil', 3, undefined, { role: 'frying-medium' })]);
    expect(small.oilAdded).toBeCloseTo(3);
  });

  it('the dish-level pan oil decides which oil is taken up, and is not a row', () => {
    const lines = [line('chicken', 200, 'deep-fried')];
    const none = dish(lines);
    const named = cookDish({ lines, dishName: 'x', country: 'IN', panOil: { name: 'o', profile: P['oil-b'] } }, FAKE_TABLES);
    expect(named.oilAdded).toBeCloseTo(none.oilAdded);
    expect(named.per100g.vitE).toBeGreaterThan(0); // only the other oil has vitamin E
    expect(named.lines).toHaveLength(1);
    const listed = cookDish({ lines, dishName: 'x', country: 'IN', panOil: { name: 'o', grams: 4, profile: P['oil-b'] } }, FAKE_TABLES);
    expect(listed.oilAdded).toBeCloseTo(4);
    expect(listed.lines).toHaveLength(1);
  });
});

describe('cookDish: raw and cooked basis give the same dish', () => {
  const same = (a: ReturnType<typeof dish>, b: ReturnType<typeof dish>) => {
    expect(near(a.weight, b.weight)).toBe(true);
    expect(near(a.kcal, b.kcal)).toBe(true);
    for (const [k, v] of Object.entries(a.per100g)) expect(near(v, b.per100g[k as keyof typeof b.per100g]!)).toBe(true);
  };

  it('boiled rice weighed raw or as eaten', () => {
    same(dish([line('brown-rice', 100, 'boiled')]), dish([line('brown-rice', 250, 'boiled', { basis: 'cooked' })]));
  });

  it('a fried food weighed raw or as eaten, oil included', () => {
    const raw = dish([line('potato', 100, 'shallow-fried')]);
    const cooked = dish([line('potato', 55, 'shallow-fried', { basis: 'cooked' })]);
    same(raw, cooked);
    expect(cooked.lines[0].rawGrams).toBeCloseTo(100);
  });

  it('meat roasted weighed either way', () => {
    same(dish([line('chicken', 200, 'roasted')]), dish([line('chicken', 150, 'roasted', { basis: 'cooked' })]));
  });
});

describe('cookInputOf', () => {
  const ing = (key: string, over: Partial<FoodIngredient> = {}): FoodIngredient => ({ name: key, grams: 10, profile: P[key], ...over });

  it('leaves a row without a usable profile out and says so', () => {
    const odd = { ...P.potato, calc: 'c9' } as unknown as IngredientProfile;
    const rows: FoodIngredient[] = [ing('rice', { rawGrams: 100, method: 'boiled' }), { name: 'mystery', grams: 5 }, { name: 'old', grams: 5, profile: odd }];
    const input = cookInputOf(rows, 'dal rice', 'IN', FAKE_TABLES);
    expect(input.lines.map((l) => l.name)).toEqual(['rice']);
    const d = cookDish(input, FAKE_TABLES);
    expect(d.lines).toHaveLength(1);
    expect(d.notes).toEqual([
      { kind: 'left-out', name: 'mystery' },
      { kind: 'left-out', name: 'old' },
    ]);
  });

  it('takes grams from rawGrams, then the profile', () => {
    expect(cookInputOf([ing('rice', { rawGrams: 80 })], 'd', 'IN', FAKE_TABLES).lines[0].grams).toBe(80);
    expect(cookInputOf([ing('rice', { profile: { ...P.rice, rawGrams: 60 } })], 'd', 'IN', FAKE_TABLES).lines[0].grams).toBe(60);
  });

  it('gives salt, spices and oil no method, and water its own', () => {
    const rows = [ing('salt', { method: 'boiled' }), ing('oil', { method: 'deep-fried' }), ing('water', { method: 'boiled-drained' }), ing('rice', { method: 'boiled' })];
    const input = cookInputOf(rows, 'd', 'IN', FAKE_TABLES);
    expect(input.lines.map((l) => l.method)).toEqual([undefined, undefined, 'boiled-drained', 'boiled']);
  });

  it('works the same dish out from rows as from lines', () => {
    const rows: FoodIngredient[] = [
      { name: 'potato', grams: 50, rawGrams: 100, method: 'shallow-fried', profile: P.potato },
      { name: 'oil', grams: 10, rawGrams: 10, profile: { ...P.oil, role: 'in-dish' } },
    ];
    const built = cookDish(cookInputOf(rows, 'aloo fry', 'IN', FAKE_TABLES), FAKE_TABLES);
    const direct = dish([line('potato', 100, 'shallow-fried'), line('oil', 10, undefined, inDish)], { name: 'aloo fry' });
    expect(built).toEqual(direct);
  });
});
