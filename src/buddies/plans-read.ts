/**
 * Walk plans: reading the server's answers to /v1/social/plans*
 * (docs/walk-buddies.md 2.5 "Plans"). Never trusted blindly: a broken plan
 * throws, an odd field falls back, and a broken row in a list is left out.
 * Pure, tested in __tests__/plans-read.test.ts.
 */
import { bad, isObj, num, readWalker, str } from './read';
import type { Plan, PlanAnswer, PlanInvitee, PlanPage, Walker } from './types';

/** Plan ids are 12 characters of base32 (server keys.random_id). */
const PLAN_ID = /^[0-9A-Za-z]{6,24}$/;
const CLUB_ID = /^[0-9A-Za-z]{6,24}$/;
const ANSWERS: readonly PlanAnswer[] = ['none', 'going', 'not_going'];

const answer = (v: unknown): PlanAnswer => (ANSWERS.includes(v as PlanAnswer) ? (v as PlanAnswer) : 'none');
const count = (v: unknown) => Math.max(0, Math.round(num(v)));

function walkerOrNull(v: unknown): Walker | null {
  try {
    return isObj(v) ? readWalker(v) : null;
  } catch {
    return null;
  }
}

function readClubRef(v: unknown): Plan['club'] {
  if (!isObj(v)) return null;
  const clubId = str(v.clubId, 40);
  const name = str(v.name, 80);
  return clubId && CLUB_ID.test(clubId) && name ? { clubId, name } : null;
}

export function readPlan(v: unknown): Plan {
  if (!isObj(v)) bad();
  const planId = str(v.planId, 40);
  const organiser = walkerOrNull(v.organiser);
  const place = str(v.place, 120);
  const startsAt = num(v.startsAt);
  if (!planId || !PLAN_ID.test(planId) || !organiser || !place || startsAt <= 0) bad();
  return {
    planId,
    organiser,
    club: readClubRef(v.club),
    startsAt,
    tz: str(v.tz, 40) ?? '',
    place,
    note: str(v.note, 400) ?? '',
    status: v.status === 'cancelled' ? 'cancelled' : 'on',
    // The server says "going" for the organiser; keep that even if it ever doesn't.
    myAnswer: organiser.relation === 'self' ? 'going' : answer(v.myAnswer),
    going: count(v.going),
    notGoing: count(v.notGoing),
  };
}

/** {"plans": [Plan]}, soonest first; a broken row is left out, not the whole list. */
export function readPlans(v: unknown): Plan[] {
  if (!isObj(v) || !Array.isArray(v.plans)) bad();
  const out: Plan[] = [];
  for (const row of v.plans) {
    try {
      out.push(readPlan(row));
    } catch {
      // skip it
    }
  }
  return out.sort((a, b) => a.startsAt - b.startsAt);
}

/** {"plan": Plan} (create, change, cancel, answer). */
export function readPlanReply(v: unknown): Plan {
  if (!isObj(v)) bad();
  return readPlan(v.plan);
}

/** GET /plans/{id}: {"plan", "invitees": [{"walker", "answer"}]}. */
export function readPlanPage(v: unknown): PlanPage {
  if (!isObj(v)) bad();
  const plan = readPlan(v.plan);
  const invitees: PlanInvitee[] = [];
  const seen = new Set<string>();
  for (const r of Array.isArray(v.invitees) ? v.invitees : []) {
    if (!isObj(r)) continue;
    const w = walkerOrNull(r.walker);
    if (!w || seen.has(w.pid)) continue;
    seen.add(w.pid);
    invitees.push({ walker: w, answer: answer(r.answer) });
  }
  return { plan, invitees };
}
