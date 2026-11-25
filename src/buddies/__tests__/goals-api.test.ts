import { describe, expect, it, jest } from '@jest/globals';

import type { Send } from '../clubs-api';
import { makeGoalsApi } from '../goals-api';

const goal = {
  goalId: 'GL0000000001',
  title: 'Morning walk',
  kind: 'walk',
  target: 30,
  byTime: '07:00',
  days: [0, 1, 2, 3, 4, 5, 6],
  paused: false,
  createdBy: null,
  createdAt: 1,
};

function fake(reply: unknown = null) {
  const send = jest.fn<Send>(async () => reply);
  return { send, api: makeGoalsApi(send) };
}

describe('goal calls', () => {
  it("gets a club's goals for a day", async () => {
    const { send, api } = fake({ goals: [goal], tracked: true, mine: [] });
    const cg = await api.clubGoals('KBR000000001', '2026-11-24');
    expect(send).toHaveBeenCalledWith('GET', '/clubs/KBR000000001/goals?day=2026-11-24');
    expect(cg.goals[0].title).toBe('Morning walk');
  });

  it('creates a goal: trimmed, days sorted, no target or by-time when there is none, always counted by the phone', async () => {
    const { send, api } = fake({ goal: { ...goal, kind: 'weight', target: undefined, byTime: undefined } });
    await api.createGoal('KBR000000001', { title: ' Check weight ', kind: 'weight', target: null, nutrientKey: null, byTime: null, days: [4, 0] });
    expect(send).toHaveBeenCalledWith('POST', '/clubs/KBR000000001/goals', { title: 'Check weight', kind: 'weight', counted: 'auto', days: [0, 4] });
  });

  it('creates a goal with its target and by-time', async () => {
    const { send, api } = fake({ goal });
    await api.createGoal('KBR000000001', { title: 'Morning walk', kind: 'walk', target: 30, nutrientKey: null, byTime: '07:00', days: [0, 1, 2, 3, 4, 5, 6] });
    expect(send.mock.calls[0][2]).toEqual({ title: 'Morning walk', kind: 'walk', counted: 'auto', days: [0, 1, 2, 3, 4, 5, 6], target: 30, byTime: '07:00' });
  });

  it('creates a nutrient goal with its nutrient and a decimal target', async () => {
    const { send, api } = fake({ goal: { ...goal, kind: 'nutrient', nutrientKey: 'transFat', target: 0.4 } });
    const g = await api.createGoal('KBR000000001', { title: 'Trans fat 0.4 g or less', kind: 'nutrient', target: 0.4, nutrientKey: 'transFat', byTime: null, days: [0] });
    expect(send.mock.calls[0][2]).toEqual({ title: 'Trans fat 0.4 g or less', kind: 'nutrient', counted: 'auto', nutrientKey: 'transFat', days: [0], target: 0.4 });
    expect(g).toMatchObject({ kind: 'nutrient', nutrientKey: 'transFat', target: 0.4 });
  });

  it('never sends a nutrient key for another kind', async () => {
    const { send, api } = fake({ goal });
    await api.createGoal('KBR000000001', { title: 'Walk', kind: 'walk', target: 30, nutrientKey: 'protein', byTime: null, days: [0] });
    expect(send.mock.calls[0][2]).not.toHaveProperty('nutrientKey');
  });

  it('changes only what was given; an empty by-time clears it', async () => {
    const { send, api } = fake({ goal });
    await api.updateGoal('KBR000000001', 'GL0000000001', { paused: true });
    expect(send).toHaveBeenCalledWith('PATCH', '/clubs/KBR000000001/goals/GL0000000001', { paused: true });
    await api.updateGoal('KBR000000001', 'GL0000000001', { title: ' Walk ', byTime: null, days: [2, 1] });
    expect(send.mock.calls[1][2]).toEqual({ title: 'Walk', byTime: null, days: [1, 2] });
  });

  it('deletes a goal', async () => {
    const { send, api } = fake();
    await api.deleteGoal('KBR000000001', 'GL0000000001');
    expect(send).toHaveBeenCalledWith('DELETE', '/clubs/KBR000000001/goals/GL0000000001');
  });

  it('marks a goal done for a day, with a whole steps count when given', async () => {
    const { send, api } = fake({ mark: { goalId: 'GL0000000002', day: '2026-11-24', done: false, value: 6240 } });
    const m = await api.putMark('KBR000000001', 'GL0000000002', '2026-11-24', { done: false, value: 6240.6 });
    expect(send).toHaveBeenCalledWith('PUT', '/clubs/KBR000000001/goals/GL0000000002/marks/2026-11-24', { done: false, value: 6241 });
    expect(m.value).toBe(6240);
    const tap = fake({ mark: { goalId: 'GL0000000003', day: '2026-11-24', done: true, at: 5 } });
    await tap.api.putMark('KBR000000001', 'GL0000000003', '2026-11-24', { done: true });
    expect(tap.send.mock.calls[0][2]).toEqual({ done: true });
  });

  it('gets the report and the summary for a day', async () => {
    const r = fake({ day: '2026-11-24', goal, members: 0, doneToday: 0, neverDone: 0, rows: [] });
    await r.api.goalReport('KBR000000001', 'GL0000000001', '2026-11-24');
    expect(r.send).toHaveBeenCalledWith('GET', '/clubs/KBR000000001/goals/GL0000000001/report?day=2026-11-24');
    const s = fake({ goals: [] });
    await s.api.goalSummary('KBR000000001', '2026-11-24');
    expect(s.send).toHaveBeenCalledWith('GET', '/clubs/KBR000000001/goals/summary?day=2026-11-24');
  });

  it('sends a reminder to each person once', async () => {
    const { send, api } = fake();
    await api.remindGoal('KBR000000001', 'GL0000000001', ['p1', 'p2', 'p1']);
    expect(send).toHaveBeenCalledWith('POST', '/clubs/KBR000000001/goals/GL0000000001/remind', { pids: ['p1', 'p2'] });
  });

  it('says yes or no to goal tracking', async () => {
    const { send, api } = fake();
    await api.setGoalsConsent('SRN000000005', true);
    expect(send).toHaveBeenCalledWith('PUT', '/clubs/SRN000000005/goals/consent', { on: true });
  });
});
