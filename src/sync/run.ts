/**
 * One full sync: read the platform, store rows, then do everything that
 * depends on fresh numbers (widget, nudges). Shared by the app and the
 * background task.
 */
import type { Profile, Repository, SourceId } from '@/data/types';
import { publishStepsIfOwnCounter } from '@/health/publish';
import type { StepSource } from '@/health/types';
import { achievementTitle } from '@/lib/achievements';
import { dayKey } from '@/lib/dates';
import { formatSteps } from '@/lib/format';
import { REMINDER_MIN_STEPS, shouldRemind } from '@/lib/reminders';
import { notifyNow } from '@/notifications/notify';
import { pushWidgetData } from '@/widget/update';
import { WIDGET_DATA_KEY } from '@/widget/widget-data';

import { backfill, DETAIL_DAYS, detailDaysToSync, fillGap, SOURCE_KEY, syncRecent, type SyncResult } from './engine';

const LAST_REMINDED_KEY = 'lastRemindedAt';
const GOAL_NOTIFIED_KEY = 'goalNotifiedFor';
export const LAST_SYNC_KEY = 'lastSyncAt';

let inFlight: { key: string; promise: Promise<SyncResult> } | null = null;

export function runSync(repo: Repository, profile: Profile, source: StepSource, now?: Date): Promise<SyncResult> {
  // Live step events and app focus can ask at once; they share one run. A
  // caller for another day (just after midnight), source or goal waits for it
  // and then gets a run of its own, so it never receives stale numbers.
  const key = `${source.id}|${dayKey(now ?? new Date())}|${profile.dailyGoal}`;
  if (inFlight?.key === key) return inFlight.promise;
  const before = inFlight?.promise.catch(() => undefined) ?? Promise.resolve();
  const run = {
    key,
    // Without a given time, the run reads up to when it actually starts.
    promise: before
      .then(() => doSync(repo, profile, source, now ?? new Date()))
      .finally(() => {
        if (inFlight === run) inFlight = null;
      }),
  };
  inFlight = run;
  return run.promise;
}

/** Resolves once no sync is running. */
export async function syncIdle(): Promise<void> {
  while (inFlight) await inFlight.promise.catch(() => undefined);
}

async function doSync(repo: Repository, profile: Profile, source: StepSource, now: Date): Promise<SyncResult> {
  // A run asked for before the person switched source must not write the old source's numbers.
  const current = await repo.getKv<SourceId>(SOURCE_KEY);
  if (current && current !== source.id) throw new Error(`Step source is now ${current}, not ${source.id}`);
  const lastSyncAt = await repo.getKv<number>(LAST_SYNC_KEY);
  const backfilled = await backfill(repo, source, profile, now);
  if (!backfilled && lastSyncAt) await fillGap(repo, source, profile, lastSyncAt, now);
  const days = backfilled ? DETAIL_DAYS : detailDaysToSync(lastSyncAt, now);
  const result = await syncRecent(repo, source, profile, now, days);
  await repo.setKv(LAST_SYNC_KEY, now.getTime());

  // Side effects must never fail the sync itself.
  await Promise.allSettled([
    updateWidget(repo, result, now),
    nudge(repo, profile, result, now),
    celebrate(repo, result),
    publishStepsIfOwnCounter(repo, source, now),
  ]);
  return result;
}

async function updateWidget(repo: Repository, { today }: SyncResult, now: Date) {
  const data = { date: today.date, steps: today.steps, goal: today.goal, updatedAt: now.getTime() };
  await repo.setKv(WIDGET_DATA_KEY, data);
  await pushWidgetData(data);
}

async function nudge(repo: Repository, profile: Profile, { today, stepsLastWindow }: SyncResult, now: Date) {
  const lastRemindedAt = await repo.getKv<number>(LAST_REMINDED_KEY);
  const remind = shouldRemind({
    now,
    stepsLastWindow,
    settings: profile.reminders,
    lastRemindedAt,
    goalMetToday: timedSteps(today) >= today.goal,
  });
  if (!remind) return;
  await repo.setKv(LAST_REMINDED_KEY, now.getTime());
  const left = Math.max(0, today.goal - today.steps);
  await notifyNow(
    'Time for a short walk',
    `Under ${REMINDER_MIN_STEPS} steps in the last hour. ${formatSteps(left)} to go for today's goal.`,
  );
}

/**
 * Steps known to have been taken today. A "Goal reached" alert or a skipped
 * reminder shouldn't rest on steps whose time isn't known.
 */
const timedSteps = (day: SyncResult['today']) => day.steps - day.untimedSteps;

async function celebrate(repo: Repository, { today, achievements }: SyncResult) {
  if (timedSteps(today) >= today.goal && (await repo.getKv<string>(GOAL_NOTIFIED_KEY)) !== today.date) {
    await repo.setKv(GOAL_NOTIFIED_KEY, today.date);
    await notifyNow('Goal reached', `${formatSteps(today.steps)} steps today. Nice work.`);
  }
  for (const a of achievements) {
    await notifyNow('New badge', achievementTitle(a.kind, a.value));
  }
}
