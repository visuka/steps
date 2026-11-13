/**
 * Water reminders, the daily note and the weekly summary end to end, on the
 * in-memory repository: what goes out, when, and what is kept.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { openRepository } from '@/data/db.web';
import { DEFAULT_PROFILE, loadProfile, mergeProfile, saveProfile } from '@/data/profile';
import type { FoodEntry, Profile, Repository } from '@/data/types';
import { addDaysToKey } from '@/lib/dates';
import { budgetAllows, LAST_NOTIFIED_KEY } from '@/notifications/budget';
import { CHANNELS } from '@/notifications/channels';
import { healthNotes } from '@/notifications/health-notes';
import { journalRoute, onTap, queueTap, takeTap, tapTarget } from '@/notifications/taps';
import { DAY_MARKS_KEY, dismissGapNote, markDay, NOTE_LOG_KEY, readDayMarks, setNotForMe, todayGapNote } from '@/nutrition/notes';
import { PREMIUM_KEY } from '@/premium/premium';
import { addWater, undoWater } from '@/water/add';
import { loadWaterToday, snoozeWaterToday, WATER_REMINDERS_KEY, waterWeek } from '@/water/today';
import type { WaterReminderLog } from '@/water/water';

jest.mock('@/notifications/notify', () => ({ notifyNow: async () => undefined }));

const TODAY = '2026-11-13';
const at = (day: string, h: number, m = 0) => {
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m);
};
let n = 0;
const food = (day: string, foodId: string, unit: string, quantity: number, kcal: number, h = 13): FoodEntry => ({
  id: `f${n++}`,
  loggedAt: at(day, h).getTime(),
  name: foodId,
  foodId,
  unit,
  quantity,
  kcal,
  healthSampleId: null,
  place: 'home',
  restaurant: null,
});

let repo: Repository;
const sent: { title: string; body: string; channel?: string; open?: string }[] = [];
const send = async (title: string, body: string, opts: { channel?: string; open?: string }) => {
  sent.push({ title, body, ...opts });
};
const premium = () => repo.setKv(PREMIUM_KEY, { premium: true, reason: 'testing', checkedAt: 1, account: 'a' });

/** Four full days of rice, dal and roti before TODAY: short of protein for 65 kg. */
async function lowProteinDays() {
  for (let i = 1; i <= 4; i++) {
    const d = addDaysToKey(TODAY, -i);
    await repo.addFood(food(d, 'rice', 'bowl', 3, 585, 13));
    await repo.addFood(food(d, 'dal', 'bowl', 2, 400, 20));
    await repo.addFood(food(d, 'chapati', 'piece', 4, 480, 20));
  }
}

beforeEach(async () => {
  repo = await openRepository();
  sent.length = 0;
});

describe('profile', () => {
  it('gives an old stored profile the water and nutrition defaults', async () => {
    await repo.setKv('profile', { heightCm: 170, weightKg: 70, sex: 'male', onboarded: true, reminders: { enabled: true } });
    const p = await loadProfile(repo);
    expect(p.water).toEqual(DEFAULT_PROFILE.water);
    expect(p.nutrition).toEqual({ diet: null, tips: false, weekly: false, hideCalories: false, differentNeeds: false });
    expect(p.reminders).toEqual({ enabled: true, startHour: 9, endHour: 20 });
    // Saved before weightSet existed: a weight other than the default was typed in.
    expect(p.weightSet).toBe(true);
  });
  it('treats an old stored profile at the default weight as not typed', async () => {
    await repo.setKv('profile', { heightCm: 170, weightKg: 65, onboarded: true });
    expect((await loadProfile(repo)).weightSet).toBe(false);
    await repo.setKv('profile', { heightCm: 170, weightKg: 80, weightSet: false, onboarded: true });
    expect((await loadProfile(repo)).weightSet).toBe(false);
  });
  it('keeps nested fields when a change sets only one of them', async () => {
    const p = mergeProfile(DEFAULT_PROFILE, { water: { targetMl: 2250 }, nutrition: { diet: 'egg' } });
    const q = mergeProfile(p, { water: { remind: true } });
    expect(q.water).toEqual({ ...DEFAULT_PROFILE.water, targetMl: 2250, remind: true });
    expect(q.nutrition.diet).toBe('egg');
    await saveProfile(repo, q);
    expect((await loadProfile(repo)).water.targetMl).toBe(2250);
  });
  it('marks a typed weight as the person\'s own', () => {
    expect(mergeProfile(DEFAULT_PROFILE, { weightKg: 72 }).weightSet).toBe(true);
    expect(mergeProfile(DEFAULT_PROFILE, { weightKg: 65 }).weightSet).toBe(false);
  });
});

describe('day marks', () => {
  it('keeps marks six weeks', async () => {
    await repo.setKv(DAY_MARKS_KEY, { '2026-09-01': 'complete', '2026-11-01': 'fasting' });
    await markDay(repo, TODAY, 'complete', at(TODAY, 21));
    expect(await readDayMarks(repo)).toEqual({ '2026-11-01': 'fasting', [TODAY]: 'complete' });
    await markDay(repo, TODAY, null, at(TODAY, 21));
    expect(await readDayMarks(repo)).toEqual({ '2026-11-01': 'fasting' });
  });
});

describe('today\'s gap note', () => {
  it('is worked out once a day and never changes', async () => {
    await lowProteinDays();
    const first = await todayGapNote(repo, DEFAULT_PROFILE, at(TODAY, 8));
    expect(first.note?.key).toBe('protein');
    expect(await repo.getKv(NOTE_LOG_KEY)).toEqual({ protein: [TODAY] });
    // More food today doesn't change today's card.
    await repo.addFood(food(TODAY, 'chickpeas', 'bowl', 2, 490, 9));
    expect(await todayGapNote(repo, DEFAULT_PROFILE, at(TODAY, 18))).toEqual(first);
    await dismissGapNote(repo, at(TODAY, 18));
    expect((await todayGapNote(repo, DEFAULT_PROFILE, at(TODAY, 19))).dismissed).toBe(true);
    // Tomorrow: within the 14-day cooldown, so no protein note.
    expect((await todayGapNote(repo, DEFAULT_PROFILE, at('2026-11-14', 8))).note?.key).not.toBe('protein');
  });
  it('keeps "Not for me" foods', async () => {
    await setNotForMe(repo, 'milk-toned', true);
    expect(await setNotForMe(repo, 'tofu', true)).toEqual(['milk-toned', 'tofu']);
    expect(await setNotForMe(repo, 'milk-toned', false)).toEqual(['tofu']);
  });
});

describe('water today', () => {
  const p = mergeProfile(DEFAULT_PROFILE, { water: { targetMl: 2000, remind: true } });
  it('adds water and drinks, and undoes through the shared delete path', async () => {
    const source = { writeWater: async () => 'hc-1', deleteSample: jest.fn(async (_kind: string, _id: string) => undefined) };
    const added = await addWater(repo, source, 250, at(TODAY, 9));
    await repo.addFood(food(TODAY, 'chai', 'cup', 1, 69, 10));
    let w = await loadWaterToday(repo, p, at(TODAY, 11), 3000);
    expect(w.waterMl).toBe(250);
    expect(w.drinksMl).toBe(150);
    expect(w.progressText).toBe('0.4 of 2.0 L');
    expect(w.progress?.glasses).toBe(1);
    await undoWater(repo, source, added.entry);
    expect(source.deleteSample).toHaveBeenCalledWith('water', 'hc-1');
    w = await loadWaterToday(repo, p, at(TODAY, 11), 3000);
    expect(w.waterMl).toBe(0);
  });
  it('stays reached once reached', async () => {
    await repo.addLog('water', { id: 'w1', loggedAt: at(TODAY, 10).getTime(), value: 2000, healthSampleId: null });
    expect((await loadWaterToday(repo, p, at(TODAY, 12), 4000)).reached).toBe(true);
    const later = await loadWaterToday(repo, p, at(TODAY, 18), 15000);
    expect(later).toMatchObject({ reached: true, target: { ml: 2000 } });
  });
  it('un-reaches when the water is removed, and follows a new target', async () => {
    await repo.addLog('water', { id: 'w1', loggedAt: at(TODAY, 10).getTime(), value: 2000, healthSampleId: null });
    expect((await loadWaterToday(repo, p, at(TODAY, 12), 4000)).reached).toBe(true);
    const raised = mergeProfile(p, { water: { targetMl: 3000 } });
    expect(await loadWaterToday(repo, raised, at(TODAY, 13), 4000)).toMatchObject({ reached: false, target: { ml: 3000 } });
    await repo.deleteLog('water', 'w1');
    expect((await loadWaterToday(repo, p, at(TODAY, 14), 4000)).reached).toBe(false);
  });
  it('counts days the target was met', async () => {
    for (const d of ['2026-11-10', '2026-11-12']) {
      await repo.addLog('water', { id: d, loggedAt: at(d, 10).getTime(), value: 2100, healthSampleId: null });
    }
    const week = await waterWeek(repo, p, at(TODAY, 12));
    expect(week.days).toHaveLength(7);
    expect(week.metDays).toBe(2);
  });
});

describe('health notes after a sync', () => {
  const p: Profile = mergeProfile(DEFAULT_PROFILE, { water: { targetMl: 2000, remind: true } });
  it('needs premium', async () => {
    await healthNotes(repo, p, { steps: 3000, stepSent: false }, at(TODAY, 14), send);
    expect(sent).toEqual([]);
  });
  it('sends a water reminder when behind, with the progress', async () => {
    await premium();
    await healthNotes(repo, p, { steps: 3000, stepSent: false }, at(TODAY, 14), send);
    expect(sent).toEqual([{ title: 'Water', body: "Time for a glass of water. You're at 0.0 of 2.0 L.", channel: 'water', open: 'water' }]);
    const log = await repo.getKv<WaterReminderLog>(WATER_REMINDERS_KEY);
    expect(log?.sent).toHaveLength(1);
    expect(await repo.getKv(LAST_NOTIFIED_KEY)).toBe(at(TODAY, 14).getTime());
  });
  it('keeps out of the way of step notifications and other posts', async () => {
    await premium();
    await healthNotes(repo, p, { steps: 3000, stepSent: true }, at(TODAY, 14), send);
    await repo.setKv(LAST_NOTIFIED_KEY, at(TODAY, 13, 30).getTime());
    await healthNotes(repo, p, { steps: 3000, stepSent: false }, at(TODAY, 14), send);
    expect(sent).toEqual([]);
  });
  it('stops after "No more reminders today"', async () => {
    await premium();
    await snoozeWaterToday(repo, at(TODAY, 12));
    await healthNotes(repo, p, { steps: 3000, stepSent: false }, at(TODAY, 14), send);
    expect(sent).toEqual([]);
  });
  it('sends the nutrition note in the evening only with tips on, privately', async () => {
    await premium();
    await lowProteinDays();
    const off = mergeProfile(DEFAULT_PROFILE, {});
    await healthNotes(repo, off, { steps: 3000, stepSent: false }, at(TODAY, 18, 30), send);
    expect(sent).toEqual([]);
    const on = mergeProfile(DEFAULT_PROFILE, { nutrition: { tips: true } });
    await healthNotes(repo, on, { steps: 3000, stepSent: false }, at(TODAY, 18, 30), send);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ title: 'A note about your food', channel: 'nutrition', open: 'food' });
    expect(sent[0].body).toMatch(/^Protein has been on the low side lately\. It builds and repairs muscle\. /);
    // One a day.
    await healthNotes(repo, on, { steps: 3000, stepSent: false }, at(TODAY, 19, 20), send);
    expect(sent).toHaveLength(1);
  });
  it('sends the weekly summary on Sunday evening once', async () => {
    await premium();
    const sunday = '2026-11-15';
    for (let i = 1; i <= 5; i++) {
      const d = addDaysToKey(sunday, -i);
      await repo.addFood(food(d, 'rice', 'bowl', 3, 585, 13));
      await repo.addFood(food(d, 'dal', 'bowl', 3, 600, 20));
    }
    const on = mergeProfile(DEFAULT_PROFILE, { nutrition: { weekly: true } });
    await healthNotes(repo, on, { steps: 3000, stepSent: false }, at(sunday, 18, 10), send);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ title: 'Your week', channel: 'weekly' });
    expect(sent[0].body.startsWith('Full food days: 5 of 7.')).toBe(true);
    await healthNotes(repo, on, { steps: 3000, stepSent: false }, at(sunday, 20, 0), send);
    expect(sent).toHaveLength(1);
  });
});

describe('notification plumbing', () => {
  it('has a channel for each kind, nutrition and weekly private', () => {
    expect(CHANNELS.map((c) => c.id)).toEqual(['nudges', 'water', 'nutrition', 'weekly']);
    expect(CHANNELS.filter((c) => c.private).map((c) => c.id)).toEqual(['nutrition', 'weekly']);
  });
  it('keeps 45 minutes from any post and from the mood check-in', () => {
    const now = at(TODAY, 19, 30);
    expect(budgetAllows({ now, lastNotifiedAt: null, moodHour: null, stepSent: false })).toBe(true);
    expect(budgetAllows({ now, lastNotifiedAt: at(TODAY, 18, 50).getTime(), moodHour: null, stepSent: false })).toBe(false);
    expect(budgetAllows({ now, lastNotifiedAt: at(TODAY, 18, 45).getTime(), moodHour: null, stepSent: false })).toBe(true);
    expect(budgetAllows({ now, lastNotifiedAt: null, moodHour: 20, stepSent: false })).toBe(false);
    expect(budgetAllows({ now: at(TODAY, 19, 15), lastNotifiedAt: null, moodHour: 20, stepSent: false })).toBe(true);
    expect(budgetAllows({ now, lastNotifiedAt: null, moodHour: null, stepSent: true })).toBe(false);
  });
  it('queues a tap until the screens are ready', () => {
    expect(tapTarget({ open: 'water' })).toBe('water');
    expect(tapTarget({ open: 'elsewhere' })).toBeNull();
    expect(tapTarget(null)).toBeNull();
    queueTap('food');
    const got: string[] = [];
    const stop = onTap((t) => got.push(t));
    expect(got).toEqual(['food']);
    queueTap('water');
    expect(got).toEqual(['food', 'water']);
    stop();
    queueTap('water');
    expect(takeTap()).toBe('water');
    expect(takeTap()).toBeNull();
    expect(journalRoute('food')).toEqual({ pathname: '/journal', params: { section: 'food' } });
  });
});
