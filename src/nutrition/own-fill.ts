/**
 * "Fill with AI" on the own-food form: the person's name and serving go to
 * the food estimate API, and the answer becomes the nutrients of exactly one
 * serving. No React Native here, so jest can run it.
 */
import { checkDescription, type EstimateResult, FoodApiError } from '@/api/food-read';
import { nutrientsFor, portionLabel, type PortionOverrides } from '@/nutrition/catalog';
import { NUTRIENT } from '@/nutrition/nutrients';
import type { Where } from '@/nutrition/place';
import type { NutrientKey, Nutrients } from '@/nutrition/types';

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/** A serving that already says how much: "1 packet", "half plate", "a glass". */
const HAS_AMOUNT = /^(\d|[½¼¾⅓]|(a|an|one|two|three|half|quarter|few|some|couple|several)\b)/i;

/**
 * What is sent to the estimate API: "1 packet of Haldiram aloo bhujia",
 * "1 glass of my protein shake". A serving with no amount ("packet") is one of
 * it; no serving sends the name alone and the server picks the usual portion.
 */
export function fillDescription(name: string, serving: string): string {
  const n = tidy(name);
  const s = tidy(serving);
  if (!s) return n;
  return `${HAS_AMOUNT.test(s) ? s : `1 ${s}`} of ${n}`;
}

/** A plain reason Fill can't be asked yet, or null. */
export function checkFill(name: string, serving: string): string | null {
  if (!tidy(name)) return 'Type the food’s name first.';
  return checkDescription(fillDescription(name, serving));
}

/** Same description and place: the values on screen are still for what's typed. */
export function fillKey(description: string, where: Where | null | undefined): string {
  return JSON.stringify([description.toLowerCase(), where?.place ?? null, where?.restaurant ?? null]);
}

/** Three significant figures: enough for any label, and small amounts (0.04 mg) don't round to zero. */
function round(v: number): number {
  if (v === 0) return 0;
  const digits = Math.max(0, 2 - Math.floor(Math.log10(Math.abs(v))));
  return Number(v.toFixed(Math.min(digits, 6)));
}

/**
 * Several foods added up as one. A nutrient is kept only when every food with
 * calories has a figure for it: milk and whey with B12 plus a banana without
 * would give a short B12 that day totals would count as complete, so it stays
 * unknown instead. (The server never sends a food without calories.)
 */
function addUp(list: Nutrients[]): Nutrients {
  const counted = list.filter((n) => (n.kcal ?? 0) > 0);
  const out: Nutrients = {};
  for (const n of list) {
    for (const [k, v] of Object.entries(n) as [NutrientKey, number][]) out[k] = (out[k] ?? 0) + v;
  }
  for (const k of Object.keys(out) as NutrientKey[]) {
    if (counted.some((n) => n[k] === undefined)) delete out[k];
  }
  return out;
}

export type FillOutcome =
  /**
   * `nutrients`: the full map for one serving, more than the form shows.
   * `serving`: the portion the server took, for an empty serving field (one item only).
   * `parts`: what was counted, when more than one food was added up.
   */
  | { kind: 'filled'; nutrients: Nutrients; serving: string | null; parts: string[] }
  /** A dish the server couldn't work out: the app offers the recipe form. */
  | { kind: 'unknown'; name: string }
  /** It came out at 0 calories, which the form can't save. */
  | { kind: 'zero' }
  /**
   * Part of it isn't counted yet (an ingredient still being found, or its
   * calories only "at least"): an own food has no "at least" and is never
   * looked up again, so nothing is filled.
   */
  | { kind: 'partial' }
  | { kind: 'nothing' };

/**
 * The estimate answer as one serving. Each item's per-100 g values are scaled
 * by its grams (unit grams × quantity, with the person's own portion sizes),
 * and several items ("milk, whey, banana") are added up, since together they
 * are the one thing the person named. A part the server couldn't work out
 * would leave the total short, so then nothing is filled. The same goes for
 * a food still pending, or with its calories only partly known; other
 * partly known nutrients ("missing") are left out, so they stay unknown
 * rather than become fixed numbers that are really floors.
 */
export function fillFromEstimate(result: EstimateResult, overrides: PortionOverrides = {}): FillOutcome {
  if (result.unknown.length) return { kind: 'unknown', name: result.unknown[0] };
  if (!result.items.length) return { kind: 'nothing' };
  const missing = new Set(result.items.flatMap((i) => i.food.missing ?? []));
  if (missing.has('kcal') || result.items.some((i) => i.food.pending)) return { kind: 'partial' };
  const total = addUp(result.items.map((i) => nutrientsFor(i.food, i.unit, i.quantity, overrides)));
  for (const k of missing) delete total[k];
  if (total.kcal === undefined || total.kcal < 0) return { kind: 'nothing' };
  // 0 kcal (water, black tea) can't be saved as an own food, so say so plainly.
  if (Math.round(total.kcal) === 0) return { kind: 'zero' };
  const nutrients: Nutrients = {};
  for (const [k, v] of Object.entries(total) as [NutrientKey, number][]) nutrients[k] = round(v);
  nutrients.kcal = Math.round(total.kcal);
  const label = (i: EstimateResult['items'][number]) => portionLabel(i.food, i.unit, i.quantity);
  const one = result.items.length === 1 ? result.items[0] : null;
  return {
    kind: 'filled',
    nutrients,
    serving: one ? label(one) : null,
    parts: one ? [] : result.items.map((i) => `${i.food.name} (${label(i)})`),
  };
}

/**
 * The form's values after a fill: the AI's full map, except that every value
 * the person typed or cleared stays theirs. Values from an earlier fill that
 * the new answer doesn't have are dropped, never kept as stale numbers.
 */
export function mergeFill(values: Nutrients, edited: Iterable<NutrientKey>, ai: Nutrients): Nutrients {
  const mine = new Set(edited);
  const out: Nutrients = {};
  for (const [k, v] of Object.entries(ai) as [NutrientKey, number][]) if (!mine.has(k)) out[k] = v;
  for (const k of mine) {
    const v = values[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** What the form says when Fill didn't work; manual entry is always offered beside it. */
export function fillErrorMessage(e: unknown): string {
  if (!(e instanceof FoodApiError)) return 'Something went wrong. Please try again, or type the values in yourself.';
  switch (e.kind) {
    case 'not_food':
      return 'That doesn’t look like food or drink. Check the name and serving.';
    case 'limit':
      return 'You’ve reached today’s limit for lookups. You can still type the values from the label.';
    case 'offline':
      return 'Couldn’t reach our server. Check your internet, or type the values in yourself.';
    case 'timeout':
      return 'That took too long. Please try again, or type the values in yourself.';
    case 'busy':
      return 'Lots of people are looking up food right now. Try again in a moment, or type the values in yourself.';
    case 'unavailable':
      return 'Food lookup isn’t working right now. Try again later, or type the values in yourself.';
    default:
      return e.message;
  }
}

/**
 * Decimals for a nutrient field, so a small amount never reads as zero:
 * 0.04 mg shows "0.04", not "0.0". Calories are whole; 1 and above show one.
 */
export function fieldDecimals(key: NutrientKey, value: number | null | undefined): number {
  if (NUTRIENT[key].unit === 'kcal') return 0;
  if (value == null || value === 0 || Math.abs(value) >= 1) return 1;
  for (let d = 2; d < 4; d++) if (Number(value.toFixed(d)) === value) return d;
  return 4;
}

export const FILLED_NOTE = 'Worked out from the food list · check the label if you have one';
export const STALE_NOTE = 'Changed since it was filled · tap Fill again to update';
/**
 * The note under the fields: null before any fill, stale once the name,
 * serving or place no longer match the last fill that worked, whatever
 * happened since (a later Fill that failed leaves the old numbers on screen).
 */
export function fillNote(filledFor: string | null, current: string): string | null {
  if (filledFor === null) return null;
  return filledFor === current ? FILLED_NOTE : STALE_NOTE;
}

export const ZERO_NOTE = 'That came out at 0 calories, so there’s nothing to add. If it has calories, type them from the label.';
export const PARTIAL_FILL_NOTE =
  'Some of its ingredients aren’t counted yet, so the values would be too low. Try again later, or type the values in yourself.';
export const NOTHING_NOTE = 'We couldn’t work that out. Try a clearer name, or type the values in yourself.';
