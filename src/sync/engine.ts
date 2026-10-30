/**
 * The only code that reads health platforms. It turns each day's minute
 * buckets into a DaySummary row; screens, widgets and reminders read rows.
 */
import { profileStride } from '@/data/profile';
import type { DaySummary, Profile, Repository } from '@/data/types';
import type { StepSource } from '@/health/types';
import { type Achievement, newAchievements } from '@/lib/achievements';
import { addDays, addDaysToKey, dayKey, daysBetween, startOfDay } from '@/lib/dates';
import { estimateKcalFromSteps, summarizeBuckets } from '@/lib/metrics';
import { REMINDER_WINDOW_MIN } from '@/lib/reminders';
import { computeStreaks } from '@/lib/streaks';

/** Days re-read at minute detail on every sync (matches CMPedometer's 7-day memory). */
export const DETAIL_DAYS = 7;
export const BACKFILL_DAYS = 365;

const BACKFILL_KEY = 'backfilledAt';

export interface SyncResult {
  today: DaySummary;
  stepsLastWindow: number;
  achievements: Achievement[];
}

async function syncDay(
  repo: Repository,
  source: StepSource,
  profile: Profile,
  day: Date,
  now: Date,
): Promise<{ summary: DaySummary; buckets: { start: number; steps: number }[] }> {
  const start = startOfDay(day);
  const end = new Date(Math.min(addDays(start, 1).getTime(), now.getTime()));
  const key = dayKey(start);
  const isToday = key === dayKey(now);

  const [buckets, platformDistance, floors, existing] = await Promise.all([
    source.getStepBuckets(start, end, 1),
    source.getDistanceM(start, end),
    source.getFloors(start, end),
    repo.getDay(key),
  ]);
  const metrics = summarizeBuckets(buckets, { weightKg: profile.weightKg, strideM: profileStride(profile) });

  const summary: DaySummary = {
    date: key,
    steps: metrics.steps,
    distanceM: platformDistance && platformDistance > 0 ? Math.round(platformDistance) : metrics.distanceM,
    activeKcal: metrics.activeKcal,
    activeMin: metrics.activeMin,
    floors,
    // A past day keeps the goal it had; today follows the current goal.
    goal: isToday ? profile.dailyGoal : (existing?.goal ?? profile.dailyGoal),
    source: source.id,
    updatedAt: now.getTime(),
  };
  await repo.upsertDay(summary, metrics.hourly);
  return { summary, buckets };
}

/**
 * How many recent days (today included) to re-read at minute detail: every
 * day since the last sync, at least today and yesterday, at most DETAIL_DAYS.
 */
export function detailDaysToSync(lastSyncAt: number | null, now: Date): number {
  if (!lastSyncAt) return DETAIL_DAYS;
  const since = daysBetween(dayKey(new Date(lastSyncAt)), dayKey(now));
  return Math.min(DETAIL_DAYS, Math.max(2, since + 1));
}

/** Fills history with daily totals; minute detail comes from syncRecent. Runs once per install or source. */
export async function backfill(repo: Repository, source: StepSource, profile: Profile, now = new Date()) {
  if (await repo.getKv<number>(BACKFILL_KEY)) return false;
  const today = dayKey(now);
  await fillDailyTotals(repo, source, profile, addDaysToKey(today, -(BACKFILL_DAYS - 1)), addDaysToKey(today, -DETAIL_DAYS), now);
  await repo.setKv(BACKFILL_KEY, now.getTime());
  return true;
}

/** Days the app missed because it wasn't opened (and background sync didn't run) for over a week. */
export async function fillGap(repo: Repository, source: StepSource, profile: Profile, lastSyncAt: number, now = new Date()) {
  const from = dayKey(new Date(lastSyncAt));
  const to = addDaysToKey(dayKey(now), -DETAIL_DAYS);
  if (from <= to) await fillDailyTotals(repo, source, profile, from, to, now);
}

async function fillDailyTotals(repo: Repository, source: StepSource, profile: Profile, from: string, to: string, now: Date) {
  const totals = await source.getDailyTotals(from, to);
  const stride = profileStride(profile);

  for (const t of totals) {
    if (t.steps <= 0) continue;
    const existing = await repo.getDay(t.date);
    await repo.upsertDay({
      date: t.date,
      steps: t.steps,
      distanceM: Math.round(t.distanceM && t.distanceM > 0 ? t.distanceM : t.steps * stride),
      activeKcal: estimateKcalFromSteps(t.steps, profile.weightKg),
      activeMin: null,
      floors: t.floors,
      goal: existing?.goal ?? profile.dailyGoal,
      source: source.id,
      updatedAt: now.getTime(),
    });
  }
}

export async function resetBackfill(repo: Repository) {
  await repo.setKv(BACKFILL_KEY, 0);
}

/**
 * Re-reads the last `days` days (today included) and updates streak badges.
 * Called on app open, from live step events, and from the background task.
 */
export async function syncRecent(
  repo: Repository,
  source: StepSource,
  profile: Profile,
  now = new Date(),
  days = 2,
): Promise<SyncResult> {
  let today: DaySummary | null = null;
  let stepsLastWindow = 0;
  const windowStart = now.getTime() - REMINDER_WINDOW_MIN * 60_000;

  for (let i = days - 1; i >= 0; i--) {
    const { summary, buckets } = await syncDay(repo, source, profile, addDays(startOfDay(now), -i), now);
    if (i === 0) {
      today = summary;
      stepsLastWindow = buckets.filter((b) => b.start >= windowStart).reduce((sum, b) => sum + b.steps, 0);
    }
  }

  const achievements = await awardAchievements(repo, now);
  return { today: today!, stepsLastWindow, achievements };
}

async function awardAchievements(repo: Repository, now: Date): Promise<Achievement[]> {
  const today = dayKey(now);
  const [rows, lifetimeSteps, earned] = await Promise.all([
    repo.getDays(addDaysToKey(today, -BACKFILL_DAYS * 3), today),
    repo.lifetimeSteps(),
    repo.getAchievements(),
  ]);
  const { best } = computeStreaks(rows, today);
  const fresh = newAchievements({ bestStreak: best, lifetimeSteps }, new Set(earned.map((a) => a.id)), now.getTime());
  if (fresh.length) await repo.addAchievements(fresh);
  return fresh;
}
