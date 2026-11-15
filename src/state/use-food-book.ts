import { useEffect, useState } from 'react';

import { fetchCookingTables, fetchProfiles, recipeFood } from '@/api/food-api';
import { useAuth } from '@/auth/auth-state';
import { type EditedLine, fillProfiles } from '@/components/food/food-result-edit';
import { foodCountry } from '@/lib/country-detect';
import type { FoodEntry } from '@/data/types';
import { findFood, keepPastEntries, type PortionOverrides } from '@/nutrition/catalog';
import { entryNutrients } from '@/nutrition/day';
import { ensureTables, forgetTables, keptTables } from '@/nutrition/cooking/store';
import type { CookingTables } from '@/nutrition/cooking/types';
import { type ConfirmOutcome, confirmIngredients, ourGuessAgain } from '@/nutrition/log-food';
import { MY_DISHES_KEY, type MyDishes, NO_DISHES, readMyDishes } from '@/nutrition/my-dishes';
import type { FoodIngredient, FoodItem, OwnFood } from '@/nutrition/types';

import { useApp } from './app-state';

const PORTIONS_KEY = 'portionOverrides';

/** Asking for the tables again after a failed try waits this long (not signed in, offline). */
const ASK_AGAIN_MS = 10 * 60_000;
let lastAsk = 0;

/**
 * The person's own foods, the foods the food API worked out for them, their
 * portion sizes, and what their entries contain.
 */
export function useFoodBook() {
  const { repo, dataVersion, touch } = useApp();
  const { status } = useAuth();
  const [own, setOwn] = useState<OwnFood[]>([]);
  const [saved, setSaved] = useState<FoodItem[]>([]);
  const [overrides, setOverrides] = useState<PortionOverrides>({});
  const [dishes, setDishes] = useState<MyDishes>(NO_DISHES);
  const [tables, setTables] = useState<CookingTables | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      repo.getOwnFoods(),
      repo.getSavedFoods(),
      repo.getKv<PortionOverrides>(PORTIONS_KEY),
      repo.getKv<unknown>(MY_DISHES_KEY),
    ]).then(([o, s, p, d]) => {
      if (!live) return;
      setOwn(o);
      setSaved(s);
      setOverrides(p ?? {});
      setDishes(readMyDishes(d));
    });
    return () => {
      live = false;
    };
  }, [repo, dataVersion]);

  // The cooking tables: the kept ones at once; downloaded after sign-in when none are kept (never bundled).
  // Signed out they are forgotten, and the wait before asking again starts over for the next sign-in.
  useEffect(() => {
    if (status === 'loading') return;
    let live = true;
    if (status === 'signed-out') {
      lastAsk = 0;
      forgetTables(repo).then(() => {
        if (live) setTables(null);
      });
      return () => {
        live = false;
      };
    }
    const deps = { repo, fetch: () => fetchCookingTables() };
    keptTables(repo).then(async (kept) => {
      if (!live) return;
      setTables(kept);
      if (kept || Date.now() - lastAsk < ASK_AGAIN_MS) return;
      lastAsk = Date.now();
      const fresh = await ensureTables(deps);
      if (live && fresh) setTables(fresh);
    });
    return () => {
      live = false;
    };
  }, [repo, dataVersion, status]);

  return {
    own,
    saved,
    overrides,
    /** The dishes whose ingredients the person corrected (nutrition/my-dishes.ts). */
    dishes,
    /** POST /v1/food/ingredients: the profiles of ingredient names, for the rows the person adds. */
    fetchProfiles,
    /** The cooking factor tables, or null while there are none on the phone (editing then uses the recipe look-up). */
    tables,
    /** The country dishes are worked out for. */
    country: foodCountry() ?? '*',
    find: (id: string) => findFood(id, own, saved),
    nutrientsOf: (entry: FoodEntry) => entryNutrients(entry, own, overrides, saved),
    /** "My bowl of rice is 200 g": applies to past entries as well as new ones. */
    setPortion: async (food: FoodItem, unitKey: string, grams: number) => {
      const next = { ...overrides, [`${food.id}:${unitKey}`]: grams };
      setOverrides(next);
      await repo.setKv(PORTIONS_KEY, next);
      touch();
    },
    saveOwn: async (food: OwnFood) => {
      await repo.saveOwnFood(food);
      touch();
    },
    /**
     * Keeps a food from the food API on the phone and returns it as kept: its
     * id may change so past entries of an older version stay as they were.
     * Shown at once, so an entry logged straight after saving doesn't read as
     * calorie-only until the reload.
     */
    saveFood: async (food: FoodItem): Promise<FoodItem> => {
      const kept = keepPastEntries(food, saved);
      setSaved((prev) => [kept, ...prev.filter((f) => f.id !== kept.id)]);
      await repo.saveSavedFood(kept);
      touch();
      return kept;
    },
    /**
     * The person confirmed an edited ingredient list for `food`: their version is worked out
     * (POST /v1/food/recipe) and kept, and the mappings with it. Saved as it is, never renamed
     * by keepPastEntries: past entries keep the original dish, and an edited version updates in place.
     */
    confirmIngredients: async (food: FoodItem, list: EditedLine[], typedText: string | null): Promise<ConfirmOutcome> => {
      const out = await confirmIngredients({ saved, dishes, recipe: recipeFood, tables, country: foodCountry() ?? '*' }, food, list, typedText);
      if (!out.ok || !out.changed) return out;
      await repo.saveSavedFood(out.food);
      await repo.setKv(MY_DISHES_KEY, out.dishes);
      setSaved((prev) => [out.food, ...prev.filter((f) => f.id !== out.food.id)]);
      setDishes(out.dishes);
      touch();
      return out;
    },
    /**
     * The food's ingredients with profiles, for "Edit recipe": the ones it has, and one call
     * (POST /v1/food/ingredients) for the rest. A profile of another cooking version asks for new
     * tables first. Null with no tables, or when the call fails: editing then goes the recipe look-up way.
     */
    ingredientsWithProfiles: async (food: FoodItem): Promise<FoodIngredient[] | null> => {
      const list = food.ingredients ?? [];
      const seen = list.find((i) => i.profile)?.profile?.calc ?? food.calc;
      let have = tables;
      if (!have || (seen && seen !== have.calc)) {
        have = await ensureTables({ repo, fetch: () => fetchCookingTables() }, seen);
        if (have) setTables(have);
      }
      // Without tables the numbers can't be worked out here: the recipe look-up stands.
      if (!have) return null;
      return fillProfiles(fetchProfiles, list, food.name);
    },
    /** "Use our guess again": returns the original dish; the person's version stays for old entries. */
    ourGuessAgain: async (mine: FoodItem): Promise<FoodItem | null> => {
      const out = ourGuessAgain(dishes, mine, (id) => findFood(id, own, saved));
      await repo.setKv(MY_DISHES_KEY, out.dishes);
      setDishes(out.dishes);
      touch();
      return out.food;
    },
  };
}
