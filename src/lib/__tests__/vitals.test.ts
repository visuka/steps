import { describe, expect, it } from '@jest/globals';

import type { BloodPressureEntry, DaySummary, HeartDay, MoodEntry, SleepEntry } from '@/data/types';
import { averageBp, bpCategory, checkBp } from '@/lib/blood-pressure';
import { addDaysToKey, parseDayKey } from '@/lib/dates';
import {
  formatSleep,
  guessSleepWindow,
  nightsByDate,
  type SleepSegment,
  sleepSessions,
  toSleepEntries,
  unionMs,
} from '@/lib/sleep';
import {
  bpGoalComparison,
  restingTrend,
  restingWeekChange,
  sleepMoodComparison,
  sleepStepsComparison,
} from '@/lib/vitals-insights';

const MIN = 60_000;
const HOUR = 60 * MIN;
const T0 = new Date(2026, 9, 27, 23, 0).getTime();

const seg = (stage: SleepSegment['stage'], fromMin: number, toMin: number, source = 'watch', id = 's1'): SleepSegment => ({
  id,
  source,
  stage,
  start: T0 + fromMin * MIN,
  end: T0 + toMin * MIN,
});

const day = (date: string, steps: number, goal = 8000): DaySummary => ({
  date,
  steps,
  distanceM: 0,
  activeKcal: 0,
  activeMin: null,
  floors: null,
  goal,
  source: 'demo',
  updatedAt: 0,
});

const sleepEntry = (date: string, asleepMin: number, extra: Partial<SleepEntry> = {}): SleepEntry => ({
  id: `sleep-${date}`,
  date,
  startAt: parseDayKey(date).getTime() - HOUR,
  endAt: parseDayKey(date).getTime() + 7 * HOUR,
  asleepMin,
  rested: null,
  source: 'manual',
  healthId: null,
  stages: null,
  updatedAt: 0,
  ...extra,
});

describe('unionMs', () => {
  it('counts overlapping time once', () => {
    expect(unionMs([])).toBe(0);
    expect(unionMs([{ start: 0, end: 10 }, { start: 5, end: 15 }, { start: 20, end: 30 }])).toBe(25);
    expect(unionMs([{ start: 0, end: 30 }, { start: 5, end: 10 }])).toBe(30);
  });
});

describe('sleepSessions', () => {
  it('adds up stages and leaves out time awake', () => {
    const [s] = sleepSessions([
      seg('light', 0, 120),
      seg('deep', 120, 200),
      seg('awake', 200, 220),
      seg('rem', 220, 300),
      seg('light', 300, 450),
    ]);
    expect(s.asleepMin).toBe(430);
    expect(s.stages).toEqual({ awake: 20, light: 270, deep: 80, rem: 80 });
    expect(s.end - s.start).toBe(450 * MIN);
  });

  it("doesn't count a night twice when a phone and a watch both recorded it", () => {
    const sessions = sleepSessions([
      seg('inBed', -30, 480, 'phone', 'p1'),
      seg('light', 0, 200, 'watch', 'w1'),
      seg('deep', 200, 260, 'watch', 'w1'),
      seg('rem', 260, 420, 'watch', 'w1'),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('w1');
    expect(sessions[0].asleepMin).toBe(420);
  });

  it('counts time in bed as sleep when that is all an app knows', () => {
    const [s] = sleepSessions([seg('inBed', 0, 450, 'phone')]);
    expect(s.asleepMin).toBe(450);
    expect(s.stages).toBeNull();
  });

  it('splits a nap from the night and drops stray minutes', () => {
    const sessions = sleepSessions([seg('asleep', 0, 420), seg('asleep', 900, 960, 'watch', 'nap'), seg('asleep', 1200, 1205)]);
    expect(sessions.map((s) => s.asleepMin)).toEqual([420, 60]);
  });

  it('files a session under the morning it ended', () => {
    const [entry] = toSleepEntries(sleepSessions([seg('asleep', 0, 420)]), 0);
    expect(entry.date).toBe('2026-10-28');
    expect(entry.source).toBe('health');
    expect(entry.id).toBe('health:s1');
  });
});

describe('nightsByDate', () => {
  it('takes times from the watch and how rested from the person', () => {
    const nights = nightsByDate([
      sleepEntry('2026-10-28', 400, { rested: 4 }),
      sleepEntry('2026-10-28', 380, { id: 'health:x', source: 'health', healthId: 'x' }),
      sleepEntry('2026-10-28', 45, { id: 'health:nap', source: 'health', healthId: 'nap' }),
      sleepEntry('2026-10-27', 420, { rested: 2 }),
    ]);
    expect(nights.map((n) => n.date)).toEqual(['2026-10-27', '2026-10-28']);
    expect(nights[1]).toMatchObject({ asleepMin: 425, rested: 4, fromHealth: true });
    expect(nights[0]).toMatchObject({ asleepMin: 420, rested: 2, fromHealth: false });
  });
});

describe('guessSleepWindow', () => {
  const quiet = new Array<number>(24).fill(0);
  const late = new Date(2026, 9, 28, 20, 0).getTime();

  it('defaults to 23:00 to 06:30 without step data', () => {
    const { bedAt, wakeAt } = guessSleepWindow('2026-10-28', null, null, late);
    expect(new Date(bedAt)).toEqual(new Date(2026, 9, 27, 23, 0));
    expect(new Date(wakeAt)).toEqual(new Date(2026, 9, 28, 6, 30));
  });

  it('uses the last busy evening hour and the first busy morning hour', () => {
    const evening = [...quiet];
    evening[22] = 400;
    const morning = [...quiet];
    morning[0] = 30; // a trip to the bathroom isn't being up
    morning[7] = 900;
    morning[9] = 2000;
    const { bedAt, wakeAt } = guessSleepWindow('2026-10-28', evening, morning, late);
    expect(new Date(bedAt)).toEqual(new Date(2026, 9, 27, 23, 0));
    expect(new Date(wakeAt)).toEqual(new Date(2026, 9, 28, 7, 0));
  });

  it('handles a night that started after midnight', () => {
    const morning = [...quiet];
    morning[1] = 300;
    morning[8] = 1000;
    const { bedAt } = guessSleepWindow('2026-10-28', quiet, morning, late);
    expect(new Date(bedAt)).toEqual(new Date(2026, 9, 28, 2, 0));
  });

  it("doesn't guess a wake-up time that hasn't happened yet", () => {
    const early = new Date(2026, 9, 28, 5, 50).getTime();
    const { wakeAt } = guessSleepWindow('2026-10-28', null, null, early);
    expect(new Date(wakeAt)).toEqual(new Date(2026, 9, 28, 5, 45));
  });
});

describe('formatSleep', () => {
  it('reads naturally', () => {
    expect(formatSleep(45)).toBe('45 min');
    expect(formatSleep(420)).toBe('7 h');
    expect(formatSleep(445.4)).toBe('7 h 25 min');
  });
});

describe('blood pressure', () => {
  it('uses the AHA ranges, the higher number deciding', () => {
    expect(bpCategory(115, 75)).toBe('normal');
    expect(bpCategory(125, 78)).toBe('elevated');
    expect(bpCategory(118, 82)).toBe('stage1');
    expect(bpCategory(135, 70)).toBe('stage1');
    expect(bpCategory(142, 85)).toBe('stage2');
    expect(bpCategory(150, 122)).toBe('severe');
    expect(bpCategory(181, 100)).toBe('severe');
    expect(bpCategory(88, 58)).toBe('low');
  });

  it('catches likely typos', () => {
    expect(checkBp(120, 80, null)).toBeNull();
    expect(checkBp(120, 80, 72)).toBeNull();
    expect(checkBp(80, 120, null)).toMatch(/order/);
    expect(checkBp(1200, 80, null)).toMatch(/top number/);
    expect(checkBp(120, 8, null)).toMatch(/bottom number/);
    expect(checkBp(120, 80, 7)).toMatch(/pulse/);
    expect(checkBp(null, 80, null)).toMatch(/both/);
  });

  it('averages readings', () => {
    const r = (s: number, d: number) => ({ systolic: s, diastolic: d }) as BloodPressureEntry;
    expect(averageBp([])).toBeNull();
    expect(averageBp([r(120, 80), r(131, 85)])).toEqual({ systolic: 126, diastolic: 83, count: 2 });
  });
});

describe('vitals patterns', () => {
  const today = '2026-10-30';
  const date = (n: number) => addDaysToKey(today, -n);

  it('compares steps after full and short nights', () => {
    const days = [1, 2, 3, 4, 5, 6].map((n) => day(date(n), n <= 3 ? 9000 : 6000));
    const nights = nightsByDate(days.map((d, i) => sleepEntry(d.date, i < 3 ? 450 : 360)));
    expect(sleepStepsComparison(days, nights)).toMatchObject({ a: 9000, b: 6000, daysA: 3, daysB: 3 });
    expect(sleepStepsComparison(days.slice(0, 4), nights)).toBeNull();
  });

  it('compares sleep before good and other days', () => {
    const nights = nightsByDate([1, 2, 3, 4, 5, 6].map((n) => sleepEntry(date(n), n <= 3 ? 450 : 390)));
    const moods = [1, 2, 3, 4, 5, 6].map((n): MoodEntry => ({ date: date(n), mood: n <= 3 ? 5 : 2, note: null, loggedAt: 0 }));
    expect(sleepMoodComparison(nights, moods)).toMatchObject({ a: 450, b: 390 });
  });

  it('compares resting heart rate with a month earlier', () => {
    const heart: HeartDay[] = [];
    for (let n = 1; n <= 42; n++) {
      heart.push({ date: date(n), restingBpm: n <= 14 ? 66 : 71, avgBpm: null, minBpm: null, maxBpm: null, updatedAt: 0 });
    }
    const days = Array.from({ length: 42 }, (_, i) => day(date(i + 1), i < 14 ? 9000 : 6500));
    expect(restingTrend(heart, days, today)).toEqual({ recent: 66, earlier: 71, recentSteps: 9000, earlierSteps: 6500 });
    expect(restingTrend(heart.slice(0, 20), days, today)).toBeNull();
    expect(restingWeekChange(heart, today)).toEqual({ week: 66, before: 66 });
  });

  it('compares blood pressure on goal days and other days', () => {
    const days = [1, 2, 3, 4, 5, 6].map((n) => day(date(n), n <= 3 ? 9000 : 5000));
    const readings = days.map(
      (d, i) =>
        ({
          loggedAt: parseDayKey(d.date).getTime() + 8 * HOUR,
          systolic: i < 3 ? 124 : 132,
          diastolic: i < 3 ? 80 : 86,
        }) as BloodPressureEntry,
    );
    expect(bpGoalComparison(days, readings)).toEqual({
      goal: { systolic: 124, diastolic: 80, count: 3 },
      other: { systolic: 132, diastolic: 86, count: 3 },
    });
    expect(bpGoalComparison(days, readings.slice(0, 5))).toBeNull();
  });
});
