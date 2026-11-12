import { useEffect, useState } from 'react';

import type { FoodEntry } from '@/data/types';
import { findFood, keepPastEntries, type PortionOverrides } from '@/nutrition/catalog';
import { entryNutrients } from '@/nutrition/day';
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

  useEffect(() => {
    let live = true;
    Promise.all([repo.getOwnFoods(), repo.getSavedFoods(), repo.getKv<PortionOverrides>(PORTIONS_KEY)]).then(
      ([o, s, p]) => {
        if (!live) return;
        setOwn(o);
        setSaved(s);
        setOverrides(p ?? {});
      },
    );
    return () => {
      live = false;
    };
  }, [repo, dataVersion]);

  return {
    own,
    saved,
    overrides,
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
  };
}
