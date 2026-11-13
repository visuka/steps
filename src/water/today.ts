/**
 * Water on the phone: today's target and progress for the Today card, the
 * last 7 days for the Water screen and the Week tab, and the reminder that
 * the sync sends when someone is well behind.
 */
import type { FoodEntry, LogEntry, Profile, Repository } from '@/data/types';
import { addDays, addDaysToKey, dayKey, parseDayKey, startOfDay } from '@/lib/dates';
import { loadFoodBook } from '@/nutrition/notes';
import { waterReminderLine } from '@/nutrition/note-text';
import { needsAreDifferent } from '@/nutrition/targets';

import {
  drinkMl,
  drinkTimes,
  formatLitres,
  noteReminderSent,
  rollLog,
  settleLog,
  stickyTarget,
  type WaterProgress,
  waterProgress,
  waterProgressText,
  waterReminderDue,
  type WaterReminderLog,
  type WaterTarget,
  waterTarget,
} from './water';

export const WATER_REMINDERS_KEY = 'waterReminders';
/** The one-time "Set your target" row on the Today card was closed with "Not now". */
export const WATER_SETUP_DISMISSED_KEY = 'waterSetupDismissed';
/** Water logs read for any water view (no range query on the repository). */
const LOGS_READ = 400;

/** The weight is the person's own: typed in, or any weight logged. */
export async function weightKnown(repo: Pick<Repository, 'getLogs'>, profile: Pick<Profile, 'weightSet'>): Promise<boolean> {
  if (profile.weightSet) return true;
  return (await repo.getLogs('weight', 1)).length > 0;
}

export interface WaterToday {
  /** Null: no target to show (numbers only, or a doctor's limit not entered yet). */
  target: WaterTarget | null;
  waterMl: number;
  drinksMl: number;
  progress: WaterProgress | null;
  /** "1.25 of 2.25 L", "1.2 of 1.5 L limit"; just the amount without a target. */
  progressText: string;
  /** Sticky for the day; never with a doctor's limit. */
  reached: boolean;
  glassMl: number;
  /** A reminder went out today: offer "No more reminders today". */
  remindedToday: boolean;
  snoozed: boolean;
  /** Reminders are paused after 3 quiet days; the next drink starts them again. */
  paused: boolean;
  /** For "Set your target": suggestion basis wording needs it. */
  weightKnown: boolean;
  /** Last water or drink, any of the last few days. */
  lastDrinkAt: number | null;
}

interface DayInputs {
  logs: LogEntry[];
  foods: FoodEntry[];
  drinks: number;
  drinkAt: number[];
  tempMaxC: number | null;
  steps: number | null;
}

async function readDay(repo: Repository, now: Date, steps?: number | null): Promise<DayInputs> {
  const start = startOfDay(now).getTime();
  const [logs, foods, book, weather, day] = await Promise.all([
    repo.getLogs('water', LOGS_READ),
    repo.getFoods(addDays(startOfDay(now), -3).getTime(), now.getTime() + 1),
    loadFoodBook(repo),
    repo.getWeather(dayKey(now)),
    steps === undefined ? repo.getDay(dayKey(now)) : Promise.resolve(null),
  ]);
  const todayFoods = foods.filter((f) => f.loggedAt >= start);
  return {
    logs,
    foods,
    drinks: drinkMl(todayFoods, book.own, book.overrides, book.saved),
    drinkAt: [...drinkTimes(foods, book.own, book.saved), ...logs.map((l) => l.loggedAt)],
    tempMaxC: weather?.tempMaxC ?? null,
    steps: steps ?? day?.steps ?? null,
  };
}

async function readLog(repo: Pick<Repository, 'getKv'>, today: string): Promise<WaterReminderLog> {
  return rollLog(await repo.getKv<WaterReminderLog>(WATER_REMINDERS_KEY), today);
}

/**
 * Everything the Today water card shows. `steps`: today's steps on screen
 * (displaySteps); left out, the synced row is read. Saves "reached" so it sticks.
 */
export async function loadWaterToday(repo: Repository, profile: Profile, now = new Date(), steps?: number | null): Promise<WaterToday> {
  const today = dayKey(now);
  const [d, known, stored] = await Promise.all([readDay(repo, now, steps), weightKnown(repo, profile), readLog(repo, today)]);
  const waterMl = d.logs.reduce((a, l) => (dayKey(new Date(l.loggedAt)) === today ? a + l.value : a), 0);
  const total = waterMl + d.drinks;
  const numbersOnly = needsAreDifferent(profile, now.getFullYear());
  const computed = waterTarget(profile, { tempMaxC: d.tempMaxC, steps: d.steps, weightKnown: known, numbersOnly });
  let log = settleLog(stored, d.drinkAt, now.getTime(), today);
  let target = computed;
  let reached = false;
  if (computed) {
    const sticky = stickyTarget(computed, total, log);
    target = sticky.target;
    reached = sticky.reached;
    log = sticky.log;
  }
  await repo.setKv(WATER_REMINDERS_KEY, log);
  return {
    target,
    waterMl,
    drinksMl: d.drinks,
    progress: target ? waterProgress(waterMl, d.drinks, target.ml, profile.water.glassMl) : null,
    progressText: target ? waterProgressText(total, target, profile.units) : formatLitres(total, profile.units),
    reached,
    glassMl: profile.water.glassMl,
    remindedToday: log.sent.length > 0,
    snoozed: log.snoozed,
    paused: log.pausedSince !== null,
    weightKnown: known,
    lastDrinkAt: d.drinkAt.length ? Math.max(...d.drinkAt) : null,
  };
}

/** "No more reminders today". */
export async function snoozeWaterToday(repo: Pick<Repository, 'getKv' | 'setKv'>, now = new Date()): Promise<void> {
  const log = await readLog(repo, dayKey(now));
  await repo.setKv(WATER_REMINDERS_KEY, { ...log, snoozed: true });
}

export interface WaterDay {
  day: string;
  waterMl: number;
  drinksMl: number;
  totalMl: number;
  /** That day's target with its own weather and steps; null without one. */
  targetMl: number | null;
  met: boolean;
}

/** The last `days` days, oldest first, for the Water screen's chart and "met on 4 of 7 days". */
export async function waterWeek(repo: Repository, profile: Profile, now = new Date(), days = 7): Promise<{ days: WaterDay[]; metDays: number }> {
  const today = dayKey(now);
  const from = addDaysToKey(today, -(days - 1));
  const [logs, foods, book, weather, steps, known, log] = await Promise.all([
    repo.getLogs('water', LOGS_READ),
    repo.getFoods(parseDayKey(from).getTime(), now.getTime() + 1),
    loadFoodBook(repo),
    repo.getWeatherRange(from, today),
    repo.getDays(from, today),
    weightKnown(repo, profile),
    readLog(repo, today),
  ]);
  const numbersOnly = needsAreDifferent(profile, now.getFullYear());
  const out: WaterDay[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDaysToKey(from, i);
    const dayFoods = foods.filter((f) => dayKey(new Date(f.loggedAt)) === day);
    const waterMl = logs.reduce((a, l) => (dayKey(new Date(l.loggedAt)) === day ? a + l.value : a), 0);
    const drinksMl = drinkMl(dayFoods, book.own, book.overrides, book.saved);
    const t =
      day === today && log.reached
        ? log.reached
        : waterTarget(profile, {
            tempMaxC: weather.find((w) => w.date === day)?.tempMaxC ?? null,
            steps: steps.find((s) => s.date === day)?.steps ?? null,
            weightKnown: known,
            numbersOnly,
          });
    const totalMl = waterMl + drinksMl;
    out.push({ day, waterMl, drinksMl, totalMl, targetMl: t?.ml ?? null, met: Boolean(t && !t.limit && totalMl >= t.ml) });
  }
  return { days: out, metDays: out.filter((d) => d.met).length };
}

type Post = (title: string, body: string) => Promise<void>;

/**
 * Sends a water reminder when one is due (or, once, "reminders paused");
 * true when it posted. Water must be unlocked and the budget free (the caller checks).
 */
export async function remindWater(repo: Repository, profile: Profile, now: Date, steps: number | null, post: Post): Promise<boolean> {
  const w = profile.water;
  // Cheap checks first: this runs after every sync.
  if (!w.remind || w.doctorLimit || w.targetMl === null) return false;
  if (now.getHours() < w.fromHour + 1 || now.getHours() >= w.untilHour) return false;
  const status = await loadWaterToday(repo, profile, now, steps);
  // loadWaterToday saved the settled log.
  let log = await readLog(repo, dayKey(now));
  if (log.pausedSince !== null) {
    if (log.pauseTold) return false;
    await post('Water reminders paused', 'Nothing logged for a few days. They start again when you log a glass.');
    await repo.setKv(WATER_REMINDERS_KEY, { ...log, pauseTold: true });
    return true;
  }
  const due = waterReminderDue({
    now,
    settings: w,
    targetMl: status.target?.ml ?? null,
    drunkMl: status.waterMl + status.drinksMl,
    reached: status.reached,
    lastDrinkAt: status.lastDrinkAt,
    log,
    numbersOnly: needsAreDifferent(profile, now.getFullYear()),
  });
  if (!due || !status.target) return false;
  await post('Water', waterReminderLine(status.progressText));
  log = noteReminderSent(log, now.getTime());
  await repo.setKv(WATER_REMINDERS_KEY, log);
  return true;
}
