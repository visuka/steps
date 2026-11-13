/**
 * Water reminders, the nutrition note and the weekly summary, run after every
 * sync (app and background). Premium only, each behind its own feature, and
 * all sharing one budget: at most one of them per sync, none within 45
 * minutes of any other post or of the mood check-in, none on a sync that
 * already sent a step nudge, goal alert or badge.
 */
import type { Profile, Repository } from '@/data/types';
import { inWeeklyWindow, pushNutritionNote, pushWeeklySummary } from '@/nutrition/notes';
import { needsAreDifferent } from '@/nutrition/targets';
import { isLocked, premiumOpenOnPhone } from '@/premium/premium';
import { remindWater, waterWeek } from '@/water/today';

import { budgetAllows, readBudget, spendBudget } from './budget';
import type { NotifyOptions } from './channels';
import { notifyNow } from './notify';

export async function healthNotes(
  repo: Repository,
  profile: Profile,
  { steps, stepSent }: { steps: number | null; stepSent: boolean },
  now: Date,
  send: (title: string, body: string, opts: NotifyOptions) => Promise<void> = notifyNow,
): Promise<void> {
  const open = await premiumOpenOnPhone(repo);
  if (isLocked('body', open) && isLocked('food', open)) return;
  const lastNotifiedAt = await readBudget(repo);
  const moodHour = profile.moodCheckIn.enabled ? profile.moodCheckIn.hour : null;
  if (!budgetAllows({ now, lastNotifiedAt, moodHour, stepSent })) return;

  const post = (opts: NotifyOptions) => async (title: string, body: string) => {
    await send(title, body, opts);
    await spendBudget(repo, now);
  };

  if (!isLocked('body', open) && (await remindWater(repo, profile, now, steps, post({ channel: 'water', open: 'water' })))) return;
  if (isLocked('food', open)) return;
  if (await pushNutritionNote(repo, profile, now, post({ channel: 'nutrition', open: 'food' }))) return;

  const waterShown =
    !isLocked('body', open) && !profile.water.doctorLimit && !needsAreDifferent(profile, now.getFullYear()) && profile.water.targetMl !== null;
  if (!profile.nutrition.weekly || !inWeeklyWindow(now)) return;
  const metDays = waterShown ? (await waterWeek(repo, profile, now)).metDays : null;
  await pushWeeklySummary(repo, profile, now, metDays, post({ channel: 'weekly', open: 'food' }));
}
