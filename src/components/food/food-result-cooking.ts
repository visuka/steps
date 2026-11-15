/**
 * The words and choices of the cooking part of "Edit recipe" (plan T15c, "UI"):
 * the chips, what a row says about its method, the oil line, the caption, and the
 * result screen's "Potato · shallow fried". Plain functions, so jest checks them;
 * food-result-edit-rows.tsx only draws them. Never says how a number was worked out.
 */
import { methodChoices, methodLabel, methodWord } from '@/nutrition/cooking/methods';
import type { CookedDish, CookMethod } from '@/nutrition/cooking/types';
import type { FoodIngredient } from '@/nutrition/types';

import { cookable, type EditRow, oilSoakedUp, sharedMethod } from './food-result-edit';
import { ingredientLine, type IngredientLine } from './food-result-layout';

export const COOKED_QUESTION = 'How was it cooked?';
export const MORE_CHIP = 'More…';
export const NO_METHOD_WORD = 'how cooked?';
export const OIL_NAME = 'Oil soaked up in frying';
/** A row that is looked up, or could not be (the words of the rows' second line). */
export const UNKNOWN_ROW = "We don't know this one yet.";

export interface MethodChoice {
  method: CookMethod;
  label: string;
}

/** The chips before "More…" (plan T15c, UI): the usual ways, in the order the plan lists. */
export const METHOD_CHIPS: readonly MethodChoice[] = [
  { method: 'raw', label: 'Raw / salad' },
  { method: 'boiled', label: 'Boiled' },
  { method: 'simmered', label: 'In a curry' },
  { method: 'stir-fried', label: 'Tadka' },
  { method: 'shallow-fried', label: 'Shallow fried' },
  { method: 'deep-fried', label: 'Deep fried' },
  { method: 'roasted', label: 'Roasted / baked' },
];

/** The chips show when some row can take a method. */
export const showsMethods = (rows: EditRow[]): boolean => rows.some(cookable);

/** A chip is selected when all cookable rows share its method. */
export const chipSelected = (rows: EditRow[], method: CookMethod): boolean => sharedMethod(rows) === method;

/** "More…" is selected when the shared method is one the chips don't have. */
export function moreSelected(rows: EditRow[]): boolean {
  const shared = sharedMethod(rows);
  return shared !== null && !METHOD_CHIPS.some((c) => c.method === shared);
}

/** The sheet's list: every method of the plan's decision 6, plus the one a row already has. */
export const sheetChoices = (current?: CookMethod): MethodChoice[] =>
  methodChoices(current).map((method) => ({ method, label: methodLabel(method) }));

/** The row's small tappable text: "boiled", or "how cooked?". */
export const rowMethodWord = (r: Pick<EditRow, 'method'>): string => (r.method ? methodWord(r.method) : NO_METHOD_WORD);

/** "Cooking method for Potato: shallow fried. Change". */
export function rowMethodSpoken(r: Pick<EditRow, 'name' | 'method'>): string {
  const name = r.name.trim() || 'new ingredient';
  return `Cooking method for ${name}: ${r.method ? methodWord(r.method) : 'not set'}. Change`;
}

/** The chips' own spoken label. */
export const chipSpoken = (label: string): string => `Cooked ${label.toLowerCase()} for every ingredient`;

/** The sheet's title for one row, or for all of them. */
export const sheetTitle = (rowName: string | null): string => (rowName ? `How was ${rowName.trim() || 'this'} cooked?` : COOKED_QUESTION);

/** The oil line: grams in whole numbers, or null when none was soaked up. */
export function oilLine(dish: CookedDish | null): { name: string; grams: string; spoken: string } | null {
  const g = oilSoakedUp(dish);
  if (g <= 0) return null;
  return { name: OIL_NAME, grams: `${g} g`, spoken: `${OIL_NAME}, ${g} grams` };
}

/** "Amounts in 1 bowl, before cooking"; without the cooking part (the recipe look-up way) just "Amounts in 1 bowl". */
export const amountsCaption = (unitLabel: string | undefined, cooking: boolean): string =>
  `Amounts in 1 ${unitLabel ?? 'serving'}${cooking ? ', before cooking' : ''}`;

/** What a row says while it has no profile: the look-up's state, in words, or null. */
export function rowNote(r: Pick<EditRow, 'lookup'>, looking: string, failed: string): string | null {
  if (r.lookup === 'looking') return looking;
  if (r.lookup === 'failed') return failed;
  if (r.lookup === 'unknown') return UNKNOWN_ROW;
  return null;
}

/**
 * An ingredient of the result screen as a line: its name's own "(boiled)" or
 * "· fried" first, else the method the person or the server chose
 * ("Potato · shallow fried"). Not-sure says nothing.
 */
export function resultLine(ing: Pick<FoodIngredient, 'name' | 'method'>): IngredientLine {
  const line = ingredientLine(ing.name);
  if (line.method || !ing.method || ing.method === 'unknown') return line;
  return { ...line, method: methodWord(ing.method) };
}
