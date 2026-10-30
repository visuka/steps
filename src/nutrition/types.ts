export type NutrientKey =
  | 'kcal'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fiber'
  | 'vitA'
  | 'vitC'
  | 'vitD'
  | 'vitB12'
  | 'folate'
  | 'calcium'
  | 'iron'
  | 'potassium'
  | 'magnesium'
  | 'zinc';

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
  | 'own';

export interface FoodUnit {
  key: string;
  /** "bowl (katori)", "roti", "medium banana". */
  label: string;
  grams: number;
}

/**
 * A food people can pick. Catalog foods give nutrients per 100 g; a food the
 * person adds gives them per serving, with one unit of 100 "grams" so the same
 * maths works for both. A future AI estimate returns this same shape.
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
