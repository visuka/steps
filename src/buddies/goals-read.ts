/**
 * Shared club goals: reading the server's answers to /v1/social/clubs/{id}/goals*
 * (the goals contract). Never trusted blindly: a broken answer throws, a
 * broken row is left out, an odd field falls back. Pure, tested in
 * __tests__/goals-read.test.ts.
 */
import { bad, isObj, num, readWalker, str } from './read';
import type {
  ClubGoals,
  ClubRole,
  Goal,
  GoalCounted,
  GoalKind,
  GoalMark,
  GoalReport,
  GoalReportRow,
  GoalSummaryRow,
  Walker,
} from './types';

export const GOAL_KINDS: readonly GoalKind[] = ['steps', 'walk', 'water', 'sleep', 'medicine', 'other'];
const ROLES: readonly ClubRole[] = ['owner', 'admin', 'member'];
/** Goal ids are 12 characters of base32 (server keys.random_id). */
const GOAL_ID = /^[0-9A-Za-z]{6,24}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const BY_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const whole = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

function walkerOrNull(v: unknown): Walker | null {
  try {
    return isObj(v) ? readWalker(v) : null;
  } catch {
    return null;
  }
}

/** Days of the week, Monday = 0; sorted, no repeats. */
function readDays(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
}

export function readGoal(v: unknown): Goal {
  if (!isObj(v)) bad();
  const goalId = str(v.goalId, 40);
  const title = str(v.title, 80);
  const kind = v.kind as GoalKind;
  if (!goalId || !GOAL_ID.test(goalId) || !title?.trim() || !GOAL_KINDS.includes(kind)) bad();
  const days = readDays(v.days);
  if (!days.length) bad();
  const byTime = str(v.byTime, 5);
  // A phone can only mark steps, walks, water and sleep by itself; anything else is tapped.
  const counted: GoalCounted = v.counted === 'auto' && ['steps', 'walk', 'water', 'sleep'].includes(kind) ? 'auto' : 'tap';
  return {
    goalId,
    title: title.trim(),
    kind,
    target: whole(v.target) || null,
    byTime: byTime && BY_TIME.test(byTime) ? byTime : null,
    days,
    counted,
    paused: v.paused === true,
    createdBy: walkerOrNull(v.createdBy),
    createdAt: num(v.createdAt),
  };
}

function readGoalList(v: unknown): Goal[] {
  if (!Array.isArray(v)) return [];
  const out: Goal[] = [];
  for (const g of v) {
    try {
      out.push(readGoal(g));
    } catch {
      // skip it
    }
  }
  return out;
}

function readMark(v: unknown): GoalMark | null {
  if (!isObj(v)) return null;
  const goalId = str(v.goalId, 40);
  if (!goalId || !GOAL_ID.test(goalId)) return null;
  const done = v.done === true;
  return { goalId, done, at: done ? whole(v.at) || null : null, value: whole(v.value) };
}

/** GET /clubs/{id}/goals: {"goals", "tracked", "mine"}. Marks only count while I am tracked. */
export function readClubGoals(v: unknown): ClubGoals {
  if (!isObj(v) || !Array.isArray(v.goals)) bad();
  const goals = readGoalList(v.goals);
  const tracked = v.tracked === true;
  const known = new Set(goals.map((g) => g.goalId));
  const mine: GoalMark[] = [];
  if (tracked && Array.isArray(v.mine)) {
    for (const m of v.mine) {
      const mark = readMark(m);
      if (mark && known.has(mark.goalId) && !mine.some((x) => x.goalId === mark.goalId)) mine.push(mark);
    }
  }
  return { goals, tracked, mine };
}

/** {"goal": Goal} (create and change). */
export function readGoalReply(v: unknown): Goal {
  if (!isObj(v)) bad();
  return readGoal(v.goal);
}

/** PUT …/marks/{day}: {"mark": {"goalId", "day", "done", "at"?, "value"?}}. */
export function readMarkReply(v: unknown): GoalMark & { day: string } {
  if (!isObj(v)) bad();
  const mark = readMark(v.mark);
  const day = isObj(v.mark) ? str(v.mark.day, 10) : null;
  if (!mark || !day || !DAY.test(day)) bad();
  return { ...mark, day };
}

function readRow(v: unknown): GoalReportRow | null {
  if (!isObj(v)) return null;
  const walker = walkerOrNull(v.walker);
  const role = ROLES.includes(v.role as ClubRole) ? (v.role as ClubRole) : null;
  if (!walker || !role) return null;
  const t = isObj(v.today) ? v.today : {};
  const w = isObj(v.week) ? v.week : {};
  const of = Math.min(7, whole(w.of) ?? 0);
  const today = t.done === true;
  return {
    walker,
    role,
    today: { done: today, at: today ? whole(t.at) || null : null, value: whole(t.value) },
    week: { done: Math.min(of, whole(w.done) ?? 0), of },
    // Done today means done at least once.
    everDone: v.everDone === true || today,
  };
}

/** Not done today first, then by name (the server's order, kept even if it changes). */
function rowOrder(a: GoalReportRow, b: GoalReportRow): number {
  if (a.today.done !== b.today.done) return a.today.done ? 1 : -1;
  const an = (a.walker.name || a.walker.handle).toLowerCase();
  const bn = (b.walker.name || b.walker.handle).toLowerCase();
  return an.localeCompare(bn);
}

/** GET …/goals/{goalId}/report?day=. */
export function readGoalReport(v: unknown): GoalReport {
  if (!isObj(v) || !Array.isArray(v.rows)) bad();
  const day = str(v.day, 10);
  if (!day || !DAY.test(day)) bad();
  const goal = readGoal(v.goal);
  const rows: GoalReportRow[] = [];
  for (const r of v.rows) {
    const row = readRow(r);
    if (row) rows.push(row);
  }
  rows.sort(rowOrder);
  const members = Math.max(whole(v.members) ?? 0, rows.length);
  const doneToday = Math.min(members, whole(v.doneToday) ?? rows.filter((r) => r.today.done).length);
  const neverDone = Math.min(members - doneToday, whole(v.neverDone) ?? rows.filter((r) => !r.everDone).length);
  return { day, goal, members, doneToday, neverDone, rows };
}

/** GET …/goals/summary?day=: {"goals": [{"goalId", "doneToday", "members"}]}. */
export function readGoalSummary(v: unknown): GoalSummaryRow[] {
  if (!isObj(v) || !Array.isArray(v.goals)) bad();
  const out: GoalSummaryRow[] = [];
  for (const r of v.goals) {
    if (!isObj(r)) continue;
    const goalId = str(r.goalId, 40);
    if (!goalId || !GOAL_ID.test(goalId)) continue;
    const members = whole(r.members) ?? 0;
    out.push({ goalId, members, doneToday: Math.min(members, whole(r.doneToday) ?? 0) });
  }
  return out;
}
