/**
 * Nutrients per 100 g of a dish made of parts, as the server's catalog.mix_known:
 * a nutrient no part has is left out (never 0); one only some parts have is
 * added up from those and named in `missing` ("at least"). The decimals are
 * how values are written, not cooking data.
 */
import type { NutrientKey, Nutrients } from '../types';

export const DECIMALS: Record<NutrientKey, number> = {
  kcal: 0, protein: 1, carbs: 1, fiber: 1, sugars: 1, addedSugar: 1, fat: 1, satFat: 1,
  transFat: 2, omega3: 2, cholesterol: 0, vitA: 0, vitD: 1, vitE: 2, vitK: 1, vitC: 1,
  thiamin: 2, riboflavin: 2, niacin: 2, vitB6: 2, folate: 0, vitB12: 2, calcium: 0, iron: 2,
  magnesium: 0, phosphorus: 0, potassium: 0, sodium: 0, zinc: 2, selenium: 1, caffeine: 0,
  alcohol: 1, gl: 1,
};

export const KEYS = Object.keys(DECIMALS) as NutrientKey[];

export interface Part {
  per100g: Nutrients;
  grams: number;
}

export function rounded(key: NutrientKey, value: number): number {
  const f = 10 ** DECIMALS[key];
  return Math.round(value * f) / f;
}

/** Water, or anything else that is all zeros: it neither tells a nutrient nor leaves one unknown. */
function neutral(n: Nutrients): boolean {
  const values = Object.values(n);
  return values.length > 0 && values.every((v) => v === 0);
}

/** Next to no available carbohydrate: its glycemic load is 0 even with no GI known. */
function noGl(n: Nutrients): boolean {
  return n.carbs !== undefined && n.carbs - (n.fiber ?? 0) < 1;
}

export function mixKnown(parts: Part[]): { per100g: Nutrients; missing: NutrientKey[] } {
  const weight = parts.reduce((s, p) => s + p.grams, 0);
  if (!(weight > 0)) return { per100g: {}, missing: [] };
  let flags = parts.map((p) => neutral(p.per100g));
  if (flags.every(Boolean)) flags = flags.map(() => false);
  const per100g: Nutrients = {};
  const missing: NutrientKey[] = [];
  for (const key of KEYS) {
    let sum = 0;
    let any = false;
    parts.forEach((p, i) => {
      const v = p.per100g[key];
      if (!flags[i] && v !== undefined) {
        sum += (v * p.grams) / 100;
        any = true;
      }
    });
    if (!any) continue;
    per100g[key] = rounded(key, (sum / weight) * 100);
    const lacks = parts.some((p, i) => !flags[i] && p.grams > 0 && p.per100g[key] === undefined && !(key === 'gl' && noGl(p.per100g)));
    if (lacks) missing.push(key);
  }
  return { per100g, missing };
}
