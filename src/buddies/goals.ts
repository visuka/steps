/**
 * Shared club goals: the words, numbers and checks the goal screens show.
 * Pure (no React, no network), tested in __tests__/goals.test.ts.
 *
 * Wording stays neutral: a goal is "Done" or "Not marked yet", never
 * missed or failed. No doses or medical advice anywhere.
 */
import { parseDayKey } from '@/lib/dates';
import { formatClock, type ClockStyle } from '@/lib/when';

import { SocialError } from './read';
import type { Goal, GoalCounted, GoalForm, GoalKind, GoalMark, GoalReport, GoalSummaryRow } from './types';

/** At most this many goals a club (the server says goal_limit after). */
export const GOALS_MAX = 10;
export const GOAL_TITLE_MAX = 40;

export const KIND_ORDER: readonly GoalKind[] = ['steps', 'walk', 'water', 'sleep', 'medicine', 'other'];

export const KIND_WORD: Record<GoalKind, string> = {
  steps: 'Steps',
  walk: 'Walk',
  water: 'Water',
  sleep: 'Sleep',
  medicine: 'Medicine',
  other: 'Anything',
};

/** The plain icon each kind shows (names from PLAIN_ICON_COLOR). */
export const KIND_ICON = {
  steps: 'steps',
  walk: 'walk',
  water: 'drop',
  sleep: 'moon',
  medicine: 'pill',
  other: 'check',
} as const satisfies Record<GoalKind, string>;

/** A title to start from when the captain picks a kind. */
export const KIND_TITLE: Record<GoalKind, string> = {
  steps: 'Daily steps',
  walk: 'Morning walk',
  water: 'Drink water',
  sleep: 'Sleep well',
  medicine: 'Take my medicine',
  other: '',
};

export interface TargetRange {
  min: number;
  max: number;
  step: number;
  start: number;
  unit: string;
}

/** The targets the server accepts per kind (goals.py TARGETS). Medicine and anything have none. */
export const TARGETS: Partial<Record<GoalKind, TargetRange>> = {
  steps: { min: 500, max: 50000, step: 500, start: 8000, unit: 'steps' },
  walk: { min: 5, max: 240, step: 5, start: 30, unit: 'min' },
  water: { min: 1, max: 20, step: 1, start: 8, unit: 'glasses' },
  sleep: { min: 180, max: 720, step: 30, start: 420, unit: 'min' },
};

/** The phone can count these by itself; the others are tapped. */
export const canAuto = (kind: GoalKind): boolean => TARGETS[kind] !== undefined;

const n = (v: number) => Math.round(v).toLocaleString('en-IN');

/** "7 h 30 min", "45 min". */
export function minutesWords(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** A target in words: "8,000 steps", "30 min", "8 glasses", "7 h". */
export function targetWords(kind: GoalKind, target: number): string {
  switch (kind) {
    case 'steps':
      return `${n(target)} steps`;
    case 'walk':
    case 'sleep':
      return minutesWords(target);
    case 'water':
      return `${target} ${target === 1 ? 'glass' : 'glasses'}`;
    default:
      return String(target);
  }
}

/** A target moved one step up or down, kept inside the range. */
export function stepTarget(kind: GoalKind, value: number, by: 1 | -1): number {
  const r = TARGETS[kind];
  if (!r) return value;
  return Math.min(r.max, Math.max(r.min, Math.round((value + by * r.step) / r.step) * r.step));
}

// ── days ────────────────────────────────────────────────────────────────

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [0, 1, 2, 3, 4];
/** Monday = 0, as the server keeps them. */
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A day key's weekday, Monday = 0. */
export function weekdayOf(day: string): number {
  return (parseDayKey(day).getDay() + 6) % 7;
}

export const sameDays = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && [...a].sort().every((d, i) => d === [...b].sort()[i]);

/** "Every day", "Weekdays", "Weekends", "Mon, Wed, Fri". */
export function daysWord(days: readonly number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  if (sameDays(sorted, WEEKDAYS)) return 'Weekdays';
  if (sameDays(sorted, [5, 6])) return 'Weekends';
  return sorted.map((d) => DAY_SHORT[d]).join(', ');
}

/** Whether a goal asks for anything on `day` (not paused and one of its days). */
export function dueOn(goal: Pick<Goal, 'days' | 'paused'>, day: string): boolean {
  return !goal.paused && goal.days.includes(weekdayOf(day));
}

// ── times ───────────────────────────────────────────────────────────────

/** "07:00" as the phone shows times: "7:00 am" or "07:00". */
export function byTimeWords(byTime: string, style: ClockStyle): string {
  const [h, m] = byTime.split(':').map(Number);
  return formatClock(new Date(2026, 0, 1, h, m).getTime(), style);
}

/** "HH:MM" from a picked time. */
export function byTimeOf(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The second line of a goal: "8,000 steps · Every day · by 7:00 am". */
export function goalLine(goal: Pick<Goal, 'kind' | 'target' | 'days' | 'byTime' | 'paused'>, style: ClockStyle): string {
  const parts: string[] = [];
  if (goal.target !== null) parts.push(targetWords(goal.kind, goal.target));
  parts.push(daysWord(goal.days));
  if (goal.byTime) parts.push(`by ${byTimeWords(goal.byTime, style)}`);
  if (goal.paused) parts.push('Paused');
  return parts.join(' · ');
}

export const countedWord = (c: GoalCounted) => (c === 'auto' ? 'Counted by the phone' : 'Marked by tapping');

// ── status ──────────────────────────────────────────────────────────────

/** What the phone has counted today, for an auto goal. */
export function liveWords(kind: GoalKind, value: number, target: number): string {
  switch (kind) {
    case 'steps':
      return `${n(value)} of ${n(target)} steps`;
    case 'walk':
      return `${minutesWords(value)} of ${minutesWords(target)} walked`;
    case 'water':
      return `${value} of ${target} glasses`;
    case 'sleep':
      return `${minutesWords(value)} of ${minutesWords(target)} slept`;
    default:
      return '';
  }
}

/** "Done 8:12 am", "Done", or "Not marked yet". */
export function markWords(mark: Pick<GoalMark, 'done' | 'at'> | null | undefined, style: ClockStyle): string {
  if (!mark?.done) return 'Not marked yet';
  return mark.at ? `Done ${formatClock(mark.at, style)}` : 'Done';
}

/** "9 of 12 done". */
export function summaryLine(row: Pick<GoalSummaryRow, 'doneToday' | 'members'> | undefined): string {
  if (!row) return 'Not marked yet';
  return `${row.doneToday} of ${row.members} done`;
}

/** "6 of 7 days". */
export function weekLine(w: { done: number; of: number }): string {
  if (!w.of) return 'Not due this week';
  return `${w.done} of ${w.of} ${w.of === 1 ? 'day' : 'days'}`;
}

/** The people not done today, for a gentle reminder; never myself. */
export function remindTargets(report: GoalReport, myPid: string | null): string[] {
  return report.rows.filter((r) => !r.today.done && r.walker.pid !== myPid).map((r) => r.walker.pid);
}

/** A goal's form filled from a saved goal (to edit) or a kind's start values. */
export function formOf(goal: Goal | null, kind: GoalKind = 'walk'): GoalForm {
  if (goal) {
    return {
      title: goal.title,
      kind: goal.kind,
      target: goal.target,
      byTime: goal.byTime,
      days: [...goal.days],
      counted: goal.counted,
    };
  }
  return {
    title: KIND_TITLE[kind],
    kind,
    target: TARGETS[kind]?.start ?? null,
    byTime: null,
    days: [...EVERY_DAY],
    counted: canAuto(kind) ? 'auto' : 'tap',
  };
}

/** The form after picking another kind: the start title only replaces an untouched one. */
export function withKind(f: GoalForm, kind: GoalKind): GoalForm {
  const untouched = !f.title.trim() || f.title === KIND_TITLE[f.kind];
  return {
    ...f,
    kind,
    title: untouched ? KIND_TITLE[kind] : f.title,
    target: TARGETS[kind]?.start ?? null,
    counted: canAuto(kind) ? f.counted : 'tap',
  };
}

/** What is wrong with a form, in plain words, or null when it can be saved. */
export function goalProblem(f: GoalForm): string | null {
  const title = f.title.trim().replace(/\s+/g, ' ');
  if (!title) return 'Give the goal a name.';
  if (title.length > GOAL_TITLE_MAX) return `Keep the name to ${GOAL_TITLE_MAX} letters.`;
  if (!f.days.length) return 'Pick at least one day.';
  const r = TARGETS[f.kind];
  if (f.counted === 'auto' && !canAuto(f.kind)) return 'Only steps, walks, water and sleep can be counted by the phone.';
  if (f.counted === 'auto' && f.target === null) return 'Set a target the phone can count.';
  if (f.target !== null && (!r || f.target < r.min || f.target > r.max)) return 'That target is out of range.';
  return null;
}

/** A goal error in plain words. */
export function goalErrorText(e: unknown): string {
  if (!(e instanceof SocialError)) return 'Something went wrong. Try again.';
  switch (e.why ?? e.code) {
    case 'goal_limit':
      return `A club can have ${GOALS_MAX} goals.`;
    case 'goals_consent':
      return 'Turn on goal tracking for this club first.';
    case 'goals_off':
      return 'This club has shared goals turned off.';
    case 'paused':
      return 'This goal is paused.';
    case 'not_due':
      return 'This goal is not set for today.';
    case 'daily_limit':
      return 'A reminder for this goal was already sent today.';
    case 'title':
      return 'That name cannot be used. Try another.';
    case 'target':
      return 'That target is out of range.';
    case 'byTime':
      return 'That time cannot be used.';
    case 'days':
      return 'Pick at least one day.';
    case 'text_not_allowed':
      return 'That name has words that are not allowed.';
  }
  return e.message;
}

/** Today's goals across my clubs, for the Buddies home tile: done and due (tracked clubs only). */
export function goalsDigest(list: { goals: { goals: Goal[]; tracked: boolean; mine: GoalMark[] } | null }[], day: string): { done: number; due: number } {
  let done = 0;
  let due = 0;
  for (const x of list) {
    if (!x.goals?.tracked) continue;
    for (const g of x.goals.goals) {
      if (!dueOn(g, day)) continue;
      due += 1;
      if (x.goals.mine.some((m) => m.goalId === g.goalId && m.done)) done += 1;
    }
  }
  return { done, due };
}

/** "2 of 5 done today", "No goals today", or what the tile says before any club has goals. */
export function digestWords(d: { done: number; due: number } | null, clubs: number): string {
  if (!clubs) return 'Shared goals from your clubs';
  if (!d) return '—';
  if (!d.due) return 'No goals today';
  return `${d.done} of ${d.due} done today`;
}
