import { describe, expect, it } from '@jest/globals';

import { memoryRepository } from '@/data/db.web';
import { loadProfile } from '@/data/profile';
import { addDaysToKey, formatDayLong, parseDayKey } from '@/lib/dates';
import { formatDuration, formatPace, formatSteps } from '@/lib/format';
import { ACTIVE_CADENCE } from '@/lib/metrics';
import { paceSecPerKm } from '@/lib/walk';
import { nutrientsFor } from '@/nutrition/catalog';
import { entryNutrients } from '@/nutrition/day';
import { dayKcalTarget, fullDayKcal } from '@/nutrition/targets';

import {
  SAMPLE_DAY,
  SAMPLE_FOOD,
  SAMPLE_FOOD_RESULT,
  SAMPLE_FOODS,
  SAMPLE_GOAL,
  SAMPLE_HOURLY,
  SAMPLE_KCAL_TARGET,
  SAMPLE_NOW,
  SAMPLE_PROFILE,
  SAMPLE_SLEEP,
  SAMPLE_STEPS,
  SAMPLE_TODAY,
  SAMPLE_WALK,
  SAMPLE_WALK_ID,
  SAMPLE_WALK_PARTS,
  SAMPLE_WALK_POINTS,
  SAMPLE_WATER,
  sampleSnapshot,
  sampleStepBuckets,
  sampleTime,
} from '../sample';

const clock = (ms: number) => {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

describe('the sample day matches the mockups', () => {
  it('is Friday 14 Nov, early afternoon', () => {
    expect(SAMPLE_DAY).toBe('2025-11-14');
    expect(formatDayLong(SAMPLE_DAY)).toBe('Fri, 14 Nov');
    expect(clock(SAMPLE_NOW)).toBe('13:30');
  });

  it('has 6,240 of 8,000 steps (78%), 4.6 km and 52 active minutes', () => {
    expect(SAMPLE_STEPS).toBe(6240);
    expect(SAMPLE_GOAL).toBe(8000);
    expect(SAMPLE_PROFILE.dailyGoal).toBe(8000);
    expect(formatSteps(SAMPLE_TODAY.steps)).toBe('6,240');
    expect(Math.round((SAMPLE_STEPS / SAMPLE_GOAL) * 100)).toBe(78);
    expect(SAMPLE_TODAY.distanceM).toBe(4600);
    expect(SAMPLE_TODAY.activeMin).toBe(52);
    expect(SAMPLE_TODAY.date).toBe(SAMPLE_DAY);
  });

  it('has hourly steps that add up to the day, none after now', () => {
    expect(SAMPLE_HOURLY).toHaveLength(24);
    expect(SAMPLE_HOURLY.reduce((a, b) => a + b, 0)).toBe(SAMPLE_STEPS);
    expect(SAMPLE_HOURLY.slice(new Date(SAMPLE_NOW).getHours() + 1).every((h) => h === 0)).toBe(true);
  });

  it('has 1,280 kcal eaten of a 1,900 kcal target', () => {
    const eaten = SAMPLE_FOODS.map((f) => entryNutrients(f, [], {}).kcal ?? 0).reduce((a, b) => a + b, 0);
    expect(eaten).toBe(1280);
    expect(SAMPLE_FOODS.every((f) => f.loggedAt >= parseDayKey(SAMPLE_DAY).getTime() && f.loggedAt <= SAMPLE_NOW)).toBe(true);
    expect(SAMPLE_KCAL_TARGET).toBe(1900);
    expect(fullDayKcal(SAMPLE_PROFILE, 2025)).toBe(1900);
    expect(dayKcalTarget(SAMPLE_PROFILE, SAMPLE_TODAY.activeKcal, 2025)).toBe(1900);
  });

  it('has 5 of 8 glasses of water', () => {
    expect(SAMPLE_WATER).toHaveLength(5);
    expect(SAMPLE_WATER.every((w) => w.value === SAMPLE_PROFILE.water.glassMl)).toBe(true);
    expect(SAMPLE_PROFILE.water.targetMl! / SAMPLE_PROFILE.water.glassMl).toBe(8);
    expect(SAMPLE_WATER.every((w) => w.loggedAt <= SAMPLE_NOW)).toBe(true);
  });

  it('has 6 h 50 m of sleep last night, counted on the sample day', () => {
    expect(SAMPLE_SLEEP.date).toBe(SAMPLE_DAY);
    expect(SAMPLE_SLEEP.asleepMin).toBe(6 * 60 + 50);
    expect((SAMPLE_SLEEP.endAt - SAMPLE_SLEEP.startAt) / 60_000).toBe(410);
    expect(SAMPLE_SLEEP.startAt).toBe(sampleTime(23, 20, -1));
  });

  it('has the morning walk: 7:10 am, 2.3 km, 32 min, 3,120 steps, 13:55 /km, 2 floors, 24 °C clear', () => {
    expect(clock(SAMPLE_WALK.startedAt)).toBe('7:10');
    expect(SAMPLE_WALK.distanceM).toBe(2300);
    expect(formatDuration(SAMPLE_WALK.movingS)).toBe('32 min');
    expect(SAMPLE_WALK.steps).toBe(3120);
    expect(formatPace(paceSecPerKm(SAMPLE_WALK.distanceM, SAMPLE_WALK.movingS), 'metric')).toBe('13:55 /km');
    expect(SAMPLE_WALK.floorsUp).toBe(2);
    expect(SAMPLE_WALK.weather).toEqual({ tempC: 24, condition: 'clear', forecast: true });
    // Counted steps are final, so opening the walk never asks a step source for them.
    expect(SAMPLE_WALK.stepsFrom).toBe('walk');
  });

  it('has the walk in two parts: 28 min on foot and a 6 min car ride, removed', () => {
    expect(SAMPLE_WALK_PARTS).toHaveLength(1);
    const [car] = SAMPLE_WALK_PARTS;
    expect(car).toMatchObject({ walkId: SAMPLE_WALK_ID, ord: 0, kind: 'vehicle', choice: 'remove' });
    expect((car.endT - car.startT) / 60_000).toBe(6);
    expect((SAMPLE_WALK.endedAt - SAMPLE_WALK.startedAt - (car.endT - car.startT)) / 60_000).toBe(28);
  });

  it('has a route in time order inside the walk, the car fixes marked as its part', () => {
    expect(SAMPLE_WALK_POINTS.length).toBeGreaterThan(100);
    for (let i = 1; i < SAMPLE_WALK_POINTS.length; i++) {
      expect(SAMPLE_WALK_POINTS[i].t).toBeGreaterThan(SAMPLE_WALK_POINTS[i - 1].t);
    }
    expect(SAMPLE_WALK_POINTS[0].t).toBe(SAMPLE_WALK.startedAt);
    expect(SAMPLE_WALK_POINTS.at(-1)!.t).toBe(SAMPLE_WALK.endedAt);
    const [car] = SAMPLE_WALK_PARTS;
    for (const p of SAMPLE_WALK_POINTS) {
      const inCar = p.t >= car.startT && p.t <= car.endT;
      expect(p.part).toBe(inCar ? 0 : null);
      expect(Number.isFinite(p.lat) && Number.isFinite(p.lon)).toBe(true);
    }
  });

  it('has the food look-up: 1 bowl of endu chepala with egg curry, 412 kcal, P38 C14 F22', () => {
    expect(SAMPLE_FOOD_RESULT.query).toBe('endu chepala with egg curry');
    expect(SAMPLE_FOOD_RESULT.script).toBe('ఎండు చేపల గుడ్డు కూర');
    expect(SAMPLE_FOOD_RESULT.unit).toBe('bowl');
    expect(SAMPLE_FOOD_RESULT.quantity).toBe(1);
    expect(SAMPLE_FOOD_RESULT.meal).toBe('lunch');
    const n = nutrientsFor(SAMPLE_FOOD, 'bowl', 1, {});
    const round = (v: number | undefined, places = 0) => Number((v ?? NaN).toFixed(places));
    expect(round(n.kcal)).toBe(412);
    expect(round(n.protein)).toBe(38);
    expect(round(n.carbs)).toBe(14);
    expect(round(n.fat)).toBe(22);
    expect(round(n.sodium)).toBe(1850);
    expect(round(n.calcium)).toBe(210);
    expect(round(n.iron, 1)).toBe(3.1);
    expect(round(n.vitB12, 1)).toBe(2.4);
    expect(round(n.vitA)).toBe(180);
  });

  it('has the five ingredients, 260 g a bowl, and the partly known nutrients still pending', () => {
    expect(SAMPLE_FOOD.ingredients).toEqual([
      { name: 'Dried anchovy (methallu)', grams: 40 },
      { name: 'Egg 2', grams: 100 },
      { name: 'Onion', grams: 60 },
      { name: 'Tomato', grams: 50 },
      { name: 'Oil', grams: 10 },
    ]);
    const bowl = SAMPLE_FOOD.units.find((u) => u.key === 'bowl')!;
    expect(bowl.grams).toBe(SAMPLE_FOOD.ingredients!.reduce((a, i) => a + i.grams, 0));
    expect([...SAMPLE_FOOD.missing!].sort()).toEqual(['calcium', 'iron', 'sodium', 'vitA', 'vitB12']);
    expect(SAMPLE_FOOD.pending).toBe(true);
  });
});

describe('the sample repository', () => {
  it('reads back the sample day as the screens ask for it', async () => {
    const repo = memoryRepository(sampleSnapshot());
    expect(await loadProfile(repo)).toEqual(SAMPLE_PROFILE);
    expect(await repo.getDay(SAMPLE_DAY)).toEqual(SAMPLE_TODAY);
    expect(await repo.getHourly(SAMPLE_DAY)).toEqual(SAMPLE_HOURLY);
    const start = parseDayKey(SAMPLE_DAY).getTime();
    const end = parseDayKey(addDaysToKey(SAMPLE_DAY, 1)).getTime();
    const foods = await repo.getFoods(start, end);
    expect(foods.reduce((a, f) => a + f.kcal, 0)).toBe(1280);
    expect((await repo.getLogs('water', 20)).length).toBe(5);
    expect(await repo.getSleep(SAMPLE_DAY, SAMPLE_DAY)).toEqual([SAMPLE_SLEEP]);
    expect((await repo.getWalks(5)).map((w) => w.id)).toEqual([SAMPLE_WALK_ID]);
    const walk = await repo.getWalk(SAMPLE_WALK_ID);
    expect(walk?.walk).toEqual(SAMPLE_WALK);
    expect(walk?.points).toHaveLength(SAMPLE_WALK_POINTS.length);
    expect(await repo.getWalkParts(SAMPLE_WALK_ID)).toEqual(SAMPLE_WALK_PARTS);
    expect((await repo.getWeather(SAMPLE_DAY))?.condition).toBe('clear');
    expect((await repo.getSavedFoods()).map((f) => f.id)).toEqual([SAMPLE_FOOD.id]);
  });

  it('keeps changes in memory only: a fresh one starts from the sample again', async () => {
    const repo = memoryRepository(sampleSnapshot());
    await repo.addLog('water', { id: 'extra', loggedAt: SAMPLE_NOW, value: 250, healthSampleId: null });
    await repo.deleteWalk(SAMPLE_WALK_ID);
    expect((await repo.getLogs('water', 20)).length).toBe(6);
    const fresh = memoryRepository(sampleSnapshot());
    expect((await fresh.getLogs('water', 20)).length).toBe(5);
    expect(await fresh.getWalk(SAMPLE_WALK_ID)).not.toBeNull();
  });
});

describe('the sample day step minutes for the detail screen', () => {
  const dayStart = new Date(sampleTime(0));
  const dayEnd = new Date(sampleTime(0, 0, 1));

  it('add up to each hour figure at every bucket size', () => {
    for (const size of [1, 15, 60]) {
      const buckets = sampleStepBuckets(dayStart, dayEnd, size);
      expect(buckets.reduce((a, b) => a + b.steps, 0)).toBe(SAMPLE_STEPS);
      const perHour = new Array<number>(24).fill(0);
      for (const b of buckets) perHour[new Date(b.start).getHours()] += b.steps;
      expect(perHour).toEqual(SAMPLE_HOURLY);
    }
  });

  it('make 52 active minutes at the app cadence, as Today says', () => {
    const minutes = sampleStepBuckets(dayStart, dayEnd, 1);
    expect(minutes.filter((b) => b.steps >= ACTIVE_CADENCE).length).toBe(SAMPLE_TODAY.activeMin);
  });

  it('put the morning walk steps in 15-minute bars from 7:10', () => {
    const quarters = sampleStepBuckets(dayStart, dayEnd, 15);
    expect(quarters.every((b) => b.end - b.start === 15 * 60_000)).toBe(true);
    const first = quarters.find((b) => new Date(b.start).getHours() === 7);
    expect(clock(first?.start ?? 0)).toBe('7:00');
  });

  it('give nothing for another day or a window with no steps', () => {
    expect(sampleStepBuckets(new Date(sampleTime(0, 0, -1)), dayStart, 15)).toEqual([]);
    expect(sampleStepBuckets(new Date(sampleTime(14)), dayEnd, 15)).toEqual([]);
  });
});
