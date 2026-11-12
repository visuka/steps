/**
 * Calls to our food API (stepsinfra): what a description or a recipe contains.
 * The server only ever adds up nutrients from an ingredient table; answers are
 * checked in food-read.ts before the app uses them.
 */
import { getAccessToken } from '@/auth/session';
import { STEPS_API_URL } from '@/constants/app';
import { lookupName, restaurantItem, type Where } from '@/nutrition/place';
import type { FoodItem } from '@/nutrition/types';

import {
  badAnswer,
  errorCode,
  errorFor,
  type EstimateItem,
  estimateRequest,
  type EstimateResult,
  type FoodRoute,
  readEstimate,
  readRecipe,
  type RecipeRequest,
  type RecipeResult,
  timedOut,
  tokenError,
} from './food-read';

export { FoodApiError } from './food-read';
export type { EstimateItem, EstimateResult, RecipeRequest, RecipeResult, RecipeUnit } from './food-read';

/** The server gives up on the model after about 28 s; a little longer here covers the network. */
const TIMEOUT_MS = 35_000;

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
  const token = await accessToken(route);

  const controller = new AbortController();
  // Covers reading the body too: a stalled answer ends as a timeout, not a spinner forever.
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${STEPS_API_URL}/v1/food/${route}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw controller.signal.aborted ? timedOut() : errorFor(route, null);
    }
    if (!res.ok) {
      // Our server says why ("daily_limit"); API Gateway's own replies don't.
      const code = await res.json().then(errorCode, () => undefined);
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
export async function estimateFood(description: string, where?: Where | null): Promise<EstimateResult> {
  return readEstimate(await post('estimate', estimateRequest(description, where)));
}

/**
 * The restaurant version of a home dish, from one look-up of its name; null
 * when the server sent no restaurant-style answer. Throws FoodApiError like
 * estimateFood.
 */
export async function restaurantVersion(home: FoodItem, where: Where): Promise<EstimateItem | null> {
  return restaurantItem(await estimateFood(lookupName(home), where));
}

/** A dish the person made → one food, per serving, worked out from its ingredients. */
export async function recipeFood(request: RecipeRequest): Promise<RecipeResult> {
  const body: Record<string, unknown> = {
    name: request.name.trim(),
    ingredients: request.ingredients.trim(),
    steps: request.steps.trim(),
  };
  if (request.servings !== undefined) body.servings = request.servings;
  if (request.unit !== undefined) body.unit = request.unit;
  return readRecipe(await post('recipe', body));
}
