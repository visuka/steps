/**
 * Walk plans, pure rules (docs/walk-buddies.md 8.1 plans.ts, T16e): the day
 * and time choices of the form, its checks (the server's limits), the plain
 * words for answers and errors, the local reminder 1 hour before a walk I'm
 * going to, and the safety tips shown once. Tested in __tests__/plans.test.ts.
 */
import type { Repository } from '@/data/types';
import { addDaysToKey, dayKey, parseDayKey } from '@/lib/dates';
import { type ClockStyle, formatClock, formatDay } from '@/lib/when';

import { SocialError } from './read';
import type { Plan, PlanAnswer, PlanForm, PlanInvitee } from './types';

// Server limits (stepsinfra steps/social/plans.py).
export const PLACE_MAX = 60;
export const NOTE_MAX = 200;
export const INVITE_MAX = 20;
export const UPCOMING_MAX = 5;
export const SOON_MS = 15 * 60_000;
export const AHEAD_DAYS = 60;
/** The day chips: today and the next 6 days; "Other day" opens the date picker. */
export const DAY_CHIPS = 7;
/** A new plan starts at 7:00 in the morning. */
export const DEFAULT_MINUTES = 7 * 60;

export interface DayChoice {
  /** YYYY-MM-DD, local. */
  day: string;
  /** "Today", "Tomorrow", "Wed 26". */
  label: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Today, Tomorrow, then the next 5 days by name and date. */
export function dayChoices(now: number): DayChoice[] {
  const today = dayKey(new Date(now));
  return Array.from({ length: DAY_CHIPS }, (_, i) => {
    const day = addDaysToKey(today, i);
    const d = parseDayKey(day);
    return { day, label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${WEEKDAYS[d.getDay()]} ${d.getDate()}` };
  });
}

/** The moment on `day` (local) at `minutes` after midnight. */
export function atDayTime(day: string, minutes: number): number {
  const d = parseDayKey(day);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minutes / 60), minutes % 60).getTime();
}

/** Minutes after local midnight of a moment. */
export function minutesOf(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/** A new plan's start: tomorrow at 7:00. */
export function defaultStart(now: number): number {
  return atDayTime(addDaysToKey(dayKey(new Date(now)), 1), DEFAULT_MINUTES);
}

/** The last day the date picker allows. */
export function lastDay(now: number): string {
  return addDaysToKey(dayKey(new Date(now)), AHEAD_DAYS);
}

/** One space between words, as the server keeps it. */
export const cleanText = (t: string) => t.trim().replace(/\s+/g, ' ');

/** A plain reason the plan can't be sent, or null (the server's limits). */
export function planProblem(f: Pick<PlanForm, 'startsAt' | 'place' | 'note' | 'invite' | 'clubId'>, now: number, opts: { editing?: boolean } = {}): string | null {
  const place = cleanText(f.place);
  if (!place) return "Type where you'll meet.";
  if (place.length > PLACE_MAX) return `The place can be at most ${PLACE_MAX} characters.`;
  if (cleanText(f.note).length > NOTE_MAX) return `The note can be at most ${NOTE_MAX} characters.`;
  if (f.startsAt < now + SOON_MS) return 'Pick a time at least 15 minutes from now.';
  if (f.startsAt > now + AHEAD_DAYS * 86_400_000) return `Pick a day in the next ${AHEAD_DAYS} days.`;
  if (!f.clubId) {
    const n = new Set(f.invite).size;
    if (!n && !opts.editing) return 'Invite at least one buddy.';
    if (n > INVITE_MAX) return `You can invite up to ${INVITE_MAX} buddies.`;
  }
  return null;
}

export const isOrganiser = (p: Pick<Plan, 'organiser'>) => p.organiser.relation === 'self';

/** "Today, 7:00 am", "Tomorrow, 6:30 am", "Wed 26 Nov, 7:00 am". */
export function planWhen(ms: number, now: number, style: ClockStyle): string {
  const today = dayKey(new Date(now));
  const day = dayKey(new Date(ms)) === addDaysToKey(today, 1) ? 'Tomorrow' : formatDay(ms, now, style);
  return `${day}, ${formatClock(ms, style)}`;
}

export const ANSWER_WORD: Record<PlanAnswer, string> = { going: 'Going', not_going: "Can't make it", none: 'Waiting' };

/** Who said what, each list by name. Club plans list only people who answered. */
export function inviteeGroups(invitees: PlanInvitee[]): Record<PlanAnswer, PlanInvitee[]> {
  const by = (a: PlanAnswer) =>
    invitees
      .filter((i) => i.answer === a)
      .sort((x, y) => (x.walker.name ?? x.walker.handle).localeCompare(y.walker.name ?? y.walker.handle));
  return { going: by('going'), not_going: by('not_going'), none: by('none') };
}

/** The three numbers: going and can't make it from the plan, waiting from the list (buddy plans only). */
export function planCounts(plan: Plan, invitees: PlanInvitee[]): { going: number; notGoing: number; waiting: number | null } {
  return {
    going: plan.going,
    notGoing: plan.notGoing,
    waiting: plan.club ? null : invitees.filter((i) => i.answer === 'none').length,
  };
}

/** The Groups row's second line: "Tomorrow, 6:30 am · 3 going". */
export function planLine(p: Plan, now: number, style: ClockStyle): string {
  if (p.status === 'cancelled') return `${planWhen(p.startsAt, now, style)} · Cancelled`;
  return [planWhen(p.startsAt, now, style), p.going ? `${p.going} going` : null].filter(Boolean).join(' · ');
}

/** The word at the end of a plan's row: where I stand ("" when cancelled; the line says so). */
export function standWord(p: Pick<Plan, 'status' | 'organiser' | 'myAnswer'>): string {
  if (p.status === 'cancelled') return '';
  if (isOrganiser(p)) return 'Yours';
  return p.myAnswer === 'none' ? 'Invited' : ANSWER_WORD[p.myAnswer];
}

/** Plans still to come (or started within the hour), soonest first. */
export function upcoming(plans: Plan[], now: number): Plan[] {
  return plans.filter((p) => p.startsAt > now - 3_600_000).sort((a, b) => a.startsAt - b.startsAt);
}

/** Plain words for a plan error. */
export function planErrorText(e: unknown): string {
  if (!(e instanceof SocialError)) return 'Something went wrong. Try again.';
  if (e.code === 'bad_request') {
    if (e.why === 'startsAt') return `Pick a time from 15 minutes to ${AHEAD_DAYS} days from now.`;
    if (e.why === 'invite') return `Invite 1 to ${INVITE_MAX} of your buddies.`;
    if (e.why === 'text') return `Use a place of up to ${PLACE_MAX} characters and a note of up to ${NOTE_MAX}.`;
    return "Check the time, the place and who's invited.";
  }
  // Club walks are planned by the captain and vice-captains only (owner, 24 Nov 2026).
  if (e.why === 'staff_only') return 'The captain and vice-captains plan club walks.';
  switch (e.code) {
    case 'daily_limit':
      return `You can have ${UPCOMING_MAX} upcoming walks at a time.`;
    case 'conflict':
    case 'already':
      return 'This walk was cancelled.';
    case 'forbidden':
      return "You can't change this walk.";
    case 'not_found':
      return "This walk isn't there any more.";
  }
  return e.message;
}

// ── the reminder 1 hour before ───────────────────────────────────────────

export const PLAN_REMINDERS_KEY = 'buddies.planReminders';
export const REMIND_BEFORE_MS = 60 * 60_000;

export interface ReminderEntry {
  id: string;
  at: number;
  place: string;
}
export type ReminderMap = Record<string, ReminderEntry>;

/** The phone's local notifications, injected (notify.ts on the phone, nothing in the preview). */
export interface Reminders {
  /** Schedules one; null when notifications are off (asks first only when `ask`). */
  schedule: (at: number, title: string, body: string, ask: boolean) => Promise<string | null>;
  cancel: (id: string) => Promise<void>;
}

export type Kv = Pick<Repository, 'getKv' | 'setKv'>;

/** When to remind me of this plan, or null (not going, cancelled, or under an hour to go). */
export function reminderAt(p: Pick<Plan, 'myAnswer' | 'status' | 'startsAt'>, now: number): number | null {
  if (p.myAnswer !== 'going' || p.status !== 'on') return null;
  const at = p.startsAt - REMIND_BEFORE_MS;
  return at > now ? at : null;
}

/** What the reminder says: neutral words, the place and the time. */
export function reminderText(p: Pick<Plan, 'place' | 'startsAt'>, style: ClockStyle): { title: string; body: string } {
  return { title: 'Walk in 1 hour', body: `${p.place}, ${formatClock(p.startsAt, style)}` };
}

async function readMap(kv: Kv): Promise<ReminderMap> {
  const m = await kv.getKv<ReminderMap>(PLAN_REMINDERS_KEY).catch(() => null);
  if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
  const out: ReminderMap = {};
  for (const [k, v] of Object.entries(m)) {
    if (v && typeof v === 'object' && typeof v.id === 'string' && typeof v.at === 'number') out[k] = { id: v.id, at: v.at, place: String(v.place ?? '') };
  }
  return out;
}

/**
 * Keeps the phone's reminders in step with these plans: one 1 hour before
 * each walk I'm going to, none for the rest. `all`: the list is every plan I
 * have, so reminders for plans not in it are dropped too. Returns the plan
 * ids that have a reminder.
 */
export async function syncReminders(
  deps: { kv: Kv; reminders: Reminders; now: number; style: ClockStyle; ask?: boolean },
  plans: Plan[],
  opts: { all?: boolean } = {},
): Promise<Set<string>> {
  const map = await readMap(deps.kv);
  const next: ReminderMap = opts.all ? {} : { ...map };
  const ids = new Set(plans.map((p) => p.planId));
  if (opts.all) {
    for (const [planId, r] of Object.entries(map)) if (!ids.has(planId)) await deps.reminders.cancel(r.id).catch(() => undefined);
  }
  for (const p of plans) {
    const at = reminderAt(p, deps.now);
    const have = map[p.planId];
    if (have && at !== null && have.at === at && have.place === p.place) {
      next[p.planId] = have;
      continue;
    }
    if (have) await deps.reminders.cancel(have.id).catch(() => undefined);
    delete next[p.planId];
    if (at === null) continue;
    const t = reminderText(p, deps.style);
    const id = await deps.reminders.schedule(at, t.title, t.body, !!deps.ask).catch(() => null);
    if (id) next[p.planId] = { id, at, place: p.place };
  }
  await deps.kv.setKv(PLAN_REMINDERS_KEY, next);
  return new Set(Object.keys(next));
}

/** Answer a plan, then set or drop its reminder (asking for notifications when going). */
export async function answerAndRemind(
  deps: { kv: Kv; reminders: Reminders; now: number; style: ClockStyle; answerPlan: (id: string, a: 'going' | 'not_going') => Promise<Plan> },
  planId: string,
  answer: 'going' | 'not_going',
): Promise<{ plan: Plan; reminded: boolean }> {
  const plan = await deps.answerPlan(planId, answer);
  const set = await syncReminders({ ...deps, ask: answer === 'going' }, [plan]);
  return { plan, reminded: set.has(plan.planId) };
}

// ── safety tips, shown once ──────────────────────────────────────────────

export const TIPS_KEY = 'buddies.tipsSeen';
export type TipsKind = 'plan' | 'club';

/** docs/walk-buddies.md 6.4. */
export const SAFETY_TIPS = ['Meet in a busy public place.', "Tell someone where you're going.", 'Leave if you feel unsafe.'] as const;
export const SAFETY_URL = 'https://neutcrafts.in/steps/safety';

export async function tipsSeen(kv: Kv, kind: TipsKind): Promise<boolean> {
  const seen = await kv.getKv<Partial<Record<TipsKind, boolean>>>(TIPS_KEY).catch(() => null);
  return !!seen && typeof seen === 'object' && seen[kind] === true;
}

export async function markTipsSeen(kv: Kv, kind: TipsKind): Promise<void> {
  const seen = (await kv.getKv<Partial<Record<TipsKind, boolean>>>(TIPS_KEY).catch(() => null)) ?? {};
  await kv.setKv(TIPS_KEY, { ...(typeof seen === 'object' && seen ? seen : {}), [kind]: true });
}
