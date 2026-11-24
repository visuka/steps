import { describe, expect, it, jest } from '@jest/globals';

import {
  applyMarks,
  autoDecision,
  autoDue,
  autoMarks,
  GOALS_AUTO_EVERY_MS,
  GOALS_AUTO_KEY,
  glassesOf,
  goalClubs,
  type PhoneToday,
  runGoalsAuto,
  sleepMinOf,
  walkMinOf,
} from '../goals-auto';
import type { ClubGoals, Goal } from '../types';

const DAY = '2026-11-24'; // a Tuesday
const phone: PhoneToday = { steps: 6240, waterGlasses: 5, sleepMin: 410, walkMin: 32 };

const goal = (goalId: string, over: Partial<Goal> = {}): Goal => ({
  goalId,
  title: 'Goal',
  kind: 'walk',
  target: 30,
  byTime: null,
  days: [0, 1, 2, 3, 4, 5, 6],
  counted: 'auto',
  paused: false,
  createdBy: null,
  createdAt: 0,
  ...over,
});

describe('what the phone decides', () => {
  it('compares each kind with its own number', () => {
    expect(autoDecision(goal('A', { kind: 'walk', target: 30 }), phone)).toEqual({ done: true, value: 32 });
    expect(autoDecision(goal('A', { kind: 'steps', target: 8000 }), phone)).toEqual({ done: false, value: 6240 });
    expect(autoDecision(goal('A', { kind: 'water', target: 5 }), phone)).toEqual({ done: true, value: 5 });
    expect(autoDecision(goal('A', { kind: 'sleep', target: 420 }), phone)).toEqual({ done: false, value: 410 });
  });

  it('decides nothing for a tap goal or one without a target', () => {
    expect(autoDecision(goal('A', { counted: 'tap' }), phone)).toBeNull();
    expect(autoDecision(goal('A', { target: null }), phone)).toBeNull();
  });
});

describe('the marks to send', () => {
  const cg = (goals: Goal[], mine: ClubGoals['mine'] = [], tracked = true): ClubGoals => ({ goals, tracked, mine });

  it('marks a goal that has become done, once', () => {
    expect(autoMarks(cg([goal('A')]), phone, DAY)).toEqual([{ goalId: 'A', done: true }]);
    expect(autoMarks(cg([goal('A')], [{ goalId: 'A', done: true, at: 1, value: null }]), phone, DAY)).toEqual([]);
  });

  it('sends a steps count that moved by 100 or more, rounded down', () => {
    const steps = goal('S', { kind: 'steps', target: 8000 });
    expect(autoMarks(cg([steps]), phone, DAY)).toEqual([{ goalId: 'S', done: false, value: 6200 }]);
    expect(autoMarks(cg([steps], [{ goalId: 'S', done: false, at: null, value: 6200 }]), phone, DAY)).toEqual([]);
    expect(autoMarks(cg([steps], [{ goalId: 'S', done: false, at: null, value: 6100 }]), phone, DAY)).toEqual([{ goalId: 'S', done: false, value: 6200 }]);
  });

  it('never un-marks a done goal', () => {
    const steps = goal('S', { kind: 'steps', target: 8000 });
    expect(autoMarks(cg([steps], [{ goalId: 'S', done: true, at: 1, value: 5000 }]), phone, DAY)).toEqual([{ goalId: 'S', done: true, value: 6200 }]);
  });

  it('leaves out tap goals, goals not due today, paused goals, and clubs where I am not tracked', () => {
    expect(autoMarks(cg([goal('T', { counted: 'tap' }), goal('D', { days: [0] }), goal('P', { paused: true })]), phone, DAY)).toEqual([]);
    expect(autoMarks(cg([goal('A')], [], false), phone, DAY)).toEqual([]);
  });

  it('shows the marks sent without asking again', () => {
    expect(applyMarks([{ goalId: 'A', done: false, at: null, value: 100 }], [{ goalId: 'A', done: true, at: 9 }, { goalId: 'B', done: true, at: 8 }])).toEqual([
      { goalId: 'A', done: true, at: 9, value: 100 },
      { goalId: 'B', done: true, at: 8, value: null },
    ]);
    expect(applyMarks([{ goalId: 'A', done: true, at: 9, value: null }], [{ goalId: 'A', done: false }])).toEqual([{ goalId: 'A', done: false, at: null, value: null }]);
  });
});

describe("the phone's numbers", () => {
  it('counts glasses as the Today tile does', () => {
    expect(glassesOf(1000, 300, 250)).toBe(5);
    expect(glassesOf(1000, 0, 0)).toBe(0);
  });

  it("adds last night's sleep that ended today", () => {
    expect(sleepMinOf([{ date: DAY, asleepMin: 380 }, { date: DAY, asleepMin: 30.4 }, { date: '2026-11-23', asleepMin: 400 }], DAY)).toBe(410);
  });

  it("takes today's longest walk in whole minutes, never a ride", () => {
    const at = (h: number) => new Date(2026, 10, 24, h).getTime();
    const walks = [
      { startedAt: at(6), movingS: 1920, activity: 'walk' as const },
      { startedAt: at(9), movingS: 3600, activity: 'ride' as const },
      { startedAt: at(12), movingS: 600 },
      { startedAt: new Date(2026, 10, 23, 18).getTime(), movingS: 5000 },
    ];
    expect(walkMinOf(walks, DAY)).toBe(32);
  });
});

describe('the runner', () => {
  const NOW = new Date(2026, 10, 24, 9, 0).getTime();

  function setup(saved: unknown = null) {
    const store = new Map<string, unknown>(saved ? [[GOALS_AUTO_KEY, saved]] : []);
    const kv = {
      getKv: async <T,>(k: string) => (store.get(k) as T) ?? null,
      setKv: async <T,>(k: string, v: T) => {
        store.set(k, v);
      },
    };
    const api = {
      myClubs: jest.fn(async () => [
        { clubId: 'KBR000000001', goals: true, myState: 'member' as const },
        { clubId: 'JHE000000003', goals: false, myState: 'member' as const },
        { clubId: 'NRS000000002', goals: true, myState: 'asked' as const },
      ]),
      clubGoals: jest.fn(async (_id: string, _day: string): Promise<ClubGoals> => ({ goals: [goal('A'), goal('T', { counted: 'tap' })], tracked: true, mine: [] })),
      putMark: jest.fn(async (_id: string, _goalId: string, _day: string, _m: { done: boolean; value?: number | null }) => ({})),
    };
    const read = jest.fn(async () => phone);
    return { store, kv, api, read };
  }

  it('looks again after 15 minutes or on another day', () => {
    expect(autoDue(null, DAY, NOW)).toBe(true);
    expect(autoDue({ at: NOW, day: DAY, clubs: [], clubsAt: NOW }, DAY, NOW + GOALS_AUTO_EVERY_MS - 1)).toBe(false);
    expect(autoDue({ at: NOW, day: DAY, clubs: [], clubsAt: NOW }, DAY, NOW + GOALS_AUTO_EVERY_MS)).toBe(true);
    expect(autoDue({ at: NOW, day: '2026-11-23', clubs: [], clubsAt: NOW }, DAY, NOW + 1)).toBe(true);
    expect(goalClubs([{ clubId: 'A', goals: true, myState: 'member' }, { clubId: 'B', goals: true, myState: 'invited' }])).toEqual(['A']);
  });

  it("marks the auto goals of clubs with goals where I'm a member, and remembers when", async () => {
    const { store, kv, api, read } = setup();
    expect(await runGoalsAuto({ kv, api, phone: read, today: DAY, now: NOW })).toBe(1);
    expect(api.clubGoals).toHaveBeenCalledTimes(1);
    expect(api.clubGoals).toHaveBeenCalledWith('KBR000000001', DAY);
    expect(api.putMark).toHaveBeenCalledWith('KBR000000001', 'A', DAY, { done: true });
    expect(store.get(GOALS_AUTO_KEY)).toEqual({ at: NOW, day: DAY, clubs: ['KBR000000001'], clubsAt: NOW });
  });

  it('does nothing inside the 15 minutes, unless asked to', async () => {
    const { kv, api, read } = setup({ at: NOW, day: DAY, clubs: ['KBR000000001'], clubsAt: NOW });
    expect(await runGoalsAuto({ kv, api, phone: read, today: DAY, now: NOW + 60_000 })).toBe(0);
    expect(api.clubGoals).not.toHaveBeenCalled();
    expect(await runGoalsAuto({ kv, api, phone: read, today: DAY, now: NOW + 60_000, force: true })).toBe(1);
    expect(api.myClubs).not.toHaveBeenCalled();
  });

  it('skips a club where I am not tracked, and a club that fails', async () => {
    const { kv, api, read } = setup();
    api.myClubs.mockResolvedValueOnce([
      { clubId: 'KBR000000001', goals: true, myState: 'member' },
      { clubId: 'SRN000000005', goals: true, myState: 'member' },
    ]);
    api.clubGoals.mockRejectedValueOnce(new Error('gone')).mockResolvedValueOnce({ goals: [goal('A')], tracked: false, mine: [] });
    expect(await runGoalsAuto({ kv, api, phone: read, today: DAY, now: NOW })).toBe(0);
    expect(api.putMark).not.toHaveBeenCalled();
  });

  it('reads nothing from the phone when no club has goals', async () => {
    const { kv, api, read } = setup();
    api.myClubs.mockResolvedValueOnce([]);
    expect(await runGoalsAuto({ kv, api, phone: read, today: DAY, now: NOW })).toBe(0);
    expect(read).not.toHaveBeenCalled();
  });
});
