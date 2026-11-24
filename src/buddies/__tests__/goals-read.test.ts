import { describe, expect, it } from '@jest/globals';

import { readClubGoals, readGoal, readGoalReply, readGoalReport, readGoalSummary, readMarkReply } from '../goals-read';
import { notifyOf, NOTIFY_DEFAULTS, readMe, readNotify } from '../read';

const ravi = { pid: 'P1RAVI000000', handle: 'ravi_walks', name: 'Ravi', relation: 'buddy' };
const asha = { pid: 'P3ASHA000000', handle: 'asha_runs', name: 'Asha', relation: 'none' };
const goal = {
  goalId: 'GL0000000001',
  title: 'Morning walk',
  kind: 'walk',
  target: 30,
  byTime: '07:00',
  days: [0, 1, 2, 3, 4, 5, 6],
  counted: 'auto',
  paused: false,
  createdBy: ravi,
  createdAt: 1_763_000_000_000,
};

describe('a goal', () => {
  it('reads a good goal with its target, by-time and maker', () => {
    const g = readGoal(goal);
    expect(g).toMatchObject({ goalId: 'GL0000000001', kind: 'walk', target: 30, byTime: '07:00', counted: 'auto', paused: false });
    expect(g.createdBy?.handle).toBe('ravi_walks');
  });

  it('leaves out a target and by-time the server did not send', () => {
    const { target: _t, byTime: _b, ...rest } = goal;
    const g = readGoal({ ...rest, kind: 'medicine', counted: 'tap' });
    expect(g.target).toBeNull();
    expect(g.byTime).toBeNull();
  });

  it('never counts medicine or anything by the phone, and drops odd days and times', () => {
    const g = readGoal({ ...goal, kind: 'medicine', counted: 'auto', days: [4, 0, 0, 9, 'x'], byTime: '25:00' });
    expect(g.counted).toBe('tap');
    expect(g.days).toEqual([0, 4]);
    expect(g.byTime).toBeNull();
  });

  it('refuses a goal without an id, a title, a known kind or any day', () => {
    expect(() => readGoal({ ...goal, goalId: 'bad id!' })).toThrow();
    expect(() => readGoal({ ...goal, title: '  ' })).toThrow();
    expect(() => readGoal({ ...goal, kind: 'pills' })).toThrow();
    expect(() => readGoal({ ...goal, days: [] })).toThrow();
    expect(() => readGoal(null)).toThrow();
  });

  it('reads the reply to a create or change', () => {
    expect(readGoalReply({ goal }).title).toBe('Morning walk');
    expect(() => readGoalReply({})).toThrow();
  });
});

describe("a club's goals", () => {
  it('reads goals, tracked and my marks, skipping broken goals', () => {
    const cg = readClubGoals({
      goals: [goal, { goalId: 'x' }],
      tracked: true,
      mine: [{ goalId: 'GL0000000001', done: true, at: 1_763_100_000_000 }],
    });
    expect(cg.goals).toHaveLength(1);
    expect(cg.tracked).toBe(true);
    expect(cg.mine).toEqual([{ goalId: 'GL0000000001', done: true, at: 1_763_100_000_000, value: null }]);
  });

  it('keeps no marks while I am not tracked, nor marks of goals it does not know', () => {
    expect(readClubGoals({ goals: [goal], tracked: false, mine: [{ goalId: 'GL0000000001', done: true }] }).mine).toEqual([]);
    expect(readClubGoals({ goals: [goal], tracked: true, mine: [{ goalId: 'GL0000000009', done: true }] }).mine).toEqual([]);
  });

  it('keeps a steps count on a mark not done yet, without a time', () => {
    const cg = readClubGoals({ goals: [goal], tracked: true, mine: [{ goalId: 'GL0000000001', done: false, at: 5, value: 6240 }] });
    expect(cg.mine[0]).toEqual({ goalId: 'GL0000000001', done: false, at: null, value: 6240 });
  });

  it('refuses an answer without a goals list', () => {
    expect(() => readClubGoals({ tracked: true })).toThrow();
  });
});

describe('a mark reply', () => {
  it('reads the mark with its day', () => {
    expect(readMarkReply({ mark: { goalId: 'GL0000000001', day: '2026-11-24', done: true, at: 7 } })).toEqual({
      goalId: 'GL0000000001',
      day: '2026-11-24',
      done: true,
      at: 7,
      value: null,
    });
    expect(() => readMarkReply({ mark: { goalId: 'GL0000000001', day: '24 Nov', done: true } })).toThrow();
  });
});

describe('a goal report', () => {
  const row = (walker: unknown, done: boolean, week: number, ever = true) => ({
    walker,
    role: 'member',
    today: done ? { done: true, at: 9 } : { done: false },
    week: { done: week, of: 7 },
    everDone: ever,
  });

  it('reads the numbers and rows, not done first then by name', () => {
    const r = readGoalReport({
      day: '2026-11-24',
      goal,
      members: 3,
      doneToday: 1,
      neverDone: 1,
      rows: [row(ravi, true, 6), row(asha, false, 0, false), { walker: null }],
    });
    expect(r.rows.map((x) => x.walker.handle)).toEqual(['asha_runs', 'ravi_walks']);
    expect(r).toMatchObject({ members: 3, doneToday: 1, neverDone: 1 });
    expect(r.rows[1].week).toEqual({ done: 6, of: 7 });
  });

  it('keeps the numbers inside what can be true', () => {
    const r = readGoalReport({ day: '2026-11-24', goal, members: 1, doneToday: 5, neverDone: 9, rows: [row(ravi, true, 9)] });
    expect(r.doneToday).toBe(1);
    expect(r.neverDone).toBe(0);
    expect(r.rows[0].week.done).toBe(7);
    // Done today means done at least once.
    expect(readGoalReport({ day: '2026-11-24', goal, rows: [row(ravi, true, 1, false)] }).rows[0].everDone).toBe(true);
  });

  it('refuses a report without a day, a goal or rows', () => {
    expect(() => readGoalReport({ goal, rows: [] })).toThrow();
    expect(() => readGoalReport({ day: '2026-11-24', rows: [] })).toThrow();
    expect(() => readGoalReport({ day: '2026-11-24', goal })).toThrow();
  });
});

describe('the goals summary', () => {
  it('reads done today of members per goal, skipping broken rows', () => {
    expect(
      readGoalSummary({ goals: [{ goalId: 'GL0000000001', doneToday: 9, members: 12 }, { goalId: '' }, { goalId: 'GL0000000002', doneToday: 20, members: 4 }] }),
    ).toEqual([
      { goalId: 'GL0000000001', doneToday: 9, members: 12 },
      { goalId: 'GL0000000002', doneToday: 4, members: 4 },
    ]);
    expect(() => readGoalSummary({})).toThrow();
  });
});

describe('the goal reminders switch on /me', () => {
  it('reads the switches, taking the default for a missing or odd one', () => {
    const me = readMe({ joined: true, pid: 'P1', handle: 'you_walk', counts: {}, notify: { goals: false, messages: 'no' } });
    expect(notifyOf(me).goals).toBe(false);
    expect(notifyOf(me).messages).toBe(true);
    expect(readNotify(null)).toEqual(NOTIFY_DEFAULTS);
  });

  it('starts goal reminders on for a copy saved before the switches', () => {
    expect(notifyOf({ joined: true, pid: 'P1', handle: 'h', name: null, handleChangeFrom: 0, nearby: false, areaSetOn: null, counts: { requestsIn: 0, unread: 0, clubInvites: 0, clubRequests: 0 } }).goals).toBe(true);
    expect(notifyOf(null).goals).toBe(true);
  });
});
