/**
 * Plain flags for one portion: "High in salt", "Deep-fried", and how much it
 * raises blood glucose. Thresholds are the UK Food Standards Agency's
 * front-of-pack traffic lights, the most widely used plain rule there is.
 */
import { GL_BANDS, nutrientNumber } from './nutrients';
import type { FoodItem, NutrientKey } from './types';

export type WatchLevel = 'high' | 'medium';

export interface WatchOut {
  key: NutrientKey | 'deep-fried';
  level: WatchLevel;
  text: string;
}

type Band = { high: number; medium: number };
type Watched = 'sodium' | 'sugars' | 'satFat' | 'fat';

/** Per 100 g of food. Above `high` is red, above `medium` amber. */
const FOOD_BANDS: Record<Watched, Band> = {
  sodium: { high: 600, medium: 120 },
  sugars: { high: 22.5, medium: 5 },
  satFat: { high: 5, medium: 1.5 },
  fat: { high: 17.5, medium: 3 },
};

/** Per 100 ml of a drink (taken as 100 g): half the food figures; salt has its own. */
const DRINK_BANDS: Record<Watched, Band> = {
  sodium: { high: 300, medium: 120 },
  sugars: { high: 11.25, medium: 2.5 },
  satFat: { high: 2.5, medium: 0.75 },
  fat: { high: 8.75, medium: 1.5 },
};

/** A big portion is red when it alone holds this much (30% of an adult's reference intake). */
const PORTION_HIGH: Record<Watched, number> = { sodium: 720, sugars: 27, satFat: 6, fat: 21 };
/** FSA's portion rule applies to portions over this. */
const BIG_PORTION_G = 100;
/** Trans fat in one portion worth a mention; there is no safe amount to aim for. */
const TRANS_FAT_G = 0.5;

const TEXT: Record<Watched, Record<WatchLevel, string>> = {
  sodium: { high: 'High in salt', medium: 'Medium salt' },
  sugars: { high: 'High in sugar', medium: 'Medium sugar' },
  satFat: { high: 'High in saturated fat', medium: 'Medium saturated fat' },
  fat: { high: 'High in fat', medium: 'Medium fat' },
};

/**
 * What to watch in `grams` of the food, highest first. Own foods hold their
 * numbers per serving (one serving = 100 "grams"), so only the per-portion
 * rule is fair for them.
 */
export function watchOuts(food: FoodItem, grams: number): WatchOut[] {
  const own = food.category === 'own';
  const bands = food.category === 'drink' ? DRINK_BANDS : FOOD_BANDS;
  const portion = grams / 100;
  const out: WatchOut[] = [];

  for (const key of Object.keys(FOOD_BANDS) as Watched[]) {
    const per100 = food.per100g[key];
    if (per100 === undefined) continue;
    const inPortion = per100 * portion;
    const bigPortion = own || grams > BIG_PORTION_G;
    let level: WatchLevel | null = null;
    if (!own && per100 > bands[key].high) level = 'high';
    else if (bigPortion && inPortion > PORTION_HIGH[key]) level = 'high';
    else if (!own && per100 > bands[key].medium) level = 'medium';
    if (level) out.push({ key, level, text: TEXT[key][level] });
  }

  const trans = food.per100g.transFat;
  if (trans !== undefined && trans * portion >= TRANS_FAT_G) {
    out.push({ key: 'transFat', level: 'high', text: 'Has trans fat' });
  }
  if (food.flags?.includes('deep-fried')) out.push({ key: 'deep-fried', level: 'medium', text: 'Deep-fried' });

  // Highs, then deep-fried, then mediums; otherwise in the order above (the sort is stable).
  const rank = (w: WatchOut) => (w.level === 'high' ? 0 : w.key === 'deep-fried' ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b));
}

/** Below this much available carb per 100 g, a GI figure means little (oil, meat, greens). */
const MIN_CARBS_FOR_GI = 5;

/** The food's glycemic index worked back from its glycemic load, or null when it isn't a carb food. */
export function glycemicIndex(food: FoodItem): number | null {
  const { gl, carbs, fiber = 0 } = food.per100g;
  if (gl === undefined || carbs === undefined) return null;
  const available = carbs - fiber;
  if (available < MIN_CARBS_FOR_GI) return null;
  return Math.round((gl / available) * 100);
}

export type GlBand = 'low' | 'medium' | 'high';

/**
 * Low, medium or high glycemic load (University of Sydney bands): a portion of
 * 10 or less is low and 20 or more high; a day under 80 is low and over 120
 * high. Judged on the number as the app shows it, so the label always agrees
 * with the figure next to it.
 */
export function glBand(value: number, scale: 'day' | 'portion'): GlBand {
  const shown = Number(nutrientNumber('gl', value));
  const { low, high } = GL_BANDS[scale];
  if (scale === 'portion') return shown <= low ? 'low' : shown >= high ? 'high' : 'medium';
  return shown < low ? 'low' : shown > high ? 'high' : 'medium';
}
