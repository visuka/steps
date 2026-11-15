import { describe, expect, it } from '@jest/globals';

import { readTables } from '../tables';
import { FAKE_TABLES } from './fake-tables';

const copy = () => JSON.parse(JSON.stringify(FAKE_TABLES)) as Record<string, any>;

describe('readTables', () => {
  it('keeps good tables whole', () => {
    expect(readTables(copy())).toEqual(FAKE_TABLES);
  });

  it('takes the whole answer of GET /v1/food/cooking too', () => {
    const { calc, ...tables } = copy();
    expect(readTables({ calc, tables })).toEqual(FAKE_TABLES);
  });

  it('treats a version it does not know as no tables', () => {
    expect(readTables({ ...copy(), calc: 'c2' })).toBeNull();
    const { calc, ...tables } = copy();
    expect(readTables({ calc: 'c2', tables })).toBeNull();
    expect(readTables({ calc, tables: undefined })).toBeNull();
  });

  it('is null for the "same" answer, nothing, and non-objects', () => {
    expect(readTables({ calc: 'c1', same: true })).toBeNull();
    for (const v of [null, undefined, 3, 'x', [], {}]) expect(readTables(v)).toBeNull();
  });

  it('is null when a part has the wrong shape', () => {
    for (const key of ['methods', 'retentionMap', 'retention', 'yields', 'fatDrip', 'oilUptake', 'oils']) {
      const t = copy();
      t[key] = 'oops';
      expect(readTables(t)).toBeNull();
    }
    const t = copy();
    t.yields.limits = [2, 1];
    expect(readTables(t)).toBeNull();
    const u = copy();
    delete u.oils.foods;
    expect(readTables(u)).toBeNull();
  });

  it('drops single bad entries, so a missing entry means nothing is known', () => {
    const t = copy();
    t.retention.codes.R1.vitC = 150; // not a percentage
    t.yields.classes.tuber['deep-fried'] = -1;
    t.yields.classes.tuber.frying = 0.5; // not a method
    t.oilUptake.unshift({ method: 'deep-fried', u: 500 }, { method: 'poaching', u: 1 }, 'x');
    t.fatDrip.meat.roasted = 1.5;
    const got = readTables(t)!;
    expect(got.retention.codes.R1.vitC).toBeUndefined();
    expect(got.yields.classes.tuber['deep-fried']).toBeUndefined();
    expect(got.oilUptake).toEqual(FAKE_TABLES.oilUptake);
    expect(got.fatDrip.meat.roasted).toBeUndefined();
    expect(got.yields.classes.tuber).not.toHaveProperty('frying');
  });

  it('never lets a key reach Object.prototype', () => {
    const t = JSON.parse(JSON.stringify(copy()).replace('"tuber":', '"__proto__":')) as unknown;
    const got = readTables(t)!;
    expect(({} as Record<string, unknown>).boiled).toBeUndefined();
    expect(Object.keys(got.retentionMap)).not.toContain('__proto__');
  });

  it('reads the oil values as nutrients', () => {
    const t = copy();
    t.oils.foods['fake-oil'].per100g = { kcal: 900, fat: -3, bogus: 4 };
    expect(readTables(t)!.oils.foods['fake-oil'].per100g).toEqual({ kcal: 900 });
  });
});
