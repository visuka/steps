import type { NutrientKey, Nutrients } from './types';

export interface NutrientInfo {
  key: NutrientKey;
  label: string;
  unit: 'kcal' | 'g' | 'mg' | 'µg';
  /** US FDA Daily Value for adults, used as a general target. */
  daily: number;
  group: 'energy' | 'macro' | 'vitamin' | 'mineral';
}

export const NUTRIENTS: NutrientInfo[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal', daily: 2000, group: 'energy' },
  { key: 'protein', label: 'Protein', unit: 'g', daily: 50, group: 'macro' },
  { key: 'carbs', label: 'Carbs', unit: 'g', daily: 275, group: 'macro' },
  { key: 'fat', label: 'Fat', unit: 'g', daily: 78, group: 'macro' },
  { key: 'fiber', label: 'Fibre', unit: 'g', daily: 28, group: 'macro' },
  { key: 'vitA', label: 'Vitamin A', unit: 'µg', daily: 900, group: 'vitamin' },
  { key: 'vitC', label: 'Vitamin C', unit: 'mg', daily: 90, group: 'vitamin' },
  { key: 'vitD', label: 'Vitamin D', unit: 'µg', daily: 20, group: 'vitamin' },
  { key: 'vitB12', label: 'Vitamin B12', unit: 'µg', daily: 2.4, group: 'vitamin' },
  { key: 'folate', label: 'Folate', unit: 'µg', daily: 400, group: 'vitamin' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', daily: 1300, group: 'mineral' },
  { key: 'iron', label: 'Iron', unit: 'mg', daily: 18, group: 'mineral' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', daily: 4700, group: 'mineral' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', daily: 420, group: 'mineral' },
  { key: 'zinc', label: 'Zinc', unit: 'mg', daily: 11, group: 'mineral' },
];

export const NUTRIENT = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n])) as Record<NutrientKey, NutrientInfo>;

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const out: Nutrients = {};
  for (const [k, v] of Object.entries(n) as [NutrientKey, number][]) out[k] = v * factor;
  return out;
}

/** Adds up nutrients; a key missing from every item stays missing. */
export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = {};
  for (const n of list) {
    for (const [k, v] of Object.entries(n) as [NutrientKey, number][]) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

/** "12 mg", "1.2 µg", "340 kcal". */
export function formatNutrient(key: NutrientKey, value: number): string {
  const info = NUTRIENT[key];
  const digits = value >= 100 || info.unit === 'kcal' ? 0 : value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${info.unit}`;
}

export function percentOfDaily(key: NutrientKey, value: number): number {
  return Math.round((value / NUTRIENT[key].daily) * 100);
}
