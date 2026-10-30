/**
 * Patterns in a person's own walking: when in the day they walk, and how mood
 * and weather line up with their steps. Comparisons only show once each side
 * has a few days, so one odd day can't produce a confident-sounding claim.
 * These are correlations; the UI words them as "on days when…", never as causes.
 */
import type { DaySummary, DayWeather, MoodEntry } from '@/data/types';

import { parseDayKey } from './dates';

export const MIN_GROUP_DAYS = 3;
/** A day this hot (max °C) changes plans in most of India. */
export const HOT_DAY_C = 35;
/** Rain that day, in mm, that counts as a rainy day. */
export const RAINY_DAY_MM = 1;

export interface Comparison {
  /** Average steps on the days in question. */
  a: number;
  /** Average steps on the other days. */
  b: number;
  daysA: number;
  daysB: number;
  /** (a − b) / b */
  change: number;
}

const average = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function compare(a: number[], b: number[]): Comparison | null {
  if (a.length < MIN_GROUP_DAYS || b.length < MIN_GROUP_DAYS) return null;
  const avgA = average(a);
  const avgB = average(b);
  if (avgB <= 0) return null;
  return { a: Math.round(avgA), b: Math.round(avgB), daysA: a.length, daysB: b.length, change: (avgA - avgB) / avgB };
}

/** "32% more", "18% fewer", or "about the same". */
export function describeChange(change: number): string {
  const pct = Math.round(Math.abs(change) * 100);
  if (pct < 5) return 'about the same';
  return `${pct}% ${change > 0 ? 'more' : 'fewer'}`;
}

/** Days with steps; days without any are usually days the phone stayed home. */
const walkedDays = (days: DaySummary[]) => days.filter((d) => d.steps > 0);

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

export const DAY_PARTS: { part: DayPart; label: string; hours: number[] }[] = [
  { part: 'morning', label: 'Morning', hours: [5, 6, 7, 8, 9, 10, 11] },
  { part: 'afternoon', label: 'Afternoon', hours: [12, 13, 14, 15, 16] },
  { part: 'evening', label: 'Evening', hours: [17, 18, 19, 20] },
  { part: 'night', label: 'Night', hours: [21, 22, 23, 0, 1, 2, 3, 4] },
];

export interface TimeOfDay {
  /** Share of steps in each part of the day, 0–1. */
  shares: Record<DayPart, number>;
  /** Start of the two-hour window with the most steps. */
  peakStartHour: number;
  days: number;
}

export function timeOfDay(hourlyByDay: number[][]): TimeOfDay | null {
  const days = hourlyByDay.filter((h) => h.some((s) => s > 0));
  if (days.length < MIN_GROUP_DAYS) return null;
  const totals = new Array<number>(24).fill(0);
  for (const h of days) h.forEach((s, hour) => (totals[hour] += s));
  const sum = totals.reduce((s, x) => s + x, 0);
  if (sum <= 0) return null;

  const shares = {} as Record<DayPart, number>;
  for (const { part, hours } of DAY_PARTS) shares[part] = hours.reduce((s, h) => s + totals[h], 0) / sum;

  let peakStartHour = 0;
  for (let h = 1; h < 23; h++) {
    if (totals[h] + totals[h + 1] > totals[peakStartHour] + totals[peakStartHour + 1]) peakStartHour = h;
  }
  return { shares, peakStartHour, days: days.length };
}

/** Weekend days against weekdays. */
export function weekendComparison(days: DaySummary[]): Comparison | null {
  const walked = walkedDays(days);
  const isWeekend = (d: DaySummary) => [0, 6].includes(parseDayKey(d.date).getDay());
  return compare(
    walked.filter(isWeekend).map((d) => d.steps),
    walked.filter((d) => !isWeekend(d)).map((d) => d.steps),
  );
}

/** Days logged as good or great (4–5) against the rest of the days with a mood. */
export function moodComparison(days: DaySummary[], moods: MoodEntry[]): Comparison | null {
  const moodByDate = new Map(moods.map((m) => [m.date, m.mood]));
  const rated = walkedDays(days).filter((d) => moodByDate.has(d.date));
  return compare(
    rated.filter((d) => moodByDate.get(d.date)! >= 4).map((d) => d.steps),
    rated.filter((d) => moodByDate.get(d.date)! <= 3).map((d) => d.steps),
  );
}

/**
 * Hot days against cooler ones. Uses 35 °C when there are enough days on both
 * sides; otherwise splits at the person's own middle temperature, so a place
 * that's never that hot still gets an answer.
 */
export function heatComparison(
  days: DaySummary[],
  weather: DayWeather[],
): { thresholdC: number; comparison: Comparison } | null {
  const tempByDate = new Map(weather.map((w) => [w.date, w.tempMaxC]));
  const withTemp = walkedDays(days).filter((d) => tempByDate.has(d.date));
  const split = (threshold: number) =>
    compare(
      withTemp.filter((d) => tempByDate.get(d.date)! >= threshold).map((d) => d.steps),
      withTemp.filter((d) => tempByDate.get(d.date)! < threshold).map((d) => d.steps),
    );

  const hot = split(HOT_DAY_C);
  if (hot) return { thresholdC: HOT_DAY_C, comparison: hot };

  const temps = withTemp.map((d) => tempByDate.get(d.date)!).sort((a, b) => a - b);
  if (temps.length < 2 * MIN_GROUP_DAYS || temps[temps.length - 1] - temps[0] < 3) return null;
  const median = Math.round(temps[Math.floor(temps.length / 2)]);
  const byMedian = split(median);
  return byMedian ? { thresholdC: median, comparison: byMedian } : null;
}

export function rainComparison(days: DaySummary[], weather: DayWeather[]): Comparison | null {
  const byDate = new Map(weather.map((w) => [w.date, w]));
  const withWeather = walkedDays(days).filter((d) => byDate.has(d.date));
  const rainy = (d: DaySummary) => {
    const w = byDate.get(d.date)!;
    return w.precipMm >= RAINY_DAY_MM || w.condition === 'rain' || w.condition === 'storm';
  };
  return compare(
    withWeather.filter(rainy).map((d) => d.steps),
    withWeather.filter((d) => !rainy(d)).map((d) => d.steps),
  );
}

/** "6 and 8 pm", "11 am and 1 pm". */
export function formatHourWindow(startHour: number): string {
  const label = (h: number) => {
    const twelve = h % 12 === 0 ? 12 : h % 12;
    return { n: twelve, suffix: h % 24 < 12 ? 'am' : 'pm' };
  };
  const a = label(startHour);
  const b = label(startHour + 2);
  return a.suffix === b.suffix ? `${a.n} and ${b.n} ${b.suffix}` : `${a.n} ${a.suffix} and ${b.n} ${b.suffix}`;
}
