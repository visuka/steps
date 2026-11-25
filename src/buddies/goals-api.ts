/**
 * Calls to the shared club goals routes (/v1/social/clubs/{id}/goals*, the
 * goals contract). Built over one `send` function so tests can check every
 * method, path and body without the network; api.ts gives it the real
 * `call`. Views never import this.
 */
import type { Send } from './clubs-api';
import { readClubGoals, readGoalReply, readGoalReport, readGoalSummary, readMarkReply } from './goals-read';
import type { ClubGoals, Goal, GoalForm, GoalMark, GoalReport, GoalSummaryRow } from './types';

const enc = encodeURIComponent;

/** What a captain may change on a goal (kind and nutrient stay as made). */
export type GoalPatch = Partial<Pick<GoalForm, 'title' | 'target' | 'byTime' | 'days'>> & { paused?: boolean };

export function makeGoalsApi(send: Send) {
  const goals = (id: string) => `/clubs/${enc(id)}/goals`;
  const goal = (id: string, goalId: string) => `${goals(id)}/${enc(goalId)}`;
  return {
    /** The club's goals, whether I am tracked, and my marks for `day` (YYYY-MM-DD). */
    clubGoals: async (id: string, day: string): Promise<ClubGoals> => readClubGoals(await send('GET', `${goals(id)}?day=${enc(day)}`)),
    /**
     * Captain or vice-captain; at most 10 goals a club. Every goal is counted by the phone:
     * counted is always "auto" (the server takes nothing else, or no counted at all).
     */
    createGoal: async (id: string, f: GoalForm): Promise<Goal> => {
      const body: Record<string, unknown> = {
        title: f.title.trim(),
        kind: f.kind,
        counted: 'auto',
        days: [...f.days].sort((a, b) => a - b),
      };
      if (f.kind === 'nutrient' && f.nutrientKey) body.nutrientKey = f.nutrientKey;
      if (f.target !== null) body.target = f.target;
      if (f.byTime) body.byTime = f.byTime;
      return readGoalReply(await send('POST', goals(id), body));
    },
    /** Captain or vice-captain: any of title, target, byTime (null clears it), days, paused. */
    updateGoal: async (id: string, goalId: string, patch: GoalPatch): Promise<Goal> => {
      const body: Record<string, unknown> = {};
      if (patch.title !== undefined) body.title = patch.title.trim();
      if (patch.target !== undefined) body.target = patch.target;
      if (patch.byTime !== undefined) body.byTime = patch.byTime || null;
      if (patch.days !== undefined) body.days = [...patch.days].sort((a, b) => a - b);
      if (patch.paused !== undefined) body.paused = patch.paused;
      return readGoalReply(await send('PATCH', goal(id, goalId), body));
    },
    /** Captain or vice-captain; the goal's marks go with it. */
    deleteGoal: async (id: string, goalId: string): Promise<void> => {
      await send('DELETE', goal(id, goalId));
    },
    /**
     * Mark my goal done or not for `day`. A value goes for steps goals only (goals-auto.ts):
     * no blood pressure, weight, mood or food number ever leaves the phone.
     */
    putMark: async (id: string, goalId: string, day: string, m: { done: boolean; value?: number | null }): Promise<GoalMark & { day: string }> => {
      const body: Record<string, unknown> = { done: m.done };
      if (typeof m.value === 'number') body.value = Math.max(0, Math.round(m.value));
      return readMarkReply(await send('PUT', `${goal(id, goalId)}/marks/${enc(day)}`, body));
    },
    /** Captain or vice-captain: who did it today, this week and ever. */
    goalReport: async (id: string, goalId: string, day: string): Promise<GoalReport> =>
      readGoalReport(await send('GET', `${goal(id, goalId)}/report?day=${enc(day)}`)),
    /** Captain or vice-captain: "done today of members" for every goal. */
    goalSummary: async (id: string, day: string): Promise<GoalSummaryRow[]> =>
      readGoalSummary(await send('GET', `${goals(id)}/summary?day=${enc(day)}`)),
    /** Captain or vice-captain, once a goal a day; members choose whether they get it. */
    remindGoal: async (id: string, goalId: string, pids: string[]): Promise<void> => {
      await send('POST', `${goal(id, goalId)}/remind`, { pids: [...new Set(pids)].slice(0, 200) });
    },
    /** Say yes or no to goal tracking in a club (no takes my marks away). */
    setGoalsConsent: async (id: string, on: boolean): Promise<void> => {
      await send('PUT', `${goals(id)}/consent`, { on });
    },
  };
}

export type GoalsApi = ReturnType<typeof makeGoalsApi>;
