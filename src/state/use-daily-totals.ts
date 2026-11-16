/**
 * One number per day over the last week or month, for the Week and Month
 * charts at the top of each Today tile's screen (owner, 16 Nov 2026: "a graph
 * to show the activity over a period of time"). The adding up is in
 * `totalsByDay`, so jest can check it without a repository.
 */

import { useEffect, useState } from 'react';

import { dayKey } from '@/lib/dates';
import { entryNutrients } from '@/nutrition/day';
import { useClock } from '@/hooks/use-clock';

import { useApp } from './app-state';
import { type DayTotal, dayKeysEnding, type TotalsKind, totalsByDay } from './daily-totals';
import { dayEndMs, dayStartMs, deviceZone } from './series';
import { useFoodBook } from './use-food-book';

export { averageOfLogged, type DayTotal, type TotalsKind } from './daily-totals';

/** Water logs read for a month (newest first; the repository has no range query). */
const WATER_LOGS_READ = 3000;
const WALKS_READ = 500;

const localDay = (ms: number) => dayKey(new Date(ms));

/** `kind`'s daily totals for the `days` days ending today; reads again when the data changes. */
export function useDailyTotals(kind: TotalsKind, days: number): { ready: boolean; totals: DayTotal[] } {
  const { repo, dataVersion } = useApp();
  const book = useFoodBook();
  const today = useClock().today;
  const key = `${kind}|${days}|${today}`;
  const [data, setData] = useState<{ key: string; totals: DayTotal[] } | null>(null);

  useEffect(() => {
    let live = true;
    const keys = dayKeysEnding(today, days);
    const from = keys[0]!;
    (async (): Promise<DayTotal[]> => {
      if (kind === 'steps' || kind === 'active') {
        const list = await repo.getDays(from, today).catch(() => []);
        return totalsByDay(keys, list, (d) => d.date, (d) => (kind === 'steps' ? d.steps : (d.activeMin ?? 0)));
      }
      if (kind === 'food') {
        const foods = await repo.getFoods(dayStartMs(from, deviceZone), dayEndMs(today, deviceZone)).catch(() => []);
        return totalsByDay(keys, foods, (f) => localDay(f.loggedAt), (f) => Math.round(entryNutrients(f, book.own, book.overrides, book.saved).kcal ?? 0));
      }
      if (kind === 'water') {
        const logs = await repo.getLogs('water', WATER_LOGS_READ).catch(() => []);
        return totalsByDay(keys, logs, (l) => localDay(l.loggedAt), (l) => l.value);
      }
      if (kind === 'sleep') {
        const nights = await repo.getSleep(from, today).catch(() => []);
        return totalsByDay(keys, nights, (n) => n.date, (n) => n.asleepMin);
      }
      const walks = await repo.getWalks(WALKS_READ).catch(() => []);
      return totalsByDay(keys, walks, (w) => localDay(w.startedAt), (w) => w.distanceM);
    })().then((totals) => {
      if (live) setData({ key, totals });
    });
    return () => {
      live = false;
    };
  }, [repo, dataVersion, kind, days, today, key, book.own, book.saved, book.overrides]);

  return data && data.key === key ? { ready: true, totals: data.totals } : { ready: false, totals: [] };
}
