/**
 * Calls to the walk plan routes (/v1/social/plans*, docs/walk-buddies.md 2.5
 * "Plans"). Built over one `send` function so tests check every method, path
 * and body without the network; api.ts gives it the real `call`. Views never
 * import this: hooks get it through BuddiesSource.
 */
import type { Send } from './clubs-api';
import { readPlanPage, readPlanReply, readPlans } from './plans-read';
import type { Plan, PlanForm, PlanPage } from './types';

const enc = encodeURIComponent;

/** One space between words, as the server keeps it. */
const clean = (t: string) => t.trim().replace(/\s+/g, ' ');

/** What a change sends: any of the time, place and note, and buddies to add (never removed). */
export interface PlanPatch {
  startsAt?: number;
  place?: string;
  note?: string;
  invite?: string[];
}

export function makePlansApi(send: Send) {
  const plan = (id: string) => `/plans/${enc(id)}`;
  return {
    /** Upcoming plans: mine, ones I'm invited to, and my clubs'. */
    plans: async (): Promise<Plan[]> => readPlans(await send('GET', '/plans')),
    plan: async (id: string): Promise<PlanPage> => readPlanPage(await send('GET', plan(id))),
    /** Buddies (1–20 pids) or a club; tz is the phone's time zone. */
    createPlan: async (f: PlanForm, tz: string): Promise<Plan> => {
      const body: Record<string, unknown> = { startsAt: f.startsAt, tz, place: clean(f.place) };
      const note = clean(f.note);
      if (note) body.note = note;
      if (f.clubId) body.clubId = f.clubId;
      else body.invite = [...new Set(f.invite)];
      return readPlanReply(await send('POST', '/plans', body));
    },
    /** Organiser only: everyone invited is told. */
    updatePlan: async (id: string, p: PlanPatch): Promise<Plan> => {
      const body: Record<string, unknown> = {};
      if (p.startsAt !== undefined) body.startsAt = p.startsAt;
      if (p.place !== undefined) body.place = clean(p.place);
      if (p.note !== undefined) body.note = clean(p.note);
      if (p.invite?.length) body.invite = [...new Set(p.invite)];
      return readPlanReply(await send('PATCH', plan(id), body));
    },
    /** Organiser only: everyone invited is told. */
    cancelPlan: async (id: string): Promise<Plan> => readPlanReply(await send('POST', `${plan(id)}/cancel`)),
    answerPlan: async (id: string, answer: 'going' | 'not_going'): Promise<Plan> =>
      readPlanReply(await send('PUT', `${plan(id)}/answer`, { answer })),
  };
}

export type PlansApi = ReturnType<typeof makePlansApi>;
