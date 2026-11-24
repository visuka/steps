/**
 * The club board's part of sharing steps (docs/walk-buddies.md 8.1
 * steps-share.ts; PUT /v1/social/me/steps). Only while the person has the
 * board on in at least one club: then today's total and this week's (Mon–Sun)
 * go to the server at most every 30 minutes while the app is in front, and at
 * once when the day changes. Nothing else is sent: no hours, no walks, no
 * place. The family part (T16g) adds its own switch to `sharingOn`.
 */
import { addDaysToKey, parseDayKey } from '@/lib/dates';
import type { Repository } from '@/data/types';

/** Club ids whose board I am on (kept when the board switch changes or a club loads). */
export const BOARDS_KEY = 'buddies.boards';
/** What was last sent: {day, steps, at}. */
export const STEPS_SENT_KEY = 'buddies.stepsSent';

export const STEPS_EVERY_MS = 30 * 60_000;

export interface StepsSent {
  day: string;
  steps: number;
  at: number;
}

export interface StepsBody {
  day: string;
  steps: number;
  weekStart: string;
  weekSteps: number;
  tz: string;
}

/** The Monday of the week a day is in (YYYY-MM-DD). */
export function weekStartOf(day: string): string {
  const wd = parseDayKey(day).getDay(); // 0 Sunday … 6 Saturday
  return addDaysToKey(day, -((wd + 6) % 7));
}

/** Time to send again: something is shared, and nothing was sent today, or the count changed and 30 minutes have passed. */
export function stepsDue(sent: StepsSent | null, today: string, steps: number, now: number, sharingOn: boolean): boolean {
  if (!sharingOn) return false;
  if (!sent || sent.day !== today) return true;
  if (sent.steps === steps) return false;
  return now - sent.at >= STEPS_EVERY_MS;
}

/** The body for PUT /me/steps from the week's day totals (only days from Monday to today count). */
export function stepsBody(days: { date: string; steps: number }[], today: string, tz: string): StepsBody {
  const weekStart = weekStartOf(today);
  let weekSteps = 0;
  let steps = 0;
  for (const d of days) {
    if (d.date < weekStart || d.date > today) continue;
    const n = Math.max(0, Math.round(d.steps || 0));
    weekSteps += n;
    if (d.date === today) steps = n;
  }
  return { day: today, steps: Math.min(steps, 200_000), weekStart, weekSteps: Math.min(weekSteps, 2_000_000), tz };
}

/** The phone's time zone name, or India's when it can't be read. */
export function phoneTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && /^[A-Za-z][A-Za-z_]*(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(tz) && tz.length <= 40) return tz;
  } catch {
    // fall through
  }
  return 'Asia/Kolkata';
}

/** Keep the list of clubs whose board I am on. */
export async function rememberBoard(repo: Pick<Repository, 'getKv' | 'setKv'>, clubId: string, on: boolean): Promise<string[]> {
  const cur = (await repo.getKv<string[]>(BOARDS_KEY)) ?? [];
  const list = Array.isArray(cur) ? cur.filter((x) => typeof x === 'string') : [];
  const next = on ? [...new Set([...list, clubId])] : list.filter((x) => x !== clubId);
  if (next.length !== list.length || next.some((x, i) => x !== list[i])) await repo.setKv(BOARDS_KEY, next);
  return next;
}

export interface SendStepsDeps {
  repo: Pick<Repository, 'getKv' | 'setKv' | 'getDays'>;
  putSteps: (body: StepsBody) => Promise<boolean>;
  today: string;
  now: number;
  tz?: string;
}

/** Sends the totals when due; returns whether it sent. Errors are left for the next try. */
export async function sendSteps({ repo, putSteps, today, now, tz = phoneTimeZone() }: SendStepsDeps): Promise<boolean> {
  const boards = (await repo.getKv<string[]>(BOARDS_KEY)) ?? [];
  const on = Array.isArray(boards) && boards.length > 0;
  if (!on) return false;
  const weekStart = weekStartOf(today);
  const days = await repo.getDays(weekStart, today);
  const body = stepsBody(days, today, tz);
  const sent = await repo.getKv<StepsSent>(STEPS_SENT_KEY);
  if (!stepsDue(sent, today, body.steps, now, on)) return false;
  try {
    await putSteps(body);
  } catch {
    return false;
  }
  await repo.setKv<StepsSent>(STEPS_SENT_KEY, { day: today, steps: body.steps, at: now });
  return true;
}
