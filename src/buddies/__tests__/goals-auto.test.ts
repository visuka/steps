import { describe, expect, it, jest } from '@jest/globals';

import {
  activeMinOf,
  applyMarks,
  autoDecision,
  autoDue,
  autoMarks,
  countToday,
  EMPTY_PHONE,
  GOALS_AUTO_EVERY_MS,
  GOALS_AUTO_KEY,
  glassesOf,
  goalClubs,
  heartToday,
  mayUnmark,
  mealsOf,
  type PhoneToday,
  rideMinOf,
  runGoalsAuto,
  sleepMinOf,
  statusWords,
  walkMinOf,
  partlyKnown,
} from '../goals-auto';
import type { ClubGoals, Goal } from '../types';

const DAY = '2026-11-24'; // a Tuesday
const phone: PhoneToday = {
  steps: 6240,
  activeMin: 22,
  distanceM: 4310,
  walkMin: 32,
  rideMin: 45,
  sleepMin: 410,
  heart: true,
  bpReadings: 1,
  weightLogged: false,
  moodLogged: true,
  foodEntries: 2,
  meals: 2,
  waterGlasses: 5,
  nutrients: { kcal: 1250, protein: 38.5, addedSugar: 18, vitC: 95, sodium: 2100 },
  known: { kcal: true, protein: true, addedSugar: true, vitC: true, sodium: true },
  partial: {},
};

const goal = (goalId: string, over: Partial<Goal> = {}): Goal => ({
  goalId,
  title: 'Goal',
  kind: 'walk',
  target: 30,
  nutrientKey: null,
  byTime: null,
  days: [0, 1, 2, 3, 4, 5, 6],
  paused: false,
  createdBy: null,
  createdAt: 0,
  ...over,
});
const nutrient = (goalId: string, nutrientKey: Goal['nutrientKey'], target: number) => goal(goalId, { kind: 'nutrient', nutrientKey, target });

describe('what the phone decides', () => {
  it('compares each kind counted by the phone with its own number', () => {
    expect(autoDecision(goal('A', { kind: 'walk', target: 30 }), phone)).toEqual({ done: true, value: 32 });
    expect(autoDecision(goal('A', { kind: 'steps', target: 8000 }), phone)).toEqual({ done: false, value: 6240 });
    expect(autoDecision(goal('A', { kind: 'active', target: 20 }), phone)).toEqual({ done: true, value: 22 });
    expect(autoDecision(goal('A', { kind: 'distance', target: 5000 }), phone)).toEqual({ done: false, value: 4310 });
    expect(autoDecision(goal('A', { kind: 'ride', target: 45 }), phone)).toEqual({ done: true, value: 45 });
    expect(autoDecision(goal('A', { kind: 'sleep', target: 420 }), phone)).toEqual({ done: false, value: 410 });
    expect(autoDecision(goal('A', { kind: 'heart', target: null }), phone)).toEqual({ done: true, value: 1 });
    expect(autoDecision(goal('A', { kind: 'heart', target: null }), { ...phone, heart: false })).toEqual({ done: false, value: 0 });
  });

  it('compares each kind the person logs with what they logged today', () => {
    expect(autoDecision(goal('A', { kind: 'bp', target: 1 }), phone)).toEqual({ done: true, value: 1 });
    expect(autoDecision(goal('A', { kind: 'bp', target: 2 }), phone)).toEqual({ done: false, value: 1 });
    expect(autoDecision(goal('A', { kind: 'weight', target: null }), phone)).toEqual({ done: false, value: 0 });
    expect(autoDecision(goal('A', { kind: 'mood', target: null }), phone)).toEqual({ done: true, value: 1 });
    expect(autoDecision(goal('A', { kind: 'meals', target: 3 }), phone)).toEqual({ done: false, value: 2 });
    expect(autoDecision(goal('A', { kind: 'water', target: 5 }), phone)).toEqual({ done: true, value: 5 });
  });

  it('counts meals as the Food screen splits the day, not foods', () => {
    const at = (h: number, m = 0) => ({ loggedAt: new Date(2026, 10, 24, h, m).getTime() });
    // Rice, dal and curd at lunch: one meal.
    const lunch = [at(13), at(13, 5), at(13, 10)];
    expect(mealsOf(lunch)).toBe(1);
    expect(autoDecision(goal('A', { kind: 'meals', target: 3 }), { ...phone, foodEntries: 3, meals: mealsOf(lunch) })).toEqual({ done: false, value: 1 });
    const day = [at(8), ...lunch, at(17), at(20, 30)];
    expect(mealsOf(day)).toBe(4);
    expect(autoDecision(goal('A', { kind: 'meals', target: 3 }), { ...phone, foodEntries: 6, meals: mealsOf(day) })).toEqual({ done: true, value: 4 });
  });

  it('counts a nutrient at least: done once the day reaches the target', () => {
    expect(autoDecision(nutrient('A', 'protein', 50), phone)).toEqual({ done: false, value: 38.5 });
    expect(autoDecision(nutrient('A', 'vitC', 90), phone)).toEqual({ done: true, value: 95 });
    expect(autoDecision(nutrient('A', 'iron', 18), phone)).toEqual({ done: false, value: 0 });
  });

  it('counts a nutrient at most: done only with food logged and the total at or under the target', () => {
    expect(autoDecision(nutrient('A', 'addedSugar', 25), phone)).toEqual({ done: true, value: 18 });
    expect(autoDecision(nutrient('A', 'addedSugar', 18), phone)).toEqual({ done: true, value: 18 });
    expect(autoDecision(nutrient('A', 'sodium', 2000), phone)).toEqual({ done: false, value: 2100 });
    expect(autoDecision(nutrient('A', 'kcal', 1800), phone)).toEqual({ done: true, value: 1250 });
    // Nothing logged yet is not "at most".
    expect(autoDecision(nutrient('A', 'addedSugar', 25), EMPTY_PHONE)).toEqual({ done: false, value: 0 });
  });

  it('never marks at most for a nutrient the food log does not know, or knows only partly', () => {
    // A quick 600 kcal entry knows only calories: added sugar is "–" on the Food screen.
    const kcalOnly: PhoneToday = { ...EMPTY_PHONE, foodEntries: 1, meals: 1, nutrients: { kcal: 600 }, known: { kcal: true } };
    expect(autoDecision(nutrient('A', 'addedSugar', 25), kcalOnly)).toEqual({ done: false, value: 0 });
    expect(autoDecision(nutrient('A', 'kcal', 1800), kcalOnly)).toEqual({ done: true, value: 600 });
    // Some of today's foods know added sugar only partly ("≥ 12" on the Food screen).
    const partly: PhoneToday = { ...phone, nutrients: { ...phone.nutrients, addedSugar: 12 }, partial: { addedSugar: true } };
    expect(autoDecision(nutrient('A', 'addedSugar', 25), partly)).toEqual({ done: false, value: 12 });
    // An at-least goal still counts a partly known total: it can only be more.
    expect(autoDecision(nutrient('A', 'protein', 30), { ...phone, partial: { protein: true } })).toEqual({ done: true, value: 38.5 });
  });

  it('decides nothing for a goal missing the target or nutrient it needs', () => {
    expect(autoDecision(goal('A', { target: null }), phone)).toBeNull();
    expect(autoDecision(goal('A', { kind: 'nutrient', nutrientKey: null, target: 10 }), phone)).toBeNull();
  });

  it('only a nutrient at-most goal may be un-marked', () => {
    expect(mayUnmark(nutrient('A', 'addedSugar', 25))).toBe(true);
    expect(mayUnmark(nutrient('A', 'kcal', 1800))).toBe(true);
    expect(mayUnmark(nutrient('A', 'protein', 50))).toBe(false);
    expect(mayUnmark(goal('A', { kind: 'water', target: 8 }))).toBe(false);
  });
});

describe('the marks to send', () => {
  const cg = (goals: Goal[], mine: ClubGoals['mine'] = [], tracked = true): ClubGoals => ({ goals, tracked, mine });
  const done = (goalId: string, value: number | null = null) => ({ goalId, done: true, at: 1, value });

  it('marks a goal that has become done, once', () => {
    expect(autoMarks(cg([goal('A')]), phone, DAY)).toEqual([{ goalId: 'A', done: true }]);
    expect(autoMarks(cg([goal('A')], [done('A')]), phone, DAY)).toEqual([]);
  });

  it('marks every kind from the phone, and never sends a number but steps', () => {
    const goals = [
      goal('HR', { kind: 'heart', target: null }),
      goal('BP', { kind: 'bp', target: 1 }),
      goal('MD', { kind: 'mood', target: null }),
      goal('WT', { kind: 'weight', target: null }),
      goal('WA', { kind: 'water', target: 5 }),
      goal('AC', { kind: 'active', target: 20 }),
      nutrient('VC', 'vitC', 90),
      nutrient('SU', 'addedSugar', 25),
    ];
    const sent = autoMarks(cg(goals), phone, DAY);
    expect(sent).toEqual(['HR', 'BP', 'MD', 'WA', 'AC', 'VC', 'SU'].map((goalId) => ({ goalId, done: true })));
    expect(sent.every((m) => !('value' in m))).toBe(true);
  });

  it('sends a steps count that moved by 100 or more, rounded down', () => {
    const steps = goal('S', { kind: 'steps', target: 8000 });
    expect(autoMarks(cg([steps]), phone, DAY)).toEqual([{ goalId: 'S', done: false, value: 6200 }]);
    expect(autoMarks(cg([steps], [{ goalId: 'S', done: false, at: null, value: 6200 }]), phone, DAY)).toEqual([]);
    expect(autoMarks(cg([steps], [{ goalId: 'S', done: false, at: null, value: 6100 }]), phone, DAY)).toEqual([{ goalId: 'S', done: false, value: 6200 }]);
  });

  it('never un-marks a done goal', () => {
    const steps = goal('S', { kind: 'steps', target: 8000 });
    expect(autoMarks(cg([steps], [done('S', 5000)]), phone, DAY)).toEqual([{ goalId: 'S', done: true, value: 6200 }]);
    expect(autoMarks(cg([goal('B', { kind: 'bp', target: 2 })], [done('B')]), phone, DAY)).toEqual([]);
    expect(autoMarks(cg([nutrient('P', 'protein', 50)], [done('P')]), phone, DAY)).toEqual([]);
  });

  it('un-marks a nutrient at-most goal once the day goes over, and marks it again when back under', () => {
    const salt = nutrient('NA', 'sodium', 2000);
    expect(autoMarks(cg([salt], [done('NA')]), phone, DAY)).toEqual([{ goalId: 'NA', done: false }]);
    expect(autoMarks(cg([salt], [{ goalId: 'NA', done: false, at: null, value: null }]), phone, DAY)).toEqual([]);
    expect(autoMarks(cg([salt]), { ...phone, nutrients: { sodium: 1500 } }, DAY)).toEqual([{ goalId: 'NA', done: true }]);
    // Food removed until nothing is logged: no longer done.
    expect(autoMarks(cg([nutrient('SU', 'addedSugar', 25)], [done('SU')]), EMPTY_PHONE, DAY)).toEqual([{ goalId: 'SU', done: false }]);
  });

  it('leaves out goals not due today, paused goals, and clubs where I am not tracked', () => {
    expect(autoMarks(cg([goal('D', { days: [0] }), goal('P', { paused: true })]), phone, DAY)).toEqual([]);
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

describe('what my row says', () => {
  const clock = { uses24h: false, locale: 'en-IN' };
  const doneAt = { goalId: 'SU', done: true, at: new Date(2026, 10, 24, 9, 5).getTime(), value: null };

  it('shows an at-most goal over its target at once, though the server still says done', () => {
    const sugar = nutrient('SU', 'addedSugar', 25);
    const over: PhoneToday = { ...phone, nutrients: { ...phone.nutrients, addedSugar: 40 } };
    expect(statusWords(sugar, doneAt, over, clock)).toBe('40 of at most 25 g');
    // Still under: the done mark stays.
    expect(statusWords(sugar, doneAt, phone, clock)).toMatch(/^Done/);
    // Not known any more is not shown as done either.
    expect(statusWords(sugar, doneAt, { ...phone, known: { kcal: true } }, clock)).toBe('Not known yet');
  });

  it('keeps a done mark for every other goal, and shows the count before one', () => {
    const steps = goal('S', { kind: 'steps', target: 8000 });
    expect(statusWords(steps, { ...doneAt, goalId: 'S' }, phone, clock)).toMatch(/^Done/);
    expect(statusWords(steps, null, phone, clock)).toBe('6,240 of 8,000 steps');
    expect(statusWords(steps, { goalId: 'S', done: false, at: null, value: 5000 }, null, clock)).toBe('5,000 of 8,000 steps');
    expect(statusWords(steps, null, null, clock)).toBe('Not marked yet');
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
    expect(rideMinOf(walks, DAY)).toBe(60);
    expect(rideMinOf([{ startedAt: at(7), movingS: 1500, activity: 'walk' }], DAY)).toBe(0);
  });

  it('counts active minutes as Today shows them', () => {
    const row = { date: DAY, activeMin: 41.6, briskMin: 30, runMin: 5 };
    expect(activeMinOf(row, DAY)).toBe(42);
    expect(activeMinOf({ ...row, activeMin: null }, DAY)).toBe(35);
    expect(activeMinOf({ ...row, activeMin: null, briskMin: null, runMin: null }, DAY)).toBe(0);
    expect(activeMinOf({ ...row, date: '2026-11-23' }, DAY)).toBe(0);
    expect(activeMinOf(null, DAY)).toBe(0);
  });

  it('finds a heart rate from a watch, or a pulse with blood pressure, today only', () => {
    const at = (d: number, h: number) => new Date(2026, 10, d, h).getTime();
    const watch = { date: DAY, restingBpm: null, avgBpm: 72, minBpm: null, maxBpm: null };
    expect(heartToday([watch], [], DAY)).toBe(true);
    expect(heartToday([{ ...watch, avgBpm: null }], [], DAY)).toBe(false);
    expect(heartToday([{ ...watch, date: '2026-11-23' }], [], DAY)).toBe(false);
    expect(heartToday([], [{ loggedAt: at(24, 8), pulse: 68 }], DAY)).toBe(true);
    expect(heartToday([], [{ loggedAt: at(24, 8), pulse: null }, { loggedAt: at(23, 8), pulse: 70 }], DAY)).toBe(false);
  });

  it("counts today's readings and entries", () => {
    const at = (d: number, h: number) => new Date(2026, 10, d, h).getTime();
    expect(countToday([{ loggedAt: at(24, 8) }, { loggedAt: at(24, 21) }, { loggedAt: at(23, 23) }], DAY)).toBe(2);
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
      clubGoals: jest.fn(async (_id: string, _day: string): Promise<ClubGoals> => ({ goals: [goal('A'), goal('Z', { kind: 'sleep', target: 420 })], tracked: true, mine: [] })),
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

  it("marks the goals of clubs with goals where I'm a member, and remembers when", async () => {
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

describe('partlyKnown', () => {
  it('marks a key partly known when a calories-only entry sits next to a food that knows it', () => {
    expect(partlyKnown([{ kcal: 300, addedSugar: 10 }, { kcal: 210 }], {})).toEqual({ addedSugar: true });
  });
  it('leaves keys every entry knows alone, and keeps the food book missing keys', () => {
    expect(partlyKnown([{ kcal: 300, protein: 8 }, { kcal: 100, protein: 2 }], { fiber: true })).toEqual({ fiber: true });
  });
});

