/**
 * The cooking methods the person can pick, with plain labels (plan T15c,
 * decision 6), and which rows have no method at all.
 */
import type { CookMethod, IngredientProfile } from './types';

export const COOK_METHODS: readonly CookMethod[] = [
  'raw',
  'soaked',
  'sprouted',
  'boiled',
  'boiled-drained',
  'pressure-cooked',
  'steamed',
  'simmered',
  'stir-fried',
  'shallow-fried',
  'deep-fried',
  'roasted',
  'grilled',
  'unknown',
];

export const isCookMethod = (v: unknown): v is CookMethod =>
  typeof v === 'string' && (COOK_METHODS as readonly string[]).includes(v);

/** The methods the app offers, in the order of the sheet. */
export const OFFERED_METHODS: readonly CookMethod[] = [
  'raw',
  'boiled',
  'boiled-drained',
  'pressure-cooked',
  'steamed',
  'simmered',
  'stir-fried',
  'shallow-fried',
  'deep-fried',
  'roasted',
  'grilled',
];

const LABELS: Record<CookMethod, string> = {
  raw: 'Raw / salad',
  soaked: 'Soaked',
  sprouted: 'Sprouted',
  boiled: 'Boiled',
  'boiled-drained': 'Boiled, water drained',
  'pressure-cooked': 'Pressure cooked',
  steamed: 'Steamed',
  simmered: 'In a curry / gravy',
  'stir-fried': 'Tadka / stir-fried',
  'shallow-fried': 'Shallow fried (pan / tawa)',
  'deep-fried': 'Deep fried',
  roasted: 'Roasted / baked',
  grilled: 'Grilled / tandoor',
  unknown: 'Not sure',
};

export const methodLabel = (m: CookMethod): string => LABELS[m];

/** A short lower-case word for a row ("Potato · shallow fried"). */
export const methodWord = (m: CookMethod): string => {
  switch (m) {
    case 'raw':
      return 'raw';
    case 'boiled-drained':
      return 'boiled, drained';
    case 'simmered':
      return 'in gravy';
    case 'stir-fried':
      return 'stir-fried';
    case 'roasted':
      return 'roasted';
    case 'unknown':
      return 'not sure';
    default:
      return m.replace(/-/g, ' ');
  }
};

/**
 * What the sheet lists for a row now on `current`: the offered methods, plus
 * soaked, sprouted or unknown only when the row already has it.
 */
export function methodChoices(current?: CookMethod): CookMethod[] {
  const list = [...OFFERED_METHODS];
  if (current && !list.includes(current)) list.push(current);
  return list;
}

/** True when the app offers a method for this row: not salt, spices, water or oil. */
export function takesMethod(profile: Pick<IngredientProfile, 'kind' | 'noMethod'>): boolean {
  return profile.kind === 'food' && !profile.noMethod;
}
