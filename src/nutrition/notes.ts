/**
 * What the nutrition screens and notifications keep on the phone: days marked
 * "That's all for today" or "Fasting today", today's gap note (worked out once
 * a day, so the card never changes between renders), the note history behind
 * the cooldowns, "Not for me" foods, and when the push and the weekly summary
 * last went out.
 */
import type { FoodEntry, Profile, Repository } from '@/data/types';
import { addDays, addDaysToKey, dayKey, daysBetween, startOfDay } from '@/lib/dates';

import type { PortionOverrides } from './catalog';
import { loggedFoodIds, NOT_FOR_ME_KEY, type SourceOptions } from './diet';
import { averageOfJudged, type DayIntake, dayIntakes, type DayMark, type DayMarks, type FoodBook, type GapNote, logNote, type NoteLog, NOTE_COOLDOWN_DAYS, NOTE_WINDOW_DAYS, pickGapNote, weekReady } from './gaps';
import { NUTRIENTS } from './nutrients';
import { gapNoteText, PRIVATE_TITLE, weeklySummaryText, type WeekFacts } from './note-text';
import { nutrientState } from './state';
import { ageIn, energySplit, needsAreDifferent, splitVerdict } from './targets';

export const DAY_MARKS_KEY = 'dayComplete';
export const NOTE_KEY = 'nutritionNote';
export const NOTE_LOG_KEY = 'nutritionNoteLog';
export const PUSHES_KEY = 'nutritionPushes';
export const WEEKLY_KEY = 'weeklySummaryFor';
/** "Today | This week" on the Food tab. */
export const TAB_KEY = 'nutritionTab';
/** Same key as state/use-food-book.ts. */
const PORTIONS_KEY = 'portionOverrides';

// ── day marks ────────────────────────────────────────────────────────────

export async function readDayMarks(repo: Pick<Repository, 'getKv'>): Promise<DayMarks> {
  return (await repo.getKv<DayMarks>(DAY_MARKS_KEY)) ?? {};
}

/** Marks (or with null unmarks) a day; marks older than 6 weeks are dropped. */
export async function markDay(repo: Pick<Repository, 'getKv' | 'setKv'>, day: string, mark: DayMark | null, now = new Date()): Promise<DayMarks> {
  const today = dayKey(now);
  const marks = await readDayMarks(repo);
  const next: DayMarks = {};
  for (const [d, m] of Object.entries(marks)) if (daysBetween(d, today) < NOTE_WINDOW_DAYS) next[d] = m;
  if (mark) next[day] = mark;
  else delete next[day];
  await repo.setKv(DAY_MARKS_KEY, next);
  return next;
}

// ── inputs ───────────────────────────────────────────────────────────────

export async function loadFoodBook(repo: Repository): Promise<FoodBook> {
  const [own, saved, overrides] = await Promise.all([repo.getOwnFoods(), repo.getSavedFoods(), repo.getKv<PortionOverrides>(PORTIONS_KEY)]);
  return { own, saved, overrides: overrides ?? {} };
}

export interface NutritionWindow {
  entries: FoodEntry[];
  book: FoodBook;
  marks: DayMarks;
  /** Every day with food in the last `days` days, oldest first. */
  days: DayIntake[];
  notForMe: string[];
}

/** The last `days` days (today included) of food, worked out once for every nutrition rule. */
export async function loadNutritionWindow(repo: Repository, profile: Profile, now: Date, days = 31): Promise<NutritionWindow> {
  const from = addDays(startOfDay(now), -(days - 1)).getTime();
  const [entries, book, marks, notForMe] = await Promise.all([
    repo.getFoods(from, now.getTime() + 1),
    loadFoodBook(repo),
    readDayMarks(repo),
    repo.getKv<string[]>(NOT_FOR_ME_KEY),
  ]);
  return { entries, book, marks, days: dayIntakes(entries, book, profile, { marks, now }), notForMe: notForMe ?? [] };
}

/** Source options from what the person logged: last 14 days first, beef only after 30 days of it. */
export function sourceOptions(w: Pick<NutritionWindow, 'entries' | 'notForMe' | 'book'>, now: Date): SourceOptions {
  const day = 86_400_000;
  return {
    logged: loggedFoodIds(w.entries, startOfDay(now).getTime() - 13 * day),
    logged30: loggedFoodIds(w.entries, startOfDay(now).getTime() - 29 * day),
    notForMe: w.notForMe,
    overrides: w.book.overrides,
  };
}

// ── "Not for me" ─────────────────────────────────────────────────────────

export async function setNotForMe(repo: Pick<Repository, 'getKv' | 'setKv'>, foodId: string, notForMe: boolean): Promise<string[]> {
  const list = (await repo.getKv<string[]>(NOT_FOR_ME_KEY)) ?? [];
  const next = notForMe ? [...new Set([...list, foodId])] : list.filter((id) => id !== foodId);
  await repo.setKv(NOT_FOR_ME_KEY, next);
  return next;
}

// ── today's gap note ─────────────────────────────────────────────────────

export interface CachedNote {
  day: string;
  note: GapNote | null;
  /** "Got it". */
  dismissed: boolean;
}

/**
 * Today's note: worked out on the first call of the day and kept, so there is
 * at most one a day and it never changes. A note is logged (for cooldowns)
 * when it's first worked out.
 */
export async function todayGapNote(repo: Repository, profile: Profile, now = new Date(), window?: NutritionWindow): Promise<CachedNote> {
  const today = dayKey(now);
  const cached = await repo.getKv<CachedNote>(NOTE_KEY);
  if (cached?.day === today) return cached;
  const w = window ?? (await loadNutritionWindow(repo, profile, now, 15));
  const log = (await repo.getKv<NoteLog>(NOTE_LOG_KEY)) ?? {};
  const note = pickGapNote({ days: w.days, today, profile, log });
  const next: CachedNote = { day: today, note, dismissed: false };
  await repo.setKv(NOTE_KEY, next);
  if (note) await repo.setKv(NOTE_LOG_KEY, logNote(log, note.key, today));
  return next;
}

export async function dismissGapNote(repo: Pick<Repository, 'getKv' | 'setKv'>, now = new Date()): Promise<void> {
  const cached = await repo.getKv<CachedNote>(NOTE_KEY);
  if (cached?.day === dayKey(now)) await repo.setKv(NOTE_KEY, { ...cached, dismissed: true });
}

// ── nutrition push ───────────────────────────────────────────────────────

/** The push goes out between 18:00 and 19:30: clear of the hourly step nudges' end and the 20:00 mood check-in. */
export const PUSH_FROM = { h: 18, m: 0 };
export const PUSH_UNTIL = { h: 19, m: 30 };
export const PUSHES_PER_WEEK = 2;

/** kv nutritionPushes: what was pushed, newest last. */
export type PushLog = { day: string; key: GapNote['key'] }[];

/** Inside 18:00–19:30. */
export function inPushWindow(now: Date): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= PUSH_FROM.h * 60 + PUSH_FROM.m && minutes < PUSH_UNTIL.h * 60 + PUSH_UNTIL.m;
}

export function nutritionPushDue(input: { now: Date; tips: boolean; cached: CachedNote | null; pushes: PushLog }): boolean {
  const { now, tips, cached, pushes } = input;
  const today = dayKey(now);
  if (!tips || !cached || cached.day !== today || !cached.note || cached.dismissed) return false;
  if (!inPushWindow(now)) return false;
  const ago = (d: string) => daysBetween(d, today);
  if (pushes.some((p) => p.day === today)) return false;
  if (pushes.filter((p) => ago(p.day) < 7).length >= PUSHES_PER_WEEK) return false;
  if (pushes.some((p) => p.key === cached.note!.key && ago(p.day) < NOTE_COOLDOWN_DAYS)) return false;
  return true;
}

// ── weekly summary ───────────────────────────────────────────────────────

/** Sundays from 18:00 to 21:00. */
export const WEEKLY_FROM_HOUR = 18;
export const WEEKLY_UNTIL_HOUR = 21;

/** Sunday, 18:00–21:00. */
export function inWeeklyWindow(now: Date): boolean {
  return now.getDay() === 0 && now.getHours() >= WEEKLY_FROM_HOUR && now.getHours() < WEEKLY_UNTIL_HOUR;
}

export function weeklySummaryDue(input: { now: Date; weekly: boolean; judgedDays: number; sentFor: string | null }): boolean {
  const { now } = input;
  if (!input.weekly || !inWeeklyWindow(now)) return false;
  if (input.sentFor === dayKey(now)) return false;
  return weekReady(input.judgedDays);
}

/** The week's facts from the last 7 days of food (today counted once judged) and the water days met. */
export function weekFacts(days: DayIntake[], profile: Profile, now: Date, waterMetDays: number | null): WeekFacts {
  const from = addDaysToKey(dayKey(now), -6);
  const week = averageOfJudged(days.filter((d) => d.day >= from && d.day <= dayKey(now)));
  const year = now.getFullYear();
  const plain = needsAreDifferent(profile, year);
  let onTrack: WeekFacts['onTrack'] = null;
  if (!plain) {
    let ok = 0;
    let known = 0;
    for (const n of NUTRIENTS) {
      if ((n.group !== 'vitamin' && n.group !== 'mineral') || n.key === 'vitD') continue;
      const s = nutrientState(n.key, week.average[n.key], {
        coverage: week.coverage[n.key] ?? 0,
        judged: weekReady(week.judgedDays),
        sex: profile.sex,
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        age: ageIn(profile, year),
      });
      if (s.state === 'unknown') continue;
      known++;
      if (s.state === 'ok') ok++;
    }
    onTrack = { ok, known };
  }
  const split = energySplit(week.average, week.coverage);
  return { judgedDays: week.judgedDays, waterMetDays, onTrack, split: split ? splitVerdict(split) : null };
}

// ── sending ──────────────────────────────────────────────────────────────

type Post = (title: string, body: string) => Promise<void>;

/** Posts today's note when it's due; true when it did. Food must be unlocked (the caller checks). */
export async function pushNutritionNote(repo: Repository, profile: Profile, now: Date, post: Post): Promise<boolean> {
  // Cheap checks first: this runs after every sync, on budget phones too.
  if (!profile.nutrition.tips || !inPushWindow(now) || needsAreDifferent(profile, now.getFullYear())) return false;
  const window = await loadNutritionWindow(repo, profile, now, 31);
  const cached = await todayGapNote(repo, profile, now, window);
  const pushes = (await repo.getKv<PushLog>(PUSHES_KEY)) ?? [];
  if (!nutritionPushDue({ now, tips: profile.nutrition.tips, cached, pushes }) || !cached.note) return false;
  const text = gapNoteText(cached.note, profile.nutrition.diet, sourceOptions(window, now));
  await post(PRIVATE_TITLE.nutrition, text.body);
  const today = dayKey(now);
  const kept = pushes.filter((p) => daysBetween(p.day, today) < NOTE_WINDOW_DAYS);
  await repo.setKv(PUSHES_KEY, [...kept, { day: today, key: cached.note.key }]);
  return true;
}

/** Posts the Sunday summary when due; true when it did. */
export async function pushWeeklySummary(
  repo: Repository,
  profile: Profile,
  now: Date,
  waterMetDays: number | null,
  post: Post,
): Promise<boolean> {
  if (!profile.nutrition.weekly || !inWeeklyWindow(now)) return false;
  if ((await repo.getKv<string>(WEEKLY_KEY)) === dayKey(now)) return false;
  const window = await loadNutritionWindow(repo, profile, now, 7);
  const facts = weekFacts(window.days, profile, now, waterMetDays);
  const sentFor = await repo.getKv<string>(WEEKLY_KEY);
  if (!weeklySummaryDue({ now, weekly: profile.nutrition.weekly, judgedDays: facts.judgedDays, sentFor })) return false;
  const text = weeklySummaryText(facts);
  await post(text.title, text.body);
  await repo.setKv(WEEKLY_KEY, dayKey(now));
  return true;
}
