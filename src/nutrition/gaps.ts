/**
 * Which days say enough about what someone eats to judge, the week's average
 * over those days, and the one gentle "gap note" worth making. A food log
 * always misses things, so a note needs a pattern over several full days,
 * known figures for nearly everything eaten, and long quiet spells between.
 */
import type { FoodEntry, Profile } from '@/data/types';
import { addDaysToKey, dayKey, daysBetween } from '@/lib/dates';

import type { PortionOverrides } from './catalog';
import { entryNutrients } from './day';
import { NUTRIENT, NUTRIENTS, sumNutrients } from './nutrients';
import { coverage, coverageAll, SHOW_COVERAGE } from './state';
import { ageIn, fiberTarget, fullDayKcal, needsAreDifferent, proteinTarget, lowLine } from './targets';
import type { FoodItem, NutrientKey, Nutrients, OwnFood } from './types';

/** "That's all for today", or "Fasting today" (the day is left out). */
export type DayMark = 'complete' | 'fasting';
/** Day key → mark; kept six weeks (notes.ts). */
export type DayMarks = Record<string, DayMark>;

/** A day without a mark is judged from this share of a full day's energy, with 2+ foods from the list. */
export const JUDGED_SHARE = 0.6;
/** "That's all for today" still needs this much: a fast or a tea-only day says nothing about gaps. */
export const COMPLETE_SHARE = 0.5;
const JUDGED_FOODS = 2;
/** Today is judged by itself from this hour (dinner in India is often 21:00–22:00). */
export const JUDGE_TODAY_HOUR = 23;
/** Judged days in the last 7 needed for any week verdict. */
export const WEEK_DAYS_NEEDED = 4;
/** Each day a gap note counts must have figures for this share of its energy. */
export const NOTE_COVERAGE = 0.95;

const loggedKcal = (entries: Pick<FoodEntry, 'kcal'>[]) => entries.reduce((a, e) => a + (e.kcal || 0), 0);

/**
 * A finished day says enough to judge when it was marked complete (and isn't
 * nearly empty), or when it holds 60% of a full day's energy from at least
 * two foods of the list. A fasting day never counts.
 */
export function isJudgedDay(
  entries: Pick<FoodEntry, 'kcal' | 'foodId'>[],
  fullKcal: number,
  complete: DayMark | boolean | null | undefined,
): boolean {
  if (complete === 'fasting') return false;
  const kcal = loggedKcal(entries);
  if (complete === true || complete === 'complete') return kcal >= COMPLETE_SHARE * fullKcal;
  return kcal >= JUDGED_SHARE * fullKcal && entries.filter((e) => e.foodId).length >= JUDGED_FOODS;
}

/** Today: only after "That's all for today", or from 23:00 on a day that already qualifies. */
export function isJudgedToday(
  entries: Pick<FoodEntry, 'kcal' | 'foodId'>[],
  fullKcal: number,
  mark: DayMark | null | undefined,
  now: Date,
): boolean {
  if (mark) return isJudgedDay(entries, fullKcal, mark);
  return now.getHours() >= JUDGE_TODAY_HOUR && isJudgedDay(entries, fullKcal, null);
}

/** One day's food: totals, how much of it each figure covers, and whether it's judged. */
export interface DayIntake {
  day: string;
  total: Nutrients;
  coverage: Partial<Record<NutrientKey, number>>;
  judged: boolean;
  kcal: number;
  entries: number;
}

export interface FoodBook {
  own: OwnFood[];
  overrides: PortionOverrides;
  saved: FoodItem[];
}

/** Every day with food in `entries`, oldest first. */
export function dayIntakes(
  entries: FoodEntry[],
  book: FoodBook,
  profile: Profile,
  opts: { marks?: DayMarks; now: Date },
): DayIntake[] {
  const today = dayKey(opts.now);
  const full = fullDayKcal(profile, opts.now.getFullYear());
  const byDay = new Map<string, FoodEntry[]>();
  for (const e of entries) {
    const key = dayKey(new Date(e.loggedAt));
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }
  return [...byDay.keys()].sort().map((day) => {
    const list = byDay.get(day)!;
    const nutrients = list.map((e) => entryNutrients(e, book.own, book.overrides, book.saved));
    const mark = opts.marks?.[day];
    const judged = day === today ? isJudgedToday(list, full, mark, opts.now) : day < today && isJudgedDay(list, full, mark);
    return { day, total: sumNutrients(nutrients), coverage: coverageAll(nutrients), judged, kcal: loggedKcal(list), entries: list.length };
  });
}

export interface JudgedAverage {
  judgedDays: number;
  /** Per nutrient, over the judged days whose figure covers 80%+ of that day; missing when no such day. */
  average: Nutrients;
  /** Per nutrient, the share of the judged days' energy with a figure for it. */
  coverage: Partial<Record<NutrientKey, number>>;
  /** Per nutrient, how many judged days its average is over. */
  daysFor: Partial<Record<NutrientKey, number>>;
}

/** Averages judged days only; dailyAverage() (all days with food) stays as it is for other uses. */
export function averageOfJudged(days: DayIntake[]): JudgedAverage {
  const judged = days.filter((d) => d.judged);
  const average: Nutrients = {};
  const cov: Partial<Record<NutrientKey, number>> = {};
  const daysFor: Partial<Record<NutrientKey, number>> = {};
  const kcal = judged.reduce((a, d) => a + d.kcal, 0);
  for (const key of Object.keys(NUTRIENT) as NutrientKey[]) {
    const counted = judged.filter((d) => d.total[key] !== undefined && (d.coverage[key] ?? 0) >= SHOW_COVERAGE);
    if (counted.length) average[key] = counted.reduce((a, d) => a + (d.total[key] ?? 0), 0) / counted.length;
    daysFor[key] = counted.length;
    const known = judged.reduce((a, d) => a + d.kcal * (d.coverage[key] ?? 0), 0);
    cov[key] = kcal > 0 ? known / kcal : judged.some((d) => (d.coverage[key] ?? 0) > 0) ? 1 : 0;
  }
  return { judgedDays: judged.length, average, coverage: cov, daysFor };
}

/**
 * The last 7 days (today included once it is judged), judged days only.
 * `entries` may hold more; only the 7 days up to `now` count.
 */
export function judgedAverage(
  entries: FoodEntry[],
  own: OwnFood[],
  overrides: PortionOverrides,
  saved: FoodItem[],
  profile: Profile,
  opts: { marks?: DayMarks; now?: Date; days?: number } = {},
): JudgedAverage {
  const now = opts.now ?? new Date();
  const from = addDaysToKey(dayKey(now), -((opts.days ?? 7) - 1));
  const days = dayIntakes(entries, { own, overrides, saved }, profile, { marks: opts.marks, now }).filter(
    (d) => d.day >= from && d.day <= dayKey(now),
  );
  return averageOfJudged(days);
}

/** True when the week has enough judged days for verdicts. */
export const weekReady = (judgedDays: number): boolean => judgedDays >= WEEK_DAYS_NEEDED;

/**
 * A week verdict for one nutrient needs 4+ judged days that count for it
 * (80%+ known that day), not just 4+ judged days: a week "Low" must never
 * rest on one day's figure.
 */
export const weekJudgedFor = (week: Pick<JudgedAverage, 'daysFor'>, key: NutrientKey): boolean =>
  weekReady(week.daysFor[key] ?? 0);

/** For "Log 2 more full days to see your week": 0 once ready. */
export const fullDaysNeeded = (judgedDays: number): number => Math.max(0, WEEK_DAYS_NEEDED - judgedDays);

/** "Log 2 more full days to see your week", or null when ready. */
export function weekWaitText(judgedDays: number): string | null {
  const n = fullDaysNeeded(judgedDays);
  if (!n) return null;
  return `Log ${n} more full ${n === 1 ? 'day' : 'days'} to see your week`;
}

// ── gap notes ────────────────────────────────────────────────────────────

/** Needed most days: judged on the last few days. */
export const DAY_KIND_KEYS: readonly NutrientKey[] = [
  'protein',
  'fiber',
  ...NUTRIENTS.filter((n) => n.storage === 'daily').map((n) => n.key),
];
/** Stored by the body: judged on two weeks. Vitamin E is left out: no EAR, and most of it hides in cooking oil. */
export const WEEK_KIND_KEYS: readonly NutrientKey[] = ['vitA', 'vitB12', 'calcium', 'iron', 'magnesium'];
/** Which note wins; the rest follow, lowest first. */
export const NOTE_RANK: readonly NutrientKey[] = ['vitB12', 'iron', 'calcium', 'protein', 'fiber', 'folate', 'vitA', 'vitC'];

/** The same nutrient isn't noted again within this many days. */
export const NOTE_COOLDOWN_DAYS = 14;
/** The 3rd note within this window adds the doctor line… */
export const NOTE_WINDOW_DAYS = 42;
/** …and then the nutrient is quiet this long. */
export const NOTE_QUIET_DAYS = 30;

/** kv nutritionNoteLog: nutrient → days a note about it was shown. */
export type NoteLog = Partial<Record<NutrientKey, string[]>>;

export interface GapNote {
  key: NutrientKey;
  /** day: low on 3 of the last 4 counted days; week: two low weeks in a row. */
  kind: 'day' | 'week';
  /** The average it rests on, as % of the daily need. */
  percent: number;
  /** The 3rd note in 6 weeks: adds the doctor line. */
  doctor: boolean;
}

/** The low line used for notes about this person. */
function noteLine(key: NutrientKey, profile: Profile, year: number): number | undefined {
  if (key === 'protein') return proteinTarget(profile).low;
  if (key === 'fiber') return fiberTarget(fullDayKcal(profile, year)).low;
  return lowLine(key, profile.sex, ageIn(profile, year));
}

function noteDaily(key: NutrientKey, profile: Profile, year: number): number | undefined {
  if (key === 'protein') return proteinTarget(profile).daily;
  if (key === 'fiber') return fiberTarget(fullDayKcal(profile, year)).daily;
  return NUTRIENT[key].daily;
}

/** Days a note may rest on: judged, with figures for 95%+ of the day's energy. */
const counted = (days: DayIntake[], key: NutrientKey) =>
  days.filter((d) => d.judged && d.total[key] !== undefined && (d.coverage[key] ?? 0) >= NOTE_COVERAGE);

const mean = (days: DayIntake[], key: NutrientKey) => days.reduce((a, d) => a + (d.total[key] ?? 0), 0) / days.length;

/** Why a nutrient can't be noted now: cooldown, or quiet after a doctor line. Returns the doctor flag otherwise. */
export function noteAllowed(log: NoteLog, key: NutrientKey, today: string): { ok: boolean; doctor: boolean } {
  const shown = (log[key] ?? []).filter((d) => d < today || d === today).sort();
  const ago = (d: string) => daysBetween(d, today);
  if (shown.some((d) => ago(d) < NOTE_COOLDOWN_DAYS)) return { ok: false, doctor: false };
  // A shown note was a 3rd-in-6-weeks one: quiet for 30 days after it.
  for (const d of shown) {
    const before = shown.filter((x) => x <= d && daysBetween(x, d) < NOTE_WINDOW_DAYS);
    if (before.length >= 3 && ago(d) < NOTE_QUIET_DAYS) return { ok: false, doctor: false };
  }
  const recent = shown.filter((d) => ago(d) < NOTE_WINDOW_DAYS);
  return { ok: true, doctor: recent.length >= 2 };
}

export interface GapInput {
  /** At least the last 14 days, any order; today may be in it (it never counts). */
  days: DayIntake[];
  today: string;
  profile: Profile;
  log: NoteLog;
}

/**
 * The one note worth making today, or null. Never for "My needs are
 * different" (or under 18), never about nutrients with gapNote: false, and
 * not about potassium for someone whose doctor limits their fluids.
 */
export function pickGapNote({ days, today, profile, log }: GapInput): GapNote | null {
  const year = Number(today.slice(0, 4));
  if (needsAreDifferent(profile, year)) return null;
  const past = (fromAgo: number, toAgo: number) =>
    days.filter((d) => {
      const ago = daysBetween(d.day, today);
      return ago >= fromAgo && ago <= toAgo;
    });
  const lastWeek = past(1, 7);
  const weekBefore = past(8, 14);

  const found: { note: GapNote; ratio: number }[] = [];
  const consider = (key: NutrientKey, kind: GapNote['kind'], value: number) => {
    const line = noteLine(key, profile, year);
    const daily = noteDaily(key, profile, year);
    if (!line || !daily) return;
    const allowed = noteAllowed(log, key, today);
    if (!allowed.ok) return;
    found.push({ note: { key, kind, percent: Math.round((value / daily) * 100), doctor: allowed.doctor }, ratio: value / line });
  };

  for (const key of [...DAY_KIND_KEYS, ...WEEK_KIND_KEYS]) {
    if (NUTRIENT[key].gapNote === false) continue;
    if (key === 'potassium' && profile.water.doctorLimit) continue;
    const line = noteLine(key, profile, year);
    if (line === undefined) continue;
    if (DAY_KIND_KEYS.includes(key)) {
      const recent = counted(lastWeek, key).sort((a, b) => (a.day < b.day ? 1 : -1));
      if (recent.length < WEEK_DAYS_NEEDED) continue;
      const last4 = recent.slice(0, 4);
      if (last4.filter((d) => (d.total[key] ?? 0) < line).length >= 3) consider(key, 'day', mean(last4, key));
    } else {
      const a = counted(lastWeek, key);
      const b = counted(weekBefore, key);
      if (a.length < WEEK_DAYS_NEEDED || b.length < WEEK_DAYS_NEEDED) continue;
      if (mean(a, key) < line && mean(b, key) < line) consider(key, 'week', mean(a, key));
    }
  }
  if (!found.length) return null;
  const rank = (k: NutrientKey) => {
    const i = NOTE_RANK.indexOf(k);
    return i < 0 ? NOTE_RANK.length : i;
  };
  found.sort((x, y) => rank(x.note.key) - rank(y.note.key) || x.ratio - y.ratio);
  return found[0].note;
}

/** Adds today's note to the log and drops days older than 6 weeks. */
export function logNote(log: NoteLog, key: NutrientKey, today: string): NoteLog {
  const out: NoteLog = {};
  for (const [k, list] of Object.entries(log) as [NutrientKey, string[]][]) {
    const kept = list.filter((d) => daysBetween(d, today) < NOTE_WINDOW_DAYS);
    if (kept.length) out[k] = kept;
  }
  out[key] = [...new Set([...(out[key] ?? []), today])].sort();
  return out;
}

/** Totals for one day's entries, for screens that need just one day. */
export function dayTotals(entries: FoodEntry[], book: FoodBook): { total: Nutrients; coverage: Partial<Record<NutrientKey, number>> } {
  const nutrients = entries.map((e) => entryNutrients(e, book.own, book.overrides, book.saved));
  return { total: sumNutrients(nutrients), coverage: coverageAll(nutrients) };
}

export { coverage };
