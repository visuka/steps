import { useEffect, useState } from 'react';

import type { FoodEntry } from '@/data/types';
import { restingKcalSoFar } from '@/lib/calories';
import { addDaysToKey, dayKey, parseDayKey } from '@/lib/dates';
import { dailyAverage, partialKeys } from '@/nutrition/day';
import { sumNutrients } from '@/nutrition/nutrients';

import { useApp } from './app-state';
import { todayKcal } from './today-kcal';
import { useFoodBook } from './use-food-book';

/** Today plus the six days before it: the week that stored vitamins and minerals are judged on. */
const WEEK_DAYS = 7;

/**
 * Today's food, what it adds up to, and the eaten-vs-burned balance so far.
 * `reload` reads the log again when it changes: Today passes a count that
 * goes up each time it comes into view, so food saved by a path that doesn't
 * bump dataVersion (or while the tab sat in the background) still shows.
 */
export function useCaloriesToday(reload = 0) {
  const { repo, profile, today, dataVersion } = useApp();
  const book = useFoodBook();
  const [week, setWeek] = useState<FoodEntry[]>([]);
  const todayKey = dayKey(new Date());
  const todayStart = parseDayKey(todayKey).getTime();

  useEffect(() => {
    let live = true;
    const from = parseDayKey(addDaysToKey(todayKey, 1 - WEEK_DAYS)).getTime();
    const to = parseDayKey(addDaysToKey(todayKey, 1)).getTime();
    repo.getFoods(from, to).then((f) => live && setWeek(f));
    return () => {
      live = false;
    };
  }, [repo, todayKey, dataVersion, reload]);

  const foods = week.filter((f) => f.loggedAt >= todayStart);
  const nutrients = sumNutrients(foods.map(book.nutrientsOf));
  const partial = partialKeys(foods, book.own, book.saved);
  const { eaten } = todayKcal({ foods, nutrientsOf: book.nutrientsOf, partial });
  const resting = restingKcalSoFar(profile, new Date());
  // Only today's row: after midnight the one in memory can still be yesterday's until the next sync.
  const active = today?.date === todayKey ? today.activeKcal : 0;
  return {
    book,
    foods,
    nutrients,
    /** Keys today's totals know only partly ("at least"): calories among them get "≥" wherever shown. */
    partial,
    /** Daily average over the days of the last week with food logged, today included. */
    week: dailyAverage(week, book.own, book.overrides, book.saved),
    /** Entries logged with calories only, which add nothing to the vitamins. */
    caloriesOnly: foods.filter((f) => !f.foodId).length,
    eaten,
    resting,
    active,
    burned: resting + active,
  };
}

/**
 * Calories eaten today: the one figure Today and the Food tab both show.
 * Loads like useCaloriesToday; `reload` reads the log again (pass a count
 * that goes up each time the screen comes into focus).
 */
export function useTodayKcal(reload = 0) {
  const { eaten, partial } = useCaloriesToday(reload);
  return { eaten, partial: Boolean(partial.kcal) };
}
