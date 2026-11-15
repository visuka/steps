/**
 * The golden-case format of stepsinfra docs/app-cooking-contract.md section 4
 * and the one check both the fake and the real golden tests use.
 */
import { cookDish } from '../cook';
import { DECIMALS } from '../mix';
import type { Basis, Coating, CookedDish, CookingTables, IngredientProfile, LineKind, OilRole, PanOil, CookMethod } from '../types';
import type { NutrientKey, Nutrients } from '../../types';

export interface GoldenTolerance {
  kcal: number;
  nutrientRel: number;
  grams: number;
}

export interface GoldenCase {
  id: string;
  input: {
    dishName: string;
    country: string;
    panOil?: PanOil;
    lines: {
      name: string;
      kind?: LineKind;
      grams: number;
      basis: Basis;
      method?: CookMethod;
      role?: OilRole | null;
      coating?: Coating;
      profile: IngredientProfile;
    }[];
  };
  expect: GoldenExpect;
}

export interface GoldenExpect {
  lines: { name: string; rawGrams: number; grams: number; oilGrams: number; role?: OilRole }[];
  weight: number;
  oilAdded: number;
  kcal: number;
  per100g: Nutrients;
  missing: NutrientKey[];
}

export interface GoldenFile {
  calc: 'c1';
  tables?: string;
  tolerance: GoldenTolerance;
  cases: GoldenCase[];
}

/** What went wrong in one case, as short sentences; empty when it passes. */
export function checkGolden(expected: GoldenExpect, got: CookedDish, tol: GoldenTolerance): string[] {
  const bad: string[] = [];
  if (Math.abs(got.kcal - expected.kcal) > tol.kcal) bad.push(`kcal ${got.kcal} vs ${expected.kcal}`);
  if (Math.abs(got.weight - expected.weight) > tol.grams) bad.push(`weight ${got.weight} vs ${expected.weight}`);
  if (Math.abs(got.oilAdded - expected.oilAdded) > tol.grams) bad.push(`oilAdded ${got.oilAdded} vs ${expected.oilAdded}`);
  if (got.lines.length !== expected.lines.length) {
    bad.push(`${got.lines.length} lines vs ${expected.lines.length}`);
  } else {
    expected.lines.forEach((e, i) => {
      const g = got.lines[i];
      for (const f of ['rawGrams', 'grams', 'oilGrams'] as const) {
        if (Math.abs(g[f] - e[f]) > tol.grams) bad.push(`${e.name} ${f} ${g[f]} vs ${e[f]}`);
      }
      if (g.role !== e.role) bad.push(`${e.name} role ${g.role} vs ${e.role}`);
    });
  }
  for (const key of Object.keys(expected.per100g) as NutrientKey[]) {
    const e = expected.per100g[key]!;
    const v = got.per100g[key];
    if (v === undefined) bad.push(`${key} missing, expected ${e}`);
    else if (Math.abs(v - e) > Math.max(tol.nutrientRel * Math.abs(e), 10 ** -DECIMALS[key] + 1e-9)) bad.push(`${key} ${v} vs ${e}`);
  }
  for (const key of Object.keys(got.per100g)) {
    if (expected.per100g[key as NutrientKey] === undefined) bad.push(`extra ${key}`);
  }
  const a = [...expected.missing].sort().join(',');
  const b = [...got.missing].sort().join(',');
  if (a !== b) bad.push(`missing [${b}] vs [${a}]`);
  return bad;
}

/** Works one case out with the phone's maths and checks it. */
export function runCase(tables: CookingTables, c: GoldenCase, tol: GoldenTolerance): string[] {
  const lines = c.input.lines.map((l) => ({ ...l, kind: l.kind ?? l.profile.kind }));
  const got = cookDish({ lines, dishName: c.input.dishName, country: c.input.country, panOil: c.input.panOil }, tables);
  return checkGolden(c.expect, got, tol);
}
