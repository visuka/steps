import { describe, expect, it } from '@jest/globals';

import {
  byTimeWords,
  canAuto,
  clubGoalWords,
  daysWord,
  digestWords,
  dueOn,
  formOf,
  goalErrorText,
  goalLine,
  goalProblem,
  goalsDigest,
  liveWords,
  markWords,
  minutesWords,
  remindTargets,
  stepTarget,
  summaryLine,
  targetWords,
  trackedCount,
  weekdayOf,
  weekLine,
  withKind,
} from '../goals';
import { SocialError, socialErrorFor } from '../read';
import type { Goal, GoalReport } from '../types';

const h12 = { uses24h: false };
const h24 = { uses24h: true };

const goal = (over: Partial<Goal> = {}): Goal => ({
  goalId: 'GL0000000001',
  title: 'Morning walk',
  kind: 'walk',
  target: 30,
  byTime: '07:00',
  days: [0, 1, 2, 3, 4, 5, 6],
  counted: 'auto',
  paused: false,
  createdBy: null,
  createdAt: 0,
  ...over,
});

describe('days', () => {
  it('counts Monday as 0', () => {
    expect(weekdayOf('2026-11-23')).toBe(0); // a Monday
    expect(weekdayOf('2026-11-24')).toBe(1);
    expect(weekdayOf('2026-11-29')).toBe(6);
  });

  it('says the days plainly', () => {
    expect(daysWord([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(daysWord([4, 3, 2, 1, 0])).toBe('Weekdays');
    expect(daysWord([5, 6])).toBe('Weekends');
    expect(daysWord([4, 0, 2])).toBe('Mon, Wed, Fri');
  });

  it('is due on its days, never while paused', () => {
    expect(dueOn(goal({ days: [1] }), '2026-11-24')).toBe(true);
    expect(dueOn(goal({ days: [0] }), '2026-11-24')).toBe(false);
    expect(dueOn(goal({ paused: true }), '2026-11-24')).toBe(false);
  });
});

describe('words', () => {
  it('says targets in their units', () => {
    expect(targetWords('steps', 8000)).toBe('8,000 steps');
    expect(targetWords('walk', 30)).toBe('30 min');
    expect(targetWords('sleep', 450)).toBe('7 h 30 min');
    expect(targetWords('sleep', 420)).toBe('7 h');
    expect(targetWords('water', 1)).toBe('1 glass');
    expect(minutesWords(45)).toBe('45 min');
  });

  it('says the by-time as the phone shows times', () => {
    expect(byTimeWords('07:00', h12)).toBe('7:00 am');
    expect(byTimeWords('20:30', h24)).toBe('20:30');
  });

  it('puts a goal on one line', () => {
    expect(goalLine(goal(), h12)).toBe('30 min · Every day · by 7:00 am');
    expect(goalLine(goal({ kind: 'medicine', target: null, byTime: null, days: [0, 1, 2, 3, 4], paused: true }), h12)).toBe('Weekdays · Paused');
  });

  it('says done with the time, or not marked yet, never missed', () => {
    const at = new Date(2026, 10, 24, 8, 12).getTime();
    expect(markWords({ done: true, at }, h12)).toBe('Done 8:12 am');
    expect(markWords({ done: false, at: null }, h12)).toBe('Not marked yet');
    expect(markWords(null, h12)).toBe('Not marked yet');
    expect(summaryLine({ doneToday: 9, members: 12 })).toBe('9 of 12 done');
    expect(weekLine({ done: 6, of: 7 })).toBe('6 of 7 days');
    expect(weekLine({ done: 1, of: 1 })).toBe('1 of 1 day');
  });

  it("says what the phone counted against the target", () => {
    expect(liveWords('steps', 6240, 8000)).toBe('6,240 of 8,000 steps');
    expect(liveWords('water', 5, 8)).toBe('5 of 8 glasses');
    expect(liveWords('walk', 12, 30)).toBe('12 min of 30 min walked');
    expect(liveWords('sleep', 410, 420)).toBe('6 h 50 min of 7 h slept');
  });
});

describe('the form', () => {
  it('starts a new goal from the kind', () => {
    expect(formOf(null)).toMatchObject({ kind: 'walk', target: 30, counted: 'auto', days: [0, 1, 2, 3, 4, 5, 6], byTime: null });
    expect(formOf(null, 'medicine')).toMatchObject({ target: null, counted: 'tap' });
  });

  it('changing the kind keeps a typed name, and taps what the phone cannot count', () => {
    const typed = { ...formOf(null), title: 'KBR loop' };
    expect(withKind(typed, 'medicine')).toMatchObject({ title: 'KBR loop', counted: 'tap', target: null });
    expect(withKind(formOf(null), 'steps')).toMatchObject({ title: 'Daily steps', target: 8000, counted: 'auto' });
    expect(canAuto('other')).toBe(false);
  });

  it('moves a target in steps inside the range', () => {
    expect(stepTarget('steps', 8000, 1)).toBe(8500);
    expect(stepTarget('steps', 500, -1)).toBe(500);
    expect(stepTarget('walk', 240, 1)).toBe(240);
  });

  it('finds what is wrong before saving', () => {
    expect(goalProblem(formOf(null))).toBeNull();
    expect(goalProblem({ ...formOf(null), title: ' ' })).toBe('Give the goal a name.');
    expect(goalProblem({ ...formOf(null), title: 'x'.repeat(41) })).toMatch(/40/);
    expect(goalProblem({ ...formOf(null), days: [] })).toBe('Pick at least one day.');
    expect(goalProblem({ ...formOf(null, 'medicine'), counted: 'auto' })).toMatch(/phone/);
    expect(goalProblem({ ...formOf(null), target: null })).toMatch(/target/);
    expect(goalProblem({ ...formOf(null), target: 999 })).toMatch(/range/);
  });
});

describe('reminders and the home tile', () => {
  it('reminds only those not done today, never me', () => {
    const row = (pid: string, done: boolean) => ({
      walker: { pid, handle: pid, name: null, relation: 'none' as const },
      role: 'member' as const,
      today: { done, at: null, value: null },
      week: { done: 0, of: 7 },
      everDone: done,
    });
    const report: GoalReport = { day: '2026-11-24', goal: goal(), members: 3, doneToday: 1, neverDone: 2, rows: [row('me', false), row('p1', false), row('p2', true)] };
    expect(remindTargets(report, 'me')).toEqual(['p1']);
  });

  it("counts today's goals done across tracked clubs", () => {
    const tracked = { goals: { goals: [goal(), goal({ goalId: 'GL0000000002', days: [0] })], tracked: true, mine: [{ goalId: 'GL0000000001', done: true, at: 1, value: null }] } };
    const untracked = { goals: { goals: [goal()], tracked: false, mine: [] } };
    expect(goalsDigest([tracked, untracked, { goals: null }], '2026-11-24')).toEqual({ done: 1, due: 1 });
    expect(digestWords({ done: 1, due: 3 }, 2)).toBe('1 of 3 done today');
    expect(digestWords({ done: 0, due: 0 }, 1)).toBe('No goals today');
    expect(digestWords(null, 0)).toBe('Shared goals from your clubs');
  });

  it("says one line per club, and counts the clubs that track my goals", () => {
    const done = { goalId: 'GL0000000001', done: true, at: 1, value: null };
    const two = { goals: [goal(), goal({ goalId: 'GL0000000002' })], tracked: true, mine: [done] };
    expect(clubGoalWords(two, '2026-11-24')).toBe('1 of 2 goals done today');
    expect(clubGoalWords({ goals: [goal()], tracked: true, mine: [done] }, '2026-11-24')).toBe('1 of 1 goal done today');
    expect(clubGoalWords({ goals: [goal({ paused: true })], tracked: true, mine: [] }, '2026-11-24')).toBe('No goals today');
    expect(clubGoalWords({ goals: [goal()], tracked: false, mine: [] }, '2026-11-24')).toBe('Goal tracking is off');
    expect(clubGoalWords(null, '2026-11-24')).toBeNull();
    expect(clubGoalWords(undefined, '2026-11-24')).toBeNull();
    expect(trackedCount([{ goals: two }, { goals: { tracked: false } }, { goals: null }])).toBe(1);
    expect(trackedCount([])).toBe(0);
  });
});

describe('goal errors', () => {
  it('says each reason plainly', () => {
    expect(goalErrorText(socialErrorFor(409, 'conflict', 'goal_limit'))).toBe('A club can have 10 goals.');
    expect(goalErrorText(socialErrorFor(409, 'conflict', 'goals_consent'))).toMatch(/goal tracking/);
    expect(goalErrorText(socialErrorFor(429, 'daily_limit'))).toMatch(/already sent today/);
    expect(goalErrorText(socialErrorFor(400, 'bad_request', 'target'))).toMatch(/range/);
    expect(goalErrorText(socialErrorFor(422, 'text_not_allowed'))).toMatch(/not allowed/);
    expect(goalErrorText(new SocialError('offline'))).toBe(new SocialError('offline').message);
    expect(goalErrorText(new Error('x'))).toBe('Something went wrong. Try again.');
  });
});
