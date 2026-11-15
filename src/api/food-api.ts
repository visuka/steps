/**
 * Calls to our food API (stepsinfra): what a description or a recipe contains.
 * The server only ever adds up nutrients from an ingredient table; answers are
 * checked in food-read.ts before the app uses them.
 */
import { getAccessToken } from '@/auth/session';
import { STEPS_API_URL } from '@/constants/app';
import { foodCountry } from '@/lib/country-detect';
import { lookupName, restaurantItem, type Where } from '@/nutrition/place';
import type { FoodItem } from '@/nutrition/types';
import { premiumRequired } from '@/premium/premium';

import {
  badAnswer,
  errorCode,
  errorFor,
  type EstimateItem,
  estimateRequest,
  type EstimateResult,
  type FoodRoute,
  ingredientsRequest,
  type ProfileItem,
  readEstimate,
  readProfileItems,
  readRecipe,
  readSearch,
  type RecipeRequest,
  recipeRequest,
  type RecipeResult,
  type SearchItem,
  searchRequest,
  timedOut,
  tokenError,
} from './food-read';

export { FoodApiError } from './food-read';
export type { EstimateItem, EstimateResult, RecipeRequest, RecipeResult, RecipeUnit, SearchItem } from './food-read';

/** The server gives up on the model after about 28 s; a little longer here covers the network. */
const TIMEOUT_MS = 35_000;

/**
 * The country dishes are worked out for ("IN"): the Country setting, else the
 * phone's time zone, never its language region (lib/country.ts). Checked, and
 * left out when unknown, by estimateRequest and recipeRequest.
 */
function phoneRegion(): string | null {
  return foodCountry();
}

/**
 * The signed-in person's access token from our sign-in API: the one place the
 * food API gets it. getAccessToken refreshes it when it is close to expiry and
 * rejects with AuthApiError, which tokenError turns into a plain message.
 */
async function accessToken(route: FoodRoute): Promise<string> {
  try {
    return await getAccessToken();
  } catch (e) {
    throw tokenError(route, e);
  }
}

async function post(route: FoodRoute, body: unknown): Promise<unknown> {
  return send(route, { method: 'POST', body });
}

/** One call to /v1/food/<route>: POST with a JSON body, or GET (with a query such as `?have=c1`). */
async function send(route: FoodRoute, call: { method: 'GET' | 'POST'; body?: unknown; query?: string }): Promise<unknown> {
  const token = await accessToken(route);

  const controller = new AbortController();
  // Covers reading the body too: a stalled answer ends as a timeout, not a spinner forever.
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${STEPS_API_URL}/v1/food/${route}${call.query ?? ''}`, {
        method: call.method,
        headers: { ...(call.method === 'POST' ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${token}` },
        ...(call.method === 'POST' ? { body: JSON.stringify(call.body) } : {}),
        signal: controller.signal,
      });
    } catch {
      throw controller.signal.aborted ? timedOut() : errorFor(route, null);
    }
    if (!res.ok) {
      // Our server says why ("daily_limit"); API Gateway's own replies don't.
      const code = await res.json().then(errorCode, () => undefined);
      // The server says this account doesn't have premium: the app goes free and shows why (src/premium).
      if (res.status === 402) premiumRequired();
      throw errorFor(route, res.status, code);
    }
    try {
      return await res.json();
    } catch {
      throw controller.signal.aborted ? timedOut() : badAnswer();
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * "200 g rice and 2 idli" → the foods in it, each with its amount. With a
 * place, dishes are worked out home-style or restaurant-style; without one
 * the server goes by the text.
 */
export async function estimateFood(description: string, where?: Where | null, opts: Ask = {}): Promise<EstimateResult> {
  const result = readEstimate(await post('estimate', estimateRequest(description, where, phoneRegion(), opts.refresh)));
  for (const item of result.items) stampPending(item.food);
  return result;
}

/**
 * Dishes already on our server that match what is being typed (POST /v1/food/search), by words or by
 * meaning, in any language: picking one needs no AI look-up. Throws FoodApiError like estimateFood.
 */
export async function searchDishes(q: string, where?: Where | null): Promise<SearchItem[]> {
  const items = readSearch(await post('search', searchRequest(q, where, phoneRegion())));
  for (const item of items) stampPending(item.food);
  return items;
}

/** `refresh`: a quiet repeat of a pending food's look-up (nutrition/pending.ts), marked as one for the server. */
export interface Ask {
  refresh?: boolean;
}

/** A pending answer remembers when it came, so its first repeat waits from then (nutrition/pending.ts). */
function stampPending(food: FoodItem): void {
  if (food.pending) food.pendingSince = Date.now();
  else delete food.pendingSince;
}

/**
 * The restaurant version of a home dish, from one look-up of its name; null
 * when the server sent no restaurant-style answer. Throws FoodApiError like
 * estimateFood.
 */
export async function restaurantVersion(home: FoodItem, where: Where): Promise<EstimateItem | null> {
  return restaurantItem(await estimateFood(lookupName(home), where));
}

/**
 * What the server knows about each ingredient name (POST /v1/food/ingredients), so the phone can
 * work a dish out itself (nutrition/cooking). Only the names, the country and the dish name go.
 * Throws FoodApiError like estimateFood.
 */
export async function fetchProfiles(names: string[], dish?: string): Promise<ProfileItem[]> {
  return readProfileItems(await post('ingredients', ingredientsRequest(names, phoneRegion(), dish)));
}

/**
 * The cooking factor tables (GET /v1/food/cooking), as the server sent them, or `{same: true}` when
 * the version in `have` is still current. Checked by nutrition/cooking/tables.ts readTables.
 */
export async function fetchCookingTables(have?: string): Promise<unknown> {
  return send('cooking', { method: 'GET', query: have ? `?have=${encodeURIComponent(have)}` : '' });
}

/** A dish the person made → one food, per serving, worked out from its ingredients. */
export async function recipeFood(request: RecipeRequest, opts: Ask = {}): Promise<RecipeResult> {
  const result = readRecipe(await post('recipe', recipeRequest(request, phoneRegion(), opts.refresh)));
  // Kept with a pending recipe so the look-up can be repeated (nutrition/pending.ts).
  if (result.food.pending) result.food.recipe = { ...request };
  stampPending(result.food);
  return result;
}
