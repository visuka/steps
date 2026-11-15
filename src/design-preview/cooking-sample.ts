/**
 * INVENTED sample for the design preview's Edit recipe (screen=food&edit=1): a few ingredients
 * with profiles, one of them deep fried, and a tiny factor table so the chips, the method text
 * and the oil line have something to show. None of these numbers is real or comes from the
 * server; the real tables are downloaded by the app and never sit in this repo.
 */
import type { CookingTables, IngredientProfile } from '@/nutrition/cooking/types';
import type { FoodIngredient, FoodItem } from '@/nutrition/types';

import { SAMPLE_FOOD } from './sample';

export const SAMPLE_COOKING_TABLES: CookingTables = {
  calc: 'c1',
  methods: {
    boiled: { sameAs: [], liquidEaten: false },
    simmered: { sameAs: ['boiled'], liquidEaten: true },
    'stir-fried': { sameAs: [], liquidEaten: false },
    'deep-fried': { sameAs: [], liquidEaten: false },
  },
  retentionMap: {},
  retention: { proxies: {}, codes: {} },
  yields: { limits: [0.3, 4], classes: {}, methods: {}, gravyWater: {} },
  fatDrip: {},
  oilUptake: [{ method: 'deep-fried', u: 15 }],
  oils: {
    byCountry: { '*': 'sample-oil' },
    foods: { 'sample-oil': { name: 'Sample oil', per100g: { kcal: 900, protein: 0, carbs: 0, fiber: 0, fat: 100 }, missing: [] } },
  },
};

const profile = (over: Partial<IngredientProfile>): IngredientProfile => ({
  calc: 'c1',
  kind: 'food',
  id: null,
  recName: '',
  per100g: {},
  missing: [],
  cookClass: 'sample',
  yieldClass: 'sample',
  asEaten: false,
  fryAgain: true,
  noMethod: false,
  basis: 'raw',
  rawGrams: 0,
  yields: {},
  cooked: {},
  ...over,
});

const ingredient = (name: string, grams: number, p: Partial<IngredientProfile>, method?: FoodIngredient['method']): FoodIngredient => ({
  name,
  grams,
  rawGrams: grams,
  ...(method ? { method } : {}),
  profile: profile({ recName: name, ...p }),
});

/** Five rows: dried anchovy deep fried (so the oil line shows), egg boiled, onion tadka, tomato in gravy, and oil in the dish. */
export const SAMPLE_COOKING_INGREDIENTS: FoodIngredient[] = [
  ingredient('Dried anchovy (methallu)', 40, { per100g: { kcal: 290, protein: 60, carbs: 0, fat: 5 }, yields: { 'deep-fried': { y: 0.7 } } }, 'deep-fried'),
  ingredient('Egg', 100, { per100g: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }, yields: { boiled: { y: 1 } } }, 'boiled'),
  ingredient('Onion', 60, { per100g: { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 } }, 'stir-fried'),
  ingredient('Tomato', 50, { per100g: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 } }, 'simmered'),
  ingredient('Oil', 10, { kind: 'oil', role: 'in-dish', noMethod: true, per100g: { kcal: 900, protein: 0, carbs: 0, fat: 100 } }),
];

/** The sample dish for the editor: the same dish, with ingredients that carry profiles. */
export const SAMPLE_COOKING_FOOD: FoodItem = { ...SAMPLE_FOOD, ingredients: SAMPLE_COOKING_INGREDIENTS };
