/**
 * Shared club goals counted by the phone ("auto" goals: steps, a walk,
 * water, sleep). The phone looks at today's own numbers and marks the goal
 * done when they reach the target; a captain sees only done or not (and,
 * for steps, the count). Runs when Buddies or Today opens, at most every
 * 15 minutes, and only for clubs where I said yes to goal tracking.
 *
 * Nothing is ever un-marked by the phone: a goal marked done stays done
 * (a person can undo a tap goal; an auto goal follows the numbers).
 * Pure parts are tested in __tests__/goals-auto.test.ts.
 */
import type { FoodEntry, Profile, Repository, SleepEntry, Walk } from '@/data/types';
import { dayKey, parseDayKey, startOfDay } from '@/lib/dates';
import { loadFoodBook } from '@/nutrition/notes';
import { drinkMl } from '@/water/water';

import { dueOn } from './goals';
import type { ClubCard, ClubGoals, Goal, GoalMark } from './types';

/** The last run: {at, day, clubs (ids where goals are on and I am a member), clubsAt}. */
export const GOALS_AUTO_KEY = 'buddies.goalsAuto';
export const GOALS_AUTO_EVERY_MS = 15 * 60_000;
/** The list of my clubs is asked for again after this, or when the day changes. */
const CLUBS_EVERY_MS = 6 * 60 * 60_000;
/** A steps count is sent again only when it moved this much. */
export const STEPS_VALUE_STEP = 100;

/** Today's own numbers, as the Today screen shows them. */
export interface PhoneToday {
  steps: number;
  waterGlasses: number;
  /** Asleep last night (the night that ended this morning). */
  sleepMin: number;
  /** The longest walk saved today (not a ride). */
  walkMin: number;
}

export interface AutoDecision {
  done: boolean;
  /** What the phone counted, in the goal's unit (steps, minutes, glasses). */
  value: number;
}

/** What the phone says about one auto goal today; null for a tap goal or one without a target. */
export function autoDecision(goal: Pick<Goal, 'kind' | 'counted' | 'target'>, phone: PhoneToday): AutoDecision | null {
  if (goal.counted !== 'auto' || goal.target === null) return null;
  const value = (() => {
    switch (goal.kind) {
      case 'steps':
        return phone.steps;
      case 'walk':
        return phone.walkMin;
      case 'water':
        return phone.waterGlasses;
      case 'sleep':
        return phone.sleepMin;
      default:
        return null;
    }
  })();
  if (value === null) return null;
  const v = Math.max(0, Math.floor(value));
  return { done: v >= goal.target, value: v };
}

export interface MarkToSend {
  goalId: string;
  done: boolean;
  /** Steps goals only. */
  value?: number;
}

/**
 * The marks to send for a club's auto goals due today: a goal that has
 * become done, and for steps a count that moved by 100 or more. Never
 * sends "not done" over a done mark.
 */
export function autoMarks(cg: ClubGoals, phone: PhoneToday, day: string): MarkToSend[] {
  if (!cg.tracked) return [];
  const out: MarkToSend[] = [];
  for (const g of cg.goals) {
    if (!dueOn(g, day)) continue;
    const d = autoDecision(g, phone);
    if (!d) continue;
    const mark = cg.mine.find((m) => m.goalId === g.goalId) ?? null;
    const done = !!mark?.done || d.done;
    if (g.kind === 'steps') {
      const value = Math.floor(d.value / STEPS_VALUE_STEP) * STEPS_VALUE_STEP;
      const moved = mark?.value === null || mark?.value === undefined || Math.abs(value - mark.value) >= STEPS_VALUE_STEP;
      if (done !== !!mark?.done || (moved && value > 0)) out.push({ goalId: g.goalId, done, value });
    } else if (done && !mark?.done) {
      out.push({ goalId: g.goalId, done: true });
    }
  }
  return out;
}

/** My marks after sending: what the screen shows without asking again. */
export function applyMarks(mine: GoalMark[], sent: (MarkToSend & { at?: number | null })[]): GoalMark[] {
  const out = [...mine];
  for (const s of sent) {
    const i = out.findIndex((m) => m.goalId === s.goalId);
    const old = i >= 0 ? out[i] : null;
    const next: GoalMark = {
      goalId: s.goalId,
      done: s.done,
      at: s.done ? (s.at ?? old?.at ?? null) : null,
      value: s.value ?? old?.value ?? null,
    };
    if (i >= 0) out[i] = next;
    else out.push(next);
  }
  return out;
}

// ── the phone's numbers ─────────────────────────────────────────────────

/** Glasses of water today: water logged plus drinks in food, as the Today water tile counts. */
export function glassesOf(waterMl: number, drinksMl: number, glassMl: number): number {
  return glassMl > 0 ? Math.floor((waterMl + drinksMl) / glassMl) : 0;
}

export function sleepMinOf(entries: Pick<SleepEntry, 'date' | 'asleepMin'>[], today: string): number {
  return Math.round(entries.filter((e) => e.date === today).reduce((sum, e) => sum + Math.max(0, e.asleepMin), 0));
}

/** The longest walk started today, in whole minutes moving; rides do not count. */
export function walkMinOf(walks: Pick<Walk, 'startedAt' | 'movingS' | 'activity'>[], today: string): number {
  let best = 0;
  for (const w of walks) {
    if (w.activity === 'ride' || dayKey(new Date(w.startedAt)) !== today) continue;
    best = Math.max(best, Math.floor(Math.max(0, w.movingS) / 60));
  }
  return best;
}

/** Reads today's numbers from the phone. `steps`: the steps on screen, when known. */
export async function readPhoneToday(
  repo: Repository,
  profile: Pick<Profile, 'water'>,
  today: string,
  steps?: number | null,
): Promise<PhoneToday> {
  const start = startOfDay(parseDayKey(today)).getTime();
  const end = start + 36 * 3600_000; // past any day length; only today's foods are kept below
  const [day, logs, foods, book, sleep, walks] = await Promise.all([
    steps === undefined || steps === null ? repo.getDay(today).catch(() => null) : Promise.resolve(null),
    repo.getLogs('water', 400).catch(() => []),
    repo.getFoods(start, end).catch(() => [] as FoodEntry[]),
    loadFoodBook(repo).catch(() => null),
    repo.getSleep(today, today).catch(() => [] as SleepEntry[]),
    repo.getWalks(20).catch(() => [] as Walk[]),
  ]);
  const waterMl = logs.reduce((a, l) => (dayKey(new Date(l.loggedAt)) === today ? a + l.value : a), 0);
  const todayFoods = foods.filter((f) => dayKey(new Date(f.loggedAt)) === today);
  const drinks = book ? drinkMl(todayFoods, book.own, book.overrides, book.saved) : 0;
  return {
    steps: Math.max(0, Math.round(steps ?? day?.steps ?? 0)),
    waterGlasses: glassesOf(waterMl, drinks, profile.water.glassMl),
    sleepMin: sleepMinOf(sleep, today),
    walkMin: walkMinOf(walks, today),
  };
}

// ── the runner ──────────────────────────────────────────────────────────

export interface AutoState {
  at: number;
  day: string;
  clubs: string[];
  clubsAt: number;
}

function readState(v: unknown): AutoState | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'number' || typeof o.day !== 'string' || !Array.isArray(o.clubs)) return null;
  return {
    at: o.at,
    day: o.day,
    clubs: o.clubs.filter((c): c is string => typeof c === 'string'),
    clubsAt: typeof o.clubsAt === 'number' ? o.clubsAt : 0,
  };
}

/** Time to look again: never run, another day, or 15 minutes since the last run. */
export function autoDue(state: AutoState | null, today: string, now: number): boolean {
  if (!state || state.day !== today) return true;
  return now - state.at >= GOALS_AUTO_EVERY_MS || now < state.at;
}

/** The clubs to look at: with goals on, and I am a member. */
export const goalClubs = (cards: Pick<ClubCard, 'clubId' | 'goals' | 'myState'>[]) =>
  cards.filter((c) => c.goals && c.myState === 'member').map((c) => c.clubId);

export interface GoalsAutoDeps {
  kv: Pick<Repository, 'getKv' | 'setKv'>;
  api: {
    myClubs: () => Promise<Pick<ClubCard, 'clubId' | 'goals' | 'myState'>[]>;
    clubGoals: (id: string, day: string) => Promise<ClubGoals>;
    putMark: (id: string, goalId: string, day: string, m: { done: boolean; value?: number | null }) => Promise<unknown>;
  };
  phone: () => Promise<PhoneToday>;
  today: string;
  now: number;
  /** Look now even inside the 15 minutes (a club's Goals tab just loaded). */
  force?: boolean;
}

/** Sends what changed; returns how many marks went. Errors leave it for the next run. */
export async function runGoalsAuto({ kv, api, phone, today, now, force = false }: GoalsAutoDeps): Promise<number> {
  const state = readState(await kv.getKv<unknown>(GOALS_AUTO_KEY));
  if (!force && !autoDue(state, today, now)) return 0;
  let clubs = state?.clubs ?? [];
  let clubsAt = state?.clubsAt ?? 0;
  if (!state || state.day !== today || now - clubsAt >= CLUBS_EVERY_MS || now < clubsAt) {
    clubs = goalClubs(await api.myClubs());
    clubsAt = now;
  }
  // Saved first, so a slow or failing run does not repeat every time the screen opens.
  await kv.setKv<AutoState>(GOALS_AUTO_KEY, { at: now, day: today, clubs, clubsAt });
  if (!clubs.length) return 0;
  const numbers = await phone();
  let sent = 0;
  for (const id of clubs) {
    try {
      const cg = await api.clubGoals(id, today);
      for (const m of autoMarks(cg, numbers, today)) {
        try {
          await api.putMark(id, m.goalId, today, m.value === undefined ? { done: m.done } : { done: m.done, value: m.value });
          sent += 1;
        } catch {
          // the next run tries again
        }
      }
    } catch {
      // a club that left or turned goals off: the next list drops it
    }
  }
  return sent;
}
