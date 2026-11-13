import { describe, expect, it } from '@jest/globals';

import { DEFAULT_PROFILE, DEFAULT_WATER, mergeProfile } from '@/data/profile';
import type { FoodEntry, Profile } from '@/data/types';
import {
  drinkMl,
  drinkTimes,
  emptyReminderLog,
  formatLitres,
  heatExtraMl,
  noteReminderSent,
  type ReminderState,
  rollLog,
  settleLog,
  stepperRange,
  stepsExtraMl,
  stickyTarget,
  suggestionBasis,
  suggestWaterMl,
  waterBetween,
  waterProgress,
  waterProgressText,
  waterReminderDue,
  waterTarget,
} from '@/water/water';

const TODAY = '2026-11-13';
const at = (h: number, m = 0, day = 13) => new Date(2026, 10, day, h, m).getTime();
const withWater = (water: Partial<Profile['water']>, over: Partial<Profile> = {}) =>
  mergeProfile({ ...DEFAULT_PROFILE, ...over }, { water });

describe('suggested target', () => {
  it('is 30 ml per kg in 250 ml steps, between 1.5 and 3 L', () => {
    expect(suggestWaterMl(40)).toBe(1500);
    expect(suggestWaterMl(55)).toBe(1750);
    expect(suggestWaterMl(65)).toBe(2000);
    expect(suggestWaterMl(80)).toBe(2500);
    expect(suggestWaterMl(120)).toBe(3000);
  });
  it('is 2 L without a weight', () => {
    expect(suggestWaterMl(null)).toBe(2000);
    expect(suggestWaterMl(0)).toBe(2000);
  });
  it('uses the weight only when it is the person\'s own', () => {
    const p = { ...DEFAULT_PROFILE, weightKg: 80 };
    expect(waterTarget(p)!.base).toBe(2000); // 80 kg never typed: the default 65 is not theirs either
    expect(waterTarget(p, { weightKnown: true })!.base).toBe(2500);
    expect(waterTarget({ ...p, weightSet: true })!.base).toBe(2500);
    expect(suggestionBasis(65, true, 'metric')).toBe('From your weight, 65 kg');
    expect(suggestionBasis(65, false, 'metric')).toBe('A common starting point');
  });
});

describe('extras', () => {
  it('adds for heat from 30 °C', () => {
    expect(heatExtraMl(29.9)).toBe(0);
    expect(heatExtraMl(30)).toBe(250);
    expect(heatExtraMl(35)).toBe(500);
    expect(heatExtraMl(40)).toBe(750);
    expect(heatExtraMl(null)).toBe(0);
  });
  it('adds 250 ml per full 3,000 steps above 7,000, at most 500', () => {
    expect(stepsExtraMl(7000)).toBe(0);
    expect(stepsExtraMl(9999)).toBe(0);
    expect(stepsExtraMl(10000)).toBe(250);
    expect(stepsExtraMl(13000)).toBe(500);
    expect(stepsExtraMl(30000)).toBe(500);
    expect(stepsExtraMl(null)).toBe(0);
  });
  it('labels the day\'s target', () => {
    const t = waterTarget(withWater({ targetMl: 2000 }), { tempMaxC: 37, steps: 10500 })!;
    expect(t).toMatchObject({ ml: 2750, base: 2000, heat: 500, steps: 250, suggested: false, limit: false });
    expect(t.label).toBe('2.0 L + 0.5 L for heat (37°C) + 0.25 L for steps');
  });
  it('caps extras at 1.5 L and the total at 4 L, never cutting the person\'s own target', () => {
    expect(waterTarget(withWater({ targetMl: 3500 }), { tempMaxC: 42, steps: 20000 })!.ml).toBe(4000);
    expect(waterTarget(withWater({ targetMl: 4500 }), { tempMaxC: 42, steps: 20000 })!.ml).toBe(4500);
    expect(waterTarget(withWater({ targetMl: 2000 }), { tempMaxC: 42, steps: 20000 })!.ml).toBe(3250);
  });
  it('adds nothing with extras off, a doctor\'s limit, or numbers only', () => {
    expect(waterTarget(withWater({ targetMl: 2000, extras: false }), { tempMaxC: 40 })!.ml).toBe(2000);
    const limit = waterTarget(withWater({ targetMl: 1500, doctorLimit: true }), { tempMaxC: 40, steps: 20000 })!;
    expect(limit).toMatchObject({ ml: 1500, limit: true });
    expect(waterTarget(withWater({ targetMl: 2000 }), { tempMaxC: 40, numbersOnly: true })!.ml).toBe(2000);
  });
  it('hides the suggestion with a doctor\'s limit or numbers only', () => {
    expect(waterTarget(withWater({ doctorLimit: true }))).toBeNull();
    expect(waterTarget(DEFAULT_PROFILE, { numbersOnly: true })).toBeNull();
    expect(waterTarget(DEFAULT_PROFILE)).toMatchObject({ ml: 2000, suggested: true });
  });
  it('lets the Stepper go to 500 ml under a doctor\'s limit', () => {
    expect(stepperRange(true).min).toBe(500);
    expect(stepperRange(false)).toEqual({ min: 1000, max: 5000, step: 250 });
  });
});

describe('amounts', () => {
  it('formats litres and imperial', () => {
    expect(formatLitres(2000, 'metric')).toBe('2.0 L');
    expect(formatLitres(2250, 'metric')).toBe('2.25 L');
    expect(formatLitres(500, 'metric')).toBe('0.5 L');
    expect(formatLitres(2000, 'imperial')).toBe('68 fl oz');
    expect(waterProgressText(1250, { ml: 2250, limit: false }, 'metric')).toBe('1.25 of 2.25 L');
    expect(waterProgressText(1200, { ml: 1500, limit: true }, 'metric')).toBe('1.2 of 1.5 L limit');
    expect(waterProgressText(1250, { ml: 2250, limit: false }, 'imperial')).toBe('42 of 76 fl oz');
  });
  it('counts glasses down and the target up', () => {
    expect(waterProgress(1000, 250, 2250, 250)).toEqual({ totalMl: 1250, fraction: 1250 / 2250, glasses: 5, glassesTarget: 9 });
    expect(waterProgress(240, 0, 2000, 250).glasses).toBe(0);
  });
});

let n = 0;
const entry = (over: Partial<FoodEntry>): FoodEntry => ({
  id: `e${n++}`,
  loggedAt: at(10),
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

describe('drinks', () => {
  it('counts tea, coffee and milk, grams as ml', () => {
    const list = [
      entry({ foodId: 'chai', unit: 'cup', quantity: 2, kcal: 138 }), // 300 ml
      entry({ foodId: 'milk', unit: 'glass', quantity: 1, kcal: 152 }), // 250 ml
      entry({ foodId: 'chaas', unit: 'glass', quantity: 1, kcal: 36 }), // 200 ml
    ];
    expect(drinkMl(list, [], {})).toBe(750);
    expect(drinkTimes(list, [])).toHaveLength(3);
  });
  it('skips food, calorie-only entries and alcohol', () => {
    const beer = {
      id: 'ai:beer',
      name: 'Beer',
      aliases: [],
      category: 'drink' as const,
      per100g: { kcal: 43, alcohol: 3.9 },
      units: [{ key: 'bottle', label: 'bottle', grams: 330 }],
      defaultUnit: 'bottle',
      source: 'AI',
    };
    const list = [
      entry({ foodId: 'rice', unit: 'bowl', quantity: 1, kcal: 200 }),
      entry({ name: 'Juice', kcal: 120 }),
      entry({ foodId: 'ai:beer', unit: 'bottle', quantity: 1, kcal: 140 }),
    ];
    expect(drinkMl(list, [], {}, [beer])).toBe(0);
  });
  it('follows the person\'s own cup size', () => {
    expect(drinkMl([entry({ foodId: 'chai', unit: 'cup', quantity: 1 })], [], { 'chai:cup': 100 })).toBe(100);
  });
  it('adds water in a time range', () => {
    const logs = [
      { loggedAt: at(8), value: 250 },
      { loggedAt: at(12), value: 500 },
      { loggedAt: at(23, 59, 12), value: 300 },
    ];
    expect(waterBetween(logs, at(0), at(0, 0, 14))).toBe(750);
    expect(waterBetween(logs, at(12), at(13))).toBe(500);
    expect(waterBetween(logs, at(8), at(12))).toBe(250);
  });
});

describe('reached sticks for the day', () => {
  it('keeps the target as it was when reached, extras frozen', () => {
    const t1 = waterTarget(withWater({ targetMl: 2000 }), { steps: 6000 })!;
    const first = stickyTarget(t1, 2000, emptyReminderLog(TODAY));
    expect(first.reached).toBe(true);
    // More steps later raise the computed target; the reached one stays.
    const t2 = waterTarget(withWater({ targetMl: 2000 }), { steps: 14000 })!;
    expect(t2.ml).toBe(2500);
    const later = stickyTarget(t2, 2000, first.log);
    expect(later).toMatchObject({ reached: true, target: { ml: 2000 } });
    // A new day starts fresh.
    expect(rollLog(first.log, '2026-11-14').reached).toBeNull();
  });
  it('un-reaches when the glass that reached it is undone', () => {
    const t = waterTarget(withWater({ targetMl: 2000 }), { steps: 11000 })!;
    expect(t.ml).toBe(2250);
    const first = stickyTarget(t, 2250, emptyReminderLog(TODAY));
    expect(first.reached).toBe(true);
    const undone = stickyTarget(t, 2000, first.log);
    expect(undone).toMatchObject({ reached: false, target: { ml: 2250 } });
    // More steps later still don't move the frozen extras.
    const more = waterTarget(withWater({ targetMl: 2000 }), { steps: 14000 })!;
    expect(stickyTarget(more, 2000, first.log).target.ml).toBe(2250);
  });
  it('drops the frozen target when the base target changes', () => {
    const t = waterTarget(withWater({ targetMl: 2000 }))!;
    const first = stickyTarget(t, 2000, emptyReminderLog(TODAY));
    const raised = waterTarget(withWater({ targetMl: 3000 }))!;
    const after = stickyTarget(raised, 2000, first.log);
    expect(after).toMatchObject({ reached: false, target: { ml: 3000 } });
    expect(after.log.reached).toBeNull();
  });
  it('never says reached under a doctor\'s limit', () => {
    const t = waterTarget(withWater({ targetMl: 1500, doctorLimit: true }))!;
    expect(stickyTarget(t, 1600, emptyReminderLog(TODAY)).reached).toBe(false);
  });
});

describe('water reminders', () => {
  const settings = { ...DEFAULT_WATER, targetMl: 2000, remind: true }; // 9 to 20
  // At 14:00, 5 of the 11 window hours are gone: expected 909 ml, 80% of that 727.
  const base = (over: Partial<ReminderState> = {}): ReminderState => ({
    now: new Date(at(14)),
    settings,
    targetMl: 2000,
    drunkMl: 250,
    reached: false,
    lastDrinkAt: at(10),
    log: emptyReminderLog(TODAY),
    ...over,
  });
  const due = (over: Partial<ReminderState> = {}) => waterReminderDue(base(over));

  it('is due when well behind', () => {
    expect(due()).toBe(true);
  });
  it('needs reminders on, no doctor\'s limit, a saved target, and not numbers only', () => {
    expect(due({ settings: { ...settings, remind: false } })).toBe(false);
    expect(due({ settings: { ...settings, doctorLimit: true } })).toBe(false);
    expect(due({ settings: { ...settings, targetMl: null } })).toBe(false);
    expect(due({ targetMl: null })).toBe(false);
    expect(due({ numbersOnly: true })).toBe(false);
  });
  it('waits until an hour into the window and stops at its end', () => {
    expect(due({ now: new Date(at(9, 59)) })).toBe(false);
    expect(due({ now: new Date(at(10, 0)), drunkMl: 0, lastDrinkAt: null, targetMl: 4000 })).toBe(true);
    expect(due({ now: new Date(at(19, 59)) })).toBe(true);
    expect(due({ now: new Date(at(20, 0)) })).toBe(false);
  });
  it('stays quiet when not far behind, or behind by less than a glass', () => {
    expect(due({ drunkMl: 730 })).toBe(false); // over 80% of expected
    expect(due({ drunkMl: 650 })).toBe(true);
    expect(due({ drunkMl: 700 })).toBe(false); // 209 ml behind: under a glass
    // At 10:15 expected is 227 ml: under one glass behind, even with nothing drunk.
    expect(due({ now: new Date(at(10, 15)), drunkMl: 0, lastDrinkAt: null })).toBe(false);
  });
  it('stays quiet once the target is met or reached', () => {
    expect(due({ drunkMl: 2000 })).toBe(false);
    expect(due({ reached: true })).toBe(false);
  });
  it('waits 90 minutes after a drink and 2 hours after a reminder', () => {
    expect(due({ lastDrinkAt: at(12, 31) })).toBe(false);
    expect(due({ lastDrinkAt: at(12, 30) })).toBe(true);
    expect(due({ log: { ...emptyReminderLog(TODAY), lastSentAt: at(12, 1) } })).toBe(false);
    expect(due({ log: { ...emptyReminderLog(TODAY), lastSentAt: at(12, 0) } })).toBe(true);
  });
  it('sends at most 3 a day, 1 after 3 ignored in a row', () => {
    const sent = (k: number, streak = 0) => ({ ...emptyReminderLog(TODAY), sent: [at(10), at(12), at(14)].slice(0, k), ignoredStreak: streak });
    expect(due({ now: new Date(at(17)), log: sent(2) })).toBe(true);
    expect(due({ now: new Date(at(17)), log: sent(3) })).toBe(false);
    expect(due({ now: new Date(at(17)), log: sent(0, 3) })).toBe(true);
    expect(due({ now: new Date(at(17)), log: sent(1, 3) })).toBe(false);
  });
  it('stays quiet when snoozed or paused', () => {
    expect(due({ log: { ...emptyReminderLog(TODAY), snoozed: true } })).toBe(false);
    expect(due({ log: { ...emptyReminderLog(TODAY), pausedSince: at(9) } })).toBe(false);
  });
  it('counts a reminder as ignored with no drink within 60 minutes', () => {
    let log = noteReminderSent(emptyReminderLog(TODAY), at(12));
    expect(settleLog(log, [], at(12, 59), TODAY).ignoredStreak).toBe(0);
    log = settleLog(log, [], at(13), TODAY);
    expect(log).toMatchObject({ ignoredStreak: 1, open: null });
    log = settleLog(noteReminderSent(log, at(15)), [at(15, 30)], at(15, 40), TODAY);
    expect(log).toMatchObject({ ignoredStreak: 0, open: null });
  });
  it('pauses after 3 reminded days with nothing logged, and starts again on a drink', () => {
    const log = { ...emptyReminderLog(TODAY), remindedDays: ['2026-11-10', '2026-11-11', '2026-11-12'] };
    const paused = settleLog(log, [at(9, 0, 9)], at(10), TODAY);
    expect(paused.pausedSince).toBe(at(10));
    expect(settleLog(log, [at(9, 0, 11)], at(10), TODAY).pausedSince).toBeNull();
    // Not every day reminded (reminders just turned on): no pause.
    expect(settleLog({ ...log, remindedDays: ['2026-11-12'] }, [], at(10), TODAY).pausedSince).toBeNull();
    const back = settleLog({ ...paused, pauseTold: true }, [at(11)], at(11, 5), TODAY);
    expect(back).toMatchObject({ pausedSince: null, pauseTold: false });
  });
  it('keeps the streak and pause across days, not the day\'s counts', () => {
    const log = { ...noteReminderSent(emptyReminderLog(TODAY), at(12)), ignoredStreak: 2, snoozed: true };
    const next = rollLog(log, '2026-11-14');
    expect(next).toMatchObject({ day: '2026-11-14', sent: [], snoozed: false, ignoredStreak: 2, remindedDays: [TODAY] });
  });
});
