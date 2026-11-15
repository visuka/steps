/**
 * Loads and checks the factor tables the phone gets from GET /v1/food/cooking
 * (cooking-c1.json). The tables are never in this repo or the APK: they arrive
 * at run time and are kept in private storage. Anything of an unknown version
 * or the wrong shape is no tables at all, and the app uses the server's look-up.
 */
import { readMissing, readNutrients } from '@/api/food-read';

import { isCookMethod } from './methods';
import { CALC, type Coating, type CookMethod, type CookingTables, type OilUptakeRow } from './types';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Keys that would reach Object.prototype if they were assigned. */
const safe = (key: string): boolean => key !== '__proto__';

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const COATINGS: readonly Coating[] = ['none', 'batter', 'breaded'];

/** A plain-object map whose entries pass `read` (undefined = drop the entry); null when `v` isn't an object. */
function mapOf<T>(v: unknown, read: (value: unknown, key: string) => T | undefined): Record<string, T> | null {
  if (!isObject(v)) return null;
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(v)) {
    if (!safe(key)) continue;
    const item = read(value, key);
    if (item !== undefined) out[key] = item;
  }
  return out;
}

/** A map keyed by cooking method: unknown methods are left out. */
function byMethod<T>(v: unknown, read: (value: unknown) => T | undefined): Partial<Record<CookMethod, T>> | null {
  return mapOf(v, (value, key) => (isCookMethod(key) ? read(value) : undefined)) as Partial<Record<CookMethod, T>> | null;
}

function readOilRow(v: unknown): OilUptakeRow | null {
  if (!isObject(v) || !isCookMethod(v.method)) return null;
  const u = num(v.u);
  if (u === null || u < 0 || u > 100) return null;
  const row: OilUptakeRow = { method: v.method, u };
  if (Array.isArray(v.classes)) row.classes = v.classes.filter((c): c is string => typeof c === 'string');
  if (typeof v.names === 'string') row.names = v.names;
  if (Array.isArray(v.coating)) row.coating = v.coating.filter((c): c is Coating => COATINGS.includes(c as Coating));
  const y = num(v.y);
  if (y !== null && y > 0) row.y = y;
  if (v.withWater === true) row.withWater = true;
  const waterLeft = num(v.waterLeft);
  if (waterLeft !== null) row.waterLeft = waterLeft;
  return row;
}

/**
 * The tables from a kept or fresh answer: the tables themselves, or the whole
 * `{calc, tables}` answer. Null when the version isn't the one this build
 * knows or any part has the wrong shape.
 */
export function readTables(json: unknown): CookingTables | null {
  let t = json;
  if (isObject(t) && isObject(t.tables)) {
    if (t.calc !== CALC) return null;
    t = { calc: t.calc, ...t.tables };
  }
  if (!isObject(t) || t.calc !== CALC) return null;

  const methods = mapOf(t.methods, (value, key) => {
    if (!isCookMethod(key) || !isObject(value) || !Array.isArray(value.sameAs)) return undefined;
    return { sameAs: value.sameAs.filter(isCookMethod), liquidEaten: value.liquidEaten === true };
  });
  const retentionMap = mapOf(t.retentionMap, (row) =>
    mapOf(row, (code) => (typeof code === 'string' && code ? code : undefined)) ?? undefined,
  );
  const retention = isObject(t.retention) ? t.retention : null;
  const proxies = mapOf(retention?.proxies, (p) => (typeof p === 'string' ? p : undefined));
  const codes = mapOf(retention?.codes, (factors) =>
    mapOf(factors, (n) => {
      const v = num(n);
      return v !== null && v >= 0 && v <= 100 ? v : undefined;
    }) ?? undefined,
  );
  const y = isObject(t.yields) ? t.yields : null;
  const limits = Array.isArray(y?.limits) ? y.limits.map(num) : [];
  const classes = mapOf(y?.classes, (row) =>
    byMethod(row, (e) => {
      const v = num(e);
      if (v !== null) return v > 0 ? v : undefined;
      const p = isObject(e) ? num(e.protein) : null;
      return p !== null && p > 0 ? { protein: p } : undefined;
    }) ?? undefined,
  );
  const methodYields = byMethod(y?.methods, (e) => {
    const v = num(e);
    return v !== null && v > 0 ? v : undefined;
  });
  const gravyWater = byMethod(y?.gravyWater, (e) => {
    const v = num(e);
    return v !== null && v >= 0 && v <= 1 ? v : undefined;
  });
  const fatDrip = mapOf(t.fatDrip, (row) =>
    byMethod(row, (e) => {
      const v = num(e);
      return v !== null && v > 0 && v <= 1 ? v : undefined;
    }) ?? undefined,
  );
  const oilRows = Array.isArray(t.oilUptake) ? t.oilUptake : null;
  const oils = isObject(t.oils) ? t.oils : null;
  const byCountry = mapOf(oils?.byCountry, (id) => (typeof id === 'string' && id ? id : undefined));
  const foods = mapOf(oils?.foods, (f) => {
    if (!isObject(f) || typeof f.name !== 'string' || !isObject(f.per100g)) return undefined;
    return { name: f.name, per100g: readNutrients(f.per100g), missing: readMissing(f.missing) };
  });

  const [lo, hi] = limits;
  if (
    !methods || !retentionMap || !proxies || !codes || !classes || !methodYields || !gravyWater || !fatDrip || !oilRows ||
    !byCountry || !foods || typeof lo !== 'number' || typeof hi !== 'number' || !(lo > 0 && lo < hi) || limits.length !== 2
  ) {
    return null;
  }
  const oilUptake = oilRows.map(readOilRow).filter((r): r is OilUptakeRow => r !== null);
  return {
    calc: CALC,
    methods,
    retentionMap: retentionMap as CookingTables['retentionMap'],
    retention: { proxies, codes },
    yields: { limits: [lo, hi], classes: classes as CookingTables['yields']['classes'], methods: methodYields, gravyWater },
    fatDrip: fatDrip as CookingTables['fatDrip'],
    oilUptake,
    oils: { byCountry, foods },
  };
}

/** The calc version of a kept or fresh answer, or null. */
export function calcOf(json: unknown): string | null {
  return isObject(json) && typeof json.calc === 'string' ? json.calc : null;
}
