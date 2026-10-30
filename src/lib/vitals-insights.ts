/**
 * How sleep, heart rate and blood pressure line up with walking and mood.
 * Same rules as the walking patterns: a few days on each side before saying
 * anything, and worded as "on days when…", never as a cause or a diagnosis.
 */
import type { BloodPressureEntry, DaySummary, HeartDay, MoodEntry } from '@/data/types';

import { averageBp, type BpAverage } from './blood-pressure';
import { addDaysToKey, dayKey } from './dates';
import { type Comparison, compare, MIN_GROUP_DAYS } from './insights';
import type { Night } from './sleep';

/** Asleep this long counts as a full night (adults are advised 7 hours or more). */
export const FULL_NIGHT_MIN = 7 * 60;

const walked = (days: DaySummary[]) => days.filter((d) => d.steps > 0);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Steps on days after a full night against days after a shorter one. */
export function sleepStepsComparison(days: DaySummary[], nights: Night[]): Comparison | null {
  const slept = new Map(nights.map((n) => [n.date, n.asleepMin]));
  const withSleep = walked(days).filter((d) => slept.has(d.date));
  return compare(
    withSleep.filter((d) => slept.get(d.date)! >= FULL_NIGHT_MIN).map((d) => d.steps),
    withSleep.filter((d) => slept.get(d.date)! < FULL_NIGHT_MIN).map((d) => d.steps),
  );
}

/** Minutes asleep before days logged as good or great, against before other days. */
export function sleepMoodComparison(nights: Night[], moods: MoodEntry[]): Comparison | null {
  const moodByDate = new Map(moods.map((m) => [m.date, m.mood]));
  const rated = nights.filter((n) => moodByDate.has(n.date));
  return compare(
    rated.filter((n) => moodByDate.get(n.date)! >= 4).map((n) => n.asleepMin),
    rated.filter((n) => moodByDate.get(n.date)! <= 3).map((n) => n.asleepMin),
  );
}

export interface RestingTrend {
  /** Average resting bpm over the last two weeks. */
  recent: number;
  /** The same, four weeks before that. */
  earlier: number;
  /** Average daily steps over the same two spans, when there are steps for both. */
  recentSteps: number | null;
  earlierSteps: number | null;
}

/**
 * Resting heart rate now against a month earlier, next to steps over the same
 * spans. Resting rate tends to drift down as walking becomes a habit, so this
 * is the slow, encouraging signal; day to day it bounces around.
 */
export function restingTrend(heart: HeartDay[], days: DaySummary[], today: string): RestingTrend | null {
  const inSpan = (date: string, fromDaysAgo: number, toDaysAgo: number) =>
    date >= addDaysToKey(today, -fromDaysAgo) && date <= addDaysToKey(today, -toDaysAgo);
  const resting = (from: number, to: number) =>
    heart.filter((h) => h.restingBpm !== null && inSpan(h.date, from, to)).map((h) => h.restingBpm!);
  const steps = (from: number, to: number) => walked(days).filter((d) => inSpan(d.date, from, to)).map((d) => d.steps);

  const recent = resting(14, 1);
  const earlier = resting(42, 29);
  if (recent.length < MIN_GROUP_DAYS || earlier.length < MIN_GROUP_DAYS) return null;
  const recentSteps = steps(14, 1);
  const earlierSteps = steps(42, 29);
  const both = recentSteps.length >= MIN_GROUP_DAYS && earlierSteps.length >= MIN_GROUP_DAYS;
  return {
    recent: Math.round(mean(recent)),
    earlier: Math.round(mean(earlier)),
    recentSteps: both ? Math.round(mean(recentSteps)) : null,
    earlierSteps: both ? Math.round(mean(earlierSteps)) : null,
  };
}

/** Average resting bpm over the last 7 days against the 7 before. */
export function restingWeekChange(heart: HeartDay[], today: string): { week: number; before: number | null } | null {
  const span = (from: number, to: number) =>
    heart
      .filter((h) => h.restingBpm !== null && h.date >= addDaysToKey(today, -from) && h.date <= addDaysToKey(today, -to))
      .map((h) => h.restingBpm!);
  const week = span(6, 0);
  if (!week.length) return null;
  const before = span(13, 7);
  return { week: Math.round(mean(week)), before: before.length ? Math.round(mean(before)) : null };
}

/** Readings taken on days the step goal was reached, against the other days. */
export function bpGoalComparison(
  days: DaySummary[],
  readings: BloodPressureEntry[],
): { goal: BpAverage; other: BpAverage } | null {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const goal: BloodPressureEntry[] = [];
  const other: BloodPressureEntry[] = [];
  for (const r of readings) {
    const day = byDate.get(dayKey(new Date(r.loggedAt)));
    if (!day || day.steps <= 0) continue;
    (day.steps >= day.goal ? goal : other).push(r);
  }
  if (goal.length < MIN_GROUP_DAYS || other.length < MIN_GROUP_DAYS) return null;
  return { goal: averageBp(goal)!, other: averageBp(other)! };
}
