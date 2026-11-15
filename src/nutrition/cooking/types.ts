/**
 * Words shared by the phone and the food server for the cooking maths
 * (calc `c1`). Written to the contract in stepsinfra docs/app-cooking-contract.md.
 * Nothing here is data: the factor tables arrive at run time (tables.ts).
 */
import type { NutrientKey, Nutrients } from '../types';

export type CookMethod =
  | 'raw'
  | 'soaked'
  | 'sprouted'
  | 'boiled'
  | 'boiled-drained'
  | 'pressure-cooked'
  | 'steamed'
  | 'simmered'
  | 'stir-fried'
  | 'shallow-fried'
  | 'deep-fried'
  | 'roasted'
  | 'grilled'
  | 'unknown';

export type Basis = 'raw' | 'cooked';
export type OilRole = 'in-dish' | 'frying-medium';
export type Coating = 'none' | 'batter' | 'breaded';
export type LineKind = 'food' | 'oil' | 'water';

/** The cooking data version this build of the maths understands. */
export const CALC = 'c1';
export type Calc = typeof CALC;

/** What the server knows about one ingredient line, kept with it so editing works on the phone. */
export interface IngredientProfile {
  calc: Calc;
  kind: LineKind;
  id: string | null;
  recName: string;
  /** The record's values: raw unless asEaten. An absent key is unknown, never 0. */
  per100g: Nutrients;
  /** Keys in per100g that are only "at least". */
  missing: NutrientKey[];
  pending?: true;
  cookClass: string;
  yieldClass: string;
  asEaten: boolean;
  fryAgain: boolean;
  folicAcid?: true;
  noMethod: boolean;
  basis: Basis;
  rawGrams: number;
  role?: OilRole | null;
  coating?: Coating;
  yields: Partial<Record<CookMethod, { y?: number; oilU?: number }>>;
  cooked: Partial<Record<CookMethod, { id: string; per100g: Nutrients; missing: NutrientKey[] }>>;
}

/** One row of the oil-uptake table. */
export interface OilUptakeRow {
  method: CookMethod;
  classes?: string[];
  /** A regular expression source, tried case-insensitively. */
  names?: string;
  coating?: Coating[];
  u: number;
  y?: number;
  withWater?: true;
  waterLeft?: number;
}

/** The factor tables from GET /v1/food/cooking (cooking-c1.json). */
export interface CookingTables {
  calc: Calc;
  methods: Partial<Record<CookMethod, { sameAs: CookMethod[]; liquidEaten: boolean }>>;
  retentionMap: Record<string, Record<string, string>>;
  retention: {
    proxies: Record<string, string>;
    codes: Record<string, Record<string, number>>;
  };
  yields: {
    limits: [number, number];
    classes: Record<string, Partial<Record<CookMethod, number | { protein: number }>>>;
    methods: Partial<Record<CookMethod, number>>;
    gravyWater: Partial<Record<CookMethod, number>>;
  };
  fatDrip: Record<string, Partial<Record<CookMethod, number>>>;
  oilUptake: OilUptakeRow[];
  oils: {
    byCountry: Record<string, string>;
    foods: Record<string, { name: string; per100g: Nutrients; missing: NutrientKey[] }>;
  };
}

/** The dish's pan oil: a listed frying-medium line (grams set), else the dish's named oil (no grams). */
export interface PanOil {
  name: string;
  grams?: number;
  profile: IngredientProfile;
}

export interface CookLine {
  name: string;
  kind: LineKind;
  /** As said, in `basis`. */
  grams: number;
  basis: Basis;
  method?: CookMethod;
  role?: OilRole | null;
  coating?: Coating;
  profile: IngredientProfile;
}

export interface CookInput {
  lines: CookLine[];
  dishName: string;
  country: string;
  panOil?: PanOil;
  /** Names of rows that had no usable profile and were left out of the maths. */
  leftOut?: string[];
}

export interface CookedLine {
  name: string;
  rawGrams: number;
  /** As eaten, frying oil soaked up included. */
  grams: number;
  oilGrams: number;
  role?: OilRole;
}

export interface CookNote {
  kind: 'unknown-method' | 'left-out';
  name: string;
}

export interface CookedDish {
  lines: CookedLine[];
  weight: number;
  oilAdded: number;
  kcal: number;
  per100g: Nutrients;
  missing: NutrientKey[];
  pending: boolean;
  notes: CookNote[];
}

/** One row of an edited ingredient list as it is confirmed: amount before cooking, method and profile. */
export interface EditedLine {
  name: string;
  grams: number;
  method?: CookMethod;
  profile?: IngredientProfile;
}
