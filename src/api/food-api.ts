/**
 * Calls to our food API (stepsinfra): what a description or a recipe contains.
 * The server only ever adds up nutrients from an ingredient table; answers are
 * checked in food-read.ts before the app uses them.
 */
import { supabase } from '@/auth/supabase';
import { STEPS_API_URL } from '@/constants/app';

import {
  badAnswer,
  errorCode,
  errorFor,
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
 * The signed-in person's access token: the one place the food API gets it.
 * NOTE: the API's authorizer must accept the same tokens. When sign-in moves
 * to passkeys, this becomes `getAccessToken()` from '@/auth/session' (it
 * rejects with AuthApiError, which tokenError already reads).
 */
async function accessToken(route: FoodRoute): Promise<string> {
  let result: Awaited<ReturnType<typeof supabase.auth.getSession>>;
  try {
    result = await supabase.auth.getSession();
  } catch (e) {
    throw tokenError(route, e);
  }
  const token = result.data.session?.access_token;
  // No session and an error: an expired token that couldn't be renewed, e.g. with no signal.
  if (!token) throw tokenError(route, result.error);
  return token;
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

/** "200 g rice and 2 idli" → the foods in it, each with its amount. */
export async function estimateFood(description: string): Promise<EstimateResult> {
  return readEstimate(await post('estimate', { description: description.trim() }));
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
