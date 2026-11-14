/**
 * The person's corrected dishes (T15). The app guesses a dish's ingredients;
 * the person fixes them, and the fixed version is its own food (`mine:<n>`,
 * kept in saved_food) that later look-ups of the same dish use instead of the
 * guess. Past entries keep the dish they were logged with. Everything here is
 * pure, so jest runs it; state/use-food-book.ts and nutrition/log-food.ts use it.
 *
 * Which dish stands in for which is kept on the phone only, in kv `myDishes`:
 * by the id of the dish it replaces (a look-up of that dish) and by the text
 * the person typed (typing it again), normalised the way search reads names.
 */
import { RECIPE_NAME_MAX, RECIPE_TEXT_MAX, RECIPE_UNITS, type RecipeRequest, type RecipeUnit } from '@/api/food-read';
import type { RecentFood } from '@/data/types';

import { MINE_PREFIX, normalize, searchFoods } from './catalog';
import type { FoodIngredient, FoodItem, FoodRecipeSource, FoodUnit, OwnFood } from './types';

/** kv key of the MyDishes. */
export const MY_DISHES_KEY = 'myDishes';

export const MAX_INGREDIENTS = 30;
export const MAX_NAME = 60;
export const MAX_GRAMS = 2000;

/** Which corrected dish stands in for which: `byFood` by the dish it replaces, `byText` by the normalised text typed. */
export interface MyDishes {
  byFood: Record<string, string>;
  byText: Record<string, string>;
}

export const NO_DISHES: MyDishes = { byFood: {}, byText: {} };

export const isMine = (food: Pick<FoodItem, 'id'>): boolean => food.id.startsWith(MINE_PREFIX);

/** The same reading of text as search: "Endu  chepala, with Egg-curry" → "endu chepala with egg curry". */
export const normaliseDishText = (text: string): string => normalize(text);

const has = (table: object, key: string): boolean => Object.prototype.hasOwnProperty.call(table, key);

/** Own, safe keys only: a stored "__proto__" must never reach an object's prototype. */
const SKIP = ['__proto__', 'constructor', 'prototype'];

function readTable(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return out;
  for (const [key, value] of Object.entries(v)) {
    if (SKIP.includes(key) || !key || typeof value !== 'string' || !value.startsWith(MINE_PREFIX)) continue;
    out[key] = value;
  }
  return out;
}

/** The stored mappings, with anything malformed left out. */
export function readMyDishes(v: unknown): MyDishes {
  if (typeof v !== 'object' || v === null) return { byFood: {}, byText: {} };
  const o = v as Record<string, unknown>;
  return { byFood: readTable(o.byFood), byText: readTable(o.byText) };
}

/** The corrected dish for a typed text or a dish id, or null. Typed text wins: it is what the person asked for. */
export function mineFor(dishes: MyDishes, q: { foodId?: string | null; text?: string | null }): string | null {
  const key = q.text ? normaliseDishText(q.text) : '';
  if (key && has(dishes.byText, key)) return dishes.byText[key];
  if (q.foodId && has(dishes.byFood, q.foodId)) return dishes.byFood[q.foodId];
  return null;
}

/** Every corrected dish in use: the ones the person's searches and look-ups can end up at. */
export function activeMineIds(dishes: MyDishes): Set<string> {
  return new Set([...Object.values(dishes.byFood), ...Object.values(dishes.byText)]);
}

/** After a confirm: `basedOn` and the typed text (when there was one) both lead to `mineId`. */
export function myDishesAfterConfirm(
  dishes: MyDishes,
  confirmed: { basedOn: string; mineId: string; text?: string | null },
): MyDishes {
  const key = confirmed.text ? normaliseDishText(confirmed.text) : '';
  return {
    byFood: { ...dishes.byFood, [confirmed.basedOn]: confirmed.mineId },
    byText: key ? { ...dishes.byText, [key]: confirmed.mineId } : { ...dishes.byText },
  };
}

/** "Use our guess again": nothing leads to `mineId` any more. The food itself stays for old entries. */
export function myDishesAfterReset(dishes: MyDishes, mineId: string): MyDishes {
  const without = (t: Record<string, string>) => Object.fromEntries(Object.entries(t).filter(([, id]) => id !== mineId));
  return { byFood: without(dishes.byFood), byText: without(dishes.byText) };
}

/** The next free `mine:<n>`, past every one kept or pointed at. */
export function nextMineId(saved: FoodItem[], dishes: MyDishes): string {
  const ids = [...saved.map((f) => f.id), ...activeMineIds(dishes)];
  const top = ids.reduce((n, id) => {
    const m = /^mine:(\d+)$/.exec(id);
    return m ? Math.max(n, Number(m[1])) : n;
  }, 0);
  return `${MINE_PREFIX}${top + 1}`;
}

// ── the list the person edits ─────────────────────────────────────────────

/** One line of the recipe text sent to the server: "Onion 60 g". */
const lineOf = (i: FoodIngredient): string => `${i.name} ${i.grams} g`;

const cleanName = (name: string): string => name.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * The edited list as it will be kept (names cleaned) and the first reason it
 * can't be used, or null: 1 to 30 ingredients, names of 1 to 60 characters,
 * whole grams from 1 to 2,000, and short enough to send as recipe text.
 */
export function validIngredients(list: { name: string; grams: number }[]): {
  ingredients: FoodIngredient[];
  problem: string | null;
} {
  const ingredients = list.map((i) => ({ name: cleanName(i.name), grams: i.grams }));
  const problem = (() => {
    if (!ingredients.length) return 'Add at least one ingredient.';
    if (ingredients.length > MAX_INGREDIENTS) return `Use at most ${MAX_INGREDIENTS} ingredients.`;
    if (ingredients.some((i) => !i.name)) return 'Every ingredient needs a name.';
    if (ingredients.some((i) => i.name.length > MAX_NAME)) return `Keep each name to ${MAX_NAME} letters or fewer.`;
    if (ingredients.some((i) => !Number.isInteger(i.grams) || i.grams < 1 || i.grams > MAX_GRAMS)) {
      return 'Amounts are whole grams, from 1 to 2,000.';
    }
    if (ingredients.map(lineOf).join('\n').length > RECIPE_TEXT_MAX) {
      return 'That is too long to work out. Remove an ingredient or shorten the names.';
    }
    return null;
  })();
  return { ingredients, problem };
}

/** True when the two lists name the same ingredients in the same order with the same grams. */
export function sameIngredients(a: FoodIngredient[], b: FoodIngredient[]): boolean {
  return a.length === b.length && a.every((x, i) => x.grams === b[i].grams && cleanName(x.name).toLowerCase() === cleanName(b[i].name).toLowerCase());
}

/**
 * What goes to the recipe look-up for an edited list: the dish name; "what went
 * in" as one line per ingredient ("Onion 60 g"), in the order shown; "how you
 * cooked it" as the name plus (home) or (restaurant); one serving, in the
 * food's default unit when the server knows it, else "serving".
 */
export function recipeTextFor(food: FoodItem, ingredients: FoodIngredient[]): RecipeRequest {
  const unit: RecipeUnit = (RECIPE_UNITS as readonly string[]).includes(food.defaultUnit)
    ? (food.defaultUnit as RecipeUnit)
    : 'serving';
  const name = food.name.slice(0, RECIPE_NAME_MAX).trim();
  return {
    name,
    ingredients: ingredients.map(lineOf).join('\n'),
    steps: `${name} (${food.style === 'restaurant' ? 'restaurant' : 'home'})`,
    servings: 1,
    unit,
  };
}

const total = (list: FoodIngredient[] | undefined): number => (list ?? []).reduce((sum, i) => sum + i.grams, 0);

/** A unit can't weigh more than the app reads back (api/food-read.ts). */
const MAX_UNIT_GRAMS = 5000;

/**
 * The food's units after its ingredients changed. The grams are for one unit
 * ("in 1 bowl"), so when the total changes the default unit weighs
 * `grams × new total ÷ old total`, to the nearest 5 g and at least 5. The
 * other units (a roti, 100 g) are what they were.
 */
export function scaledUnits(food: FoodItem, oldIngredients: FoodIngredient[] | undefined, newIngredients: FoodIngredient[]): FoodUnit[] {
  const was = total(oldIngredients);
  const now = total(newIngredients);
  return food.units.map((u) => {
    if (!was || !now || was === now || u.key !== food.defaultUnit || u.key === 'g') return { ...u };
    return { ...u, grams: Math.min(MAX_UNIT_GRAMS, Math.max(5, Math.round((u.grams * now) / was / 5) * 5)) };
  });
}

/**
 * The person's version of `current` from the server's answer for the edited
 * list. The numbers (and what is still missing or pending) are the answer's;
 * the ingredients are exactly the person's, never the server's. Name, aliases,
 * category, style and restaurant carry over. `request` is kept while the
 * answer is pending, so the repeat (nutrition/pending.ts) asks the same thing.
 */
export function mineFood(p: {
  current: FoodItem;
  ingredients: FoodIngredient[];
  answer: FoodItem;
  id: string;
  request: FoodRecipeSource;
}): FoodItem {
  const { current, answer } = p;
  const out: FoodItem = {
    id: p.id,
    name: current.name,
    aliases: [...current.aliases],
    category: current.category,
    per100g: { ...answer.per100g },
    units: scaledUnits(current, current.ingredients, p.ingredients),
    defaultUnit: current.defaultUnit,
    source: 'mine',
    ingredients: p.ingredients.map((i) => ({ name: i.name, grams: i.grams })),
  };
  const basedOn = isMine(current) ? current.basedOn : current.id;
  if (basedOn) out.basedOn = basedOn;
  if (current.style) out.style = current.style;
  if (current.restaurant) out.restaurant = current.restaurant;
  if (current.homeId) out.homeId = current.homeId;
  if (answer.flags?.length) out.flags = [...answer.flags];
  if (answer.notes?.length) out.notes = [...answer.notes];
  if (answer.missing?.length) out.missing = [...answer.missing];
  if (answer.pending) {
    out.pending = true;
    out.recipe = { ...p.request };
    if (answer.pendingSince !== undefined) out.pendingSince = answer.pendingSince;
  }
  return out;
}

// ── using them ────────────────────────────────────────────────────────────

/** A look-up item with the person's version of its dish in place of the server's guess, when there is one. */
export function withMine<T extends { food: FoodItem; unit: string; quantity: number }>(
  item: T,
  dishes: MyDishes,
  find: (id: string) => FoodItem | null,
): T {
  const id = mineFor(dishes, { foodId: item.food.id });
  const mine = id && id !== item.food.id ? find(id) : null;
  if (!mine) return item;
  const known = mine.units.some((u) => u.key === item.unit);
  return { ...item, food: mine, unit: known ? item.unit : mine.defaultUnit, quantity: known ? item.quantity : 1 };
}

/**
 * The food list for typed text: search, with the person's version first when
 * they confirmed it for this text, and corrected dishes in use listed once in
 * place of the dishes they are based on.
 */
export function searchWithMine(
  query: string,
  own: OwnFood[],
  saved: FoodItem[],
  dishes: MyDishes,
  limit = 8,
): FoodItem[] {
  const found = searchFoods(query, own, saved, limit, activeMineIds(dishes));
  const id = mineFor(dishes, { text: query });
  const mine = id ? saved.find((f) => f.id === id) : undefined;
  if (!mine) return found;
  return [mine, ...found.filter((f) => f.id !== mine.id)].slice(0, limit);
}

/**
 * Where a dish opens: the unit and quantity it was last logged with, not 1 of
 * its default unit. A corrected dish also takes what its original was logged
 * with. Null when it was never logged (the server's suggested amount stands).
 */
export function startAmount(
  food: FoodItem,
  recent: Pick<RecentFood, 'foodId' | 'unit' | 'quantity'>[],
): { unit: string; quantity: number } | null {
  const ids = [food.id, ...(isMine(food) && food.basedOn ? [food.basedOn] : [])];
  for (const id of ids) {
    const r = recent.find((x) => x.foodId === id && x.unit !== null && x.quantity !== null && food.units.some((u) => u.key === x.unit));
    if (r) return { unit: r.unit!, quantity: r.quantity! };
  }
  return null;
}
