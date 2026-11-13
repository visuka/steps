import { describe, expect, it } from '@jest/globals';

import { DEFAULT_PROFILE, mergeProfile } from '@/data/profile';
import type { FoodEntry, Profile } from '@/data/types';
import { addDaysToKey } from '@/lib/dates';
import {
  averageOfJudged,
  type DayIntake,
  dayIntakes,
  fullDaysNeeded,
  isJudgedDay,
  isJudgedToday,
  judgedAverage,
  logNote,
  type NoteLog,
  noteAllowed,
  pickGapNote,
  weekReady,
  weekWaitText,
} from '@/nutrition/gaps';
import { nutritionPushDue, type PushLog, weekFacts, weeklySummaryDue } from '@/nutrition/notes';
import type { NutrientKey, Nutrients } from '@/nutrition/types';

const TODAY = '2026-11-13';
const profile = DEFAULT_PROFILE; // 65 kg, 165 cm: a full day is 1,744 kcal
const FULL = 1744;

const at = (day: string, h: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, h).getTime();
};
let n = 0;
const entry = (over: Partial<FoodEntry>): FoodEntry => ({
  id: `e${n++}`,
  loggedAt: at(TODAY, 13),
  name: 'x',
  foodId: null,
  unit: null,
  quantity: null,
  kcal: 0,
  healthSampleId: null,
  place: 'home',
  restaurant: null,
  ...over,
});
const food = (foodId: string, unit: string, quantity: number, day = TODAY, kcal = 300) =>
  entry({ foodId, unit, quantity, kcal, loggedAt: at(day, 13) });

describe('judged days', () => {
  it('needs 60% of a full day from at least two foods of the list', () => {
    expect(isJudgedDay([entry({ kcal: 600, foodId: 'rice' }), entry({ kcal: 500, foodId: 'dal' })], FULL, null)).toBe(true);
    expect(isJudgedDay([entry({ kcal: 600, foodId: 'rice' }), entry({ kcal: 400, foodId: 'dal' })], FULL, null)).toBe(false);
  });
  it('never judges a calorie-only day', () => {
    expect(isJudgedDay([entry({ kcal: 1200 }), entry({ kcal: 900 })], FULL, null)).toBe(false);
  });
  it('never judges a tea-only day, even marked complete', () => {
    const tea = [1, 2, 3, 4].map(() => entry({ kcal: 69, foodId: 'chai' }));
    expect(isJudgedDay(tea, FULL, null)).toBe(false);
    expect(isJudgedDay(tea, FULL, 'complete')).toBe(false);
  });
  it('accepts a day marked complete from half a full day, and never a fasting day', () => {
    const half = [entry({ kcal: 900, foodId: 'rice' })];
    expect(isJudgedDay(half, FULL, 'complete')).toBe(true);
    expect(isJudgedDay(half, FULL, true)).toBe(true);
    const big = [entry({ kcal: 900, foodId: 'rice' }), entry({ kcal: 900, foodId: 'dal' })];
    expect(isJudgedDay(big, FULL, 'fasting')).toBe(false);
  });
  it('judges today only after "That\'s all for today" or from 23:00', () => {
    const day = [entry({ kcal: 900, foodId: 'rice' }), entry({ kcal: 900, foodId: 'dal' })];
    expect(isJudgedToday(day, FULL, null, new Date(2026, 10, 13, 22, 30))).toBe(false);
    expect(isJudgedToday(day, FULL, null, new Date(2026, 10, 13, 23, 0))).toBe(true);
    expect(isJudgedToday(day, FULL, 'complete', new Date(2026, 10, 13, 14, 0))).toBe(true);
    expect(isJudgedToday([entry({ kcal: 500, foodId: 'rice' })], FULL, null, new Date(2026, 10, 13, 23, 30))).toBe(false);
  });
});

describe('week average', () => {
  it('averages judged days only, per nutrient over the days that know it', () => {
    const day = (d: string, total: Nutrients, cov: number, judged = true): DayIntake => ({
      day: d,
      total,
      coverage: Object.fromEntries(Object.keys(total).map((k) => [k, cov])),
      judged,
      kcal: 1800,
      entries: 4,
    });
    const avg = averageOfJudged([
      day('2026-11-10', { kcal: 1800, vitC: 100 }, 1),
      day('2026-11-11', { kcal: 1800, vitC: 40 }, 1),
      day('2026-11-12', { kcal: 1800, vitC: 10 }, 0.5), // vitC known for half the day: left out of vitC's average
      day('2026-11-09', { kcal: 300, vitC: 0 }, 1, false), // not judged
    ]);
    expect(avg.judgedDays).toBe(3);
    expect(avg.average.vitC).toBe(70);
    expect(avg.daysFor.vitC).toBe(2);
    expect(avg.coverage.vitC).toBeCloseTo(2.5 / 3);
    expect(avg.average.iron).toBeUndefined();
  });
  it('works from food entries over the last 7 days', () => {
    const entries: FoodEntry[] = [];
    for (let i = 1; i <= 8; i++) {
      const d = addDaysToKey(TODAY, -i);
      entries.push(food('rice', 'bowl', 3, d, 600), food('dal', 'bowl', 2, d, 600));
    }
    const avg = judgedAverage(entries, [], {}, [], profile, { now: new Date(2026, 10, 13, 12) });
    expect(avg.judgedDays).toBe(6); // the 7 days include today, which has no food
    expect(avg.average.protein).toBeGreaterThan(0);
  });
  it('needs 4 judged days and says how many more', () => {
    expect(weekReady(3)).toBe(false);
    expect(weekReady(4)).toBe(true);
    expect(fullDaysNeeded(1)).toBe(3);
    expect(weekWaitText(2)).toBe('Log 2 more full days to see your week');
    expect(weekWaitText(3)).toBe('Log 1 more full day to see your week');
    expect(weekWaitText(5)).toBeNull();
  });
  it('builds days from entries, with coverage and the calorie-only gap', () => {
    const days = dayIntakes(
      [food('guava', 'piece', 2, '2026-11-12', 75), entry({ kcal: 300, loggedAt: at('2026-11-12', 9) })],
      { own: [], overrides: {}, saved: [] },
      profile,
      { now: new Date(2026, 10, 13, 12) },
    );
    expect(days).toHaveLength(1);
    expect(days[0].coverage.vitC).toBeCloseTo(75 / (75 + 300), 1);
    expect(days[0].judged).toBe(false);
  });
});

/** A judged day `ago` days before TODAY with these totals, known for all of it. */
const judged = (ago: number, total: Nutrients, cov = 1): DayIntake => ({
  day: addDaysToKey(TODAY, -ago),
  total: { kcal: 1800, ...total },
  coverage: Object.fromEntries(Object.keys({ kcal: 0, ...total }).map((k) => [k, cov])),
  judged: true,
  kcal: 1800,
  entries: 5,
});
const days = (agos: number[], total: Nutrients, cov = 1) => agos.map((a) => judged(a, total, cov));
const pick = (d: DayIntake[], log: NoteLog = {}, p: Profile = profile) => pickGapNote({ days: d, today: TODAY, profile: p, log });

describe('gap notes', () => {
  it('notes a daily nutrient low on 3 of the last 4 judged days', () => {
    const d = [...days([1, 2, 3], { vitC: 20 }), judged(4, { vitC: 120 })];
    expect(pick(d)).toEqual({ key: 'vitC', kind: 'day', percent: Math.round((((20 * 3 + 120) / 4) / 90) * 100), doctor: false });
  });
  it('needs 4 judged days, not 3', () => {
    expect(pick(days([1, 2, 3], { vitC: 20 }))).toBeNull();
  });
  it('stays quiet when only 2 of the last 4 are low', () => {
    expect(pick([...days([1, 2], { vitC: 20 }), ...days([3, 4], { vitC: 120 })])).toBeNull();
  });
  it('never counts today', () => {
    expect(pick([...days([0, 1, 2], { vitC: 20 }), judged(3, { vitC: 120 })])).toBeNull();
  });
  it('counts only days with figures for 95% of what was eaten', () => {
    expect(pick(days([1, 2, 3, 4], { vitC: 20 }, 0.9))).toBeNull();
    expect(pick(days([1, 2, 3, 4], { vitC: 20 }, 0.96))?.key).toBe('vitC');
  });
  it('needs two low weeks for stored nutrients', () => {
    const lastWeek = days([1, 2, 3, 4], { vitB12: 0.8 });
    expect(pick(lastWeek)).toBeNull();
    expect(pick([...lastWeek, ...days([8, 9, 10], { vitB12: 0.8 })])).toBeNull(); // only 3 days in the week before
    expect(pick([...lastWeek, ...days([8, 9, 10, 11], { vitB12: 0.8 })])).toMatchObject({ key: 'vitB12', kind: 'week' });
    expect(pick([...lastWeek, ...days([8, 9, 10, 11], { vitB12: 3 })])).toBeNull();
  });
  it('ranks B12 over iron over vitamin C', () => {
    const two = [...days([1, 2, 3, 4], { vitB12: 0.5, iron: 5, vitC: 10 }), ...days([8, 9, 10, 11], { vitB12: 0.5, iron: 5 })];
    expect(pick(two)?.key).toBe('vitB12');
    expect(pick(two, { vitB12: [addDaysToKey(TODAY, -3)] })?.key).toBe('iron');
  });
  it('ranks the rest by how far under the line they are', () => {
    // zinc 30% of its line, B6 50%: zinc first. Neither is in the named order.
    expect(pick(days([1, 2, 3, 4], { zinc: 7.5 * 0.3, vitB6: 1.1 * 0.5 }))?.key).toBe('zinc');
  });
  it('never notes vitamin D, K, E, phosphorus or selenium', () => {
    const none = { vitD: 0.1, vitK: 1, vitE: 0.5, phosphorus: 50, selenium: 2 } as Partial<Record<NutrientKey, number>>;
    expect(pick([...days([1, 2, 3, 4], none), ...days([8, 9, 10, 11], none)])).toBeNull();
  });
  it('leaves potassium out when a doctor limits fluids', () => {
    const d = days([1, 2, 3, 4], { potassium: 1000 });
    expect(pick(d)?.key).toBe('potassium');
    expect(pick(d, {}, mergeProfile(profile, { water: { doctorLimit: true } }))).toBeNull();
  });
  it('makes no notes for "My needs are different" or under 18', () => {
    const d = days([1, 2, 3, 4], { vitC: 10 });
    expect(pick(d, {}, mergeProfile(profile, { nutrition: { differentNeeds: true } }))).toBeNull();
    expect(pick(d, {}, mergeProfile(profile, { birthYear: 2012 }))).toBeNull();
  });
  it('waits 14 days before the same nutrient again', () => {
    const d = days([1, 2, 3, 4], { vitC: 10 });
    expect(pick(d, { vitC: [addDaysToKey(TODAY, -13)] })).toBeNull();
    expect(pick(d, { vitC: [addDaysToKey(TODAY, -14)] })).toMatchObject({ key: 'vitC', doctor: false });
  });
  it('adds the doctor line to the third note in 6 weeks, then goes quiet for 30 days', () => {
    const d = days([1, 2, 3, 4], { vitC: 10 });
    expect(pick(d, { vitC: [addDaysToKey(TODAY, -30), addDaysToKey(TODAY, -15)] })).toMatchObject({ doctor: true });
    const third = addDaysToKey(TODAY, -14);
    const log = { vitC: [addDaysToKey(third, -28), addDaysToKey(third, -14), third] };
    expect(noteAllowed(log, 'vitC', TODAY).ok).toBe(false);
    expect(noteAllowed(log, 'vitC', addDaysToKey(third, 29)).ok).toBe(false);
    expect(noteAllowed(log, 'vitC', addDaysToKey(third, 30))).toEqual({ ok: true, doctor: false });
  });
  it('keeps the note log to 6 weeks', () => {
    const log = logNote({ vitC: ['2026-09-01', '2026-11-01'], iron: ['2026-09-20'] }, 'vitC', TODAY);
    expect(log).toEqual({ vitC: ['2026-11-01', TODAY] });
  });
});

describe('nutrition push timing', () => {
  const note = { key: 'vitC' as NutrientKey, kind: 'day' as const, percent: 30, doctor: false };
  const cached = { day: TODAY, note, dismissed: false };
  const due = (h: number, m = 0, over: Partial<Parameters<typeof nutritionPushDue>[0]> = {}) =>
    nutritionPushDue({ now: new Date(2026, 10, 13, h, m), tips: true, cached, pushes: [], ...over });
  it('goes out between 18:00 and 19:30 only', () => {
    expect(due(17, 59)).toBe(false);
    expect(due(18, 0)).toBe(true);
    expect(due(19, 29)).toBe(true);
    expect(due(19, 30)).toBe(false);
    expect(due(20, 0)).toBe(false);
  });
  it('needs tips on and an undismissed note for today', () => {
    expect(due(18, 30, { tips: false })).toBe(false);
    expect(due(18, 30, { cached: { ...cached, dismissed: true } })).toBe(false);
    expect(due(18, 30, { cached: { ...cached, day: '2026-11-12' } })).toBe(false);
    expect(due(18, 30, { cached: { ...cached, note: null } })).toBe(false);
  });
  it('caps at 1 a day, 2 a week and 1 per nutrient in 14 days', () => {
    const p = (ago: number, key: NutrientKey): PushLog[number] => ({ day: addDaysToKey(TODAY, -ago), key });
    expect(due(18, 30, { pushes: [p(0, 'iron')] })).toBe(false);
    expect(due(18, 30, { pushes: [p(2, 'iron'), p(5, 'zinc')] })).toBe(false);
    expect(due(18, 30, { pushes: [p(2, 'iron'), p(7, 'zinc')] })).toBe(true);
    expect(due(18, 30, { pushes: [p(10, 'vitC')] })).toBe(false);
    expect(due(18, 30, { pushes: [p(14, 'vitC')] })).toBe(true);
  });
});

describe('weekly summary', () => {
  const sunday = (h: number) => new Date(2026, 10, 15, h);
  it('goes out on Sunday evenings, once, with 4+ judged days and the switch on', () => {
    expect(weeklySummaryDue({ now: sunday(18), weekly: true, judgedDays: 4, sentFor: null })).toBe(true);
    expect(weeklySummaryDue({ now: sunday(17), weekly: true, judgedDays: 4, sentFor: null })).toBe(false);
    expect(weeklySummaryDue({ now: sunday(21), weekly: true, judgedDays: 4, sentFor: null })).toBe(false);
    expect(weeklySummaryDue({ now: new Date(2026, 10, 14, 19), weekly: true, judgedDays: 6, sentFor: null })).toBe(false);
    expect(weeklySummaryDue({ now: sunday(19), weekly: true, judgedDays: 3, sentFor: null })).toBe(false);
    expect(weeklySummaryDue({ now: sunday(19), weekly: false, judgedDays: 6, sentFor: null })).toBe(false);
    expect(weeklySummaryDue({ now: sunday(19), weekly: true, judgedDays: 6, sentFor: '2026-11-15' })).toBe(false);
  });
  it('counts the facts of the week, with no verdicts for numbers only', () => {
    const facts = weekFacts(days([1, 2, 3, 4, 5], { vitC: 100, iron: 5, calcium: 900 }), profile, new Date(2026, 10, 13, 19), 4);
    expect(facts.judgedDays).toBe(5);
    expect(facts.onTrack).toEqual({ ok: 2, known: 3 });
    const plain = weekFacts(days([1, 2, 3, 4], { vitC: 100 }), mergeProfile(profile, { nutrition: { differentNeeds: true } }), new Date(2026, 10, 13, 19), null);
    expect(plain.onTrack).toBeNull();
  });
});
