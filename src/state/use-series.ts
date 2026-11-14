/** Reads one day's series for the hourly detail screen (app/detail/[kind].tsx); the bucketing is in series.ts. */

import { useEffect, useState } from 'react';

import type { FoodEntry, LogEntry, SleepEntry } from '@/data/types';
import { daysBetween, dayKey } from '@/lib/dates';
import { ACTIVE_CADENCE } from '@/lib/metrics';
import { entryNutrients } from '@/nutrition/day';
import { DETAIL_DAYS } from '@/sync/engine';

import { useApp } from './app-state';
import {
  activeMinutesMissing,
  activePoints,
  bucketBy15Min,
  bucketByHour,
  dayEndMs,
  dayStartMs,
  deviceZone,
  hasMinuteData,
  HOURS,
  logsInRange,
  needsMoreLogs,
  QUARTERS,
  type SeriesKind,
  type SeriesPoint,
  stepPoints,
} from './series';
import { useFoodBook } from './use-food-book';

/** Water logs first read, newest first (the repository has no range query); doubled until the viewed day is covered. */
const WATER_LOGS_READ = 400;
const WATER_LOGS_MAX = 100_000;
const NO_HOURS: readonly number[] = new Array<number>(HOURS).fill(0);

export interface SeriesEntry {
  id: string;
  at: number;
  /** kcal or ml. */
  value: number;
  /** Food name; null for water. */
  name: string | null;
}

export interface SeriesData {
  /** False until the day has been read. */
  ready: boolean;
  /** 24 per-hour values: steps, active minutes, kcal or ml. */
  hours: readonly number[];
  /** Steps only: 96 quarter-hours from the stored minute data; null where there is none for this day. */
  quarters: readonly number[] | null;
  /** The day is older than the minute data the app keeps (steps and active). */
  minutesMissing: boolean;
  /** Food and water: each entry, oldest first. */
  entries: SeriesEntry[];
  /** Sleep: that morning's nights. */
  nights: SleepEntry[];
  /** The day's active minutes from its stored summary (active, when hours are not available). */
  storedActiveMin: number | null;
}

const EMPTY: SeriesData = {
  ready: false,
  hours: NO_HOURS,
  quarters: null,
  minutesMissing: false,
  entries: [],
  nights: [],
  storedActiveMin: null,
};

/** `kind`'s series for `day`; reads again when the data changes. */
export function useSeries(kind: SeriesKind, day: string): SeriesData {
  const { repo, source, dataVersion } = useApp();
  const book = useFoodBook();
  const [data, setData] = useState<{ key: string; value: SeriesData } | null>(null);
  const key = `${kind}|${day}`;

  useEffect(() => {
    let live = true;
    const tz = deviceZone;
    const start = dayStartMs(day, tz);
    const end = dayEndMs(day, tz);
    const minutes = hasMinuteData(daysBetween(day, dayKey(new Date())), DETAIL_DAYS);

    (async (): Promise<SeriesData> => {
      if (kind === 'steps') {
        const hours = await repo.getHourly(day).catch(() => [] as number[]);
        let quarters: number[] | null = null;
        if (minutes) {
          const buckets = await source.getStepBuckets(new Date(start), new Date(end), 15).catch(() => []);
          const q = bucketBy15Min(stepPoints(buckets), day, tz);
          quarters = q.length === QUARTERS && q.some((v) => v > 0) ? q : null;
        }
        return { ...EMPTY, ready: true, hours: hours.length === HOURS ? hours : NO_HOURS, quarters, minutesMissing: quarters === null };
      }
      if (kind === 'active') {
        const stored = await repo.getDay(day).catch(() => null);
        const storedActiveMin = stored?.activeMin ?? null;
        let hours: readonly number[] = NO_HOURS;
        let missing = !minutes;
        if (minutes) {
          const buckets = await source.getStepBuckets(new Date(start), new Date(end), 1).catch(() => null);
          if (buckets) hours = bucketByHour(activePoints(buckets, ACTIVE_CADENCE), day, tz).map(Math.round);
          missing = activeMinutesMissing(buckets, hours, storedActiveMin);
        }
        return { ...EMPTY, ready: true, hours: missing ? NO_HOURS : hours, minutesMissing: missing, storedActiveMin };
      }
      if (kind === 'food') {
        const foods: FoodEntry[] = await repo.getFoods(start, end).catch(() => []);
        // The same kcal as Today and the Food tab: worked out from the portion where there is one.
        const entries = foods
          .map((f): SeriesEntry => ({ id: f.id, at: f.loggedAt, value: Math.round(entryNutrients(f, book.own, book.overrides, book.saved).kcal ?? 0), name: f.name }))
          .sort((a, b) => a.at - b.at);
        return { ...EMPTY, ready: true, hours: bucketByHour(toPoints(entries), day, tz), entries };
      }
      if (kind === 'water') {
        let limit = WATER_LOGS_READ;
        let logs: LogEntry[] = await repo.getLogs('water', limit).catch(() => []);
        while (needsMoreLogs(logs, limit, start) && limit < WATER_LOGS_MAX) {
          limit *= 2;
          logs = await repo.getLogs('water', limit).catch(() => logs);
          if (logs.length < limit) break;
        }
        const entries = logsInRange(logs, start, end)
          .map((l): SeriesEntry => ({ id: l.id, at: l.loggedAt, value: l.value, name: null }))
          .sort((a, b) => a.at - b.at);
        return { ...EMPTY, ready: true, hours: bucketByHour(toPoints(entries), day, tz), entries };
      }
      const nights = await repo.getSleep(day, day).catch(() => [] as SleepEntry[]);
      return { ...EMPTY, ready: true, nights };
    })().then((value) => {
      if (live) setData({ key, value });
    });
    return () => {
      live = false;
    };
  }, [repo, source, dataVersion, kind, day, key, book.own, book.saved, book.overrides]);

  // A stale result (another kind or day) never shows: the screen draws "—" until its own arrives.
  return data && data.key === key ? data.value : EMPTY;
}

function toPoints(entries: readonly SeriesEntry[]): SeriesPoint[] {
  return entries.map((e) => ({ at: e.at, value: e.value }));
}
