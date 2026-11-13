/**
 * One shared budget for every notification the app posts by itself: never two
 * within 45 minutes, never in the 45 minutes around the mood check-in, and
 * water and nutrition stay quiet on a sync that already sent a step nudge,
 * goal alert or badge.
 */
import type { Repository } from '@/data/types';

export const LAST_NOTIFIED_KEY = 'lastNotifiedAt';
export const BUDGET_GAP_MS = 45 * 60_000;

export interface BudgetInput {
  now: Date;
  lastNotifiedAt: number | null;
  /** The mood check-in hour when it is on. */
  moodHour: number | null;
  /** This sync already sent a step nudge, goal alert or badge. */
  stepSent: boolean;
}

export function budgetAllows({ now, lastNotifiedAt, moodHour, stepSent }: BudgetInput): boolean {
  if (stepSent) return false;
  const t = now.getTime();
  if (lastNotifiedAt !== null && t - lastNotifiedAt < BUDGET_GAP_MS) return false;
  if (moodHour !== null) {
    const mood = new Date(now.getFullYear(), now.getMonth(), now.getDate(), moodHour).getTime();
    if (Math.abs(t - mood) < BUDGET_GAP_MS) return false;
  }
  return true;
}

export async function readBudget(repo: Pick<Repository, 'getKv'>): Promise<number | null> {
  return (await repo.getKv<number>(LAST_NOTIFIED_KEY).catch(() => null)) ?? null;
}

/** Call after any post. */
export async function spendBudget(repo: Pick<Repository, 'setKv'>, now: Date): Promise<void> {
  await repo.setKv(LAST_NOTIFIED_KEY, now.getTime());
}
