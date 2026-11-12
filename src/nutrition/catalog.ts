/**
 * Finding foods and working out what a logged portion contains. Log entries
 * store the food, unit and quantity, not the nutrients, so when someone says
 * "my bowl of rice is 200 g" every past and future entry recalculates.
 */
import { FOODS } from './foods.generated';
import { scaleNutrients, sumNutrients } from './nutrients';
import type { FoodItem, FoodUnit, Nutrients, OwnFood } from './types';

/** "foodId:unitKey" → grams, set by the person. */
export type PortionOverrides = Record<string, number>;

export const OWN_PREFIX = 'own:';
/** Dishes our server worked out from a description, saved on the phone once used. */
export const AI_PREFIX = 'ai:';
/** Dishes worked out from the person's own recipe, saved on the phone. */
export const RECIPE_PREFIX = 'recipe:';

/** True for foods kept in saved_food rather than the built-in list. */
export function isSavedFoodId(id: string): boolean {
  return id.startsWith(AI_PREFIX) || id.startsWith(RECIPE_PREFIX);
}

const byId = new Map(FOODS.map((f) => [f.id, f]));

/** A built-in food by id, or null. */
export function catalogFood(id: string): FoodItem | null {
  return byId.get(id) ?? null;
}

/** Treats one serving as 100 "grams" so own foods share the per-100 g maths. */
export function ownFoodItem(own: OwnFood): FoodItem {
  return {
    id: OWN_PREFIX + own.id,
    name: own.name,
    aliases: [],
    category: 'own',
    per100g: own.nutrients,
    units: [{ key: 'serving', label: own.serving || 'serving', grams: 100 }],
    defaultUnit: 'serving',
    source: 'Added by you',
  };
}

/**
 * Own foods by their prefix, then the built-in list, then saved foods. Saved
 * foods are looked up by any id, so a food the server knows but this version
 * of the app doesn't still resolves once saved.
 */
export function findFood(id: string, own: OwnFood[], saved: FoodItem[] = []): FoodItem | null {
  if (id.startsWith(OWN_PREFIX)) {
    const o = own.find((x) => OWN_PREFIX + x.id === id);
    return o ? ownFoodItem(o) : null;
  }
  return byId.get(id) ?? saved.find((f) => f.id === id) ?? null;
}

/** Saved food ids are read back at most this long (api/food-read.ts). */
const MAX_ID_LENGTH = 80;

/** True when every unit of `old` is in `next` and weighs the same. */
function keepsUnits(old: FoodItem, next: FoodItem): boolean {
  return old.units.every((u) => next.units.some((n) => n.key === u.key && Math.abs(n.grams - u.grams) < 0.01));
}

/** A short, stable fingerprint of a food's units (FNV-1a). */
function unitsHash(food: FoodItem): string {
  let h = 0x811c9dc5;
  for (const ch of food.units.map((u) => `${u.key}=${u.grams}`).join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * The food to keep in saved_food. Past entries store a unit and quantity, so
 * replacing a saved food whose units it lacks or weighs differently (the same
 * recipe entered again as "makes 2 plates" instead of "4 bowls") would quietly
 * change them. Such a food gets its own id instead; the same units again reuse it.
 */
export function keepPastEntries(food: FoodItem, saved: FoodItem[]): FoodItem {
  const old = saved.find((f) => f.id === food.id);
  if (!old || keepsUnits(old, food)) return food;
  const suffix = `~${unitsHash(food)}`;
  return { ...food, id: food.id.slice(0, MAX_ID_LENGTH - suffix.length) + suffix };
}

/** The food's units with the person's own portion sizes applied. */
export function unitsFor(food: FoodItem, overrides: PortionOverrides): FoodUnit[] {
  return food.units.map((u) => {
    const grams = overrides[`${food.id}:${u.key}`];
    return grams ? { ...u, grams } : u;
  });
}

export function gramsFor(food: FoodItem, unitKey: string, quantity: number, overrides: PortionOverrides): number {
  const unit = unitsFor(food, overrides).find((u) => u.key === unitKey) ?? { grams: 100 };
  return unit.grams * quantity;
}

export function nutrientsFor(food: FoodItem, unitKey: string, quantity: number, overrides: PortionOverrides): Nutrients {
  return scaleNutrients(food.per100g, gramsFor(food, unitKey, quantity, overrides) / 100);
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Matches names and local names ("roti", "dahi", "kela"). Whole-word prefix
 * matches rank first, then anywhere in the name; on ties own foods come
 * first, then saved ones. Recipe ingredients (raw dal, salt) are left out:
 * people log what they ate, not what went into it.
 */
export function searchFoods(query: string, own: OwnFood[], saved: FoodItem[] = [], limit = 8): FoodItem[] {
  // Built-in before saved, so an id in both resolves the way findFood does.
  return searchIn(query, [...own.map(ownFoodItem), ...FOODS, ...saved], limit);
}

/** The ranking behind searchFoods, over any list. */
export function searchIn(query: string, foods: FoodItem[], limit = 8): FoodItem[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { food: FoodItem; score: number }[] = [];
  const seen = new Set<string>();
  for (const food of foods) {
    // A saved copy of a built-in food (or any duplicate id) shows once: the first wins.
    if (food.ingredientOnly || seen.has(food.id)) continue;
    seen.add(food.id);
    const names = [food.name, ...food.aliases].map(normalize);
    let score = 0;
    for (const n of names) {
      if (n === q) score = Math.max(score, 4);
      else if (n.startsWith(q)) score = Math.max(score, 3);
      else if (n.split(' ').some((w) => w.startsWith(q))) score = Math.max(score, 2);
      else if (n.includes(q)) score = Math.max(score, 1);
    }
    const bonus = food.category === 'own' ? 0.5 : isSavedFoodId(food.id) ? 0.25 : 0;
    if (score > 0) scored.push({ food, score: score + bonus });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
    .slice(0, limit)
    .map((s) => s.food);
}

/** "2 roti", "1.5 bowl (katori)", "150 grams". */
export function portionLabel(food: FoodItem, unitKey: string, quantity: number): string {
  const unit = food.units.find((u) => u.key === unitKey);
  const q = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);
  return `${q} ${unit?.label ?? unitKey}`;
}

/**
 * Foods richest in a nutrient per usual portion: suggestions for something
 * that's often low. Not fats, sweets, drinks or spices, not raw recipe
 * ingredients, and not deep-fried food: none is a good way to get more of it.
 */
export function goodSources(key: keyof Nutrients, limit = 3, foods: FoodItem[] = FOODS): { food: FoodItem; amount: number }[] {
  return foods
    .filter(
      (f) =>
        !f.ingredientOnly &&
        !f.flags?.includes('deep-fried') &&
        !['fat', 'sweet', 'drink', 'spice'].includes(f.category),
    )
    .map((food) => {
      const unit = food.units.find((u) => u.key === food.defaultUnit) ?? food.units[0];
      return { food, amount: ((food.per100g[key] ?? 0) * unit.grams) / 100 };
    })
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export { sumNutrients };
