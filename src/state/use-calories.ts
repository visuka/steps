import { useEffect, useState } from 'react';

import type { FoodEntry } from '@/data/types';
import { restingKcalSoFar } from '@/lib/calories';
import { dayKey, parseDayKey } from '@/lib/dates';
import { sumNutrients } from '@/nutrition/nutrients';

import { useApp } from './app-state';
import { useFoodBook } from './use-food-book';

/** Today's food, what it adds up to, and the eaten-vs-burned balance so far. */
export function useCaloriesToday() {
  const { repo, profile, today, dataVersion } = useApp();
  const book = useFoodBook();
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const todayKey = dayKey(new Date());

  useEffect(() => {
    let live = true;
    const start = parseDayKey(todayKey).getTime();
    repo.getFoods(start, start + 86_400_000).then((f) => live && setFoods(f));
    return () => {
      live = false;
    };
  }, [repo, todayKey, dataVersion]);

  const nutrients = sumNutrients(foods.map(book.nutrientsOf));
  const eaten = Math.round(nutrients.kcal ?? 0);
  const resting = restingKcalSoFar(profile, new Date());
  const active = today?.activeKcal ?? 0;
  return {
    book,
    foods,
    nutrients,
    /** Entries logged with calories only, which add nothing to the vitamins. */
    caloriesOnly: foods.filter((f) => !f.foodId).length,
    eaten,
    resting,
    active,
    burned: resting + active,
  };
}
