import { describe, expect, it, jest } from '@jest/globals';

import { openRepository } from '@/data/db.web';
import {
  type BpWriter,
  changeBloodPressure,
  changeFood,
  changeLog,
  deleteBloodPressure,
  deleteFood,
  deleteLog,
  manualNightId,
  replaceCopy,
  retryLeftCopies,
  type SampleWriter,
  saveLastNight,
  saveMood,
  saveNight,
} from '@/data/entries';
import type { BloodPressureEntry, FoodEntry, LogEntry, MoodEntry, Repository, SleepEntry } from '@/data/types';
import { addDaysToKey, dayKey, parseDayKey } from '@/lib/dates';
import { catalogFood, nutrientsFor } from '@/nutrition/catalog';
import { entryNutrients } from '@/nutrition/day';
import { sumNutrients } from '@/nutrition/nutrients';

const TODAY = '2026-11-13';
const YESTERDAY = addDaysToKey(TODAY, -1);
const at = (key: string, h: number, m = 0) => {
  const d = parseDayKey(key);
  d.setHours(h, m);
  return d.getTime();
};

/** A day's food totals, added up the way the Journal and Today screens do. */
async function foodDay(repo: Repository, key: string) {
  const from = parseDayKey(key).getTime();
  const to = parseDayKey(addDaysToKey(key, 1)).getTime();
  const foods = await repo.getFoods(from, to);
  return { count: foods.length, ...sumNutrients(foods.map((f) => entryNutrients(f, [], {}))) };
}

/** A day's water, added up the way the Water screen does. */
async function waterDay(repo: Repository, key: string) {
  const logs = await repo.getLogs('water', 60);
  return logs.filter((l) => dayKey(new Date(l.loggedAt)) === key).reduce((s, l) => s + l.value, 0);
}

const banana = catalogFood('banana')!;

function bananaEntry(over: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: 'food-1',
    loggedAt: at(TODAY, 9),
    name: banana.name,
    foodId: banana.id,
    unit: 'piece',
    quantity: 2,
    kcal: Math.round(nutrientsFor(banana, 'piece', 2, {}).kcal ?? 0),
    healthSampleId: null,
    place: 'dine-in',
    restaurant: 'Corner Cafe',
    ...over,
  };
}

/** A pretend Health Connect that can be told to fail. */
function healthStore(fail: { remove?: boolean; write?: boolean } = {}) {
  let next = 1;
  const store = {
    deleteSample: jest.fn(async (_kind: string, _id: string) => {
      if (fail.remove) throw new Error('remove failed');
    }),
    writeFood: jest.fn(async (_name: string, _n: unknown, _at: Date) => {
      if (fail.write) throw new Error('write failed');
      return `hc-${next++}`;
    }),
    writeWeight: jest.fn(async (_kg: number, _at: Date) => `hc-${next++}`),
    writeWater: jest.fn(async (_ml: number, _at: Date) => {
      if (fail.write) throw new Error('write failed');
      return `hc-${next++}`;
    }),
  };
  return store as typeof store & SampleWriter;
}

describe('changing a food entry', () => {
  it('moves it to another day: both days’ totals follow, with no second entry', async () => {
    const repo = await openRepository();
    const entry = bananaEntry();
    await repo.addFood(entry);
    await repo.addFood(bananaEntry({ id: 'food-2', loggedAt: at(YESTERDAY, 20), quantity: 1, place: 'home', restaurant: null }));
    const before = { today: await foodDay(repo, TODAY), yesterday: await foodDay(repo, YESTERDAY) };

    const moved = { ...entry, loggedAt: at(YESTERDAY, 13, 30) };
    await changeFood(repo, healthStore(), entry, moved, nutrientsFor(banana, 'piece', 2, {}));

    const today = await foodDay(repo, TODAY);
    const yesterday = await foodDay(repo, YESTERDAY);
    expect(today.count).toBe(0);
    expect(today.kcal ?? 0).toBe(0);
    expect(yesterday.count).toBe(2);
    expect(yesterday.kcal).toBeCloseTo((before.today.kcal ?? 0) + (before.yesterday.kcal ?? 0), 5);
    expect(yesterday.potassium).toBeCloseTo((before.today.potassium ?? 0) + (before.yesterday.potassium ?? 0), 5);

    const all = await repo.getFoods(0, Number.MAX_SAFE_INTEGER);
    expect(all).toHaveLength(2);
    const saved = all.find((f) => f.id === 'food-1')!;
    expect(saved).toMatchObject({ loggedAt: moved.loggedAt, foodId: 'banana', place: 'dine-in', restaurant: 'Corner Cafe' });
  });

  it('changes the amount in place: the day total follows', async () => {
    const repo = await openRepository();
    const entry = bananaEntry();
    await repo.addFood(entry);
    const n = nutrientsFor(banana, 'piece', 3, {});
    await changeFood(repo, healthStore(), entry, { ...entry, quantity: 3, kcal: Math.round(n.kcal ?? 0) }, n);
    expect((await foodDay(repo, TODAY)).kcal).toBeCloseTo(n.kcal ?? 0, 5);
    expect((await repo.getFoods(0, Number.MAX_SAFE_INTEGER)).map((f) => f.quantity)).toEqual([3]);
  });

  it('swaps the Health Connect copy for a new one at the new time', async () => {
    const repo = await openRepository();
    const entry = bananaEntry({ healthSampleId: 'hc-old' });
    await repo.addFood(entry);
    const store = healthStore();
    const n = nutrientsFor(banana, 'piece', 2, {});
    const moved = { ...entry, loggedAt: at(YESTERDAY, 8) };

    expect(await changeFood(repo, store, entry, moved, n)).toBe('updated');
    expect(store.deleteSample).toHaveBeenCalledWith('food', 'hc-old');
    expect(store.writeFood).toHaveBeenCalledWith(banana.name, n, new Date(moved.loggedAt));
    const [saved] = await repo.getFoods(0, Number.MAX_SAFE_INTEGER);
    expect(saved.healthSampleId).toBe('hc-1');
  });

  it('keeps the edit when Health Connect can’t write the new copy', async () => {
    const repo = await openRepository();
    const entry = bananaEntry({ healthSampleId: 'hc-old' });
    await repo.addFood(entry);
    const moved = { ...entry, loggedAt: at(YESTERDAY, 8), quantity: 1 };

    expect(await changeFood(repo, healthStore({ write: true }), entry, moved, { kcal: 105 })).toBe('failed');
    const [saved] = await repo.getFoods(0, Number.MAX_SAFE_INTEGER);
    expect(saved).toMatchObject({ loggedAt: moved.loggedAt, quantity: 1, healthSampleId: null });
  });

  it('keeps the edit and the old copy’s id when Health Connect can’t delete the old copy', async () => {
    const repo = await openRepository();
    const entry = bananaEntry({ healthSampleId: 'hc-old' });
    await repo.addFood(entry);
    const store = healthStore({ remove: true });
    const moved = { ...entry, loggedAt: at(YESTERDAY, 8) };

    expect(await changeFood(repo, store, entry, moved, { kcal: 210 })).toBe('failed');
    // No second copy written next to the one that couldn't be deleted.
    expect(store.writeFood).not.toHaveBeenCalled();
    const [saved] = await repo.getFoods(0, Number.MAX_SAFE_INTEGER);
    expect(saved).toMatchObject({ loggedAt: moved.loggedAt, healthSampleId: 'hc-old' });
  });

  it('leaves Health Connect alone for an entry never copied there', async () => {
    const repo = await openRepository();
    const entry = bananaEntry();
    await repo.addFood(entry);
    const store = healthStore();
    expect(await changeFood(repo, store, entry, { ...entry, quantity: 1 }, { kcal: 105 })).toBe('none');
    expect(store.deleteSample).not.toHaveBeenCalled();
    expect(store.writeFood).not.toHaveBeenCalled();
  });

  it('doesn’t crash when the step source can’t write to a health store at all', async () => {
    const repo = await openRepository();
    const entry = bananaEntry({ healthSampleId: 'hc-old' });
    await repo.addFood(entry);
    expect(await changeFood(repo, {}, entry, { ...entry, quantity: 1 }, { kcal: 105 })).toBe('failed');
    const [saved] = await repo.getFoods(0, Number.MAX_SAFE_INTEGER);
    expect(saved).toMatchObject({ quantity: 1, healthSampleId: 'hc-old' });
  });
});

describe('deleting a food entry', () => {
  it('takes it off its day’s total and deletes the Health Connect copy', async () => {
    const repo = await openRepository();
    const keep = bananaEntry({ id: 'keep', quantity: 1 });
    const gone = bananaEntry({ id: 'gone', healthSampleId: 'hc-9' });
    await repo.addFood(keep);
    await repo.addFood(gone);
    const store = healthStore();

    expect(await deleteFood(repo, store, gone)).toBe('updated');
    expect(store.deleteSample).toHaveBeenCalledWith('food', 'hc-9');
    const day = await foodDay(repo, TODAY);
    expect(day.count).toBe(1);
    expect(day.kcal).toBeCloseTo(nutrientsFor(banana, 'piece', 1, {}).kcal ?? 0, 5);
  });

  it('still deletes it here when Health Connect fails', async () => {
    const repo = await openRepository();
    const entry = bananaEntry({ healthSampleId: 'hc-9' });
    await repo.addFood(entry);
    expect(await deleteFood(repo, healthStore({ remove: true }), entry)).toBe('failed');
    expect((await foodDay(repo, TODAY)).count).toBe(0);
  });
});

describe('water and weight entries', () => {
  const water = (over: Partial<LogEntry>): LogEntry => ({
    id: 'w1',
    loggedAt: at(TODAY, 10),
    value: 500,
    healthSampleId: null,
    ...over,
  });

  it('moving water to yesterday updates both days’ totals', async () => {
    const repo = await openRepository();
    const entry = water({ healthSampleId: 'hc-w' });
    await repo.addLog('water', entry);
    await repo.addLog('water', water({ id: 'w2', value: 250 }));
    await repo.addLog('water', water({ id: 'w3', loggedAt: at(YESTERDAY, 18), value: 300 }));

    const store = healthStore();
    const copy = await changeLog(repo, store, 'water', entry, { ...entry, loggedAt: at(YESTERDAY, 21) });
    expect(copy).toBe('updated');
    expect(store.deleteSample).toHaveBeenCalledWith('water', 'hc-w');
    expect(store.writeWater).toHaveBeenCalledWith(500, new Date(at(YESTERDAY, 21)));
    expect(await waterDay(repo, TODAY)).toBe(250);
    expect(await waterDay(repo, YESTERDAY)).toBe(800);
    expect(await repo.getLogs('water', 60)).toHaveLength(3);
  });

  it('changing the amount keeps the edit when Health Connect fails', async () => {
    const repo = await openRepository();
    const entry = water({ healthSampleId: 'hc-w' });
    await repo.addLog('water', entry);
    expect(await changeLog(repo, healthStore({ write: true }), 'water', entry, { ...entry, value: 750 })).toBe('failed');
    expect(await waterDay(repo, TODAY)).toBe(750);
    expect((await repo.getLogs('water', 1))[0].healthSampleId).toBeNull();
  });

  it('deleting water takes it off the day’s total', async () => {
    const repo = await openRepository();
    await repo.addLog('water', water({}));
    await repo.addLog('water', water({ id: 'w2', value: 250 }));
    await deleteLog(repo, healthStore(), 'water', water({}));
    expect(await waterDay(repo, TODAY)).toBe(250);
  });

  it('changes a weight in place', async () => {
    const repo = await openRepository();
    const entry: LogEntry = { id: 'kg', loggedAt: at(TODAY, 7), value: 70, healthSampleId: null };
    await repo.addLog('weight', entry);
    await changeLog(repo, healthStore(), 'weight', entry, { ...entry, value: 69.5, loggedAt: at(YESTERDAY, 7) });
    expect(await repo.getLogs('weight', 10)).toEqual([{ ...entry, value: 69.5, loggedAt: at(YESTERDAY, 7) }]);
  });
});

describe('blood pressure readings', () => {
  const reading = (over: Partial<BloodPressureEntry> = {}): BloodPressureEntry => ({
    id: 'bp1',
    loggedAt: at(TODAY, 8),
    systolic: 130,
    diastolic: 85,
    pulse: 70,
    source: 'manual',
    healthId: 'hc-bp',
    updatedAt: 1,
    ...over,
  });

  function vitals(fail = false) {
    const v = {
      deleteBloodPressure: jest.fn(async (_entry: BloodPressureEntry) => undefined),
      writeBloodPressure: jest.fn(async (_s: number, _d: number, _at: Date) => {
        if (fail) throw new Error('write failed');
        return 'hc-bp2';
      }),
    };
    return v as typeof v & BpWriter;
  }

  it('saves every field, and Health Connect gets the new reading', async () => {
    const repo = await openRepository();
    const before = reading();
    await repo.saveBloodPressure(before);
    const v = vitals();
    const after = { ...before, systolic: 128, diastolic: 82, pulse: null, loggedAt: at(YESTERDAY, 19) };

    expect(await changeBloodPressure(repo, v, before, after, 5)).toBe('updated');
    expect(v.deleteBloodPressure).toHaveBeenCalledWith(expect.objectContaining({ healthId: 'hc-bp' }));
    expect(v.writeBloodPressure).toHaveBeenCalledWith(128, 82, new Date(at(YESTERDAY, 19)));
    const all = await repo.getBloodPressure(0, Number.MAX_SAFE_INTEGER);
    expect(all).toEqual([{ ...after, healthId: 'hc-bp2', updatedAt: 5 }]);
  });

  it('keeps the edit when Health Connect fails', async () => {
    const repo = await openRepository();
    const before = reading();
    await repo.saveBloodPressure(before);
    expect(await changeBloodPressure(repo, vitals(true), before, { ...before, systolic: 120 })).toBe('failed');
    const [saved] = await repo.getBloodPressure(0, Number.MAX_SAFE_INTEGER);
    expect(saved).toMatchObject({ systolic: 120, healthId: null });
  });

  it('never changes or deletes a reading from another app', async () => {
    const repo = await openRepository();
    const theirs = reading({ id: 'health:x', source: 'health', healthId: 'x' });
    await repo.saveBloodPressure(theirs);
    const v = vitals();
    expect(await changeBloodPressure(repo, v, theirs, { ...theirs, systolic: 100 })).toBe('none');
    expect(await deleteBloodPressure(repo, v, theirs)).toBe('none');
    expect(await repo.getBloodPressure(0, Number.MAX_SAFE_INTEGER)).toEqual([theirs]);
    expect(v.deleteBloodPressure).not.toHaveBeenCalled();
  });

  it('remembers a copy Health Connect couldn’t delete, and deletes it on a later try', async () => {
    const repo = await openRepository();
    const entry = reading();
    await repo.saveBloodPressure(entry);
    const failing = {
      deleteBloodPressure: jest.fn(async (_entry: BloodPressureEntry) => {
        throw new Error('Health Connect is updating');
      }),
      writeBloodPressure: jest.fn(async () => null),
    } as BpWriter;

    expect(await deleteBloodPressure(repo, failing, entry)).toBe('failed');
    expect(await repo.getBloodPressure(0, Number.MAX_SAFE_INTEGER)).toEqual([]);
    // Still failing: kept, and its id is one for the sync to skip.
    expect(await retryLeftCopies(repo, failing)).toEqual(new Set(['hc-bp']));
    const v = vitals();
    expect(await retryLeftCopies(repo, v)).toEqual(new Set(['hc-bp']));
    expect(v.deleteBloodPressure).toHaveBeenCalledWith(entry);
    // Deleted there now: nothing left to skip or to try again.
    expect(await retryLeftCopies(repo, v)).toEqual(new Set());
    expect(v.deleteBloodPressure).toHaveBeenCalledTimes(1);
  });
});

describe('nights and moods', () => {
  it('moving a night to another morning leaves one night, on the new morning', async () => {
    const repo = await openRepository();
    const first = await saveNight(repo, null, { startAt: at(YESTERDAY, 23), endAt: at(TODAY, 6, 30), rested: 4 });
    expect(first.date).toBe(TODAY);
    const moved = await saveNight(repo, first, {
      startAt: at(addDaysToKey(TODAY, -2), 22),
      endAt: at(YESTERDAY, 6),
      rested: 3,
    });
    const all = await repo.getSleep(addDaysToKey(TODAY, -7), TODAY);
    expect(all).toEqual([moved]);
    expect(moved).toMatchObject({ date: YESTERDAY, asleepMin: 8 * 60, rested: 3, source: 'manual' });
  });

  it('the Last night card adds a missed night for another morning and keeps this morning’s', async () => {
    const repo = await openRepository();
    const lastNight = await saveNight(repo, null, { startAt: at(YESTERDAY, 23), endAt: at(TODAY, 6, 30), rested: 4 });
    // The same card, its dates changed to the night before.
    const missed = await saveLastNight(repo, lastNight, {
      startAt: at(addDaysToKey(TODAY, -2), 23),
      endAt: at(YESTERDAY, 7),
      rested: 3,
    });
    expect(missed).toMatchObject({ date: YESTERDAY, asleepMin: 8 * 60, rested: 3 });
    const all = await repo.getSleep(addDaysToKey(TODAY, -7), TODAY);
    expect(all).toHaveLength(2);
    expect(all.find((n) => n.date === TODAY)).toEqual(lastNight);
  });

  it('the Last night card still changes this morning’s night', async () => {
    const repo = await openRepository();
    const lastNight = await saveNight(repo, null, { startAt: at(YESTERDAY, 23), endAt: at(TODAY, 6, 30), rested: 4 });
    const changed = await saveLastNight(repo, lastNight, { startAt: at(YESTERDAY, 22), endAt: at(TODAY, 7), rested: 5 });
    expect(changed).toMatchObject({ id: lastNight.id, date: TODAY, asleepMin: 9 * 60, rested: 5 });
    expect(await repo.getSleep(addDaysToKey(TODAY, -7), TODAY)).toEqual([changed]);
  });

  it('a night whose wake-up time isn’t changed keeps its morning, even in another time zone', async () => {
    const repo = await openRepository();
    // Logged where it was already this morning; the phone's clock here still says last night.
    const before: SleepEntry = {
      id: manualNightId(TODAY),
      date: TODAY,
      startAt: at(YESTERDAY, 16),
      endAt: at(YESTERDAY, 23, 30),
      asleepMin: 450,
      rested: 3,
      source: 'manual',
      healthId: null,
      stages: null,
      updatedAt: 1,
    };
    await repo.saveSleep(before);
    const other = await saveNight(repo, null, { startAt: at(addDaysToKey(TODAY, -2), 23), endAt: at(YESTERDAY, 6), rested: 2 });

    const after = await saveNight(repo, before, { startAt: before.startAt, endAt: before.endAt, rested: 5 });
    expect(after).toMatchObject({ id: before.id, date: TODAY, rested: 5 });
    const all = await repo.getSleep(addDaysToKey(TODAY, -7), TODAY);
    expect(all).toHaveLength(2);
    expect(all.find((n) => n.date === YESTERDAY)).toEqual(other);
  });

  it('a mood whose time isn’t changed keeps its day, even in another time zone', async () => {
    const repo = await openRepository();
    // Logged just after midnight where it was already today; the phone's clock here says yesterday.
    const before: MoodEntry = { date: TODAY, mood: 3, note: null, loggedAt: at(YESTERDAY, 23) };
    const yesterday: MoodEntry = { date: YESTERDAY, mood: 5, note: 'keep me', loggedAt: at(YESTERDAY, 9) };
    await repo.setMood(before);
    await repo.setMood(yesterday);

    const after = await saveMood(repo, before, { mood: 4, note: 'better', loggedAt: before.loggedAt });
    expect(after.date).toBe(TODAY);
    expect(await repo.getMoods(YESTERDAY, TODAY)).toEqual([yesterday, { ...before, mood: 4, note: 'better' }]);
  });

  it('a mood moved to another day leaves that day only', async () => {
    const repo = await openRepository();
    const today = await saveMood(repo, null, { mood: 4, note: ' walked ', loggedAt: at(TODAY, 20) });
    expect(today).toMatchObject({ date: TODAY, note: 'walked' });
    await saveMood(repo, today, { mood: 2, note: null, loggedAt: at(YESTERDAY, 21) });
    expect(await repo.getMoods(YESTERDAY, TODAY)).toEqual([{ date: YESTERDAY, mood: 2, note: null, loggedAt: at(YESTERDAY, 21) }]);
    await repo.deleteMood(YESTERDAY);
    expect(await repo.getMoods(YESTERDAY, TODAY)).toEqual([]);
  });
});

describe('replacing a health store copy', () => {
  it('reports what happened without throwing', async () => {
    const ok = async () => undefined;
    const boom = async () => {
      throw new Error('no');
    };
    expect(await replaceCopy(null, ok, async () => 'n')).toEqual({ id: null, result: 'none' });
    expect(await replaceCopy('o', ok, async () => 'n')).toEqual({ id: 'n', result: 'updated' });
    expect(await replaceCopy('o', boom, async () => 'n')).toEqual({ id: 'o', result: 'failed' });
    expect(await replaceCopy('o', ok, boom)).toEqual({ id: null, result: 'failed' });
    expect(await replaceCopy('o', undefined, async () => 'n')).toEqual({ id: 'o', result: 'failed' });
  });
});
