import { useEffect, useState } from 'react';

import type { FoodEntry } from '@/data/types';
import type { PortionOverrides } from '@/nutrition/catalog';
import { entryNutrients } from '@/nutrition/day';
import type { FoodItem, OwnFood } from '@/nutrition/types';

import { useApp } from './app-state';

const PORTIONS_KEY = 'portionOverrides';

/** The person's own foods and portion sizes, and what their entries contain. */
export function useFoodBook() {
  const { repo, dataVersion, touch } = useApp();
  const [own, setOwn] = useState<OwnFood[]>([]);
  const [overrides, setOverrides] = useState<PortionOverrides>({});

  useEffect(() => {
    let live = true;
    Promise.all([repo.getOwnFoods(), repo.getKv<PortionOverrides>(PORTIONS_KEY)]).then(([o, p]) => {
      if (!live) return;
      setOwn(o);
      setOverrides(p ?? {});
    });
    return () => {
      live = false;
    };
  }, [repo, dataVersion]);

  return {
    own,
    overrides,
    nutrientsOf: (entry: FoodEntry) => entryNutrients(entry, own, overrides),
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
  };
}
