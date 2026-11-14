/**
 * A scanned pack as the app uses it: the entry it logs, the own food it
 * becomes on "Add to my foods", and the per-serving / per-100 g table on the
 * product sheet. No React Native here, so jest can run it.
 */
import type { FoodEntry } from '@/data/types';

import { nutrientsFor, type PortionOverrides, unitsFor } from './catalog';
import { NUTRIENT } from './nutrients';
import type { FoodItem, FoodUnit, NutrientKey, Nutrients, OwnFood } from './types';

/** "Brand Name", unless the name already starts with the brand. At most 80 letters. */
export function productTitle(name: string, brand?: string): string {
  const n = name.trim();
  const b = brand?.trim();
  const title = b && !n.toLowerCase().startsWith(b.toLowerCase()) ? `${b} ${n}` : n;
  return title.slice(0, 80).trim();
}

/** Liquids are measured in ml (1 ml taken as 1 g): the server labels their units so. */
export function isLiquid(food: FoodItem): boolean {
  return food.units.some((u) => u.key === 'ml' || /\bml\b/.test(u.label));
}

/** The pack's serving, when it has one. */
export function servingUnit(food: FoodItem): FoodUnit | null {
  return food.units.find((u) => u.key === 'serving') ?? null;
}

/** Rounded the way a label would print it: whole kcal and mg/µg above 10, else up to 2 decimals. */
export function roundNutrient(key: NutrientKey, v: number): number {
  if (NUTRIENT[key].unit === 'kcal' || Math.abs(v) >= 10) return Math.round(v);
  return Math.round(v * 100) / 100;
}

const roundAll = (n: Nutrients): Nutrients => {
  const out: Nutrients = {};
  for (const [k, v] of Object.entries(n) as [NutrientKey, number][]) out[k] = roundNutrient(k, v);
  return out;
};

/**
 * A unit's label with the grams the person set for it: "2 biscuits (25 g)"
 * set to 40 g reads "2 biscuits (40 g)". Unchanged units keep their label.
 */
function unitLabelFor(unit: FoodUnit, grams: number, liquid: boolean): string {
  if (grams === unit.grams) return unit.label;
  const amount = `${Math.round(grams)} ${liquid ? 'ml' : 'g'}`;
  const words = unit.label.replace(/\s*\(\s*[\d.,]+\s*(g|ml)\s*\)\s*$/i, '').trim();
  return `${words || 'serving'} (${amount})`;
}

/**
 * "Add to my foods": the pack as one of the person's own foods, with
 * nutrients for one of `unitKey` (per100g × unit grams ÷ 100), using the
 * grams the person set for that unit, and labelled with them. Grams become
 * "100 g" (or ml), since an own food is counted in servings. Unknown keys
 * stay unknown.
 */
export function ownFoodFromScan(food: FoodItem, unitKey: string, id: string, now: number, overrides: PortionOverrides = {}): OwnFood {
  const liquid = isLiquid(food);
  const perGram = unitKey === 'g' || unitKey === 'ml';
  const unit = food.units.find((u) => u.key === unitKey);
  const grams = unitsFor(food, overrides).find((u) => u.key === unitKey)?.grams ?? unit?.grams ?? 100;
  const serving = perGram || !unit ? `100 ${liquid ? 'ml' : 'g'}` : unitLabelFor(unit, grams, liquid);
  const nutrients = perGram || !unit ? roundAll(food.per100g) : roundAll(nutrientsFor(food, unitKey, 1, overrides));
  return { id, name: productTitle(food.name, food.brand), serving, nutrients, updatedAt: now };
}

/**
 * The log entry for an amount of a scanned pack. The food itself is kept on
 * the phone first (saved_food), so `food.id` is the one it was kept under.
 */
export function scanEntry(
  food: FoodItem,
  unit: string,
  quantity: number,
  overrides: PortionOverrides,
  at: number,
  id: string,
  healthSampleId: string | null = null,
): { entry: FoodEntry; nutrients: Nutrients } {
  const nutrients = nutrientsFor(food, unit, quantity, overrides);
  return {
    entry: {
      id,
      loggedAt: at,
      name: food.name,
      foodId: food.id,
      unit,
      quantity,
      kcal: Math.round(nutrients.kcal ?? 0),
      healthSampleId,
      // Packs are eaten wherever; the place question is for cooked dishes.
      place: 'home',
      restaurant: null,
    },
    nutrients,
  };
}

/**
 * A label read with the person's name and serving put on it, for "Add to my
 * foods only" (nothing is shared). Nutrients stay as read, per 100 g.
 */
export function labelFood(
  food: FoodItem,
  form: { name: string; brand: string; servingGrams: number | null; servingLabel: string },
): FoodItem {
  const liquid = isLiquid(food);
  const g = liquid ? 'ml' : 'g';
  const units: FoodUnit[] = [];
  if (form.servingGrams && form.servingGrams > 0) {
    const words = form.servingLabel.trim();
    const amount = `${Math.round(form.servingGrams)} ${g}`;
    units.push({ key: 'serving', label: words ? `${words} (${amount})` : `serving (${amount})`, grams: form.servingGrams });
  }
  units.push({ key: 'g', label: liquid ? 'ml' : 'grams', grams: 1 });
  const brand = form.brand.trim();
  return {
    ...food,
    name: form.name.trim().slice(0, 80) || food.name,
    ...(brand ? { brand } : {}),
    units,
    defaultUnit: units[0].key,
  };
}

export interface TableRow {
  key: NutrientKey;
  label: string;
  unit: string;
  per100: number;
  perServing: number | null;
}

/** The pack's table, in label order: keys the food has, per 100 g and per serving (when there's one). */
export function productTable(food: FoodItem, keys: NutrientKey[]): TableRow[] {
  const serving = servingUnit(food);
  const rows: TableRow[] = [];
  for (const key of keys) {
    const v = food.per100g[key];
    if (v === undefined) continue;
    rows.push({
      key,
      label: NUTRIENT[key].label,
      unit: NUTRIENT[key].unit,
      per100: roundNutrient(key, v),
      perServing: serving ? roundNutrient(key, (v * serving.grams) / 100) : null,
    });
  }
  return rows;
}
