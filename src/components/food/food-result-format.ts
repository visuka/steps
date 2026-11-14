/**
 * Plain text helpers for the food result (food-result.tsx): numbers as the
 * mockups print them ("≥ 1,850 mg", "1 bowl"), ingredient names split into
 * their parts, and which nutrients the result lists. No React Native, so jest
 * checks them.
 */

import { formatNutrient, NUTRIENT, nutrientNumber, NUTRIENTS, percentOfDaily, percentOfLimit } from '@/nutrition/nutrients';
import type { NutrientKey, Nutrients } from '@/nutrition/types';

/** "≥ " before a figure only partly known (nutrition/state.ts AT_LEAST). */
export const AT_LEAST_MARK = '≥ ';

/** "1850" → "1,850"; decimals and short numbers stay as they are. */
export function groupDigits(text: string): string {
  const [whole, frac] = text.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}

/** "≥ 1,850 mg", "38 g", "412": a nutrient as the mockups print it. */
export function nutrientText(key: NutrientKey, value: number, partial: boolean, withUnit = true): string {
  const unit = NUTRIENT[key].unit;
  const number = groupDigits(nutrientNumber(key, value));
  return `${partial ? AT_LEAST_MARK : ''}${number}${withUnit && unit ? ` ${unit}` : ''}`;
}

/** The same for a screen reader: "at least 1,850 mg". */
export function spokenNutrientText(key: NutrientKey, value: number, partial: boolean): string {
  return `${partial ? 'at least ' : ''}${groupDigits(formatNutrient(key, value))}`;
}

/** A quantity as the stepper counts it: 1, 1.5, 2. */
export function quantityText(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(1);
}

/** "1 bowl", "2 × bowl", "150 g": the portion on the result. */
export function portionText(quantity: number, unitKey: string, unitLabel: string): string {
  if (unitKey === 'g') return `${quantityText(quantity)} g`;
  return quantity === 1 ? `1 ${unitLabel}` : `${quantityText(quantity)} × ${unitLabel}`;
}

/** "40 g", "2.5 g": an ingredient's grams. */
export function gramsText(grams: number): string {
  return `${grams < 10 && !Number.isInteger(grams) ? grams.toFixed(1) : Math.round(grams)} g`;
}

export interface IngredientParts {
  /** "Dried anchovy", "Egg". */
  main: string;
  /** "(methallu)": a note in brackets at the end, or null. */
  aside: string | null;
  /** "2": a count at the end ("Egg 2"), or null. */
  count: string | null;
}

/** "Dried anchovy (methallu)" → main and aside; "Egg 2" → main and count. */
export function splitIngredient(name: string): IngredientParts {
  let rest = name.trim();
  let count: string | null = null;
  const counted = /^(.*\S)\s+(\d+(?:\.\d+)?)$/.exec(rest);
  if (counted && /\D/.test(counted[1])) {
    rest = counted[1];
    count = counted[2];
  }
  let aside: string | null = null;
  const bracket = /^(.*\S)\s*(\([^()]+\))$/.exec(rest);
  if (bracket) {
    rest = bracket[1];
    aside = bracket[2];
  }
  return { main: rest, aside, count };
}

/** "lunch" from "Save to lunch", or null. */
export function mealOfLabel(actionLabel: string): string | null {
  const m = /^Save to (.+)$/i.exec(actionLabel.trim());
  return m ? m[1] : null;
}

/** The meal a time of day falls in, for "Save to lunch". */
export function mealWord(at: Date | number): string {
  const hour = new Date(at).getHours();
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 19) return 'snacks';
  return 'dinner';
}

/** Names as the mockups print them: "Sodium", not "Sodium (salt)". */
const PLAIN_LABEL: Partial<Record<NutrientKey, string>> = {
  sodium: 'Sodium',
  sugars: 'Sugars',
  folate: 'Folate',
};

/** A nutrient's name on the result; `short` gives the mockups' short forms ("B12", "Vit A"). */
export function nutrientLabel(key: NutrientKey, short: 'none' | 'b12' | 'all' = 'none'): string {
  if (short !== 'none' && key === 'vitB12') return 'B12';
  if (short === 'all' && key.startsWith('vit') && key.length === 4) return `Vit ${key[3]}`;
  return PLAIN_LABEL[key] ?? NUTRIENT[key].label.replace(/\s*\([^)]*\)$/, '');
}

/** Watch-outs drawn as a flagged nutrient row. Fat is a macro shown above, so its flag sits under Edit. */
export const FLAG_KEYS: readonly NutrientKey[] = ['sodium', 'sugars', 'satFat', 'transFat'];

/** The vitamins and minerals the result lists first, in the mockups' order. */
const MICRO_ORDER: readonly NutrientKey[] = [
  'calcium',
  'iron',
  'vitB12',
  'vitA',
  'vitC',
  'vitD',
  'folate',
  'potassium',
  'magnesium',
  'zinc',
  'vitE',
  'vitK',
  'thiamin',
  'riboflavin',
  'niacin',
  'vitB6',
  'phosphorus',
  'selenium',
];

/** Rows listed before "Show all nutrients" (spec 10.5: the first five, warnings first). */
export const NUTRIENTS_SHOWN = 5;

/** Fill of a nutrient's bar, 0 to 1 (over 100 % is a full bar): share of its limit for a keep-low nutrient, else of the daily need; 0 with no target. */
export function nutrientShare(key: NutrientKey, value: number): number {
  const pct = NUTRIENT[key].limit ? percentOfLimit(key, value) : percentOfDaily(key, value);
  return pct === null ? 0 : Math.min(1, Math.max(0, pct / 100));
}

const hasTarget = (key: NutrientKey) => Boolean(NUTRIENT[key].daily || NUTRIENT[key].limit);

/** Nutrients that only the second list ("Show all nutrients") adds: the rest of the vitamins, minerals and limits, plus fibre. */
const REST_GROUPS: readonly string[] = ['limit', 'vitamin', 'mineral'];

/**
 * The nutrient rows: `first` is the five shown at once (flagged ones first, then
 * the mockup's vitamins and minerals that are known), `rest` is what "Show all
 * nutrients" adds in the same rows. Only nutrients with a value and a target.
 */
export function nutrientRowKeys(n: Nutrients, flagged: readonly NutrientKey[]): { first: NutrientKey[]; rest: NutrientKey[] } {
  const known = (k: NutrientKey) => n[k] !== undefined;
  const flaggedKnown = flagged.filter(known);
  const micros = MICRO_ORDER.filter((k) => known(k) && hasTarget(k) && !flaggedKnown.includes(k));
  const first = [...flaggedKnown, ...micros].slice(0, NUTRIENTS_SHOWN);
  const rest = NUTRIENTS.filter(
    (info) => known(info.key) && hasTarget(info.key) && (REST_GROUPS.includes(info.group) || info.key === 'fiber') && !first.includes(info.key),
  ).map((info) => info.key);
  return { first, rest };
}
