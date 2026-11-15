/**
 * The phone's cooking maths (plan T15c, calc `c1`), written to
 * stepsinfra docs/app-cooking-contract.md section 5 and mirroring the
 * server's cooking.work(). Pure functions: the factor tables come in as an
 * argument and nothing here knows a factor value.
 *
 * cookIngredient does one line (steps 1-7); cookDish runs the whole dish
 * (steps 8-15). A table entry that is missing means yield 1, nothing lost and
 * no oil; a nutrient that is unknown stays unknown, never 0.
 */
import type { FoodIngredient, NutrientKey, Nutrients } from '../types';
import { mixKnown, type Part } from './mix';
import {
  CALC,
  type CookInput,
  type CookLine,
  type CookMethod,
  type CookNote,
  type CookedDish,
  type CookedLine,
  type CookingTables,
  type IngredientProfile,
  type OilRole,
  type OilUptakeRow,
  type PanOil,
} from './types';

const FRIED: readonly CookMethod[] = ['stir-fried', 'shallow-fried', 'deep-fried'];
const WET: readonly CookMethod[] = ['boiled', 'boiled-drained', 'pressure-cooked', 'steamed', 'simmered'];
const FAT_KEYS: readonly NutrientKey[] = ['fat', 'satFat', 'transFat', 'omega3'];
const KCAL_PER_G = { fat: 9, alcohol: 7 };
const ROW_YIELD_MAX = 4;
const MAX_GRAMS = 30_000;

/** What cookDish tells cookIngredient about the dish. */
export interface DishContext {
  /** Some oil line is eaten (its role isn't frying-medium; an unsaid role counts). */
  eatenOil: boolean;
  dishName: string;
}

/** One line worked through steps 1-7; cookDish finishes it. */
export interface LineWork {
  line: CookLine;
  rawGrams: number;
  /** As eaten; the frying oil is added at the end of cookDish. */
  grams: number;
  oilGrams: number;
  role: OilRole | null | undefined;
  /** The row's own values per 100 g, or null when nothing of it is eaten. */
  food: Nutrients | null;
  before: Nutrients;
  after: Nutrients;
  derived: boolean;
  fryable: boolean;
  oilRow: OilUptakeRow | null;
  doughWater: number;
  oil: Nutrients | null;
  /** Water (g) this line takes out of the pot (step 6). */
  absorbed: number;
}

// ── small helpers ────────────────────────────────────────────────────────

/** Own keys only: "constructor" is not a food class. */
function own<T>(table: Record<string, T> | undefined, key: string | undefined | null): T | undefined {
  return table && typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const positive = (v: unknown): v is number => isNum(v) && v > 0;
const grams = (v: unknown): number => (isNum(v) && v > 0 ? Math.min(v, MAX_GRAMS) : 0);
const known = (m: CookMethod | undefined): m is CookMethod => m !== undefined && m !== 'unknown';
const isRole = (r: unknown): r is OilRole => r === 'in-dish' || r === 'frying-medium';
const isFried = (m: CookMethod | undefined): m is CookMethod => m !== undefined && FRIED.includes(m);

/** Lower case, accents split off, everything that isn't a letter, digit or mark a space. */
export function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim();
}

/** The method and the ones the tables treat the same, in order. */
function tries(tables: CookingTables, m: CookMethod): CookMethod[] {
  return [m, ...(own(tables.methods, m)?.sameAs ?? [])];
}

function total(per100g: Nutrients, g: number): Nutrients {
  const out: Nutrients = {};
  for (const [k, v] of Object.entries(per100g) as [NutrientKey, number][]) {
    if (isNum(v)) out[k] = (v * g) / 100;
  }
  return out;
}

function scaled(n: Nutrients, k: number): Nutrients {
  const out: Nutrients = {};
  for (const [key, v] of Object.entries(n) as [NutrientKey, number][]) out[key] = v * k;
  return out;
}

const patterns = new Map<string, RegExp | null>();
function pattern(source: string): RegExp | null {
  let p = patterns.get(source);
  if (p === undefined) {
    try {
      p = new RegExp(source, 'i');
    } catch {
      p = null;
    }
    patterns.set(source, p);
  }
  return p;
}

// ── tables, one question each ────────────────────────────────────────────

/** Step 4: the first oil-uptake row that fits this fried food, or null. */
function oilRowFor(tables: CookingTables, line: CookLine, m: CookMethod, dishName: string): OilUptakeRow | null {
  const rec = line.profile;
  const texts = [line.name, rec.recName, dishName].map(norm).filter(Boolean);
  for (const row of tables.oilUptake) {
    if (row.method !== m) continue;
    if (row.classes?.length && !row.classes.includes(rec.cookClass)) continue;
    if (row.names) {
      const p = pattern(row.names);
      if (!p || !texts.some((t) => p.test(t))) continue;
    }
    if (row.coating?.length && !row.coating.includes(line.coating ?? 'none')) continue;
    if (isNum(row.u) && row.u >= 0 && row.u <= 100) return row;
  }
  return null;
}

/** Step 5: cooked weight / raw weight, frying oil excluded. */
function yieldOf(tables: CookingTables, rec: IngredientProfile, m: CookMethod | undefined, row: OilUptakeRow | null): number {
  if (row && positive(row.y) && row.y <= ROW_YIELD_MAX) return row.y;
  if (!known(m)) return 1;
  const [lo, hi] = tables.yields.limits;
  const clamp = (v: number) => Math.min(Math.max(v, lo), hi);
  const ways = tries(tables, m);
  for (const t of ways) {
    const y = own(rec.yields as Record<string, { y?: number }>, t)?.y;
    if (positive(y)) return clamp(y);
  }
  const klass = own(tables.yields.classes as Record<string, Record<string, number | { protein: number }>>, rec.yieldClass);
  for (const t of ways) {
    const e = own(klass, t);
    let v: number | undefined;
    if (isNum(e)) v = e;
    else if (e && positive(e.protein) && positive(rec.per100g.protein)) v = rec.per100g.protein / e.protein;
    if (positive(v)) return clamp(v);
  }
  const byMethod = own(tables.yields.methods as Record<string, number>, m);
  return positive(byMethod) ? clamp(byMethod) : 1;
}

/** Step 7: % of a nutrient kept under these retention factors. */
function keptPercent(tables: CookingTables, key: NutrientKey, factors: Record<string, number> | undefined, rec: IngredientProfile): number {
  if (!factors) return 100;
  const folic = own(factors, 'folicAcid');
  if (key === 'folate' && rec.folicAcid && folic !== undefined) return folic;
  const direct = own(factors, key);
  if (direct !== undefined) return direct;
  const viaProxy = own(factors, own(tables.retention.proxies, key));
  return viaProxy !== undefined ? viaProxy : 100;
}

/** Step 7: the share of a meat's own fat still in it (1 where its liquid is eaten). */
function fatKept(tables: CookingTables, cls: string, m: CookMethod | undefined): number {
  if (!known(m) || own(tables.methods, m)?.liquidEaten) return 1;
  const f = own(own(tables.fatDrip, cls) as Record<string, number> | undefined, m);
  return isNum(f) && f > 0 && f <= 1 ? f : 1;
}

function waterLeft(tables: CookingTables, m: CookMethod | undefined): number {
  if (m === 'boiled-drained') return 0;
  const v = own(tables.yields.gravyWater as Record<string, number>, m);
  return isNum(v) && v >= 0 && v <= 1 ? v : 1;
}

// ── one line ─────────────────────────────────────────────────────────────

/** Steps 1-7 for one line. */
export function cookIngredient(line: CookLine, tables: CookingTables, ctx: DishContext): LineWork {
  const rec = line.profile;
  const g = grams(line.grams);
  const m = line.method;
  const w: LineWork = {
    line,
    rawGrams: g,
    grams: g,
    oilGrams: 0,
    role: line.role,
    food: null,
    before: {},
    after: {},
    derived: false,
    fryable: false,
    oilRow: null,
    doughWater: 0,
    oil: null,
    absorbed: 0,
  };

  // 1. Oil.
  if (line.kind === 'oil') {
    if (line.role === 'frying-medium') {
      w.rawGrams = w.grams = 0;
    } else {
      w.food = rec.per100g;
      w.before = w.after = total(rec.per100g, g);
    }
    return w;
  }
  // 2. Water: settled after the foods.
  if (line.kind === 'water') return w;

  // 3. Food as eaten.
  if (rec.asEaten) {
    w.food = rec.per100g;
    w.before = w.after = total(rec.per100g, g);
    w.fryable = rec.fryAgain && isFried(m);
    if (w.fryable && m) w.oilRow = oilRowFor(tables, line, m, ctx.dishName);
    return w;
  }

  // 4-6. Oil row, yield, cooked record.
  const fried = isFried(m);
  const urow = fried && m ? oilRowFor(tables, line, m, ctx.dishName) : null;
  w.oilRow = urow;
  const y = yieldOf(tables, rec, m, urow);
  let cooked: { per100g: Nutrients } | undefined;
  if (known(m)) cooked = tries(tables, m).map((t) => own(rec.cooked as Record<string, { per100g: Nutrients }>, t)).find(Boolean);
  // A fried record holds its own frying oil: with oil in the dish it would count twice.
  if (cooked && fried && ctx.eatenOil) cooked = undefined;
  let held = 0;
  if (cooked && fried && m) {
    held = tries(tables, m).map((t) => own(rec.yields as Record<string, { oilU?: number }>, t)?.oilU).find(positive) ?? 0;
  }
  const whole = y + held / 100;
  if (line.basis === 'raw') {
    w.rawGrams = g;
    w.grams = g * whole;
    if (y > 1) w.absorbed = g * (y - 1);
  } else {
    w.rawGrams = g / whole;
    w.grams = g;
  }
  if (cooked) {
    w.food = cooked.per100g;
    w.before = w.after = total(cooked.per100g, w.grams);
    return w;
  }

  // 7. Retention, alcohol and fat drip.
  w.derived = true;
  w.food = rec.per100g;
  const coated = line.coating === 'batter' || line.coating === 'breaded';
  const row = known(m) ? own(tables.retentionMap, rec.cookClass) : undefined;
  const code = known(m) ? ((coated ? own(row, `${m}+coated`) : undefined) ?? own(row, m)) : undefined;
  const factors = own(tables.retention.codes, code);
  const before = total(rec.per100g, w.rawGrams);
  const after: Nutrients = {};
  for (const [k, v] of Object.entries(before) as [NutrientKey, number][]) after[k] = (v * keptPercent(tables, k, factors, rec)) / 100;
  if (after.kcal !== undefined && after.alcohol !== undefined && before.alcohol !== undefined) {
    after.kcal = Math.max(after.kcal - KCAL_PER_G.alcohol * (before.alcohol - after.alcohol), 0);
  }
  const keep = fatKept(tables, rec.cookClass, m);
  if (keep < 1 && after.fat !== undefined) {
    const lost = after.fat * (1 - keep);
    for (const key of FAT_KEYS) {
      const v = after[key];
      if (v !== undefined) after[key] = v * keep;
    }
    if (after.kcal !== undefined) after.kcal = Math.max(after.kcal - KCAL_PER_G.fat * lost, 0);
  }
  w.before = before;
  w.after = after;
  return w;
}

// ── the dish ─────────────────────────────────────────────────────────────

/** Steps 8-15: the whole dish, per-line results first. */
export function cookDish(input: CookInput, tables: CookingTables): CookedDish {
  const lines = [...input.lines];
  const panGrams = grams(input.panOil?.grams);
  if (input.panOil && panGrams > 0) {
    lines.push({ name: input.panOil.name, kind: 'oil', grams: panGrams, basis: 'raw', role: 'frying-medium', profile: input.panOil.profile });
  }

  const eatenOil = lines.some((l) => l.kind === 'oil' && l.role !== 'frying-medium');
  const ctx: DishContext = { eatenOil, dishName: input.dishName };
  const rows = lines.map((l) => cookIngredient(l, tables, ctx));
  let absorbed = rows.reduce((s, r) => s + r.absorbed, 0);

  // 8. Dough and batter water.
  const waters = rows.filter((r) => r.line.kind === 'water');
  const wet = rows.some((r) => r.line.kind === 'food' && r.line.method !== undefined && WET.includes(r.line.method));
  const dough = rows.filter((r) => (r.derived || r.fryable) && r.line.method === 'deep-fried' && r.oilRow?.withWater);
  let doughWater = 0;
  let waterKept: number | undefined;
  if (dough.length && waters.length && !wet) {
    doughWater = waters.reduce((s, r) => s + grams(r.line.grams), 0);
    waterKept = dough.map((r) => r.oilRow?.waterLeft).find(isNum);
    const flour = dough.reduce((s, r) => s + r.rawGrams, 0);
    for (const r of dough) r.doughWater = flour ? (doughWater * r.rawGrams) / flour : 0;
  }

  // 9. Oil taken up.
  const taken: LineWork[] = [];
  for (const r of rows) {
    const m = r.line.method;
    if (!(r.derived || r.fryable) || !isFried(m)) continue;
    if (m !== 'deep-fried' && eatenOil) continue; // the oil in the dish is this fry's oil
    const u = r.oilRow?.u;
    if (positive(u)) {
      r.oilGrams = (u * (r.rawGrams + r.doughWater)) / 100;
      taken.push(r);
    }
  }
  const deep = taken.filter((r) => r.line.method === 'deep-fried');
  const deepTotal = deep.reduce((s, r) => s + r.oilGrams, 0);

  const oilRows = rows.filter((r) => r.line.kind === 'oil');
  const medium = oilRows.filter((r) => r.role === 'frying-medium');
  const unsaidInOrder = oilRows.filter((r) => !isRole(r.role));
  const unsaid = [...unsaidInOrder].sort((a, b) => b.line.grams - a.line.grams);
  const unsaidFirst = unsaidInOrder[0];
  let unsaidEaten = 0;
  for (const r of unsaid) {
    if (deep.length && !medium.length && r.line.grams >= deepTotal && deepTotal > 0) {
      // At least what the fried foods take up: the pan's oil.
      r.role = 'frying-medium';
      r.food = null;
      r.before = {};
      r.after = {};
      r.rawGrams = r.grams = 0;
      medium.push(r);
    } else {
      r.role = 'in-dish';
      if (deep.length) unsaidEaten += grams(r.line.grams);
    }
  }
  const listed = medium.reduce((s, r) => s + grams(r.line.grams), 0);
  if (medium.length && deepTotal > listed && listed > 0) {
    // Never more oil than was in the pan.
    for (const r of deep) r.oilGrams *= listed / deepTotal;
  } else if (!medium.length && unsaidEaten && deepTotal) {
    // The larger of the oil listed and the oil taken up is counted, never both.
    const share = Math.max(deepTotal - unsaidEaten, 0) / deepTotal;
    for (const r of deep) r.oilGrams *= share;
  }

  // 10. Which oil.
  let fryingOil: Nutrients | undefined;
  if (taken.length) {
    const source =
      medium[0]?.line.profile ??
      unsaidFirst?.line.profile ??
      input.panOil?.profile ??
      own(tables.oils.foods, own(tables.oils.byCountry, input.country) ?? own(tables.oils.byCountry, '*'));
    fryingOil = source?.per100g;
  }
  if (!fryingOil || Object.keys(fryingOil).length === 0) {
    fryingOil = undefined;
    for (const r of taken) r.oilGrams = 0;
  }

  // 11. Foods weighed as eaten hold the oil they took up.
  let oilAdded = 0;
  for (const r of taken) {
    if (!(r.oilGrams > 0) || !fryingOil) continue;
    r.oil = fryingOil;
    if (r.derived && r.line.basis === 'cooked' && !r.doughWater) {
      const k = grams(r.line.grams) / (r.grams + r.oilGrams);
      r.rawGrams *= k;
      r.grams *= k;
      r.oilGrams *= k;
      r.before = scaled(r.before, k);
      r.after = scaled(r.after, k);
    }
    oilAdded += r.oilGrams;
  }

  // 12. Water lines.
  for (const r of waters) {
    const g = grams(r.line.grams);
    if (doughWater && waterKept !== undefined && r.line.basis === 'raw') {
      r.grams = g * waterKept;
    } else if (r.line.basis === 'raw') {
      const left = g * waterLeft(tables, r.line.method);
      const take = Math.min(left, absorbed);
      absorbed -= take;
      r.grams = left - take;
    }
    r.food = r.line.profile.per100g;
  }

  // 13. Parts and totals.
  const parts: Part[] = [];
  const profiles: IngredientProfile[] = [];
  let kcal = 0;
  for (const r of rows) {
    if (r.food !== null && r.grams > 0) {
      parts.push({ per100g: r.derived ? scaled(r.after, 100 / r.grams) : r.food, grams: r.grams });
      profiles.push(r.line.profile);
    }
    if (r.oilGrams > 0 && r.oil) {
      parts.push({ per100g: r.oil, grams: r.oilGrams });
      kcal += total(r.oil, r.oilGrams).kcal ?? 0;
    }
    kcal += r.after.kcal ?? 0;
    r.grams += r.oilGrams;
  }
  const weight = parts.reduce((s, p) => s + p.grams, 0);

  // 14. Per 100 g: what the parts add up to, and the keys a line says are only "at least".
  const mix = mixKnown(parts);
  const missing = [...mix.missing];
  for (const p of profiles) {
    for (const k of p.missing) if (mix.per100g[k] !== undefined && !missing.includes(k)) missing.push(k);
  }

  // 15. Notes: what is known about a row, never how a number was worked out.
  const notes: CookNote[] = [];
  for (const r of rows) if (r.line.kind === 'food' && r.line.method === 'unknown') notes.push({ kind: 'unknown-method', name: r.line.name });
  for (const name of input.leftOut ?? []) notes.push({ kind: 'left-out', name });

  // The pan's oil line added above is not one of the person's rows.
  const out: CookedLine[] = rows.slice(0, input.lines.length).map((r) => {
    const cooked: CookedLine = { name: r.line.name, rawGrams: r.rawGrams, grams: r.grams, oilGrams: r.oilGrams };
    if (r.line.kind === 'oil' && isRole(r.role)) cooked.role = r.role;
    return cooked;
  });
  return {
    lines: out,
    weight,
    oilAdded,
    kcal,
    per100g: mix.per100g,
    missing,
    pending: rows.some((r) => r.line.profile.pending === true),
    notes,
  };
}

// ── from the recipe rows ─────────────────────────────────────────────────

/**
 * The input for cookDish from a food's ingredient rows. A row without a
 * usable profile (none, or a calc version other than the tables') is left out
 * and named in `leftOut`. Rows that take no method (salt, spices, oil) cook
 * with none; water keeps its method, which decides how much of it is left. An
 * oil row's role is its profile's (a row the person adds has 'in-dish').
 */
export function cookInputOf(
  ingredients: FoodIngredient[],
  dishName: string,
  country: string,
  tables: CookingTables,
  panOil?: PanOil,
): CookInput {
  const lines: CookLine[] = [];
  const leftOut: string[] = [];
  for (const i of ingredients) {
    const p = i.profile;
    if (!p || p.calc !== CALC || p.calc !== tables.calc) {
      leftOut.push(i.name);
      continue;
    }
    const line: CookLine = {
      name: i.name,
      kind: p.kind,
      grams: i.rawGrams ?? p.rawGrams,
      basis: p.kind === 'water' ? p.basis : 'raw',
      profile: p,
    };
    if (i.method && (p.kind === 'water' || (p.kind === 'food' && !p.noMethod))) line.method = i.method;
    if (p.kind === 'oil') line.role = p.role;
    if (p.kind === 'food' && p.coating) line.coating = p.coating;
    lines.push(line);
  }
  const input: CookInput = { lines, dishName, country, leftOut };
  if (panOil) input.panOil = panOil;
  return input;
}
