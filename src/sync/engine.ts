/**
 * The only code that reads health platforms. It turns each day's minute
 * buckets into a DaySummary row; screens, widgets and reminders read rows.
 */
import { profileStride } from '@/data/profile';
import type { DaySummary, Profile, Repository, SourceId } from '@/data/types';
import type { StepSource } from '@/health/types';
import { type Achievement, newAchievements } from '@/lib/achievements';
import { addDays, addDaysToKey, dayKey, daysBetween, startOfDay } from '@/lib/dates';
import { estimateKcalFromSteps, summarizeBuckets } from '@/lib/metrics';
import { REMINDER_WINDOW_MIN } from '@/lib/reminders';
import { computeStreaks } from '@/lib/streaks';

/** Days re-read at minute detail on every sync (matches CMPedometer's 7-day memory). */
export const DETAIL_DAYS = 7;
export const BACKFILL_DAYS = 365;
/** Health Connect without "past data" access only reads 30 days back. */
const SHORT_BACKFILL_DAYS = 30;

/** Which source the app reads steps from. */
export const SOURCE_KEY = 'sourceId';
/** { source, at } of the last history fill; another source's fill doesn't count. */
const BACKFILL_KEY = 'backfilledAt';

export interface SyncResult {
  today: DaySummary;
  /**
   * What the source has counted today up to (epoch ms): the end of its last
   * minute with steps, or the start of the day. Live steps after it aren't in `today` yet.
   */
  coveredUntil: number;
  stepsLastWindow: number;
  achievements: Achievement[];
}

async function syncDay(
  repo: Repository,
  source: StepSource,
  profile: Profile,
  day: Date,
  now: Date,
): Promise<{ summary: DaySummary; buckets: { start: number; steps: number }[]; coveredUntil: number }> {
  const start = startOfDay(day);
  const end = new Date(Math.min(addDays(start, 1).getTime(), now.getTime()));
  const key = dayKey(start);
  const isToday = key === dayKey(now);

  const [buckets, untimed, lastRecordAt, platformDistance, floors, existing] = await Promise.all([
    source.getStepBuckets(start, end, 1),
    source.getUntimedSteps?.(start, end) ?? 0,
    source.lastRecordedAt?.(start, end) ?? null,
    source.getDistanceM(start, end),
    source.getFloors(start, end),
    repo.getDay(key),
  ]);
  const metrics = summarizeBuckets(buckets, { weightKg: profile.weightKg, strideM: profileStride(profile) }, untimed);
  const coveredUntil = Math.min(Math.max(metrics.lastStepAt ?? start.getTime(), lastRecordAt ?? 0), end.getTime());
  const distanceM = plausibleDistance(platformDistance, metrics.distanceM);

  // A source that has nothing for a day (it only started recording since, say)
  // doesn't wipe out what another source counted for it.
  if (metrics.steps === 0 && existing && existing.steps > 0 && existing.source !== source.id) {
    return { summary: existing, buckets, coveredUntil };
  }

  const summary: DaySummary = {
    date: key,
    steps: metrics.steps,
    untimedSteps: metrics.untimedSteps,
    distanceM,
    activeKcal: metrics.activeKcal,
    activeMin: metrics.activeMin,
    walkMin: metrics.walkMin,
    briskMin: metrics.briskMin,
    runMin: metrics.runMin,
    floors,
    // A past day keeps the goal it had; today follows the current goal.
    goal: isToday ? profile.dailyGoal : (existing?.goal ?? profile.dailyGoal),
    source: source.id,
    updatedAt: now.getTime(),
  };
  await repo.upsertDay(summary, metrics.hourly);
  return { summary, buckets, coveredUntil };
}

/**
 * A platform's distance, used only when it plausibly covers the same steps
 * (not one tracked exercise, or a bike ride from another app); otherwise
 * steps × stride.
 */
function plausibleDistance(platform: number | null, fromSteps: number): number {
  const ratio = platform && fromSteps > 0 ? platform / fromSteps : 0;
  return ratio > 0.6 && ratio < 1.5 ? Math.round(platform!) : fromSteps;
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

interface BackfillMark {
  source: SourceId;
  at: number;
}

/**
 * Fills history with daily totals; minute detail comes from syncRecent. Runs
 * once per install and source: a fill another source made (one still running
 * while the person switched, say) doesn't count for this one.
 */
export async function backfill(repo: Repository, source: StepSource, profile: Profile, now = new Date()) {
  const mark = await repo.getKv<BackfillMark | number>(BACKFILL_KEY);
  // Installs from before the mark named its source stored just a time.
  if (mark && (typeof mark === 'number' || mark.source === source.id)) return false;
  const today = dayKey(now);
  const to = addDaysToKey(today, -DETAIL_DAYS);
  try {
    await fillDailyTotals(repo, source, profile, addDaysToKey(today, -(BACKFILL_DAYS - 1)), to, now);
  } catch {
    // Without "past data" access Health Connect refuses the long read; a month back still works.
    await fillDailyTotals(repo, source, profile, addDaysToKey(today, -(SHORT_BACKFILL_DAYS - 1)), to, now).catch(
      () => undefined,
    );
  }
  await repo.setKv<BackfillMark>(BACKFILL_KEY, { source: source.id, at: now.getTime() });
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
    // A total only: clear the day's hourly bars too, so they can't disagree with it.
    await repo.upsertDay(
      {
        date: t.date,
        steps: t.steps,
        untimedSteps: 0,
        distanceM: plausibleDistance(t.distanceM, Math.round(t.steps * stride)),
        activeKcal: estimateKcalFromSteps(t.steps, profile.weightKg),
        activeMin: null,
        walkMin: null,
        briskMin: null,
        runMin: null,
        floors: t.floors,
        goal: existing?.goal ?? profile.dailyGoal,
        source: source.id,
        updatedAt: now.getTime(),
      },
      new Array<number>(24).fill(0),
    );
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
  let coveredUntil = startOfDay(now).getTime();
  let stepsLastWindow = 0;
  const windowStart = now.getTime() - REMINDER_WINDOW_MIN * 60_000;
  for (let i = days - 1; i >= 0; i--) {
    const day = await syncDay(repo, source, profile, addDays(startOfDay(now), -i), now);
    if (i === 0) {
      today = day.summary;
      coveredUntil = day.coveredUntil;
      stepsLastWindow = day.buckets.filter((b) => b.start >= windowStart).reduce((sum, b) => sum + b.steps, 0);
    }
  }

  const achievements = await awardAchievements(repo, now);
  return { today: today!, coveredUntil, stepsLastWindow, achievements };
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
