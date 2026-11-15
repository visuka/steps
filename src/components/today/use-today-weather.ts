/** Loads today's saved weather for the line next to the date; reloads with the data. */

import { useEffect, useState } from 'react';

import type { DayWeather } from '@/data/types';
import { useNow } from '@/hooks/use-now';

import { useApp } from '@/state/app-state';

import { todayWeather, type TodayWeather } from './weather-line';
import { useClock } from '@/hooks/use-clock';

export function useTodayWeather(reload: number): TodayWeather | null {
  const { repo, profile, dataVersion } = useApp();
  // The hour's own figure: look again every ten minutes.
  const now = useNow(600_000);
  const today = useClock().today;
  const [day, setDay] = useState<DayWeather | null>(null);

  useEffect(() => {
    let live = true;
    repo
      .getWeather(today)
      .catch(() => null)
      .then((w) => {
        if (live) setDay(w);
      });
    return () => {
      live = false;
    };
  }, [repo, today, dataVersion, reload]);

  return todayWeather(day, now, profile.units);
}
