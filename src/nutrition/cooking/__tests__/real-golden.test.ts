/**
 * Runs the phone's cooking maths on the REAL tables and golden file, which live
 * in stepsinfra and never in this repo. Skipped unless both paths are given
 * (scripts/check_app_cooking.sh in stepsinfra, or scripts/check-cooking-golden.js).
 * Read with fs at run time, never imported, so nothing reaches the transform cache.
 */
import { describe, expect, it } from '@jest/globals';

import { readTables } from '../tables';
import { type GoldenFile, runCase } from './golden-check';
import { env, readJson } from './node-io';

const tablesPath = env('STEPS_COOKING_TABLES');
const goldenPath = env('STEPS_COOKING_GOLDEN');
const given = !!tablesPath && !!goldenPath;

(given ? describe : describe.skip)('real golden file', () => {
  const tables = given ? readTables(readJson(tablesPath!)) : null;
  const golden = given ? (readJson(goldenPath!) as GoldenFile) : null;

  it('reads the tables', () => {
    expect(tables).not.toBeNull();
  });

  const cases = golden?.cases ?? [];
  for (const c of cases) {
    it(c.id, () => {
      expect(tables).not.toBeNull();
      expect(runCase(tables!, c, golden!.tolerance)).toEqual([]);
    });
  }
});
