import type { NutrientKey, Nutrients } from './types';

export interface NutrientInfo {
  key: NutrientKey;
  label: string;
  unit: 'kcal' | 'g' | 'mg' | 'µg' | '';
  /**
   * energy, macro: calories and the big nutrients. limit: things to keep low.
   * glucose: sugars and glycemic load. vitamin, mineral: the rest.
   */
  group: 'energy' | 'macro' | 'limit' | 'glucose' | 'vitamin' | 'mineral';
  /** Reach this much a day: US FDA Daily Value for adults (US Adequate Intake for omega-3). */
  daily?: number;
  /** Stay under this much a day: WHO advice, or the US FDA Daily Value where WHO gives none. */
  limit?: number;
  /** Tolerable upper intake for adults (US National Academies), for nutrients food alone can push past it. */
  upper?: number;
  /**
   * Vitamins and minerals. daily: the body keeps little, so some is needed most
   * days. stored: the body keeps a store, so the week's average matters more
   * than one day.
   */
  storage?: 'daily' | 'stored';
  /**
   * Below this a day (or week) reads "Low": the ICMR-NIN 2020 EAR where it is
   * under `daily`, otherwise two-thirds of daily. `daily` stays the full bar.
   * lowFemale / lowMale replace it for that sex; 'unspecified' uses `low`, the
   * lower line. Protein and fibre lines depend on the person (targets.ts).
   */
  low?: number;
  /** Iron: for women under 50 only (state.ts). */
  lowFemale?: number;
  lowMale?: number;
  /** Only an adequate intake is known: below the line reads "Could be higher", never "Low". */
  ai?: true;
  /** Never the subject of a gap note (vitamin D comes from sunlight; the rest are rarely short or poorly counted). */
  gapNote?: false;
  /** One short plain line: what it does for the body. */
  why: string;
  /** One or two plain sentences for the info sheet. */
  note: string;
}

export const NUTRIENTS: NutrientInfo[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal', group: 'energy', daily: 2000, why: 'Energy for everything your body does.', note: 'Energy from food. Your own need depends on your size and how active you are.' },

  { key: 'protein', label: 'Protein', unit: 'g', group: 'macro', daily: 50, why: 'Builds and repairs muscle.', note: 'Needed every day for muscles and repair; the body keeps no store of it.' },
  { key: 'carbs', label: 'Carbs', unit: 'g', group: 'macro', daily: 275, why: 'Your main source of energy.', note: 'The main source of energy: rice, roti, dal, fruit, sugar. Includes fibre.' },
  { key: 'fiber', label: 'Fibre', unit: 'g', group: 'macro', daily: 28, ai: true, why: 'Keeps digestion regular and keeps you full for longer.', note: 'Keeps digestion regular and slows how fast sugar reaches the blood.' },
  { key: 'fat', label: 'Fat', unit: 'g', group: 'macro', daily: 78, why: 'Helps take up vitamins A, D, E and K.', note: 'Needed to absorb vitamins A, D, E and K. The kind of fat matters more than the amount.' },
  { key: 'omega3', label: 'Omega-3', unit: 'g', group: 'macro', daily: 1.6, low: 1.1, ai: true, why: 'A healthy fat for the heart and brain.', note: 'Healthy fats from fish, walnuts, flax seeds and mustard oil.' },

  { key: 'sodium', label: 'Sodium (salt)', unit: 'mg', group: 'limit', limit: 2000, why: 'Too much can raise blood pressure.', note: 'Mostly from salt: 1 g of salt has about 400 mg of sodium. WHO advises under 2,000 mg a day (5 g of salt).' },
  { key: 'addedSugar', label: 'Added sugar', unit: 'g', group: 'limit', limit: 50, why: 'Adds energy with no other nutrients.', note: 'Sugar, jaggery and honey added to food and drinks. WHO advises under 10% of calories (50 g), better under 25 g.' },
  { key: 'satFat', label: 'Saturated fat', unit: 'g', group: 'limit', limit: 20, why: 'Too much can raise blood cholesterol.', note: 'Ghee, butter, coconut oil, cheese and fatty meat. Best kept under about 10% of calories.' },
  { key: 'transFat', label: 'Trans fat', unit: 'g', group: 'limit', limit: 2.2, why: 'Raises the harmful kind of cholesterol, so as little as possible.', note: 'Mostly from vanaspati and frying oil used again and again. Best as low as possible; WHO: under 1% of calories.' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', group: 'limit', limit: 300, why: 'Cholesterol in food matters less than saturated fat.', note: 'From animal foods. Saturated and trans fat raise blood cholesterol more than cholesterol in food does.' },
  { key: 'caffeine', label: 'Caffeine', unit: 'mg', group: 'limit', limit: 400, why: 'Too much late in the day can spoil sleep.', note: 'Tea and coffee. Up to 400 mg a day is fine for most adults; less in pregnancy.' },
  { key: 'alcohol', label: 'Alcohol', unit: 'g', group: 'limit', why: 'Adds energy with no nutrients.', note: 'Adds calories but no nutrients.' },

  { key: 'sugars', label: 'Sugars (all)', unit: 'g', group: 'glucose', why: 'All sugars, the natural ones in fruit and milk too.', note: 'All sugars, including the natural ones in fruit and milk.' },
  { key: 'gl', label: 'Glycemic load', unit: '', group: 'glucose', why: 'How much a meal raises blood glucose.', note: 'How much the food raises blood glucose, from its carbs and how fast they are absorbed. A day under 80 is low; over 120 is high.' },

  { key: 'vitA', label: 'Vitamin A', unit: 'µg', group: 'vitamin', daily: 900, storage: 'stored', low: 390, why: 'Helps the eyes see in dim light.', note: 'Fat-soluble and stored in the liver, so the week matters more than one day. Carrots, greens, mango, milk, eggs.' },
  { key: 'vitD', label: 'Vitamin D', unit: 'µg', group: 'vitamin', daily: 20, upper: 100, storage: 'stored', low: 13, gapNote: false, why: 'Helps bones take up calcium.', note: 'Fat-soluble and stored. Most comes from sunlight on the skin, so a low figure from food is common.' },
  { key: 'vitE', label: 'Vitamin E', unit: 'mg', group: 'vitamin', daily: 15, storage: 'stored', low: 10, ai: true, why: 'Protects cells from damage.', note: 'Fat-soluble and stored. Nuts, seeds and oils.' },
  { key: 'vitK', label: 'Vitamin K', unit: 'µg', group: 'vitamin', daily: 120, storage: 'stored', low: 80, ai: true, gapNote: false, why: 'Helps blood clot after a cut.', note: 'Fat-soluble; the body keeps a small store. Leafy greens are rich in it.' },
  { key: 'vitC', label: 'Vitamin C', unit: 'mg', group: 'vitamin', daily: 90, storage: 'daily', low: 60, why: 'Helps heal cuts and take up iron.', note: 'Water-soluble: the body keeps little and passes out the extra, so some is needed every day. Boiling destroys part of it.' },
  { key: 'thiamin', label: 'Vitamin B1', unit: 'mg', group: 'vitamin', daily: 1.2, storage: 'daily', low: 0.8, why: 'Helps turn food into energy.', note: 'Thiamin. Water-soluble, needed every day. Lost when the water rice or dal was boiled in is thrown away.' },
  { key: 'riboflavin', label: 'Vitamin B2', unit: 'mg', group: 'vitamin', daily: 1.3, storage: 'daily', low: 0.9, why: 'Helps turn food into energy and keeps skin healthy.', note: 'Riboflavin. Water-soluble, needed every day. Milk, curd, eggs, greens.' },
  { key: 'niacin', label: 'Vitamin B3', unit: 'mg', group: 'vitamin', daily: 16, storage: 'daily', low: 11, why: 'Helps turn food into energy.', note: 'Niacin. Water-soluble, needed every day. Peanuts, meat, fish, whole grains.' },
  { key: 'vitB6', label: 'Vitamin B6', unit: 'mg', group: 'vitamin', daily: 1.7, storage: 'daily', low: 1.1, why: 'Helps the body use protein.', note: 'Water-soluble, needed every day. Bananas, chickpeas, potatoes, fish.' },
  { key: 'folate', label: 'Folate (B9)', unit: 'µg', group: 'vitamin', daily: 400, storage: 'daily', low: 180, why: 'Helps make new cells and blood.', note: 'Water-soluble with only a small store. Greens and dals; long boiling destroys part of it.' },
  { key: 'vitB12', label: 'Vitamin B12', unit: 'µg', group: 'vitamin', daily: 2.4, storage: 'stored', low: 2, why: 'Keeps nerves and blood healthy.', note: 'Water-soluble but stored in the liver for years. Found almost only in milk, curd, eggs, fish and meat.' },

  { key: 'calcium', label: 'Calcium', unit: 'mg', group: 'mineral', daily: 1300, upper: 2500, storage: 'stored', low: 800, why: 'Keeps bones and teeth strong.', note: 'Stored in bones, which the body draws on when intake is low, so a regular intake matters.' },
  { key: 'iron', label: 'Iron', unit: 'mg', group: 'mineral', daily: 18, upper: 45, storage: 'stored', low: 11, lowFemale: 15, why: 'Carries oxygen in the blood.', note: 'Stored in the body. Vitamin C in the same meal helps absorb it; tea or coffee with meals lowers absorption.' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', group: 'mineral', daily: 420, storage: 'stored', low: 310, lowMale: 370, why: 'Helps muscles and nerves work.', note: 'About half is stored in bones. Nuts, seeds, whole grains, dals.' },
  { key: 'phosphorus', label: 'Phosphorus', unit: 'mg', group: 'mineral', daily: 1250, storage: 'stored', low: 830, gapNote: false, why: 'Builds bones together with calcium.', note: 'Stored in bones with calcium. Most diets have enough.' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', group: 'mineral', daily: 4700, storage: 'daily', low: 2340, ai: true, why: 'Helps balance salt and keep blood pressure steady.', note: 'Not stored: the kidneys keep the balance, so it is needed every day. Helps balance sodium.' },
  { key: 'zinc', label: 'Zinc', unit: 'mg', group: 'mineral', daily: 11, upper: 40, storage: 'daily', low: 7.5, why: 'Helps wounds heal and fights germs.', note: 'The body has no real store, so it is needed regularly.' },
  { key: 'selenium', label: 'Selenium', unit: 'µg', group: 'mineral', daily: 55, upper: 400, storage: 'stored', low: 37, gapNote: false, why: 'Helps protect cells.', note: 'Stored in small amounts. Too much, for example from many Brazil nuts, is harmful.' },
];

export const NUTRIENT = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n])) as Record<NutrientKey, NutrientInfo>;

/** Glycemic load bands for a whole day and for one portion (University of Sydney GI guidance). */
export const GL_BANDS = { day: { low: 80, high: 120 }, portion: { low: 10, high: 20 } } as const;

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

/** "12 mg", "1.2 µg", "340 kcal", "0.04 g", "18" (glycemic load). */
export function formatNutrient(key: NutrientKey, value: number): string {
  const info = NUTRIENT[key];
  const text = nutrientNumber(key, value);
  return info.unit ? `${text} ${info.unit}` : text;
}

/** The number formatNutrient shows, without the unit: "12", "1.2", "0.04". */
export function nutrientNumber(key: NutrientKey, value: number): string {
  const info = NUTRIENT[key];
  const digits = info.unit === 'kcal' || info.unit === '' || value >= 10 ? 0 : value > 0 && value < 0.1 ? 2 : 1;
  return value.toFixed(digits);
}

/** Share of the daily target, or null for nutrients without one. */
export function percentOfDaily(key: NutrientKey, value: number): number | null {
  const daily = NUTRIENT[key].daily;
  return daily ? Math.round((value / daily) * 100) : null;
}

/** Share of the most-per-day limit, or null for nutrients without one. */
export function percentOfLimit(key: NutrientKey, value: number): number | null {
  const limit = NUTRIENT[key].limit;
  return limit ? Math.round((value / limit) * 100) : null;
}
