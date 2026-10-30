import { addDaysToKey, daysBetween } from '@/lib/dates';

export interface GoalDay {
  date: string;
  steps: number;
  goal: number;
}

export interface Streaks {
  current: number;
  best: number;
}

const met = (d: GoalDay) => d.steps >= d.goal;

/**
 * Recomputed from daily rows every time rather than incremented, so a late
 * sync or a time-zone change can't break a streak. Today only counts once
 * its goal is met; until then the streak runs through yesterday.
 */
export function computeStreaks(days: GoalDay[], today: string): Streaks {
  const metDays = new Set(days.filter(met).map((d) => d.date));

  let current = 0;
  let cursor = metDays.has(today) ? today : addDaysToKey(today, -1);
  while (metDays.has(cursor)) {
    current += 1;
    cursor = addDaysToKey(cursor, -1);
  }

  const sorted = [...metDays].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && daysBetween(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  return { current, best: Math.max(best, current) };
}
