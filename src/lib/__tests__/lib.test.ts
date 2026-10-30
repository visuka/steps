import { describe, expect, it } from '@jest/globals';

import { achievementId, newAchievements } from '@/lib/achievements';
import { addDaysToKey, dayKey, daysBetween } from '@/lib/dates';
import { clampGoal, suggestGoal } from '@/lib/goals';
import { bucketKcal, metForCadence, strideMeters, summarizeBuckets } from '@/lib/metrics';
import { shouldRemind } from '@/lib/reminders';
import { computeStreaks } from '@/lib/streaks';

const at = (h: number, m = 0) => new Date(2026, 9, 29, h, m).getTime();

describe('dates', () => {
  it('moves across month and year ends', () => {
    expect(addDaysToKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToKey('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('counts calendar days regardless of daylight saving', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('formats local day keys', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('metrics', () => {
  it('estimates stride from height unless overridden', () => {
    expect(strideMeters(170, null)).toBeCloseTo(0.7, 2);
    expect(strideMeters(170, 0.8)).toBe(0.8);
  });

  it('maps cadence to METs at the bucket edges', () => {
    expect(metForCadence(99)).toBe(2.8);
    expect(metForCadence(100)).toBe(3.5);
    expect(metForCadence(120)).toBe(4.3);
    expect(metForCadence(130)).toBe(5.0);
  });

  it('does not charge idle time inside a slow bucket as walking', () => {
    // 45 steps in one minute = about half a minute of slow walking.
    expect(bucketKcal(45, 1, 70)).toBeCloseTo(1.8 * 70 * (0.5 / 60), 5);
  });

  it('summarises a brisk 10-minute walk', () => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      start: at(8, i),
      end: at(8, i + 1),
      steps: 110,
    }));
    buckets.push({ start: at(14, 0), end: at(14, 1), steps: 30 });
    const m = summarizeBuckets(buckets, { weightKg: 70, strideM: 0.7 });
    expect(m.steps).toBe(1130);
    expect(m.activeMin).toBe(10);
    expect(m.distanceM).toBe(791);
    expect(m.activeKcal).toBe(Math.round(2.5 * 70 * (10 / 60) + bucketKcal(30, 1, 70)));
    expect(m.hourly[8]).toBe(1100);
    expect(m.hourly[14]).toBe(30);
  });
});

describe('streaks', () => {
  const day = (date: string, steps: number) => ({ date, steps, goal: 5000 });

  it('counts today once its goal is met', () => {
    const days = [day('2026-10-27', 6000), day('2026-10-28', 6000), day('2026-10-29', 7000)];
    expect(computeStreaks(days, '2026-10-29')).toEqual({ current: 3, best: 3 });
  });

  it('keeps the streak alive while today is still in progress', () => {
    const days = [day('2026-10-27', 6000), day('2026-10-28', 6000), day('2026-10-29', 1200)];
    expect(computeStreaks(days, '2026-10-29').current).toBe(2);
  });

  it('breaks on a missed or missing day and remembers the best run', () => {
    const days = [
      day('2026-10-01', 6000),
      day('2026-10-02', 6000),
      day('2026-10-03', 6000),
      day('2026-10-05', 6000),
      day('2026-10-28', 100),
    ];
    expect(computeStreaks(days, '2026-10-29')).toEqual({ current: 0, best: 3 });
  });
});

describe('goals', () => {
  it('waits for 14 days of history', () => {
    expect(suggestGoal(new Array(13).fill(8000), 7000)).toBeNull();
  });
  it('suggests about 10% above the median, rounded to 500', () => {
    const days = [...new Array(7).fill(6000), ...new Array(7).fill(9000)];
    // median 7500 × 1.1 = 8250 → 8500 (rounds half up)
    expect(suggestGoal(days, 7000)).toBe(8500);
  });
  it('stays silent when the suggestion equals the goal', () => {
    expect(suggestGoal(new Array(14).fill(6400), 7000)).toBeNull();
  });
  it('never suggests lowering the goal', () => {
    expect(suggestGoal(new Array(14).fill(4000), 7000)).toBeNull();
  });
  it('clamps to sensible bounds', () => {
    expect(clampGoal(100)).toBe(2000);
    expect(clampGoal(99_000)).toBe(30_000);
  });
});

describe('reminders', () => {
  const settings = { enabled: true, startHour: 9, endHour: 20 };
  const base = { stepsLastWindow: 40, settings, lastRemindedAt: null, goalMetToday: false };

  it('nudges after an idle hour inside the window', () => {
    expect(shouldRemind({ ...base, now: new Date(at(15)) })).toBe(true);
  });
  it('stays quiet outside the window and in its first hour', () => {
    expect(shouldRemind({ ...base, now: new Date(at(21)) })).toBe(false);
    expect(shouldRemind({ ...base, now: new Date(at(9, 30)) })).toBe(false);
  });
  it('stays quiet after recent movement, a recent nudge, or a met goal', () => {
    expect(shouldRemind({ ...base, now: new Date(at(15)), stepsLastWindow: 600 })).toBe(false);
    expect(shouldRemind({ ...base, now: new Date(at(15)), lastRemindedAt: at(14, 30) })).toBe(false);
    expect(shouldRemind({ ...base, now: new Date(at(15)), goalMetToday: true })).toBe(false);
  });
  it('respects the off switch', () => {
    expect(shouldRemind({ ...base, now: new Date(at(15)), settings: { ...settings, enabled: false } })).toBe(false);
  });
});

describe('achievements', () => {
  it('awards each milestone once', () => {
    const first = newAchievements({ bestStreak: 8, lifetimeSteps: 120_000 }, new Set());
    expect(first.map((a) => a.id)).toEqual([achievementId('streak', 7), achievementId('lifetime', 100_000)]);
    const again = newAchievements({ bestStreak: 8, lifetimeSteps: 120_000 }, new Set(first.map((a) => a.id)));
    expect(again).toEqual([]);
  });
});
