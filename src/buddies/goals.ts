/**
 * Shared club goals: the words, numbers and checks the goal screens show.
 * Pure (no React, no network), tested in __tests__/goals.test.ts.
 *
 * Goals are only what the app itself tracks (owner, 25 Nov 2026): some the
 * phone counts by itself (steps, active minutes, distance, a walk, a ride,
 * sleep, heart rate), the rest from what the person logs in the app's usual
 * places (blood pressure, weight, mood, meals, water, a nutrient). Every goal
 * is marked by the phone; there is no tap goal and no medicine goal.
 *
 * Wording stays neutral: a goal is "Done" or "Not marked yet", never
 * missed or failed. No doses or medical advice anywhere.
 */
import { parseDayKey } from '@/lib/dates';
import type { Units } from '@/lib/format';
import { formatClock, type ClockStyle } from '@/lib/when';
import { NUTRIENT } from '@/nutrition/nutrients';
import type { NutrientKey } from '@/nutrition/types';

import { SocialError } from './read';
import type { Goal, GoalForm, GoalKind, GoalMark, GoalReport, GoalSummaryRow } from './types';

/** At most this many goals a club (the server says goal_limit after). */
export const GOALS_MAX = 10;
export const GOAL_TITLE_MAX = 40;

/** The three plain groups the new-goal form offers, in order. */
export const KIND_GROUPS: readonly { title: string; kinds: readonly GoalKind[] }[] = [
  { title: 'Activity', kinds: ['steps', 'active', 'distance', 'walk', 'ride', 'sleep', 'heart'] },
  { title: 'Health', kinds: ['bp', 'weight', 'mood'] },
  { title: 'Food', kinds: ['meals', 'water', 'nutrient'] },
];

export const KIND_ORDER: readonly GoalKind[] = KIND_GROUPS.flatMap((g) => g.kinds);

export const KIND_WORD: Record<GoalKind, string> = {
  steps: 'Steps',
  active: 'Active minutes',
  distance: 'Distance',
  walk: 'Walk',
  ride: 'Ride',
  sleep: 'Sleep',
  heart: 'Heart rate',
  bp: 'Blood pressure',
  weight: 'Weight',
  mood: 'Mood',
  meals: 'Meals',
  water: 'Water',
  nutrient: 'A nutrient',
};

/** How each kind is counted, in the new-goal list. */
export const KIND_HOW: Record<GoalKind, string> = {
  steps: 'Counted by the phone',
  active: 'Brisk walking and running',
  distance: 'Counted by the phone',
  walk: 'A walk saved in the app',
  ride: 'A ride saved in the app',
  sleep: 'Last night',
  heart: 'From a watch, or a pulse with blood pressure',
  bp: 'Members log a reading',
  weight: 'Members log their weight',
  mood: 'Members log their mood',
  meals: 'Members log their food',
  water: 'Members log glasses',
  nutrient: 'From the food members log',
};

/** The plain icon each kind shows (names from PLAIN_ICON_COLOR). */
export const KIND_ICON = {
  steps: 'steps',
  active: 'bolt',
  distance: 'pin',
  walk: 'walk',
  ride: 'bike',
  sleep: 'moon',
  heart: 'heart',
  bp: 'pulse',
  weight: 'scale',
  mood: 'smile',
  meals: 'bowl',
  water: 'drop',
  nutrient: 'leaf',
} as const satisfies Record<GoalKind, string>;

/**
 * Where each logged kind is logged: the app's own screens, nothing new. The
 * Log button on a goal row opens it. Phone-counted kinds have none.
 */
export const LOG_ROUTE: Partial<Record<GoalKind, { pathname: string; params?: Record<string, string> }>> = {
  bp: { pathname: '/activity', params: { section: 'bp' } },
  weight: { pathname: '/activity', params: { section: 'weight' } },
  // Mood is logged on the sleep screen, under the nights (health-log.tsx MOVED_PARTS).
  mood: { pathname: '/detail/sleep' },
  meals: { pathname: '/food' },
  water: { pathname: '/detail/water' },
  nutrient: { pathname: '/food' },
};

/** Counted from what the person logs (and so has a Log button), not by the phone by itself. */
export const isLogged = (kind: GoalKind): boolean => LOG_ROUTE[kind] !== undefined;

/** "Counted by the phone", or from what is logged. */
export function countedWord(kind: GoalKind, who: 'you' | 'members' = 'you'): string {
  return isLogged(kind) ? `Counted from what ${who} log` : 'Counted by the phone';
}

// ── nutrients ──────────────────────────────────────────────────────────

/** least: done once today's total reaches the target. most: done while some food is logged and the total stays at or under it. */
export type NutrientDir = 'least' | 'most';

/**
 * The nutrients a goal can count, with their direction and the daily value or limit
 * the target is measured against (at most 10 times it). A fixed copy of nutrients.ts
 * (calories and the "limit" group: at most; the rest: at least), kept the same as
 * server goals.py NUTRIENTS; __tests__/goals.test.ts checks it against nutrients.ts.
 * Alcohol, sugars (all) and glycemic load have no daily value and are left out.
 */
export const NUTRIENT_GOALS: readonly { key: NutrientKey; dir: NutrientDir; ref: number }[] = [
  { key: 'kcal', dir: 'most', ref: 2000 },
  { key: 'protein', dir: 'least', ref: 50 },
  { key: 'carbs', dir: 'least', ref: 275 },
  { key: 'fiber', dir: 'least', ref: 28 },
  { key: 'fat', dir: 'least', ref: 78 },
  { key: 'omega3', dir: 'least', ref: 1.6 },
  { key: 'sodium', dir: 'most', ref: 2000 },
  { key: 'addedSugar', dir: 'most', ref: 50 },
  { key: 'satFat', dir: 'most', ref: 20 },
  { key: 'transFat', dir: 'most', ref: 2.2 },
  { key: 'cholesterol', dir: 'most', ref: 300 },
  { key: 'caffeine', dir: 'most', ref: 400 },
  { key: 'vitA', dir: 'least', ref: 900 },
  { key: 'vitD', dir: 'least', ref: 20 },
  { key: 'vitE', dir: 'least', ref: 15 },
  { key: 'vitK', dir: 'least', ref: 120 },
  { key: 'vitC', dir: 'least', ref: 90 },
  { key: 'thiamin', dir: 'least', ref: 1.2 },
  { key: 'riboflavin', dir: 'least', ref: 1.3 },
  { key: 'niacin', dir: 'least', ref: 16 },
  { key: 'vitB6', dir: 'least', ref: 1.7 },
  { key: 'folate', dir: 'least', ref: 400 },
  { key: 'vitB12', dir: 'least', ref: 2.4 },
  { key: 'calcium', dir: 'least', ref: 1300 },
  { key: 'iron', dir: 'least', ref: 18 },
  { key: 'magnesium', dir: 'least', ref: 420 },
  { key: 'phosphorus', dir: 'least', ref: 1250 },
  { key: 'potassium', dir: 'least', ref: 4700 },
  { key: 'zinc', dir: 'least', ref: 11 },
  { key: 'selenium', dir: 'least', ref: 55 },
];

const NUTRIENT_GOAL = new Map(NUTRIENT_GOALS.map((x) => [x.key, x]));

export const isGoalNutrient = (key: unknown): key is NutrientKey => typeof key === 'string' && NUTRIENT_GOAL.has(key as NutrientKey);

/** At least or at most; "least" for a key that is not on the list. */
export const nutrientDir = (key: NutrientKey): NutrientDir => NUTRIENT_GOAL.get(key)?.dir ?? 'least';

/** The nutrient list of the new-goal form, in four plain groups. */
export const NUTRIENT_GROUPS: readonly { title: string; keys: readonly NutrientKey[] }[] = (() => {
  const of = (groups: string[]) => NUTRIENT_GOALS.filter((x) => groups.includes(NUTRIENT[x.key].group)).map((x) => x.key);
  return [
    { title: 'Energy & macros', keys: of(['energy', 'macro']) },
    { title: 'Limits', keys: of(['limit']) },
    { title: 'Vitamins', keys: of(['vitamin']) },
    { title: 'Minerals', keys: of(['mineral']) },
  ];
})();

/** "or more" / "or less". */
export const dirWord = (key: NutrientKey): string => (nutrientDir(key) === 'most' ? 'or less' : 'or more');

/** A tidy step for a nutrient's target: a tenth of its daily value, down to 1, 2 or 5 of its power of ten. */
function niceStep(x: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const m = x / p;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
}

const decimalsOf = (step: number) => (step >= 1 ? 0 : Math.ceil(-Math.log10(step) - 1e-9));
const roundTo = (v: number, d: number) => Number(v.toFixed(d));

// ── targets ─────────────────────────────────────────────────────────────

export interface TargetRange {
  min: number;
  max: number;
  step: number;
  start: number;
}

/** The targets the server accepts per kind (goals.py TARGETS); nutrients have their own. Heart, weight and mood have none. */
export const TARGETS: Partial<Record<GoalKind, TargetRange>> = {
  steps: { min: 500, max: 50000, step: 500, start: 8000 },
  active: { min: 5, max: 300, step: 5, start: 30 },
  distance: { min: 500, max: 100000, step: 500, start: 5000 },
  walk: { min: 5, max: 240, step: 5, start: 30 },
  ride: { min: 5, max: 480, step: 5, start: 30 },
  sleep: { min: 180, max: 720, step: 30, start: 420 },
  bp: { min: 1, max: 4, step: 1, start: 1 },
  // The Food screen splits a day into four meals (breakfast, lunch, snacks, dinner) (the server allows 1–4 too).
  meals: { min: 1, max: 4, step: 1, start: 3 },
  water: { min: 1, max: 20, step: 1, start: 8 },
};

const METRES_PER_MILE = 1609.344;

/**
 * The range a goal's target moves in. A nutrient's: above 0 (its step) up to 10 times
 * its daily value or limit, starting at it. Distance moves by half a mile in miles.
 * Null when the goal has no target (heart, weight, mood, a nutrient not picked yet).
 */
export function rangeOf(kind: GoalKind, nutrientKey: NutrientKey | null = null, units: Units = 'metric'): TargetRange | null {
  if (kind === 'nutrient') {
    const n = nutrientKey ? NUTRIENT_GOAL.get(nutrientKey) : undefined;
    if (!n) return null;
    const step = niceStep(n.ref / 10);
    return { min: step, max: n.ref * 10, step, start: n.ref };
  }
  const r = TARGETS[kind];
  if (!r) return null;
  if (kind === 'distance' && units === 'imperial') return { ...r, step: Math.round(METRES_PER_MILE / 2), start: Math.round(3 * METRES_PER_MILE) };
  return r;
}

/** The kinds a goal must have a target for. */
export const needsTarget = (kind: GoalKind): boolean => kind === 'nutrient' || TARGETS[kind] !== undefined;

/** A target moved one step up or down, kept inside the range. */
export function stepTarget(kind: GoalKind, value: number, by: 1 | -1, nutrientKey: NutrientKey | null = null, units: Units = 'metric'): number {
  const r = rangeOf(kind, nutrientKey, units);
  if (!r) return value;
  const next = roundTo(Math.round((value + by * r.step) / r.step) * r.step, decimalsOf(r.step));
  return Math.min(r.max, Math.max(r.min, next));
}

// ── words ───────────────────────────────────────────────────────────────

const n = (v: number) => Math.round(v).toLocaleString('en-IN');

/** "7 h 30 min", "45 min". */
export function minutesWords(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** A distance's number in the person's units: "5", "2.5", "0.8". */
function distNumber(m: number, units: Units): string {
  const v = units === 'imperial' ? m / METRES_PER_MILE : m / 1000;
  return String(roundTo(v, v >= 10 ? 0 : 1));
}

const distUnit = (units: Units) => (units === 'imperial' ? 'mi' : 'km');

/** "5 km", "3 mi". */
export const distanceWords = (m: number, units: Units = 'metric') => `${distNumber(m, units)} ${distUnit(units)}`;

/** A nutrient amount's number: "2,000", "50", "2.4", "0.2". */
export function amountNumber(v: number): string {
  if (v >= 10) return n(v);
  return String(roundTo(v, v > 0 && v < 0.1 ? 2 : 1));
}

/** "50 g", "2,000 kcal", "2.4 µg". */
export const amountWords = (key: NutrientKey, v: number) => `${amountNumber(v)} ${NUTRIENT[key].unit}`.trim();

const plural = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;

/** A target in words: "8,000 steps", "30 min", "5 km", "2 readings", "8 glasses", "50 g or more". */
export function targetWords(kind: GoalKind, target: number, nutrientKey: NutrientKey | null = null, units: Units = 'metric'): string {
  switch (kind) {
    case 'steps':
      return `${n(target)} steps`;
    case 'active':
      return `${target} active min`;
    case 'distance':
      return distanceWords(target, units);
    case 'walk':
    case 'ride':
    case 'sleep':
      return minutesWords(target);
    case 'bp':
      return plural(target, 'reading', 'readings');
    case 'meals':
      return plural(target, 'meal', 'meals');
    case 'water':
      return plural(target, 'glass', 'glasses');
    case 'nutrient':
      return nutrientKey ? `${amountWords(nutrientKey, target)} ${dirWord(nutrientKey)}` : String(target);
    default:
      return String(target);
  }
}

/** What a goal without a target asks for. */
const NO_TARGET_WORD: Partial<Record<GoalKind, string>> = {
  heart: 'A reading',
  weight: 'Logged',
  mood: 'Logged',
};

/** What a goal asks for, in one piece: "8,000 steps", "Protein 50 g or more", "A reading". */
export function whatWords(goal: Pick<Goal, 'kind' | 'target' | 'nutrientKey'>, units: Units = 'metric'): string {
  if (goal.target === null) return NO_TARGET_WORD[goal.kind] ?? KIND_WORD[goal.kind];
  const t = targetWords(goal.kind, goal.target, goal.nutrientKey, units);
  return goal.kind === 'nutrient' && goal.nutrientKey ? `${NUTRIENT[goal.nutrientKey].label} ${t}` : t;
}

/**
 * The name a goal starts with, built from the choice ("8,000 steps", "Check blood pressure",
 * "Protein 50 g or more", "Added sugar 25 g or less"); the captain can change it.
 */
export function autoTitle(f: Pick<GoalForm, 'kind' | 'target' | 'nutrientKey'>, units: Units = 'metric'): string {
  const t = f.target;
  const title = (() => {
    switch (f.kind) {
      case 'heart':
        return 'Check heart rate';
      case 'weight':
        return 'Check weight';
      case 'mood':
        return 'Log mood';
      case 'bp':
        return t && t > 1 ? `Check blood pressure ${t} times` : 'Check blood pressure';
      case 'nutrient':
        return f.nutrientKey && t !== null ? whatWords(f, units) : '';
    }
    if (t === null) return KIND_WORD[f.kind];
    switch (f.kind) {
      case 'steps':
        return `${n(t)} steps`;
      case 'active':
        return `${t} active minutes`;
      case 'distance':
        return `${distanceWords(t, units)} on foot`;
      case 'walk':
        return `${minutesWords(t)} walk`;
      case 'ride':
        return `${minutesWords(t)} ride`;
      case 'sleep':
        return `Sleep ${minutesWords(t)}`;
      case 'meals':
        return `Log ${plural(t, 'meal', 'meals')}`;
      case 'water':
        return `${plural(t, 'glass', 'glasses')} of water`;
      default:
        return KIND_WORD[f.kind];
    }
  })();
  return title.slice(0, GOAL_TITLE_MAX);
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

const NBSP = ' ';

/** "07:00" as the phone shows times: "7:00 am" or "07:00". */
export function byTimeWords(byTime: string, style: ClockStyle): string {
  const [h, m] = byTime.split(':').map(Number);
  return formatClock(new Date(2026, 0, 1, h, m).getTime(), style);
}

/** "HH:MM" from a picked time. */
export function byTimeOf(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "by 7:00 am" with no-break spaces, so a line never wraps inside it ("by 7:00 / am"). */
export function byWords(byTime: string, style: ClockStyle): string {
  return `by ${byTimeWords(byTime, style)}`.replace(/ /g, NBSP);
}

/**
 * The second line of a goal: "8,000 steps · Every day · by 7:00 am". Each piece keeps
 * no-break spaces, so a line only breaks after a "· ", never inside a phrase ("Every / day").
 */
export function goalLine(
  goal: Pick<Goal, 'kind' | 'target' | 'nutrientKey' | 'days' | 'byTime' | 'paused'>,
  style: ClockStyle,
  units: Units = 'metric',
): string {
  const parts: string[] = [whatWords(goal, units)];
  parts.push(daysWord(goal.days));
  if (goal.byTime) parts.push(byWords(goal.byTime, style));
  if (goal.paused) parts.push('Paused');
  return parts.map((p) => p.replace(/ /g, NBSP)).join(' · ');
}

// ── status ──────────────────────────────────────────────────────────────

/** What the food log knows today of a goal's nutrient (goals-auto.ts nutrientKnown). */
export interface NutrientKnown {
  /** Foods logged today. */
  entries: number;
  /** At least one of them knows the nutrient. */
  known: boolean;
  /** Some of them know it only partly: the Food screen's "≥". */
  partial: boolean;
}

/**
 * What the phone has counted today, against the target: "6,240 of 8,000 steps",
 * "No reading yet", "32 of 50 g". `food` (nutrients): what the food log knows
 * today, since an empty log, or one that does not know the nutrient, is not yet "at most".
 */
export function liveWords(
  goal: Pick<Goal, 'kind' | 'target' | 'nutrientKey'>,
  value: number,
  units: Units = 'metric',
  food: NutrientKnown | null = null,
): string {
  const t = goal.target;
  switch (goal.kind) {
    case 'heart':
      return value > 0 ? 'Heart rate recorded' : 'No heart rate yet';
    case 'weight':
    case 'mood':
      return value > 0 ? 'Logged' : 'Not logged yet';
  }
  if (t === null) return '';
  switch (goal.kind) {
    case 'steps':
      return `${n(value)} of ${n(t)} steps`;
    case 'active':
      return `${value} of ${t} active min`;
    case 'distance':
      return `${distNumber(value, units)} of ${distanceWords(t, units)}`;
    case 'walk':
      return `${minutesWords(value)} of ${minutesWords(t)} walked`;
    case 'ride':
      return `${minutesWords(value)} of ${minutesWords(t)} ridden`;
    case 'sleep':
      return `${minutesWords(value)} of ${minutesWords(t)} slept`;
    case 'bp':
      return value > 0 ? `${value} of ${plural(t, 'reading', 'readings')}` : 'No reading yet';
    case 'meals':
      return value > 0 ? `${value} of ${plural(t, 'meal', 'meals')}` : 'No food logged yet';
    case 'water':
      return `${value} of ${t} glasses`;
    case 'nutrient': {
      const key = goal.nutrientKey;
      if (!key) return '';
      // As the Food screen prints it: "≥ 18" when some of it isn't known.
      const shown = `${food?.partial ? '≥ ' : ''}${amountNumber(value)}`;
      if (nutrientDir(key) === 'most') {
        if (!food?.entries) return 'No food logged yet';
        if (!food.known) return 'Not known yet';
        return `${shown} of at most ${amountWords(key, t)}`;
      }
      if (food?.entries && !food.known) return 'Not known yet';
      return `${shown} of ${amountWords(key, t)}`;
    }
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

// ── the form ────────────────────────────────────────────────────────────

/** A goal's form filled from a saved goal (to edit) or a kind's start values. */
export function formOf(goal: Goal | null, kind: GoalKind = 'steps', units: Units = 'metric'): GoalForm {
  if (goal) {
    return {
      title: goal.title,
      kind: goal.kind,
      target: goal.target,
      nutrientKey: goal.nutrientKey,
      byTime: goal.byTime,
      days: [...goal.days],
    };
  }
  const base = { kind, target: rangeOf(kind, null, units)?.start ?? null, nutrientKey: null };
  return { ...base, title: autoTitle(base, units), byTime: null, days: [...EVERY_DAY] };
}

/** A changed choice: the built name follows it, unless the captain typed their own. */
function withChoice(f: GoalForm, next: Pick<GoalForm, 'kind' | 'target' | 'nutrientKey'>, units: Units): GoalForm {
  const untouched = !f.title.trim() || f.title === autoTitle(f, units);
  return { ...f, ...next, title: untouched ? autoTitle(next, units) : f.title };
}

/** The form after picking another kind (a nutrient goal then waits for its nutrient). */
export function withKind(f: GoalForm, kind: GoalKind, units: Units = 'metric'): GoalForm {
  return withChoice(f, { kind, target: rangeOf(kind, null, units)?.start ?? null, nutrientKey: null }, units);
}

/** A nutrient goal for `key`, its target starting at the daily value or limit. */
export function withNutrient(f: GoalForm, key: NutrientKey, units: Units = 'metric'): GoalForm {
  return withChoice(f, { kind: 'nutrient', nutrientKey: key, target: rangeOf('nutrient', key, units)?.start ?? null }, units);
}

/** A new target; a built name follows it. */
export function withTarget(f: GoalForm, target: number, units: Units = 'metric'): GoalForm {
  return withChoice(f, { kind: f.kind, nutrientKey: f.nutrientKey, target }, units);
}

/** What is wrong with a form, in plain words, or null when it can be saved. */
export function goalProblem(f: GoalForm): string | null {
  if (f.kind === 'nutrient' && !isGoalNutrient(f.nutrientKey)) return 'Pick a nutrient.';
  const title = f.title.trim().replace(/\s+/g, ' ');
  if (!title) return 'Give the goal a name.';
  if (title.length > GOAL_TITLE_MAX) return `Keep the name to ${GOAL_TITLE_MAX} letters.`;
  if (!f.days.length) return 'Pick at least one day.';
  const r = rangeOf(f.kind, f.nutrientKey);
  if (needsTarget(f.kind) && f.target === null) return 'Set a target.';
  if (f.target !== null && (!r || !(f.target > 0) || f.target < r.min - 1e-9 || f.target > r.max + 1e-9)) return 'That target is out of range.';
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
    case 'kind':
    case 'counted':
      return 'This kind of goal cannot be set. Update the app and try again.';
    case 'nutrientKey':
      return 'Pick a nutrient from the list.';
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

// ── Buddies home ────────────────────────────────────────────────────────

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

/**
 * Buddies home, one club's goal line: "1 of 3 goals done today", "No goals today", or
 * "Goal tracking is off" when I have not said yes in that club. Null while loading or
 * when the club's goals could not be read (the row then shows no goal line).
 */
export function clubGoalWords(g: { goals: Goal[]; tracked: boolean; mine: GoalMark[] } | null | undefined, day: string): string | null {
  if (!g) return null;
  if (!g.tracked) return 'Goal tracking is off';
  const { done, due } = goalsDigest([{ goals: g }], day);
  if (!due) return 'No goals today';
  return `${done} of ${due} ${due === 1 ? 'goal' : 'goals'} done today`;
}

/** How many of these clubs count my goals (I said yes to goal tracking there). */
export function trackedCount(list: { goals: { tracked: boolean } | null }[]): number {
  return list.filter((x) => x.goals?.tracked).length;
}

/** "2 of 5 done today", "No goals today", or what the tile says before any club has goals. */
export function digestWords(d: { done: number; due: number } | null, clubs: number): string {
  if (!clubs) return 'Shared goals from your clubs';
  if (!d) return '—';
  if (!d.due) return 'No goals today';
  return `${d.done} of ${d.due} done today`;
}
