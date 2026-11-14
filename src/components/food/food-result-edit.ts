/**
 * The ingredient list while the person edits it on the food result (T15):
 * plain rows of text, what is wrong with them, and the list to send. The
 * result view draws these; the limits are nutrition/my-dishes.ts validIngredients.
 */
import { validIngredients } from '@/nutrition/my-dishes';
import type { FoodIngredient } from '@/nutrition/types';

export interface EditRow {
  /** Stable across edits, so a field keeps its place when a row above it is removed. */
  key: string;
  name: string;
  /** What is typed in the grams field: digits, or empty. */
  grams: string;
  /** Added in this edit: its name is a field until Use these ingredients. */
  added: boolean;
}

export const editRowsFrom = (ingredients: FoodIngredient[]): EditRow[] =>
  ingredients.map((i, n) => ({ key: `r${n}`, name: i.name, grams: String(i.grams), added: false }));

/** A new empty row, the key after the highest one in use. */
export function addEditRow(rows: EditRow[]): EditRow[] {
  const top = rows.reduce((n, r) => Math.max(n, Number(r.key.slice(1)) + 1), 0);
  return [...rows, { key: `r${top}`, name: '', grams: '', added: true }];
}

export const removeEditRow = (rows: EditRow[], key: string): EditRow[] => rows.filter((r) => r.key !== key);

export const patchEditRow = (rows: EditRow[], key: string, patch: Partial<Pick<EditRow, 'name' | 'grams'>>): EditRow[] =>
  rows.map((r) => (r.key === key ? { ...r, ...patch } : r));

/** Only digits are kept, up to 4 (the most is 2,000). */
export const gramsInput = (text: string): string => text.replace(/\D/g, '').slice(0, 4);

/** The rows as a list: an empty or non-number amount is NaN, which validIngredients refuses. */
export const editList = (rows: EditRow[]): { name: string; grams: number }[] =>
  rows.map((r) => ({ name: r.name, grams: /^\d+$/.test(r.grams) ? Number(r.grams) : NaN }));

/** Why Use these ingredients is off, in words for under the list; null when the list can be used. */
export const editProblem = (rows: EditRow[]): string | null => validIngredients(editList(rows)).problem;

/** True when the rows are not the ingredients they started from (name and grams). */
export function editChanged(rows: EditRow[], original: FoodIngredient[]): boolean {
  return rows.length !== original.length || rows.some((r, i) => r.name !== original[i].name || r.grams !== String(original[i].grams));
}
