/**
 * The ingredient list while the person edits it on the food result (T15, T15c):
 * plain rows of text, what is wrong with them, the list to send, and the
 * cooking flow behind the rows (a method for each, profiles looked up for added
 * rows, and the dish's numbers worked out live on the phone). The result view
 * draws these; the limits are nutrition/my-dishes.ts validIngredients.
 */
import type { ProfileItem } from '@/api/food-read';
import { cookDish, cookInputOf } from '@/nutrition/cooking/cook';
import { takesMethod } from '@/nutrition/cooking/methods';
import type { CookedDish, CookingTables, CookMethod, EditedLine, IngredientProfile, PanOil } from '@/nutrition/cooking/types';
import { dishUnits } from '@/nutrition/log-food';
import { validIngredients } from '@/nutrition/my-dishes';
import type { FoodIngredient, FoodItem, NutrientKey, Nutrients } from '@/nutrition/types';

/** Words for the rows that have no profile yet (plan T15c, decision 9). */
export const LOOKING_UP = 'Looking up…';
export const LOOKUP_FAILED = "Couldn't look this up. Check the connection.";

export interface EditRow {
  /** Stable across edits, so a field keeps its place when a row above it is removed. */
  key: string;
  name: string;
  /** What is typed in the grams field: digits, or empty. Before cooking, as it went into the pan. */
  grams: string;
  /** Added in this edit: its name is a field until Use these ingredients. */
  added: boolean;
  /** How it was cooked; absent = not said. Only rows that take a method (takesMethod) have one. */
  method?: CookMethod;
  /** What the server knows about the ingredient; without it the row is left out of the phone's numbers. */
  profile?: IngredientProfile;
  /** Where the profile look-up of an added row stands: under way, failed (offline), or no such ingredient. */
  lookup?: 'looking' | 'failed' | 'unknown';
}

/** The amount shown for a line: before cooking when the line knows it, else as it was. */
const shownGrams = (i: FoodIngredient): string => (i.rawGrams !== undefined ? String(Math.round(i.rawGrams)) : String(i.grams));

export const editRowsFrom = (ingredients: FoodIngredient[]): EditRow[] =>
  ingredients.map((i, n) => ({
    key: `r${n}`,
    name: i.name,
    grams: shownGrams(i),
    added: false,
    ...(i.method ? { method: i.method } : {}),
    ...(i.profile ? { profile: i.profile } : {}),
  }));

/** A new empty row, the key after the highest one in use. */
export function addEditRow(rows: EditRow[]): EditRow[] {
  const top = rows.reduce((n, r) => Math.max(n, Number(r.key.slice(1)) + 1), 0);
  return [...rows, { key: `r${top}`, name: '', grams: '', added: true }];
}

export const removeEditRow = (rows: EditRow[], key: string): EditRow[] => rows.filter((r) => r.key !== key);

/** A changed name is a different ingredient: what was known about the old one goes. */
export const patchEditRow = (rows: EditRow[], key: string, patch: Partial<Pick<EditRow, 'name' | 'grams'>>): EditRow[] =>
  rows.map((r) => {
    if (r.key !== key) return r;
    if (patch.name === undefined || patch.name === r.name) return { ...r, ...patch };
    const { method: _method, profile: _profile, lookup: _lookup, ...rest } = r;
    return { ...rest, ...patch };
  });

/** Only digits are kept, up to 4 (the most is 2,000). */
export const gramsInput = (text: string): string => text.replace(/\D/g, '').slice(0, 4);

/** The rows as a list: an empty or non-number amount is NaN, which validIngredients refuses. */
export const editList = (rows: EditRow[]): { name: string; grams: number }[] =>
  rows.map((r) => ({ name: r.name, grams: /^\d+$/.test(r.grams) ? Number(r.grams) : NaN }));

export type { EditedLine };

export const editLines = (rows: EditRow[]): EditedLine[] =>
  editList(rows).map((l, n) => ({
    ...l,
    ...(rows[n].method ? { method: rows[n].method } : {}),
    ...(rows[n].profile ? { profile: rows[n].profile } : {}),
  }));

/** Why Use these ingredients is off, in words for under the list; null when the list can be used. */
export function editProblem(rows: EditRow[]): string | null {
  if (rows.some((r) => r.lookup === 'looking')) return LOOKING_UP;
  if (rows.some((r) => r.lookup === 'failed')) return LOOKUP_FAILED;
  return validIngredients(editList(rows)).problem;
}

/** True when the rows are not the ingredients they started from (name, grams and method). */
export function editChanged(rows: EditRow[], original: FoodIngredient[]): boolean {
  return (
    rows.length !== original.length ||
    rows.some((r, i) => r.name !== original[i].name || r.grams !== shownGrams(original[i]) || r.method !== original[i].method)
  );
}

// ── how it was cooked ─────────────────────────────────────────────────────

/** True for a row that takes a cooking method: salt, spices, water, oil and rows with no profile don't. */
export const cookable = (r: Pick<EditRow, 'profile'>): boolean => !!r.profile && takesMethod(r.profile);

/** Every cookable row cooked this way ("How was it cooked?" chips). */
export const setAllMethods = (rows: EditRow[], method: CookMethod): EditRow[] => rows.map((r) => (cookable(r) ? { ...r, method } : r));

/** One row cooked this way (the method button on a row). */
export const setRowMethod = (rows: EditRow[], key: string, method: CookMethod): EditRow[] =>
  rows.map((r) => (r.key === key && cookable(r) ? { ...r, method } : r));

/** The method every cookable row shares, or null (none cookable, a row with no method, or different ones). */
export function sharedMethod(rows: EditRow[]): CookMethod | null {
  const some = rows.filter(cookable);
  const first = some[0]?.method;
  return first && some.every((r) => r.method === first) ? first : null;
}

// ── profiles for rows that have none ──────────────────────────────────────

/** One name sent to POST /v1/food/ingredients, and the row it was for. */
export interface Sent {
  key: string;
  name: string;
}

export type ProfileFetch = (names: string[], dish?: string) => Promise<ProfileItem[]>;

const nameKey = (n: string): string => n.trim().toLowerCase();

/** The added rows that have a name and no profile yet (a failed look-up is tried again). */
export const toLookUp = (rows: EditRow[]): Sent[] =>
  rows
    .filter((r) => r.added && r.name.trim() && !r.profile && r.lookup !== 'looking' && r.lookup !== 'unknown')
    .map((r) => ({ key: r.key, name: r.name.trim() }));

/** The rows being looked up say so ("Looking up..."), and the numbers leave them out. */
export const markLooking = (rows: EditRow[], sent: Sent[]): EditRow[] =>
  rows.map((r) => (sent.some((s) => s.key === r.key) ? { ...r, lookup: 'looking' as const } : r));

/** An oil the person adds is eaten in the dish (cooking-model 5.2); the profile of a looked-up oil says so. */
const asAdded = (p: IngredientProfile): IngredientProfile => (p.kind === 'oil' && !p.role ? { ...p, role: 'in-dish' } : p);

/**
 * The server's profile for each name sent: one call for all of them, null when
 * it fails (offline, the day's limit, not signed in). `dish` is the dish name.
 */
export async function fetchRowProfiles(fetch: ProfileFetch, sent: Sent[], dish?: string): Promise<ProfileItem[] | null> {
  if (!sent.length) return [];
  const names = [...new Set(sent.map((s) => s.name))];
  try {
    return await fetch(names, dish);
  } catch {
    return null;
  }
}

/**
 * The rows with the answer put in. A row that changed while the call was out
 * (removed, or another name) is left as it is. Null items = the call failed:
 * the row says so and Use these ingredients stays off. The server's usual
 * method is taken for a row with none, else the one the other rows share.
 */
export function applyProfiles(rows: EditRow[], sent: Sent[], items: ProfileItem[] | null): EditRow[] {
  const shared = sharedMethod(rows);
  return rows.map((r) => {
    const s = sent.find((x) => x.key === r.key);
    if (!s || r.lookup !== 'looking' || r.name.trim() !== s.name) return r;
    const { lookup: _lookup, ...rest } = r;
    if (!items) return { ...rest, lookup: 'failed' as const };
    const item = items.find((i) => nameKey(i.name) === nameKey(s.name));
    if (!item || !('profile' in item)) return { ...rest, lookup: 'unknown' as const };
    const profile = asAdded(item.profile);
    const out: EditRow = { ...rest, profile };
    const method = rest.method ?? item.method ?? shared ?? undefined;
    if (method && takesMethod(profile)) out.method = method;
    return out;
  });
}

/**
 * The ingredients of a food that has no profiles (saved before T15c, catalog
 * dishes) with profiles put in, from one call for all rows (plan T15c,
 * decision 10). The amounts they had count as before cooking. Rows the server
 * doesn't know stay as they were. Null when the call fails: editing then goes
 * the T15 recipe way.
 */
export async function fillProfiles(fetch: ProfileFetch, ingredients: FoodIngredient[], dish?: string): Promise<FoodIngredient[] | null> {
  const need = ingredients.filter((i) => !i.profile);
  if (!need.length) return ingredients;
  const items = await fetchRowProfiles(
    fetch,
    need.map((i) => ({ key: i.name, name: i.name })),
    dish,
  );
  if (!items) return null;
  return ingredients.map((i) => {
    if (i.profile) return i;
    const item = items.find((x) => nameKey(x.name) === nameKey(i.name));
    if (!item || !('profile' in item)) return i;
    const profile = asAdded(item.profile);
    const out: FoodIngredient = { ...i, profile, rawGrams: i.rawGrams ?? i.grams };
    const method = i.method ?? item.method;
    if (method && takesMethod(profile)) out.method = method;
    return out;
  });
}

// ── live numbers ──────────────────────────────────────────────────────────

export interface LiveContext {
  tables: CookingTables;
  dishName: string;
  country: string;
  panOil?: PanOil;
}

/** The ingredients the rows stand for, amounts as typed (before cooking); rows with no valid amount are skipped. */
export function rowIngredients(rows: EditRow[]): FoodIngredient[] {
  const out: FoodIngredient[] = [];
  for (const r of rows) {
    if (!/^\d+$/.test(r.grams) || !r.name.trim()) continue;
    const g = Number(r.grams);
    out.push({
      name: r.name.trim(),
      grams: g,
      rawGrams: g,
      ...(r.method ? { method: r.method } : {}),
      ...(r.profile ? { profile: r.profile } : {}),
    });
  }
  return out;
}

/**
 * The dish worked out from the rows as they are now, with no network: null
 * unless every row with a name and an amount has a profile of these tables'
 * version, so the numbers shown are the ones that will be kept (a row still
 * looking up, failed or unknown means the recipe look-up works it out instead).
 */
export function liveDish(rows: EditRow[], ctx: LiveContext): CookedDish | null {
  const ingredients = rowIngredients(rows);
  if (!ingredients.length || !ingredients.every((i) => i.profile?.calc === ctx.tables.calc)) return null;
  const input = cookInputOf(ingredients, ctx.dishName, ctx.country, ctx.tables, ctx.panOil);
  if (input.lines.length === 0) return null;
  return cookDish(input, ctx.tables);
}

/** The oil soaked up in frying, in whole grams, for its own line; 0 = no line. */
export const oilSoakedUp = (dish: CookedDish | null): number => (dish ? Math.round(dish.oilAdded) : 0);

/** The dish's nutrients as one unit: its values per 100 g at the dish's weight. */
export function unitNutrients(dish: CookedDish): Nutrients {
  const out: Nutrients = {};
  for (const k of Object.keys(dish.per100g) as NutrientKey[]) out[k] = ((dish.per100g[k] ?? 0) * dish.weight) / 100;
  return out;
}

/**
 * The food as the rows make it now, for the hero and the nutrients while editing: the dish's
 * values per 100 g, with its default unit weighing the dish (plan T15c, decisions 8 and 11).
 * The food itself when nothing can be worked out yet.
 */
export function liveFood(food: FoodItem, dish: CookedDish | null): FoodItem {
  if (!dish || !(dish.weight > 0) || dish.per100g.kcal === undefined) return food;
  const out: FoodItem = { ...food, per100g: dish.per100g, units: dishUnits(food, dish.weight) };
  delete out.missing;
  if (dish.missing.length) out.missing = dish.missing;
  return out;
}

// ── the flows the screen starts ───────────────────────────────────────────

export type OpenWithProfiles = (food: FoodItem) => Promise<FoodIngredient[] | null>;

/** True when opening needs the server first: some ingredient has no profile yet, or the tables are not on the phone (they are asked for). */
export const opensWithLookUp = (food: FoodItem, withProfiles?: OpenWithProfiles, hasTables = true): boolean =>
  !!withProfiles && (!hasTables || (food.ingredients ?? []).some((i) => !i.profile));

/**
 * The rows for "Edit recipe": the ingredients with profiles put in (one call for those without),
 * or as they are when that fails, so editing goes the recipe look-up way (decision 10).
 */
export async function openRows(food: FoodItem, withProfiles?: OpenWithProfiles, hasTables = true): Promise<EditRow[]> {
  const list = food.ingredients ?? [];
  if (!withProfiles || (hasTables && list.every((i) => i.profile))) return editRowsFrom(list);
  try {
    return editRowsFrom((await withProfiles(food)) ?? list);
  } catch {
    return editRowsFrom(list);
  }
}

/**
 * Looks up the profile of every added row that has a name and none yet: the rows say "Looking up…",
 * then take the answer. `rows` reads the rows as they are now and `update` changes them, so a row
 * edited while the call is out is left as it is. Resolves with true when a call was made.
 */
export async function lookUpAddedRows(
  rows: () => EditRow[] | null,
  update: (change: (rows: EditRow[]) => EditRow[]) => void,
  fetch: ProfileFetch,
  dish?: string,
): Promise<boolean> {
  const now = rows();
  const sent = now ? toLookUp(now) : [];
  if (!sent.length) return false;
  update((r) => markLooking(r, sent));
  const items = await fetchRowProfiles(fetch, sent, dish);
  update((r) => applyProfiles(r, sent, items));
  return true;
}
