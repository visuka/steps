/**
 * Nutrient keys, shared with the food Lambda (stepsinfra food/catalog.py) and
 * the day records it stores (data/days.py). Units are in nutrients.ts.
 */
export type NutrientKey =
  // Energy and macros
  | 'kcal'
  | 'protein'
  | 'carbs'
  | 'fiber'
  | 'sugars'
  | 'addedSugar'
  | 'fat'
  | 'satFat'
  | 'transFat'
  | 'omega3'
  | 'cholesterol'
  // Vitamins
  | 'vitA'
  | 'vitD'
  | 'vitE'
  | 'vitK'
  | 'vitC'
  | 'thiamin'
  | 'riboflavin'
  | 'niacin'
  | 'vitB6'
  | 'folate'
  | 'vitB12'
  // Minerals
  | 'calcium'
  | 'iron'
  | 'magnesium'
  | 'phosphorus'
  | 'potassium'
  | 'sodium'
  | 'zinc'
  | 'selenium'
  // Other
  | 'caffeine'
  | 'alcohol'
  /** Glycemic load: GI × available carbs (carbs − fibre) ÷ 100. Adds up like grams. */
  | 'gl';

/** Missing keys mean "not known", which is different from zero. */
export type Nutrients = Partial<Record<NutrientKey, number>>;

export type FoodCategory =
  | 'fruit'
  | 'vegetable'
  | 'grain'
  | 'bread'
  | 'legume'
  | 'meat'
  | 'egg'
  | 'fish'
  | 'dairy'
  | 'nut'
  | 'fat'
  | 'sweet'
  | 'drink'
  | 'dish'
  | 'spice'
  | 'own';

/** How a food was made, when that matters for health beyond its nutrients. */
export type FoodFlag = 'deep-fried';

export interface FoodUnit {
  key: string;
  /** "bowl (katori)", "roti", "medium banana". */
  label: string;
  grams: number;
}

/** One line of "how we worked this out": an ingredient and its grams in one unit (or the whole recipe). */
export interface FoodIngredient {
  name: string;
  grams: number;
}

/**
 * A food people can pick. Catalog foods give nutrients per 100 g; a food the
 * person adds gives them per serving, with one unit of 100 "grams" so the same
 * maths works for both. AI estimates and recipes use this same shape.
 */
export interface FoodItem {
  id: string;
  name: string;
  aliases: string[];
  category: FoodCategory;
  per100g: Nutrients;
  units: FoodUnit[];
  defaultUnit: string;
  source: string;
  flags?: FoodFlag[];
  /** Catalog only: an ingredient for recipes (raw dal, salt, spices), not offered in food search. */
  ingredientOnly?: boolean;
  /** Catalog only: values are for the food as cooked (boiled dal, roasted chicken), not raw. */
  cooked?: boolean;
  /** AI estimates and recipes: what the numbers were worked out from. */
  ingredients?: FoodIngredient[];
  /** Recipes: plain notes on the maths ("Salt not listed: 6 g assumed"). */
  notes?: string[];
  /**
   * Foods from the food API, as kept on the phone: worked out as cooked at
   * home or as served in restaurants. Unset for older foods and for look-ups
   * that didn't say, which the server works out like home food.
   */
  style?: 'home' | 'restaurant';
  /** Restaurant versions: the restaurant they were worked out for, when one was named. */
  restaurant?: string;
  /** Restaurant versions made from a home dish: that dish's id, to switch back to. */
  homeId?: string;
  /**
   * Foods from the food API: nutrients only partly known because an
   * ingredient isn't counted yet. Their value is "at least"; a key missing
   * from per100g is still unknown, never zero.
   */
  missing?: NutrientKey[];
  /**
   * Foods from the food API: an ingredient is queued for the server's
   * ingredient agent. The same look-up later gives fuller values
   * (nutrition/pending.ts repeats it).
   */
  pending?: boolean;
  /** Recipes still pending: what was sent, so the look-up can be repeated. Kept on the phone only. */
  recipe?: FoodRecipeSource;
  /**
   * Pending foods: when the phone got the answer (epoch ms), so the first
   * repeat waits from then, not from when the app next opens. Phone only.
   */
  pendingSince?: number;
  /** Scanned packs (api/scan-read.ts): the GTIN-14 under the barcode. Not kept in saved_food. */
  barcode?: string;
  /** Scanned packs: the brand on the pack. */
  brand?: string;
  /** Scanned packs: from Open Food Facts, or from a Steps user's label photo. */
  origin?: 'off' | 'label';
  /** Scanned packs: the pack size as printed ("200 g"). */
  packText?: string;
}

/** A recipe as sent to the food API (api/food-read.ts RecipeRequest). */
export interface FoodRecipeSource {
  name: string;
  ingredients: string;
  steps: string;
  servings?: number;
  unit?: string;
}

/** A food the person added, with nutrients for one serving. */
export interface OwnFood {
  id: string;
  name: string;
  /** "plate", "packet", "slice". */
  serving: string;
  nutrients: Nutrients;
  updatedAt: number;
}
