import { describe, expect, it } from '@jest/globals';

import type { DaySummary, DayWeather, MoodEntry } from '@/data/types';
import { restingKcalPerDay, restingKcalSoFar } from '@/lib/calories';
import { addDaysToKey } from '@/lib/dates';
import {
  compare,
  describeChange,
  formatHourWindow,
  heatComparison,
  moodComparison,
  rainComparison,
  timeOfDay,
  weekendComparison,
} from '@/lib/insights';
import {
  cleanPoints,
  distanceM,
  metForSpeed,
  paceSecPerKm,
  projectRoute,
  walkActiveKcal,
  walkStats,
  type WalkPoint,
} from '@/lib/walk';

/** A straight walk north from Bengaluru at `speedMs`, one fix every 2 s. */
function straightWalk(seconds: number, speedMs: number, acc = 5): WalkPoint[] {
  const metresPerDegree = 111_195;
  const points: WalkPoint[] = [];
  for (let s = 0; s <= seconds; s += 2) {
    points.push({ t: 1_000_000 + s * 1000, lat: 12.93 + (s * speedMs) / metresPerDegree, lon: 77.62, acc });
  }
  return points;
}

describe('walk maths', () => {
  it('measures great-circle distance', () => {
    // One degree of latitude is ~111.2 km.
    expect(distanceM({ lat: 12, lon: 77 }, { lat: 13, lon: 77 })).toBeCloseTo(111_195, -2);
  });

  it('adds up a steady walk', () => {
    const stats = walkStats(cleanPoints(straightWalk(600, 1.4)));
    expect(stats.distanceM).toBeGreaterThan(820);
    expect(stats.distanceM).toBeLessThan(850);
    expect(stats.movingS).toBeGreaterThan(570);
  });

  it('ignores GPS wobble while standing still', () => {
    const standing: WalkPoint[] = [];
    for (let s = 0; s < 300; s += 2) {
      standing.push({ t: s * 1000, lat: 12.93 + Math.sin(s) * 0.00002, lon: 77.62 + Math.cos(s) * 0.00002, acc: 8 });
    }
    expect(walkStats(cleanPoints(standing)).distanceM).toBeLessThan(10);
  });

  it('drops imprecise fixes and jumps', () => {
    const points = straightWalk(60, 1.4);
    points[10] = { ...points[10], acc: 80 };
    points[20] = { ...points[20], lat: points[20].lat + 0.01 };
    const clean = cleanPoints(points);
    expect(clean).toHaveLength(points.length - 2);
  });

  it('counts a stop as standing, not slow walking', () => {
    const before = straightWalk(300, 1.4);
    const last = before[before.length - 1];
    const stop: WalkPoint = { ...last, t: last.t + 600_000 };
    const after = straightWalk(300, 1.4).map((p) => ({
      ...p,
      t: p.t + stop.t - 1_000_000 + 2000,
      lat: p.lat + (last.lat - 12.93),
    }));
    const stats = walkStats(cleanPoints([...before, stop, ...after]));
    expect(stats.movingS).toBeLessThan(700);
    expect(paceSecPerKm(stats.distanceM, stats.movingS)).toBeLessThan(800);
  });

  it('burns more per minute walking briskly', () => {
    expect(metForSpeed(4.8)).toBeCloseTo(3.5);
    expect(metForSpeed(5.2)).toBeGreaterThan(3.5);
    expect(metForSpeed(30)).toBe(11.8);
    const slow = walkActiveKcal(walkStats(cleanPoints(straightWalk(1800, 1.0))).segments, 70);
    const brisk = walkActiveKcal(walkStats(cleanPoints(straightWalk(1800, 1.7))).segments, 70);
    // 30 min at 6.1 km/h ≈ (4.8 − 1) × 70 × 0.5 ≈ 133 kcal.
    expect(brisk).toBeGreaterThan(120);
    expect(brisk).toBeLessThan(145);
    expect(slow).toBeLessThan(brisk);
  });

  it('projects a route into a box', () => {
    const xy = projectRoute(straightWalk(60, 1.4), 100, 50, 5);
    for (const p of xy) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(5 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(45 + 1e-9);
    }
    // North is up.
    expect(xy[0].y).toBeGreaterThan(xy[xy.length - 1].y);
  });
});

describe('calories', () => {
  it('estimates resting energy with Mifflin–St Jeor', () => {
    const p = { weightKg: 70, heightCm: 175, sex: 'male' as const, birthYear: 1996 };
    expect(restingKcalPerDay(p, 2026)).toBe(1649);
    expect(restingKcalPerDay({ ...p, sex: 'female' }, 2026)).toBe(1483);
    expect(restingKcalPerDay({ ...p, birthYear: null }, 2026)).toBe(1649);
  });
  it('prorates resting energy through the day', () => {
    const p = { weightKg: 70, heightCm: 175, sex: 'male' as const, birthYear: 1996 };
    expect(restingKcalSoFar(p, new Date(2026, 9, 30, 12))).toBe(825);
  });
});

const day = (date: string, steps: number): DaySummary => ({
  date,
  steps,
  distanceM: 0,
  activeKcal: 0,
  activeMin: 0,
  floors: null,
  goal: 7000,
  source: 'demo',
  updatedAt: 0,
});

const weather = (date: string, tempMaxC: number, precipMm = 0): DayWeather => ({
  date,
  tempMaxC,
  tempMinC: tempMaxC - 8,
  precipMm,
  condition: precipMm > 0 ? 'rain' : 'clear',
  place: null,
  hours: {},
  updatedAt: 0,
});

const mood = (date: string, m: MoodEntry['mood']): MoodEntry => ({ date, mood: m, note: null, loggedAt: 0 });

/** 2026-10-05 is a Monday. */
const dates = Array.from({ length: 14 }, (_, i) => addDaysToKey('2026-10-05', i));

describe('insights', () => {
  it('needs a few days on each side', () => {
    expect(compare([1, 2], [1, 2, 3])).toBeNull();
    expect(compare([6000, 6000, 6000], [4000, 4000, 4000])?.change).toBeCloseTo(0.5);
  });

  it('words changes plainly', () => {
    expect(describeChange(0.32)).toBe('32% more');
    expect(describeChange(-0.18)).toBe('18% fewer');
    expect(describeChange(0.02)).toBe('about the same');
  });

  it('finds when in the day someone walks', () => {
    const evening = new Array(24).fill(0);
    evening[18] = 2000;
    evening[19] = 1500;
    evening[8] = 500;
    const result = timeOfDay([evening, evening, evening]);
    expect(result?.peakStartHour).toBe(18);
    expect(result?.shares.evening).toBeCloseTo(0.875);
    expect(formatHourWindow(18)).toBe('6 and 8 pm');
    expect(formatHourWindow(11)).toBe('11 am and 1 pm');
  });

  it('compares weekends with weekdays', () => {
    const days = dates.map((d, i) => day(d, i % 7 >= 5 ? 9000 : 6000));
    expect(weekendComparison(days)?.change).toBeCloseTo(0.5);
  });

  it('lines steps up with mood', () => {
    const days = dates.map((d, i) => day(d, i < 7 ? 8000 : 5000));
    const moods = dates.map((d, i) => mood(d, i < 7 ? 5 : 2));
    expect(moodComparison(days, moods)?.change).toBeCloseTo(0.6);
    expect(moodComparison(days, moods.slice(0, 7))).toBeNull();
  });

  it('uses 35 °C when there are enough hot days', () => {
    const days = dates.map((d, i) => day(d, i < 5 ? 4000 : 7000));
    const temps = dates.map((d, i) => weather(d, i < 5 ? 37 : 31));
    expect(heatComparison(days, temps)).toEqual(expect.objectContaining({ thresholdC: 35 }));
    expect(heatComparison(days, temps)?.comparison.change).toBeCloseTo(-3 / 7);
  });

  it('falls back to the middle temperature in milder places', () => {
    const days = dates.map((d, i) => day(d, 5000 + i * 100));
    const temps = dates.map((d, i) => weather(d, 24 + i * 0.5));
    expect(heatComparison(days, temps)?.thresholdC).toBe(28);
  });

  it('compares rainy and dry days', () => {
    const days = dates.map((d, i) => day(d, i % 3 === 0 ? 3000 : 6000));
    const w = dates.map((d, i) => weather(d, 30, i % 3 === 0 ? 12 : 0));
    expect(rainComparison(days, w)?.change).toBeCloseTo(-0.5);
  });
});
