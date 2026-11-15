/**
 * The food flows behind the log screens, as plain functions with their
 * dependencies passed in (the repository, the health source, the food API),
 * so jest runs them and the screens only draw and call them: saving an entry,
 * looking a description up, keeping a looked-up dish, and the restaurant
 * version of a home dish. Used by components/journal/food-log.tsx and
 * components/food/scan-screen.tsx.
 */
import { checkDescription, type EstimateItem, type EstimateResult, FoodApiError, type RecipeRequest, type RecipeResult } from '@/api/food-read';
import { type FoodEntry, newId, type Repository } from '@/data/types';
import type { StepSource } from '@/health/types';

import { catalogFood, type PortionOverrides } from './catalog';
import { cookDish, cookInputOf } from './cooking/cook';
import { CALC, type CookedDish, type CookingTables, type EditedLine } from './cooking/types';
import {
  isMine,
  mineFood,
  type MyDishes,
  myDishesAfterConfirm,
  myDishesAfterReset,
  cleanName,
  nextMineId,
  recipeTextFor,
  validIngredients,
  withMine,
} from './my-dishes';
import { isHomeDish, keepSavedNotes, markStyle, samePortion, savedRestaurantVersion, versionChange, type Where } from './place';
import type { FoodIngredient, FoodItem, FoodUnit, Nutrients } from './types';

// ── saving an entry ───────────────────────────────────────────────────────

export interface LogDeps {
  repo: Pick<Repository, 'addFood' | 'updateFood'>;
  source: Pick<StepSource, 'label' | 'writeFood' | 'deleteSample'>;
}

/**
 * Saves a food entry on the phone, then writes its copy to the health store.
 * The phone's row goes first: when the insert fails nothing is left behind in
 * Health, and when the Health copy fails the row is kept and `notice` says so.
 */
export async function saveFoodEntry(deps: LogDeps, entry: FoodEntry, nutrients: Nutrients): Promise<{ notice: string | null }> {
  await deps.repo.addFood({ ...entry, healthSampleId: null });
  const write = deps.source.writeFood;
  if (!write) return { notice: null };
  const notice = `Saved here, but couldn't copy it to ${deps.source.label}.`;
  let sampleId: string | null;
  try {
    sampleId = (await write.call(deps.source, entry.name, nutrients, new Date(entry.loggedAt))) ?? null;
  } catch {
    return { notice };
  }
  if (!sampleId) return { notice: null };
  try {
    await deps.repo.updateFood({ ...entry, healthSampleId: sampleId });
  } catch {
    // The row has no link to the copy, so take the copy back out rather than leave one nothing can delete.
    await deps.source.deleteSample?.('food', sampleId).catch(() => undefined);
    return { notice };
  }
  return { notice: null };
}

export interface LogInput {
  foodId: string | null;
  name: string;
  unit: string | null;
  quantity: number | null;
  nutrients: Nutrients;
  where: Where;
  /** When it was eaten (epoch ms). */
  at: number;
}

/** Logs one food: an entry with these nutrients, in the order of saveFoodEntry. */
export function logFood(deps: LogDeps, input: LogInput): Promise<{ notice: string | null }> {
  return saveFoodEntry(
    deps,
    {
      id: newId(),
      loggedAt: input.at,
      name: input.name,
      foodId: input.foodId,
      unit: input.unit,
      quantity: input.quantity,
      kcal: Math.round(input.nutrients.kcal ?? 0),
      healthSampleId: null,
      place: input.where.place,
      restaurant: input.where.restaurant,
    },
    input.nutrients,
  );
}

// ── looking a description up ──────────────────────────────────────────────

export interface LookUpDeps {
  estimate: (text: string, where: Where | null) => Promise<EstimateResult>;
  /** The person's corrected dishes: a returned dish they corrected shows as their version (nutrition/my-dishes.ts). */
  dishes?: MyDishes;
  find?: (id: string) => FoodItem | null;
}

export type LookUpOutcome =
  /** `where`: the place it was worked out for, sent or read from the text. */
  | { ok: true; result: EstimateResult; where: Where | null }
  | { ok: false; message: string };

/**
 * "2 idli and sambar" → the foods in it. The text is checked first; a failure
 * comes back as the words to show. `sent` is the place the person picked, if
 * they did. The caller drops an answer that arrives after a newer look-up.
 */
export async function lookUpFood(deps: LookUpDeps, text: string, sent: Where | null): Promise<LookUpOutcome> {
  const problem = checkDescription(text);
  if (problem) return { ok: false, message: problem };
  try {
    const result = await deps.estimate(text, sent);
    const { dishes, find } = deps;
    const items = dishes && find ? result.items.map((item) => withMine(item, dishes, find)) : result.items;
    return { ok: true, result: { ...result, items }, where: result.where ?? sent };
  } catch (e) {
    return { ok: false, message: e instanceof FoodApiError ? e.message : 'Something went wrong. Please try again.' };
  }
}

/**
 * The food to log for a looked-up item. Built-in foods are used as this app
 * has them; the person's own version is already kept and is never written
 * over by the answer; anything else is kept on the phone. Throws when it
 * can't be kept.
 */
export async function keepLookedFood(
  deps: { saved: FoodItem[]; saveFood: (food: FoodItem) => Promise<FoodItem> },
  item: EstimateItem,
  where: Where | null,
): Promise<FoodItem> {
  const builtIn = catalogFood(item.food.id);
  if (builtIn) return builtIn;
  if (isMine(item.food)) return item.food;
  return deps.saveFood(keepSavedNotes(markStyle(item.food, item.style, where), deps.saved));
}

// ── the restaurant version of a home dish ─────────────────────────────────

export interface VersionDeps {
  find: (id: string) => FoodItem | null;
  saved: FoodItem[];
  overrides: PortionOverrides;
  saveFood: (food: FoodItem) => Promise<FoodItem>;
  /** One look-up of the dish's name for the place (api/food-api.ts restaurantVersion). */
  fetchVersion: (home: FoodItem, where: Where) => Promise<EstimateItem | null>;
  /** True while a look-up is under way, so the screen can say so. */
  working?: (on: boolean) => void;
}

/**
 * The version of a food to log for where it was from (nutrition/place.ts).
 * Eaten out, a home dish becomes its restaurant version: one saved earlier, or
 * one look-up. When that fails the food is logged as it is, and `notice` says
 * so. The same amount carries over (samePortion).
 */
export async function restaurantVersionFor(
  deps: VersionDeps,
  food: FoodItem,
  unit: string,
  quantity: number,
  w: Where,
): Promise<{ food: FoodItem; unit: string; quantity: number; notice: string | null }> {
  const same = { food, unit, quantity, notice: null };
  const change = versionChange(food, w, deps.find);
  if (!change) return same;
  if (change.kind === 'home') {
    return { food: change.food, ...samePortion(food, unit, quantity, change.food, deps.overrides), notice: null };
  }
  let next = savedRestaurantVersion(change.base, w, deps.saved);
  if (!next) {
    deps.working?.(true);
    try {
      const item = await deps.fetchVersion(change.base, w);
      if (item) next = await deps.saveFood(markStyle(item.food, 'restaurant', w, change.base.id));
    } catch {
      // Offline, or the day's look-ups used up: logged as it is, below.
    } finally {
      deps.working?.(false);
    }
  }
  if (!next) {
    return {
      ...same,
      notice: isHomeDish(food)
        ? 'Couldn’t get restaurant-style values just now, so home-style values were used.'
        : 'Couldn’t look up that restaurant just now, so the restaurant values you had were used.',
    };
  }
  return { food: next, ...samePortion(food, unit, quantity, next, deps.overrides), notice: null };
}

// ── correcting a dish's ingredients ───────────────────────────────────────

export interface ConfirmDeps {
  saved: FoodItem[];
  dishes: MyDishes;
  /** POST /v1/food/recipe (api/food-api.ts recipeFood). */
  recipe: (request: RecipeRequest) => Promise<RecipeResult>;
  /** The cooking factor tables kept on the phone (nutrition/cooking/store.ts); none = the recipe look-up. */
  tables?: CookingTables | null;
  /** The country dishes are worked out for ("IN"); "*" when the phone doesn't know. */
  country?: string;
}

export type ConfirmOutcome =
  /** `food` is the person's version, `dishes` the mappings to keep; `changed` is false when the list was as it was. */
  | { ok: true; changed: boolean; food: FoodItem; dishes: MyDishes }
  | { ok: false; message: string };

/** The list as the amounts before cooking and methods it stands for, to tell whether it was changed. */
function sameEdit(was: FoodIngredient[], now: EditedLine[]): boolean {
  const key = (name: string) => cleanName(name).toLowerCase();
  return (
    was.length === now.length &&
    was.every((x, i) => Math.round(x.rawGrams ?? x.grams) === now[i].grams && key(x.name) === key(now[i].name) && x.method === now[i].method)
  );
}

/** The dish worked out on the phone from an edited list, or null when it can't be (no tables, a row with no profile). */
function workedOutHere(deps: ConfirmDeps, current: FoodItem, ingredients: FoodIngredient[]): CookedDish | null {
  const { tables } = deps;
  if (!tables || !ingredients.length) return null;
  if (!ingredients.every((i) => i.profile?.calc === CALC && i.profile.calc === tables.calc)) return null;
  const dish = cookDish(cookInputOf(ingredients, current.name, deps.country ?? '*', tables, current.panOil), tables);
  return dish.weight > 0 && dish.per100g.kcal !== undefined && dish.lines.length === ingredients.length ? dish : null;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** The default unit of a dish made on the phone weighs what the dish does: the sum of cooked grams (plan T15c, decision 11). */
export function dishUnits(food: FoodItem, weight: number): FoodUnit[] {
  const grams = Math.min(5000, Math.max(1, Math.round(weight)));
  return food.units.map((u) => (u.key === food.defaultUnit && u.key !== 'g' ? { ...u, grams } : u));
}

/**
 * The person confirms an edited ingredient list for `current`. When every row
 * has a profile and the tables are on the phone, the numbers are worked out
 * here (nutrition/cooking) and no recipe call is made; otherwise they come
 * from the recipe look-up (T15). The list is kept exactly as typed. An unchanged list
 * does nothing. Editing their own version again keeps its id (the caller saves
 * it in place); otherwise a new `mine:` food is made. Offline or on an error
 * nothing is kept and `message` says so.
 */
export async function confirmIngredients(
  deps: ConfirmDeps,
  current: FoodItem,
  list: EditedLine[],
  typedText: string | null,
): Promise<ConfirmOutcome> {
  const { ingredients, problem } = validIngredients(list);
  if (problem) return { ok: false, message: problem };
  if (current.ingredients && sameEdit(current.ingredients, list)) {
    return { ok: true, changed: false, food: current, dishes: deps.dishes };
  }
  const request = recipeTextFor(current, ingredients);
  const here = workedOutHere(
    deps,
    current,
    ingredients.map((i, n) => ({ ...i, rawGrams: i.grams, ...(list[n].method ? { method: list[n].method } : {}), ...(list[n].profile ? { profile: list[n].profile } : {}) })),
  );
  if (here) {
    const id = isMine(current) ? current.id : nextMineId(deps.saved, deps.dishes);
    const kept = ingredients.map((i, n): FoodIngredient => {
      const line = here.lines[n];
      return {
        ...i,
        grams: round1(line.grams),
        rawGrams: i.grams,
        ...(list[n].method ? { method: list[n].method } : {}),
        ...(line.oilGrams > 0 ? { oilGrams: round1(line.oilGrams) } : {}),
        profile: list[n].profile,
      };
    });
    // Pending only for show (the note says some numbers are not counted yet): madeHere keeps the repeat of a
    // pending look-up from putting the server's numbers over the phone's.
    const answer: FoodItem = { ...current, per100g: here.per100g };
    delete answer.pending;
    delete answer.notes;
    delete answer.missing;
    if (here.missing.length) answer.missing = here.missing;
    const food = mineFood({ current, ingredients: kept, answer, id, request });
    food.units = dishUnits(current, here.weight);
    food.calc = CALC;
    food.madeHere = true;
    if (here.pending) food.pending = true;
    const dishes = myDishesAfterConfirm(deps.dishes, { basedOn: food.basedOn ?? current.id, mineId: id, text: typedText });
    return { ok: true, changed: true, food, dishes };
  }
  let answer: RecipeResult;
  try {
    answer = await deps.recipe(request);
  } catch {
    return { ok: false, message: "Couldn't work it out. Check the connection and try again." };
  }
  const id = isMine(current) ? current.id : nextMineId(deps.saved, deps.dishes);
  const food = mineFood({ current, ingredients, answer: answer.food, id, request });
  const dishes = myDishesAfterConfirm(deps.dishes, { basedOn: food.basedOn ?? current.id, mineId: id, text: typedText });
  return { ok: true, changed: true, food, dishes };
}

/** "Use our guess again": nothing leads to the person's version any more; the original dish is back. */
export function ourGuessAgain(dishes: MyDishes, mine: FoodItem, find: (id: string) => FoodItem | null): { dishes: MyDishes; food: FoodItem | null } {
  return { dishes: myDishesAfterReset(dishes, mine.id), food: mine.basedOn ? find(mine.basedOn) : null };
}
