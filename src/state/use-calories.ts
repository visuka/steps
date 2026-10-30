import { useEffect, useState } from 'react';

import type { FoodEntry } from '@/data/types';
import { restingKcalSoFar } from '@/lib/calories';
import { dayKey, parseDayKey } from '@/lib/dates';

import { useApp } from './app-state';

/** Today's food and the eaten-vs-burned balance so far. */
export function useCaloriesToday() {
  const { repo, profile, today, dataVersion } = useApp();
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

  const eaten = Math.round(foods.reduce((s, f) => s + f.kcal, 0));
  const resting = restingKcalSoFar(profile, new Date());
  const active = today?.activeKcal ?? 0;
  return { foods, eaten, resting, active, burned: resting + active };
}
