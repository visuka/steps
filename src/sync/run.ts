/**
 * One full sync: read the platform, store rows, then do everything that
 * depends on fresh numbers (widget, nudges). Shared by the app and the
 * background task.
 */
import type { Profile, Repository } from '@/data/types';
import { publishStepsIfOwnCounter } from '@/health/publish';
import type { StepSource } from '@/health/types';
import { achievementTitle } from '@/lib/achievements';
import { formatSteps } from '@/lib/format';
import { REMINDER_MIN_STEPS, shouldRemind } from '@/lib/reminders';
import { notifyNow } from '@/notifications/notify';
import { pushWidgetData } from '@/widget/update';
import { WIDGET_DATA_KEY } from '@/widget/widget-data';

import { backfill, DETAIL_DAYS, detailDaysToSync, fillGap, syncRecent, type SyncResult } from './engine';

const LAST_REMINDED_KEY = 'lastRemindedAt';
const GOAL_NOTIFIED_KEY = 'goalNotifiedFor';
export const LAST_SYNC_KEY = 'lastSyncAt';

let inFlight: Promise<SyncResult> | null = null;

export function runSync(repo: Repository, profile: Profile, source: StepSource, now = new Date()): Promise<SyncResult> {
  // Live step events and app focus can ask at once; share one run.
  inFlight ??= doSync(repo, profile, source, now).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doSync(repo: Repository, profile: Profile, source: StepSource, now: Date): Promise<SyncResult> {
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
  const data = { steps: today.steps, goal: today.goal, updatedAt: now.getTime() };
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
    goalMetToday: today.steps >= today.goal,
  });
  if (!remind) return;
  await repo.setKv(LAST_REMINDED_KEY, now.getTime());
  const left = Math.max(0, today.goal - today.steps);
  await notifyNow(
    'Time for a short walk',
    `Under ${REMINDER_MIN_STEPS} steps in the last hour. ${formatSteps(left)} to go for today's goal.`,
  );
}

async function celebrate(repo: Repository, { today, achievements }: SyncResult) {
  if (today.steps >= today.goal && (await repo.getKv<string>(GOAL_NOTIFIED_KEY)) !== today.date) {
    await repo.setKv(GOAL_NOTIFIED_KEY, today.date);
    await notifyNow('Goal reached', `${formatSteps(today.steps)} steps today. Nice work.`);
  }
  for (const a of achievements) {
    await notifyNow('New badge', achievementTitle(a.kind, a.value));
  }
}
