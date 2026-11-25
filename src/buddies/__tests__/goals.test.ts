import { describe, expect, it } from '@jest/globals';

import {
  autoTitle,
  byTimeWords,
  clubGoalWords,
  countedWord,
  daysWord,
  digestWords,
  dueOn,
  formOf,
  GOAL_TITLE_MAX,
  goalErrorText,
  goalLine,
  goalProblem,
  goalsDigest,
  isGoalNutrient,
  isLogged,
  KIND_ORDER,
  liveWords,
  markWords,
  minutesWords,
  NUTRIENT_GOALS,
  NUTRIENT_GROUPS,
  nutrientDir,
  rangeOf,
  remindTargets,
  stepTarget,
  summaryLine,
  targetWords,
  trackedCount,
  weekdayOf,
  weekLine,
  withKind,
  withNutrient,
  withTarget,
} from '../goals';
import { SocialError, socialErrorFor } from '../read';
import { NUTRIENTS } from '@/nutrition/nutrients';
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
  nutrientKey: null,
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
    expect(targetWords('ride', 90)).toBe('1 h 30 min');
    expect(targetWords('active', 30)).toBe('30 active min');
    expect(targetWords('sleep', 450)).toBe('7 h 30 min');
    expect(targetWords('sleep', 420)).toBe('7 h');
    expect(targetWords('water', 1)).toBe('1 glass');
    expect(targetWords('bp', 1)).toBe('1 reading');
    expect(targetWords('bp', 2)).toBe('2 readings');
    expect(targetWords('meals', 3)).toBe('3 meals');
    expect(targetWords('distance', 5000)).toBe('5 km');
    expect(targetWords('distance', 2500)).toBe('2.5 km');
    expect(targetWords('distance', 4828, null, 'imperial')).toBe('3 mi');
    expect(targetWords('nutrient', 50, 'protein')).toBe('50 g or more');
    expect(targetWords('nutrient', 25, 'addedSugar')).toBe('25 g or less');
    expect(targetWords('nutrient', 2000, 'kcal')).toBe('2,000 kcal or less');
    expect(targetWords('nutrient', 0.4, 'transFat')).toBe('0.4 g or less');
    expect(targetWords('nutrient', 2.4, 'vitB12')).toBe('2.4 µg or more');
    expect(minutesWords(45)).toBe('45 min');
  });

  it('says the by-time as the phone shows times', () => {
    expect(byTimeWords('07:00', h12)).toBe('7:00 am');
    expect(byTimeWords('20:30', h24)).toBe('20:30');
  });

  it('puts a goal on one line', () => {
    expect(goalLine(goal(), h12)).toBe('30 min · Every day · by 7:00 am');
    expect(goalLine(goal({ kind: 'weight', target: null, byTime: null, days: [0, 1, 2, 3, 4], paused: true }), h12)).toBe('Logged · Weekdays · Paused');
    expect(goalLine(goal({ kind: 'nutrient', nutrientKey: 'protein', target: 50, byTime: null }), h12)).toBe('Protein 50 g or more · Every day');
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

  it('says what the phone counted against the target, for every kind', () => {
    const g = (kind: Goal['kind'], target: number | null, nutrientKey: Goal['nutrientKey'] = null) => ({ kind, target, nutrientKey });
    expect(liveWords(g('steps', 8000), 6240)).toBe('6,240 of 8,000 steps');
    expect(liveWords(g('active', 30), 12)).toBe('12 of 30 active min');
    expect(liveWords(g('distance', 5000), 2140)).toBe('2.1 of 5 km');
    expect(liveWords(g('water', 8), 5)).toBe('5 of 8 glasses');
    expect(liveWords(g('walk', 30), 12)).toBe('12 min of 30 min walked');
    expect(liveWords(g('ride', 60), 45)).toBe('45 min of 1 h ridden');
    expect(liveWords(g('sleep', 420), 410)).toBe('6 h 50 min of 7 h slept');
    expect(liveWords(g('heart', null), 0)).toBe('No heart rate yet');
    expect(liveWords(g('heart', null), 1)).toBe('Heart rate recorded');
    expect(liveWords(g('bp', 2), 0)).toBe('No reading yet');
    expect(liveWords(g('bp', 2), 1)).toBe('1 of 2 readings');
    expect(liveWords(g('weight', null), 0)).toBe('Not logged yet');
    expect(liveWords(g('mood', null), 1)).toBe('Logged');
    expect(liveWords(g('meals', 3), 0)).toBe('No food logged yet');
    expect(liveWords(g('meals', 3), 2)).toBe('2 of 3 meals');
    expect(liveWords(g('nutrient', 50, 'protein'), 32.4)).toBe('32 of 50 g');
    const food = (entries: number, known = true, partial = false) => ({ entries, known, partial });
    expect(liveWords(g('nutrient', 25, 'addedSugar'), 0, 'metric', food(0, false))).toBe('No food logged yet');
    expect(liveWords(g('nutrient', 25, 'addedSugar'), 31, 'metric', food(2))).toBe('31 of at most 25 g');
    // As the Food screen shows it: "–" (not known) and "≥" (partly known).
    expect(liveWords(g('nutrient', 25, 'addedSugar'), 0, 'metric', food(1, false))).toBe('Not known yet');
    expect(liveWords(g('nutrient', 25, 'addedSugar'), 18, 'metric', food(2, true, true))).toBe('≥ 18 of at most 25 g');
    expect(liveWords(g('nutrient', 50, 'protein'), 0, 'metric', food(1, false))).toBe('Not known yet');
    expect(liveWords(g('nutrient', 50, 'protein'), 32.4, 'metric', food(2, true, true))).toBe('≥ 32 of 50 g');
  });

  it('says how a goal is counted', () => {
    expect(countedWord('steps')).toBe('Counted by the phone');
    expect(countedWord('heart')).toBe('Counted by the phone');
    expect(countedWord('bp')).toBe('Counted from what you log');
    expect(countedWord('nutrient', 'members')).toBe('Counted from what members log');
    expect(KIND_ORDER.filter(isLogged)).toEqual(['bp', 'weight', 'mood', 'meals', 'water', 'nutrient']);
  });

  it('builds a plain name from the choice', () => {
    expect(autoTitle({ kind: 'steps', target: 8000, nutrientKey: null })).toBe('8,000 steps');
    expect(autoTitle({ kind: 'bp', target: 1, nutrientKey: null })).toBe('Check blood pressure');
    expect(autoTitle({ kind: 'bp', target: 2, nutrientKey: null })).toBe('Check blood pressure 2 times');
    expect(autoTitle({ kind: 'nutrient', target: 50, nutrientKey: 'protein' })).toBe('Protein 50 g or more');
    expect(autoTitle({ kind: 'nutrient', target: 25, nutrientKey: 'addedSugar' })).toBe('Added sugar 25 g or less');
    expect(autoTitle({ kind: 'nutrient', target: null, nutrientKey: null })).toBe('');
    expect(autoTitle({ kind: 'distance', target: 5000, nutrientKey: null })).toBe('5 km on foot');
    expect(autoTitle({ kind: 'water', target: 8, nutrientKey: null })).toBe('8 glasses of water');
    for (const kind of KIND_ORDER) {
      for (const key of kind === 'nutrient' ? NUTRIENT_GOALS.map((x) => x.key) : [null]) {
        const r = rangeOf(kind, key);
        for (const target of r ? [r.min, r.start, r.max] : [null]) {
          expect(autoTitle({ kind, target, nutrientKey: key }).length).toBeLessThanOrEqual(GOAL_TITLE_MAX);
        }
      }
    }
  });
});

describe('the nutrients a goal can count', () => {
  it('match nutrients.ts: every nutrient with a daily value or limit, calories and limits at most', () => {
    // NUTRIENT_GOALS is a fixed copy kept the same as server goals.py NUTRIENTS; this keeps it the same as nutrients.ts.
    const expected = NUTRIENTS.filter((x) => (x.daily ?? x.limit) !== undefined).map((x) => ({
      key: x.key,
      dir: x.group === 'limit' || x.key === 'kcal' ? 'most' : 'least',
      ref: x.daily ?? x.limit,
    }));
    expect(NUTRIENT_GOALS).toEqual(expected);
    for (const k of ['alcohol', 'gl', 'sugars', 'pills', null]) expect(isGoalNutrient(k)).toBe(false);
  });

  it('groups them in four plain lists, each nutrient once', () => {
    expect(NUTRIENT_GROUPS.map((g) => g.title)).toEqual(['Energy & macros', 'Limits', 'Vitamins', 'Minerals']);
    expect(NUTRIENT_GROUPS.flatMap((g) => g.keys).sort()).toEqual(NUTRIENT_GOALS.map((x) => x.key).sort());
    expect(NUTRIENT_GROUPS[1].keys).toEqual(['sodium', 'addedSugar', 'satFat', 'transFat', 'cholesterol', 'caffeine']);
  });

  it('moves a nutrient target in tidy steps, above 0 and up to 10 times its daily value', () => {
    expect(nutrientDir('kcal')).toBe('most');
    expect(nutrientDir('protein')).toBe('least');
    expect(rangeOf('nutrient', 'protein')).toEqual({ min: 5, max: 500, step: 5, start: 50 });
    expect(rangeOf('nutrient', 'kcal')).toEqual({ min: 200, max: 20000, step: 200, start: 2000 });
    expect(rangeOf('nutrient', 'transFat')).toMatchObject({ min: 0.2, step: 0.2, start: 2.2 });
    expect(rangeOf('nutrient', null)).toBeNull();
    expect(stepTarget('nutrient', 50, 1, 'protein')).toBe(55);
    expect(stepTarget('nutrient', 2.2, -1, 'transFat')).toBe(2);
    expect(stepTarget('nutrient', 0.2, -1, 'transFat')).toBe(0.2);
    expect(stepTarget('nutrient', 1.6, 1, 'omega3')).toBe(1.7);
    expect(stepTarget('nutrient', 500, 1, 'protein')).toBe(500);
  });
});

describe('the form', () => {
  it('starts a new goal from the kind, its name built from it', () => {
    expect(formOf(null)).toMatchObject({ kind: 'steps', target: 8000, title: '8,000 steps', nutrientKey: null, days: [0, 1, 2, 3, 4, 5, 6], byTime: null });
    expect(formOf(null, 'mood')).toMatchObject({ target: null, title: 'Log mood' });
    expect(formOf(null, 'meals')).toMatchObject({ target: 3, title: 'Log 3 meals' });
    expect(formOf(null, 'bp')).toMatchObject({ target: 1, title: 'Check blood pressure' });
    expect(formOf(null, 'distance', 'imperial')).toMatchObject({ target: 4828, title: '3 mi on foot' });
  });

  it('keeps a typed name when the choice changes; a built name follows it', () => {
    const typed = { ...formOf(null), title: 'KBR loop' };
    expect(withKind(typed, 'weight')).toMatchObject({ title: 'KBR loop', kind: 'weight', target: null });
    expect(withKind(formOf(null), 'water')).toMatchObject({ title: '8 glasses of water', target: 8 });
    expect(withTarget(formOf(null), 10000)).toMatchObject({ title: '10,000 steps', target: 10000 });
    expect(withTarget(typed, 10000)).toMatchObject({ title: 'KBR loop', target: 10000 });
    const n = withKind(formOf(null), 'nutrient');
    expect(n).toMatchObject({ kind: 'nutrient', nutrientKey: null, target: null, title: '' });
    expect(withNutrient(n, 'addedSugar')).toMatchObject({ nutrientKey: 'addedSugar', target: 50, title: 'Added sugar 50 g or less' });
    expect(withTarget(withNutrient(n, 'addedSugar'), 25).title).toBe('Added sugar 25 g or less');
    expect(withNutrient(withNutrient(n, 'protein'), 'vitC').title).toBe('Vitamin C 90 mg or more');
  });

  it('moves a target in steps inside the range', () => {
    expect(stepTarget('steps', 8000, 1)).toBe(8500);
    expect(stepTarget('steps', 500, -1)).toBe(500);
    expect(stepTarget('walk', 240, 1)).toBe(240);
    expect(stepTarget('ride', 480, 1)).toBe(480);
    expect(stepTarget('bp', 4, 1)).toBe(4);
    expect(stepTarget('meals', 3, 1)).toBe(4);
    expect(stepTarget('distance', 5000, 1)).toBe(5500);
    expect(stepTarget('distance', 4828, 1, null, 'imperial')).toBe(5635);
    expect(stepTarget('weight', 1, 1)).toBe(1);
  });

  it('finds what is wrong before saving', () => {
    expect(goalProblem(formOf(null))).toBeNull();
    expect(goalProblem(formOf(null, 'heart'))).toBeNull();
    expect(goalProblem({ ...formOf(null), title: ' ' })).toBe('Give the goal a name.');
    expect(goalProblem({ ...formOf(null), title: 'x'.repeat(41) })).toMatch(/40/);
    expect(goalProblem({ ...formOf(null), days: [] })).toBe('Pick at least one day.');
    expect(goalProblem({ ...formOf(null), target: null })).toMatch(/target/);
    expect(goalProblem({ ...formOf(null), target: 60000 })).toMatch(/range/);
    expect(goalProblem({ ...formOf(null, 'mood'), target: 2 })).toMatch(/range/);
    expect(goalProblem(withKind(formOf(null), 'nutrient'))).toBe('Pick a nutrient.');
    const sugar = withNutrient(formOf(null), 'addedSugar');
    expect(goalProblem(sugar)).toBeNull();
    expect(goalProblem({ ...sugar, target: 501 })).toMatch(/range/);
    expect(goalProblem({ ...sugar, target: 0 })).toMatch(/range/);
    expect(goalProblem({ ...withNutrient(formOf(null), 'transFat'), target: 0.4 })).toBeNull();
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
    expect(goalErrorText(socialErrorFor(400, 'bad_request', 'kind'))).toMatch(/Update the app/);
    expect(goalErrorText(socialErrorFor(400, 'bad_request', 'nutrientKey'))).toMatch(/nutrient/);
    expect(goalErrorText(new SocialError('offline'))).toBe(new SocialError('offline').message);
    expect(goalErrorText(new Error('x'))).toBe('Something went wrong. Try again.');
  });
});
