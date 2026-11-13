/**
 * Good food sources for a nutrient, for the person's diet. The lists are
 * picked by hand from our own catalog (a plain ranking picks mozzarella cups
 * and US buttermilk), then checked at run time: at least 10% of the daily
 * need in a usual portion, nothing high in salt, sugar or fat, the person's
 * diet and "Not for me" choices respected, foods they already eat first.
 */
import type { Diet, FoodEntry } from '@/data/types';

import { catalogFood, unitsFor } from './catalog';
import { NUTRIENT } from './nutrients';
import type { FoodItem, NutrientKey } from './types';
import { watchOuts } from './watch';

export type FoodDiet = Diet | 'unknown';

/** Catalog dishes with meat or fish. Keep in step with the catalog. */
export const NONVEG_DISH_IDS: readonly string[] = ['chicken-curry', 'butter-chicken', 'fish-curry', 'mutton-curry', 'chicken-biryani'];
export const EGG_DISH_IDS: readonly string[] = ['egg-curry'];

const NONVEG_WORDS =
  /\b(chicken|mutton|fish|prawns?|shrimps?|keema|meat|beef|pork|lamb|goat|crab|squid|lobster|bacon|ham|sausages?|salami|pepperoni|tuna|salmon|sardines?|mackerel|anchov(?:y|ies)|oysters?|clams?|mussels?|turkey|duck|gosht|murg[h]?|machli|macher|meen|kozhi|kodi|mamsam|kheema|liver|kebab|tikka|seekh|bangda|surmai|rohu|pomfret|katla|hilsa|tilapia)\b/i;
const EGG_WORDS = /\b(eggs?|anda|omelet(?:te)?|muttai|bhurji)\b/i;

/**
 * veg, egg or nonveg. Catalog foods go by category and the dish lists; foods
 * from the food API, recipes and the person's own foods by their name and
 * ingredients, and 'unknown' when neither says (an unknown food is never
 * suggested to anyone).
 */
export function dietOf(food: FoodItem): FoodDiet {
  const fromCatalog = food.category !== 'own' && catalogFood(food.id) !== null;
  if (food.category === 'meat' || food.category === 'fish') return 'nonveg';
  if (food.category === 'egg') return 'egg';
  if (fromCatalog) {
    if (NONVEG_DISH_IDS.includes(food.id)) return 'nonveg';
    if (EGG_DISH_IDS.includes(food.id)) return 'egg';
    // A safety net for dishes added to the catalog later without updating the lists.
    const words = [food.id.replace(/-/g, ' '), food.name].join(' ');
    if (NONVEG_WORDS.test(words)) return 'nonveg';
    if (EGG_WORDS.test(words)) return 'egg';
    return 'veg';
  }
  const text = [food.name, ...food.aliases, ...(food.ingredients ?? []).map((i) => i.name)].join(' ');
  if (NONVEG_WORDS.test(text)) return 'nonveg';
  if (EGG_WORDS.test(text)) return 'egg';
  // Only a listed recipe says what's in it; a bare name ("thali", "special rice") doesn't.
  return food.ingredients?.length ? 'veg' : 'unknown';
}

/** veg ⊂ egg ⊂ nonveg; a diet not asked yet counts as veg. */
export function dietAllows(diet: Diet | null, food: FoodDiet): boolean {
  if (food === 'unknown') return false;
  const rank = { veg: 0, egg: 1, nonveg: 2 } as const;
  return rank[food] <= rank[diet ?? 'veg'];
}

interface Pick {
  id: string;
  /** Short chip label; milk variants share one. */
  label: string;
}

const p = (id: string, label: string): Pick => ({ id, label });

const MILK = p('milk-toned', 'Milk');
const CURD = p('curd', 'Curd');
const EGG = p('egg-boiled', 'Eggs');
const OMELETTE = p('omelette', 'Omelette');

/**
 * Hand-picked sources in order of preference, by tier: veg for everyone, egg
 * for egg and nonveg diets, nonveg for nonveg. A nonveg list takes from its
 * own tier first, then egg, then veg, in turns, so it stays varied.
 */
export const SOURCE_PICKS: Partial<Record<NutrientKey, { veg: Pick[]; egg?: Pick[]; nonveg?: Pick[] }>> = {
  protein: {
    veg: [p('masoor-dal', 'Masoor dal'), p('chickpeas', 'Chickpeas'), p('tofu', 'Tofu'), MILK, CURD, p('soybeans', 'Soybeans'), p('moong-dal', 'Moong dal')],
    egg: [EGG, OMELETTE],
    nonveg: [p('chicken-breast', 'Chicken'), p('fish-rohu', 'Fish'), p('prawns', 'Prawns'), p('mutton', 'Mutton')],
  },
  fiber: {
    veg: [p('masoor-dal', 'Masoor dal'), p('chickpeas', 'Chickpeas'), p('peas', 'Green peas'), p('pomegranate', 'Pomegranate'), p('pear', 'Pear'), p('chapati', 'Roti'), p('broccoli', 'Broccoli'), p('guava', 'Guava')],
  },
  vitA: {
    veg: [p('carrot', 'Carrot'), p('spinach', 'Spinach'), p('sweet-potato', 'Sweet potato'), p('pumpkin', 'Pumpkin'), MILK],
    egg: [OMELETTE],
    nonveg: [p('fish-seer', 'Seer fish')],
  },
  vitE: {
    veg: [p('almonds', 'Almonds'), p('spinach', 'Spinach'), p('mustard-greens', 'Mustard greens'), p('broccoli', 'Broccoli')],
    egg: [OMELETTE],
  },
  vitK: {
    veg: [p('spinach', 'Spinach'), p('mustard-greens', 'Mustard greens'), p('broccoli', 'Broccoli'), p('beans', 'Green beans'), p('cabbage', 'Cabbage')],
  },
  vitC: {
    veg: [p('guava', 'Guava'), p('orange', 'Orange'), p('tomato', 'Tomato'), p('papaya', 'Papaya'), p('capsicum', 'Capsicum'), p('broccoli', 'Broccoli'), p('cauliflower', 'Cauliflower')],
  },
  thiamin: {
    veg: [p('peas', 'Green peas'), p('masoor-dal', 'Masoor dal'), p('moong-dal', 'Moong dal'), p('brown-rice', 'Brown rice'), p('chapati', 'Roti'), p('soybeans', 'Soybeans')],
    nonveg: [p('fish-mackerel', 'Mackerel'), p('mutton', 'Mutton')],
  },
  riboflavin: {
    veg: [MILK, CURD, p('spinach', 'Spinach'), p('almonds', 'Almonds'), p('soybeans', 'Soybeans'), p('mushrooms', 'Mushrooms')],
    egg: [EGG, OMELETTE],
    nonveg: [p('fish-mackerel', 'Mackerel'), p('mutton', 'Mutton')],
  },
  niacin: {
    veg: [p('brown-rice', 'Brown rice'), p('peas', 'Green peas'), p('mushrooms', 'Mushrooms'), p('chapati', 'Roti'), p('millet', 'Millet'), p('urad-dal', 'Urad dal')],
    nonveg: [p('chicken-breast', 'Chicken'), p('fish-seer', 'Seer fish'), p('fish-mackerel', 'Mackerel'), p('mutton', 'Mutton')],
  },
  vitB6: {
    veg: [p('banana', 'Banana'), p('potato', 'Potato'), p('spinach', 'Spinach'), p('soybeans', 'Soybeans'), p('peas', 'Green peas'), p('chickpeas', 'Chickpeas')],
    nonveg: [p('chicken-breast', 'Chicken'), p('fish-mackerel', 'Mackerel'), p('fish-seer', 'Seer fish')],
  },
  folate: {
    veg: [p('masoor-dal', 'Masoor dal'), p('chickpeas', 'Chickpeas'), p('moong-dal', 'Moong dal'), p('spinach', 'Spinach'), p('kidney-beans', 'Rajma'), p('broccoli', 'Broccoli'), p('toor-dal', 'Toor dal')],
    egg: [OMELETTE],
  },
  vitB12: {
    veg: [MILK, CURD],
    egg: [EGG, OMELETTE],
    nonveg: [p('fish-rohu', 'Fish'), p('fish-mackerel', 'Mackerel'), p('mutton', 'Mutton'), p('chicken-breast', 'Chicken')],
  },
  calcium: {
    // No palak: its oxalate holds on to most of its calcium.
    veg: [MILK, CURD, p('tofu', 'Tofu'), p('ragi-mudde', 'Ragi'), p('soybeans', 'Soybeans'), p('mustard-greens', 'Mustard greens')],
  },
  iron: {
    veg: [p('soybeans', 'Soybeans'), p('masoor-dal', 'Masoor dal'), p('chickpeas', 'Chickpeas'), p('kidney-beans', 'Rajma'), p('tofu', 'Tofu'), p('ragi-mudde', 'Ragi'), p('spinach', 'Spinach')],
    nonveg: [p('mutton', 'Mutton'), p('fish-seer', 'Seer fish')],
  },
  magnesium: {
    veg: [p('spinach', 'Spinach'), p('soybeans', 'Soybeans'), p('urad-dal', 'Urad dal'), p('almonds', 'Almonds'), p('moong-dal', 'Moong dal'), p('chickpeas', 'Chickpeas'), p('millet', 'Millet')],
    nonveg: [p('fish-mackerel', 'Mackerel'), p('prawns', 'Prawns')],
  },
  potassium: {
    veg: [p('soybeans', 'Soybeans'), p('spinach', 'Spinach'), p('kidney-beans', 'Rajma'), p('toor-dal', 'Toor dal'), p('masoor-dal', 'Masoor dal')],
    nonveg: [p('mutton', 'Mutton')],
  },
  zinc: {
    veg: [p('chickpeas', 'Chickpeas'), p('masoor-dal', 'Masoor dal'), p('soybeans', 'Soybeans'), p('peas', 'Green peas'), p('oats', 'Oats'), p('tofu', 'Tofu')],
    egg: [OMELETTE],
    nonveg: [p('mutton', 'Mutton'), p('prawns', 'Prawns'), p('chicken-thigh', 'Chicken')],
  },
  omega3: {
    veg: [p('soybeans', 'Soybeans'), p('tofu', 'Tofu'), p('urad-dal', 'Urad dal'), p('kidney-beans', 'Rajma')],
    nonveg: [p('fish-mackerel', 'Mackerel'), p('fish-salmon', 'Salmon'), p('fish-rohu', 'Fish'), p('fish-sardine', 'Sardine')],
  },
  phosphorus: {
    veg: [p('soybeans', 'Soybeans'), p('masoor-dal', 'Masoor dal'), p('chickpeas', 'Chickpeas'), MILK],
    nonveg: [p('fish-rohu', 'Fish'), p('prawns', 'Prawns')],
  },
  selenium: {
    veg: [p('rice', 'Rice'), p('chapati', 'Roti'), p('oats', 'Oats'), p('tofu', 'Tofu')],
    egg: [EGG],
    nonveg: [p('fish-mackerel', 'Mackerel'), p('fish-pomfret', 'Pomfret'), p('chicken-breast', 'Chicken')],
  },
};

/** Variants that show as one chip, and one "Not for me". */
const SAME_FOOD: Record<string, string> = { milk: 'milk-toned', 'milk-buffalo': 'milk-toned', 'egg-fried': 'egg-boiled' };
export const sameFood = (id: string): string => SAME_FOOD[id] ?? id;

/** Never suggested unless the person logged it in the last 30 days: many people who eat meat don't eat these. */
export const ONLY_IF_LOGGED: readonly string[] = ['beef'];

/** Palak (spinach) dishes are no calcium source: its oxalate binds the calcium. */
const NOT_FOR_CALCIUM = /palak|spinach/i;

/** A source must give this share of the daily need in its usual portion. */
export const SOURCE_FLOOR = 0.1;

export interface SourceFood {
  id: string;
  label: string;
  /** In the usual portion, in the nutrient's unit. */
  amount: number;
  /** Of the daily need, in the usual portion. */
  percent: number;
}

export interface Sources {
  /** Empty when the catalog gives fewer than 2: the line alone is shown then. */
  foods: SourceFood[];
  /** A plain line to show with (or instead of) the foods. */
  line: string | null;
}

export interface SourceOptions {
  /** Foods logged in the last 14 days, most recent first (loggedFoodIds). They come first. */
  logged?: string[];
  /** Foods logged in the last 30 days: unlocks ONLY_IF_LOGGED foods. */
  logged30?: string[];
  /** "Not for me" chips (kv NOT_FOR_ME_KEY). */
  notForMe?: string[];
  limit?: number;
  /** Portion sizes the person set. */
  overrides?: Record<string, number>;
}

/** Same food list as goodSources(): not fats, sweets, drinks or spices, raw ingredients or deep-fried food. */
function eligible(food: FoodItem): boolean {
  return !food.ingredientOnly && !food.flags?.includes('deep-fried') && !['fat', 'sweet', 'drink', 'spice'].includes(food.category);
}

function portion(food: FoodItem, overrides: Record<string, number>, key: NutrientKey): { grams: number; amount: number } {
  const units = unitsFor(food, overrides);
  const unit = units.find((u) => u.key === food.defaultUnit) ?? units[0];
  return { grams: unit.grams, amount: ((food.per100g[key] ?? 0) * unit.grams) / 100 };
}

/** The checks every suggestion passes, picked or logged. Null when it fails one. */
function check(key: NutrientKey, id: string, label: string, diet: Diet | null, o: Required<Omit<SourceOptions, 'limit'>>): SourceFood | null {
  const food = catalogFood(id);
  const daily = NUTRIENT[key].daily;
  if (!food || !daily || !eligible(food)) return null;
  if (!dietAllows(diet, dietOf(food))) return null;
  if (o.notForMe.includes(sameFood(id))) return null;
  if (ONLY_IF_LOGGED.includes(id) && !o.logged30.includes(id)) return null;
  if (key === 'calcium' && (NOT_FOR_CALCIUM.test(food.id) || NOT_FOR_CALCIUM.test(food.name))) return null;
  const { grams, amount } = portion(food, o.overrides, key);
  if (amount < SOURCE_FLOOR * daily) return null;
  if (watchOuts(food, grams).some((w) => w.level === 'high')) return null;
  return { id: sameFood(id), label, amount, percent: Math.round((amount / daily) * 100) };
}

/** "Toor dal (cooked, plain)" → "Toor dal". */
const shortName = (name: string) => name.replace(/\s*\([^)]*\)/g, '').trim();

/** The hand-picked list for this diet, tiers taken in turns, most specific first. */
export function pickOrder(key: NutrientKey, diet: Diet | null): Pick[] {
  const picks = SOURCE_PICKS[key];
  if (!picks) return [];
  const d = diet ?? 'veg';
  const tiers = [d === 'nonveg' ? picks.nonveg : undefined, d !== 'veg' ? picks.egg : undefined, picks.veg].filter(
    (t): t is Pick[] => Boolean(t?.length),
  );
  const out: Pick[] = [];
  for (let i = 0; tiers.some((t) => i < t.length); i++) for (const t of tiers) if (t[i]) out.push(t[i]);
  return out;
}

/** The fallback line for a nutrient and diet. */
export function sourceLine(key: NutrientKey, diet: Diet | null): string | null {
  if (key === 'vitD') return 'Sunlight on face and arms.';
  if (key === 'vitB12' && diet === null) return 'Eggs and fish have more, if you eat them.';
  if (key === 'omega3') {
    if (diet === 'nonveg') return 'Fish like mackerel or sardine.';
    if (diet === null) return 'Walnuts and soybeans. Fish like mackerel has more, if you eat it.';
    return 'Walnuts and soybeans.';
  }
  return null;
}

/**
 * Up to `limit` (4) foods for `key` that suit the diet: foods the person
 * logged in the last 14 days first, then the hand-picked list.
 */
export function sourcesFor(key: NutrientKey, diet: Diet | null, opts: SourceOptions = {}): Sources {
  const o = { logged: opts.logged ?? [], logged30: opts.logged30 ?? opts.logged ?? [], notForMe: opts.notForMe ?? [], overrides: opts.overrides ?? {} };
  const limit = opts.limit ?? 4;
  const picks = pickOrder(key, diet);
  const labelOf = (id: string) => picks.find((x) => x.id === sameFood(id))?.label ?? shortName(catalogFood(id)?.name ?? id);

  const out: SourceFood[] = [];
  const seen = new Set<string>();
  const add = (s: SourceFood | null) => {
    if (s && !seen.has(s.id) && out.length < limit) {
      seen.add(s.id);
      out.push(s);
    }
  };
  // Foods they already eat, when they're good sources too, then the picks.
  for (const id of o.logged) add(check(key, id, labelOf(id), diet, o));
  for (const pick of picks) add(check(key, pick.id, pick.label, diet, o));

  const line = sourceLine(key, diet);
  return { foods: out.length >= 2 ? out : [], line };
}

/** Catalog food ids in entries logged since `fromMs`, most recent first, each once (variants merged). */
export function loggedFoodIds(entries: FoodEntry[], fromMs: number): string[] {
  const out: string[] = [];
  for (const e of [...entries].sort((a, b) => b.loggedAt - a.loggedAt)) {
    if (e.loggedAt < fromMs || !e.foodId || !catalogFood(e.foodId)) continue;
    if (!out.includes(e.foodId)) out.push(e.foodId);
  }
  return out;
}

/** "Curd, milk and tofu": for a sentence. */
export function sourcesSentence(foods: SourceFood[], max = 3): string {
  const names = foods.slice(0, max).map((f, i) => (i === 0 ? f.label : f.label.charAt(0).toLowerCase() + f.label.slice(1)));
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** kv: food ids the person marked "Not for me" on a source chip; applied everywhere. */
export const NOT_FOR_ME_KEY = 'foodsNotForMe';
