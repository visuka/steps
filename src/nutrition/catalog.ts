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

const byId = new Map(FOODS.map((f) => [f.id, f]));

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

export function findFood(id: string, own: OwnFood[]): FoodItem | null {
  if (id.startsWith(OWN_PREFIX)) {
    const o = own.find((x) => OWN_PREFIX + x.id === id);
    return o ? ownFoodItem(o) : null;
  }
  return byId.get(id) ?? null;
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
 * matches rank first, then anywhere in the name; own foods come first on ties.
 */
export function searchFoods(query: string, own: OwnFood[], limit = 8): FoodItem[] {
  const q = normalize(query);
  if (!q) return [];
  const all = [...own.map(ownFoodItem), ...FOODS];
  const scored: { food: FoodItem; score: number }[] = [];
  for (const food of all) {
    const names = [food.name, ...food.aliases].map(normalize);
    let score = 0;
    for (const n of names) {
      if (n === q) score = Math.max(score, 4);
      else if (n.startsWith(q)) score = Math.max(score, 3);
      else if (n.split(' ').some((w) => w.startsWith(q))) score = Math.max(score, 2);
      else if (n.includes(q)) score = Math.max(score, 1);
    }
    if (score > 0) scored.push({ food, score: score + (food.category === 'own' ? 0.5 : 0) });
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

/** Foods richest in a nutrient per usual portion: suggestions for something that's often low. */
export function goodSources(key: keyof Nutrients, limit = 3): { food: FoodItem; amount: number }[] {
  return FOODS.filter((f) => !['fat', 'sweet', 'drink'].includes(f.category))
    .map((food) => {
      const unit = food.units.find((u) => u.key === food.defaultUnit) ?? food.units[0];
      return { food, amount: ((food.per100g[key] ?? 0) * unit.grams) / 100 };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export { sumNutrients };
