import { describe, expect, it } from '@jest/globals';

import { FAKE_TABLES } from './fake-tables';
import { type GoldenFile, runCase } from './golden-check';
import { readJson, testsDir } from './node-io';

const golden = readJson(`${testsDir()}/fake-golden.json`) as GoldenFile;

describe('fake golden file (invented numbers, worked with the server maths)', () => {
  it('has the cases the contract asks for', () => {
    const ids = golden.cases.map((c) => c.id);
    expect(golden.calc).toBe('c1');
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of ['raw', 'soaked', 'sprouted', 'boiled', 'boiled-drained', 'pressure-cooked', 'steamed', 'simmered', 'stir-fried', 'shallow-fried', 'deep-fried', 'roasted', 'grilled', 'unknown', 'not-said']) {
      expect(ids).toContain(`method-${m}`);
    }
    for (const id of ['aloo-fry', 'aloo-fry-no-oil', 'rice-dal', 'rice-raw-basis', 'rice-cooked-basis', 'deep-fried-pan-oil-listed-larger', 'deep-fried-pan-oil-listed-smaller', 'deep-fried-oil-unsaid-larger', 'deep-fried-no-oil-line', 'dough-with-water', 'rice-cooked-record', 'fried-record-in-dish-oil', 'meat-roasted', 'alcohol-boils-off', 'missing-key-in-one-line', 'pending-line']) {
      expect(ids).toContain(id);
    }
  });

  it.each(golden.cases.map((c) => [c.id, c] as const))('case %s', (_id, c) => {
    expect(runCase(FAKE_TABLES, c, golden.tolerance)).toEqual([]);
  });

  it('actually checks: a wrong number is caught', () => {
    const c = JSON.parse(JSON.stringify(golden.cases.find((x) => x.id === 'aloo-fry'))) as (typeof golden.cases)[number];
    c.expect.kcal += 5;
    expect(runCase(FAKE_TABLES, c, golden.tolerance)).not.toEqual([]);
  });
});
