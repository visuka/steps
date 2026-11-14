import { useEffect, useState } from 'react';

import { recipeFood } from '@/api/food-api';
import type { FoodEntry } from '@/data/types';
import { findFood, keepPastEntries, type PortionOverrides } from '@/nutrition/catalog';
import { entryNutrients } from '@/nutrition/day';
import { type ConfirmOutcome, confirmIngredients, ourGuessAgain } from '@/nutrition/log-food';
import { MY_DISHES_KEY, type MyDishes, NO_DISHES, readMyDishes } from '@/nutrition/my-dishes';
import type { FoodItem, OwnFood } from '@/nutrition/types';

import { useApp } from './app-state';

const PORTIONS_KEY = 'portionOverrides';

/**
 * The person's own foods, the foods the food API worked out for them, their
 * portion sizes, and what their entries contain.
 */
export function useFoodBook() {
  const { repo, dataVersion, touch } = useApp();
  const [own, setOwn] = useState<OwnFood[]>([]);
  const [saved, setSaved] = useState<FoodItem[]>([]);
  const [overrides, setOverrides] = useState<PortionOverrides>({});
  const [dishes, setDishes] = useState<MyDishes>(NO_DISHES);

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

  return {
    own,
    saved,
    overrides,
    /** The dishes whose ingredients the person corrected (nutrition/my-dishes.ts). */
    dishes,
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
    confirmIngredients: async (
      food: FoodItem,
      list: { name: string; grams: number }[],
      typedText: string | null,
    ): Promise<ConfirmOutcome> => {
      const out = await confirmIngredients({ saved, dishes, recipe: recipeFood }, food, list, typedText);
      if (!out.ok || !out.changed) return out;
      await repo.saveSavedFood(out.food);
      await repo.setKv(MY_DISHES_KEY, out.dishes);
      setSaved((prev) => [out.food, ...prev.filter((f) => f.id !== out.food.id)]);
      setDishes(out.dishes);
      touch();
      return out;
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
