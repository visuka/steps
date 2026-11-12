/**
 * Checks what the food API sends back before any of it reaches the screen or
 * the phone's database, and turns failures into short plain messages. No
 * React Native here, so jest can run it.
 *
 * The server is ours, but its answers come partly from an AI model and from a
 * shared cache, so nothing is trusted: unknown nutrients, negative or absurd
 * numbers, missing units and over-long text are dropped or trimmed.
 */
import { OWN_PREFIX } from '@/nutrition/catalog';
import { NUTRIENTS } from '@/nutrition/nutrients';
import { cleanRestaurant, isPlace, type Where, whereOf } from '@/nutrition/place';
import type { FoodCategory, FoodFlag, FoodIngredient, FoodItem, FoodUnit, NutrientKey, Nutrients } from '@/nutrition/types';

/** The server's limits (stepsinfra food/handler.py and recipe.py), checked here first. */
export const ESTIMATE_MAX_CHARS = 200;
export const RECIPE_NAME_MAX = 80;
export const RECIPE_TEXT_MAX = 1500;
export const RECIPE_MAX_SERVINGS = 50;
export const RECIPE_UNITS = ['bowl', 'plate', 'piece', 'glass', 'cup', 'serving'] as const;
export type RecipeUnit = (typeof RECIPE_UNITS)[number];

export interface EstimateItem {
  food: FoodItem;
  unit: string;
  quantity: number;
  /** What this amount was worked out from; empty for foods from the built-in list. */
  ingredients: FoodIngredient[];
  /** True when the answer came from the server's store with no AI call. */
  cached: boolean;
  /**
   * How the server worked it out: as cooked at home, as served in
   * restaurants, or 'auto' when it wasn't told where the food was from (or is
   * a server from before places).
   */
  style: 'home' | 'restaurant' | 'auto';
}

export interface EstimateResult {
  items: EstimateItem[];
  /** Dish names the server couldn't work out: the app offers the recipe form. */
  unknown: string[];
  /**
   * Where the server took the food to be from, when it says: the place sent,
   * or one in the person's own words ("ordered pizza", "biryani from Paradise").
   */
  where: Where | null;
}

export interface RecipeRequest {
  name: string;
  ingredients: string;
  steps: string;
  servings?: number;
  unit?: RecipeUnit;
}

export interface RecipeIngredient extends FoodIngredient {
  /** "pressure-cooked", "fried"… */
  method?: string;
}

export interface RecipeResult {
  food: FoodItem;
  servings: number;
  cookedGrams: number;
  /** The whole recipe, in grams as used. */
  ingredients: RecipeIngredient[];
  notes: string[];
  cached: boolean;
}

export type FoodApiErrorKind =
  | 'offline'
  | 'timeout'
  | 'signin'
  | 'not_food'
  | 'limit'
  | 'busy'
  | 'unavailable'
  | 'too_long'
  | 'bad_answer'
  | 'other';

export class FoodApiError extends Error {
  readonly kind: FoodApiErrorKind;
  constructor(kind: FoodApiErrorKind, message: string) {
    super(message);
    this.name = 'FoodApiError';
    this.kind = kind;
  }
}

export type FoodRoute = 'estimate' | 'recipe';

const MESSAGES: Record<Exclude<FoodApiErrorKind, 'not_food' | 'limit'>, string> = {
  offline: "Couldn't reach our server. Check your internet and try again.",
  timeout: 'That took too long. Please try again.',
  signin: 'Please sign in again to look up food.',
  busy: 'Lots of people are looking up food right now. Please try again in a moment.',
  unavailable: "Food lookup isn't working right now. Please try again later.",
  too_long: "That's too long. Please shorten it and try again.",
  bad_answer: 'Something went wrong. Please try again.',
  other: 'Something went wrong. Please try again.',
};

/**
 * The error for a failed call; `status` null means the request never got an
 * answer. `code` is the `error` field of our server's reply, when it sent one.
 */
export function errorFor(route: FoodRoute, status: number | null, code?: string): FoodApiError {
  if (status === null) return new FoodApiError('offline', MESSAGES.offline);
  if (status === 401 || status === 403) return new FoodApiError('signin', MESSAGES.signin);
  if (status === 422) {
    return new FoodApiError(
      'not_food',
      route === 'estimate'
        ? 'That doesn’t look like food or drink. Try something like “2 idli and sambar”.'
        : 'That doesn’t look like a recipe. List what went in, like “1 cup dal, 2 tsp oil, salt”.',
    );
  }
  // API Gateway also answers 429 when everyone asks at once; only our own
  // "daily_limit" means this person is done for today.
  if (status === 429 && code !== 'daily_limit') return new FoodApiError('busy', MESSAGES.busy);
  if (status === 429) {
    return new FoodApiError(
      'limit',
      route === 'estimate'
        ? 'You’ve reached today’s limit for lookups. Try again tomorrow, or add it as your own food.'
        : 'You’ve reached today’s limit for recipes. Try again tomorrow.',
    );
  }
  if (status === 503) return new FoodApiError('unavailable', MESSAGES.unavailable);
  if (status === 413) return new FoodApiError('too_long', MESSAGES.too_long);
  return new FoodApiError('other', MESSAGES.other);
}

/** The `error` field of a failed reply's body ("daily_limit"), if it has one. */
export function errorCode(body: unknown): string | undefined {
  return isObject(body) ? (text(body.error, 40) ?? undefined) : undefined;
}

/**
 * The error when there's no token to send. Refreshing an expired session needs
 * the internet, so offline is said as offline, not as "sign in again".
 * Understands Supabase's errors and the passkeys session's AuthApiError.
 */
export function tokenError(route: FoodRoute, cause: unknown): FoodApiError {
  const name = cause instanceof Error ? cause.name : undefined;
  const code = (cause as { code?: unknown } | null)?.code;
  if (name === 'AuthRetryableFetchError' || (name === 'AuthApiError' && code === 'offline')) {
    return errorFor(route, null);
  }
  if (name === 'AuthApiError' && (code === 'server' || code === 'rate_limited' || code === 'not_configured')) {
    return new FoodApiError('other', MESSAGES.other);
  }
  return errorFor(route, 401);
}

export function badAnswer(): FoodApiError {
  return new FoodApiError('bad_answer', MESSAGES.bad_answer);
}

export function timedOut(): FoodApiError {
  return new FoodApiError('timeout', MESSAGES.timeout);
}

/** A plain reason the description can't be sent, or null when it can. */
export function checkDescription(text: string): string | null {
  const t = text.trim();
  if (!t) return 'Type what you ate first.';
  if (t.length > ESTIMATE_MAX_CHARS) return `Please keep it under ${ESTIMATE_MAX_CHARS} letters.`;
  return null;
}

/**
 * The body for POST /v1/food/estimate. With no place the server reads one
 * from the text, if it says ("ordered pizza"); a place sent wins over that.
 * The restaurant goes only with dine-in or delivery.
 */
export function estimateRequest(description: string, where?: Where | null): Record<string, string> {
  const body: Record<string, string> = { description: description.trim() };
  if (!where) return body;
  const w = whereOf(where.place, where.restaurant);
  body.place = w.place;
  if (w.restaurant) body.restaurant = w.restaurant;
  return body;
}

/** A plain reason the recipe can't be sent, or null when it can. */
export function checkRecipe(r: RecipeRequest): string | null {
  if (!r.name.trim()) return 'Give the dish a name.';
  if (r.name.trim().length > RECIPE_NAME_MAX) return `Please keep the name under ${RECIPE_NAME_MAX} letters.`;
  if (!r.ingredients.trim()) return 'List what went into it.';
  if (r.ingredients.length > RECIPE_TEXT_MAX) return `Please keep the ingredients under ${RECIPE_TEXT_MAX} letters.`;
  if (r.steps.length > RECIPE_TEXT_MAX) return `Please keep how you cooked it under ${RECIPE_TEXT_MAX} letters.`;
  if (r.servings !== undefined && !(Number.isInteger(r.servings) && r.servings >= 1 && r.servings <= RECIPE_MAX_SERVINGS)) {
    return `It should make a whole number from 1 to ${RECIPE_MAX_SERVINGS}.`;
  }
  return null;
}

// ── reading answers ──────────────────────────────────────────────────────

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Own keys only: "toString" is not a category. */
const has = (table: object, key: unknown): boolean =>
  typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);

/** Trimmed text of at most `max` characters, or null. */
function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return t || null;
}

/** A finite number in [min, max], or null. */
function number(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

const list = (v: unknown, most: number): unknown[] => (Array.isArray(v) ? v.slice(0, most) : []);

/** Nothing has more than this per 100 g: pure fat is 900 kcal, and 100 g can't hold more than 100 g of anything. */
const MAX_PER_100G: Record<string, number> = { kcal: 900, g: 100, mg: 100_000, µg: 100_000_000, '': 100 };
const NUTRIENT_MAX = new Map<NutrientKey, number>(NUTRIENTS.map((n) => [n.key, MAX_PER_100G[n.unit]]));

/** Known nutrient keys with sane numbers; everything else is left out (unknown, never zero). */
export function readNutrients(v: unknown): Nutrients {
  const out: Nutrients = {};
  if (!isObject(v)) return out;
  for (const [key, max] of NUTRIENT_MAX) {
    const n = number(v[key], 0, max);
    if (n !== null) out[key] = n;
  }
  return out;
}

/** Every category but 'own', which only the person's own foods may have. */
const CATEGORIES: Record<Exclude<FoodCategory, 'own'>, true> = {
  fruit: true,
  vegetable: true,
  grain: true,
  bread: true,
  legume: true,
  meat: true,
  egg: true,
  fish: true,
  dairy: true,
  nut: true,
  fat: true,
  sweet: true,
  drink: true,
  dish: true,
  spice: true,
};
const FLAGS: Record<FoodFlag, true> = { 'deep-fried': true };

const MAX_UNIT_GRAMS = 5000;
const MAX_GRAMS = 5000;
const MAX_PORTIONS = 50;

function readUnits(v: unknown): FoodUnit[] {
  const units: FoodUnit[] = [];
  for (const raw of list(v, 10)) {
    if (!isObject(raw)) continue;
    const key = text(raw.key, 24);
    const label = text(raw.label, 40);
    const grams = number(raw.grams, 0, MAX_UNIT_GRAMS);
    if (!key || !label || !grams || units.some((u) => u.key === key)) continue;
    // Grams always weigh 1 g, whatever the answer said.
    units.push(key === 'g' ? { key, label, grams: 1 } : { key, label, grams });
  }
  if (!units.some((u) => u.key === 'g')) units.push({ key: 'g', label: 'grams', grams: 1 });
  return units;
}

export function readIngredients(v: unknown): RecipeIngredient[] {
  const out: RecipeIngredient[] = [];
  for (const raw of list(v, 40)) {
    if (!isObject(raw)) continue;
    const name = text(raw.name, 80);
    const grams = number(raw.grams, 0, 30_000);
    if (!name || grams === null) continue;
    const method = text(raw.method, 24);
    out.push(method ? { name, grams, method } : { name, grams });
  }
  return out;
}

const readNotes = (v: unknown): string[] =>
  list(v, 10)
    .map((n) => text(n, 200))
    .filter((n): n is string => n !== null);

/**
 * A FoodItem from the server or from saved_food, or null when it can't be
 * used: no id or name, an id that would pass for one of the person's own
 * foods, or no calories.
 */
export function readFoodItem(v: unknown): FoodItem | null {
  if (!isObject(v)) return null;
  const id = text(v.id, 80);
  const name = text(v.name, 80);
  if (!id || !name || id.startsWith(OWN_PREFIX)) return null;
  const per100g = readNutrients(v.per100g);
  if (per100g.kcal === undefined) return null;
  const units = readUnits(v.units);
  const defaultKey = text(v.defaultUnit, 24);
  const defaultUnit = units.some((u) => u.key === defaultKey) ? defaultKey! : units[0].key;
  const category = has(CATEGORIES, v.category) ? (v.category as FoodCategory) : 'dish';

  const food: FoodItem = {
    id,
    name,
    aliases: list(v.aliases, 10)
      .map((a) => text(a, 60))
      .filter((a): a is string => a !== null),
    category,
    per100g,
    units,
    defaultUnit,
    source: text(v.source, 120) ?? 'Worked out from its ingredients',
  };
  const flags = list(v.flags, 5).filter((f): f is FoodFlag => has(FLAGS, f));
  if (flags.length) food.flags = flags;
  // The method is only for the whole recipe; a food keeps name and grams.
  const ingredients = readIngredients(v.ingredients).map(({ name: n, grams }) => ({ name: n, grams }));
  if (ingredients.length) food.ingredients = ingredients;
  const notes = readNotes(v.notes);
  if (notes.length) food.notes = notes;
  // The phone's own notes on a saved food (FoodItem), checked like the rest.
  if (v.style === 'home' || v.style === 'restaurant') food.style = v.style;
  if (food.style === 'restaurant') {
    const restaurant = cleanRestaurant(v.restaurant);
    if (restaurant) food.restaurant = restaurant;
    const homeId = text(v.homeId, 80);
    if (homeId && homeId !== id && !homeId.startsWith(OWN_PREFIX)) food.homeId = homeId;
  }
  return food;
}

/**
 * A food in the server's answer. Style, restaurant and home dish are notes the
 * phone keeps (the item says the style), never taken from the food itself.
 */
function serverFood(v: unknown): FoodItem | null {
  const food = readFoodItem(v);
  if (!food) return null;
  delete food.style;
  delete food.restaurant;
  delete food.homeId;
  return food;
}

/** Ingredient amounts of two parts of a meal added up, by name. */
function addIngredients(a: FoodIngredient[], b: FoodIngredient[]): FoodIngredient[] {
  const out = a.map((i) => ({ ...i }));
  for (const i of b) {
    const same = out.find((o) => o.name === i.name);
    if (same) same.grams += i.grams;
    else out.push({ ...i });
  }
  return out;
}

/**
 * The checked answer to POST /v1/food/estimate. Malformed items are dropped;
 * a malformed answer throws. The same food twice in the same unit ("2 roti and
 * 1 phulka" are both chapati) becomes one item with the amounts added; in
 * different units both stay, so neither amount is lost.
 */
export function readEstimate(body: unknown): EstimateResult {
  if (!isObject(body) || !Array.isArray(body.items)) throw badAnswer();
  const items: EstimateItem[] = [];
  for (const raw of list(body.items, 20)) {
    if (!isObject(raw)) continue;
    const food = serverFood(raw.food);
    if (!food) continue;
    const askedUnit = text(raw.unit, 24);
    const known = food.units.some((u) => u.key === askedUnit);
    const unit = known ? askedUnit! : food.defaultUnit;
    const most = unit === 'g' ? MAX_GRAMS : MAX_PORTIONS;
    // "3 plates" of a food without plates is not 3 of its default unit: start from one.
    const quantity = (known && number(raw.quantity, 0, most)) || (unit === 'g' ? 100 : 1);
    const ingredients = readIngredients(raw.ingredients).map(({ name, grams }) => ({ name, grams }));
    const cached = raw.cached === true;
    const style = raw.style === 'home' || raw.style === 'restaurant' ? raw.style : 'auto';

    // Food ids differ by style, so the same id is the same version.
    const same = items.find((i) => i.food.id === food.id && i.unit === unit);
    if (same) {
      same.quantity = Math.min(most, same.quantity + quantity);
      same.ingredients = addIngredients(same.ingredients, ingredients);
      same.cached = same.cached && cached;
      continue;
    }
    items.push({ food, unit, quantity, ingredients, cached, style });
  }
  const unknown = list(body.unknown, 10)
    .map((u) => text(u, 80))
    .filter((u): u is string => u !== null);
  const where = isPlace(body.place) ? whereOf(body.place, body.restaurant) : null;
  return { items, unknown, where };
}

/** The checked answer to POST /v1/food/recipe; throws when there's no usable food in it. */
export function readRecipe(body: unknown): RecipeResult {
  if (!isObject(body)) throw badAnswer();
  const food = serverFood(body.food);
  if (!food) throw badAnswer();
  const servings = number(body.servings, 1, RECIPE_MAX_SERVINGS);
  const cooked = number(body.cookedGrams, 0, 30_000);
  return {
    food,
    servings: servings ? Math.round(servings) : 1,
    cookedGrams: cooked ?? 0,
    ingredients: readIngredients(body.ingredients),
    notes: readNotes(body.notes),
    cached: body.cached === true,
  };
}
