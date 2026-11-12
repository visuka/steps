/**
 * The step counts as a real phone produces them: a steady walk with syncs
 * while the app is open, a source that lags, the app coming back from the
 * background, midnight, steps whose time isn't known, and long records from
 * other apps. These are the situations that showed wrong numbers on the
 * first test phone.
 */
import { describe, expect, it, jest } from '@jest/globals';

import { openRepository } from '@/data/db.web';
import { DEFAULT_PROFILE } from '@/data/profile';
import { healthConnectWindow, isCoarseRecord, splitCoarse } from '@/health/coarse-records';
import { type PhoneCounter, phoneMinutes, phoneUntimed } from '@/health/phone-steps';
import type { StepSource } from '@/health/types';
import { addSample, type LiveSample, liveStepsSince, type Shown, stepsToShow } from '@/lib/live-steps';
import { type StepBucket, summarizeBuckets } from '@/lib/metrics';
import { DEFAULT_HOUR_WEIGHTS, untimedForDay, untimedShare } from '@/lib/untimed';
import { stepsInWindow } from '@/lib/walk';
import { syncRecent } from '@/sync/engine';
import { runSync } from '@/sync/run';

// The sync's side effects need the phone; here they do nothing.
jest.mock('@/notifications/notify', () => ({ notifyNow: async () => undefined }));

const MIN = 60_000;
const HOUR = 60 * MIN;
const day = new Date(2026, 10, 12).getTime(); // Thu 12 Nov 2026, local midnight
const at = (h: number, m = 0, s = 0) => day + h * HOUR + m * MIN + s * 1000;

/** Minute buckets of everything a source has recorded up to `until`. */
function bucketsUntil(steps: number[], until: number): StepBucket[] {
  const byMinute = new Map<number, number>();
  for (const t of steps) {
    if (t >= until) continue;
    const m = Math.floor(t / MIN) * MIN;
    byMinute.set(m, (byMinute.get(m) ?? 0) + 1);
  }
  return [...byMinute].sort((a, b) => a[0] - b[0]).map(([start, n]) => ({ start, end: start + MIN, steps: n }));
}

describe('the live count on Today', () => {
  /**
   * Walks at `spm` with the app open. Every step is a live event; the source
   * has every step up to `lagMs` ago; a sync runs every `syncEveryS`.
   * Returns every number shown, and the true count at each moment.
   */
  function walk(opts: { spm: number; minutes: number; syncEveryS: number; lagMs: number; before: number }) {
    const stepTimes: number[] = [];
    for (let i = 0; i < opts.before; i++) stepTimes.push(at(8) + i * 500);
    const start = at(9, 0, 7);
    let samples: LiveSample[] = [];
    let synced = opts.before;
    let coveredUntil = at(8, 30);
    let previous: Shown | null = null;
    let lastSync = start;
    const shown: { t: number; steps: number; truth: number }[] = [];
    let count = 0;
    const n = opts.spm * opts.minutes;
    for (let i = 0; i < n; i++) {
      const t = start + (i * MIN) / opts.spm;
      stepTimes.push(t);
      if (t - lastSync >= opts.syncEveryS * 1000) {
        lastSync = t;
        const buckets = bucketsUntil(stepTimes, t - opts.lagMs);
        const m = summarizeBuckets(buckets, { weightKg: 70, strideM: 0.7 });
        synced = m.steps;
        coveredUntil = Math.min(m.lastStepAt ?? day, t);
      }
      count += 1;
      samples = addSample(samples, { at: t, count });
      previous = stepsToShow({ date: '2026-11-12', synced, coveredUntil, samples, previous });
      shown.push({ t, steps: previous.steps, truth: stepTimes.length });
    }
    return shown;
  }

  it('climbs one step at a time through syncs, without the drops and jumps of the old count', () => {
    for (const spm of [80, 100, 120]) {
      const shown = walk({ spm, minutes: 6, syncEveryS: 33, lagMs: 0, before: 1500 });
      for (let i = 1; i < shown.length; i++) {
        const step = shown[i].steps - shown[i - 1].steps;
        expect(step).toBeGreaterThanOrEqual(0);
        expect(step).toBeLessThanOrEqual(3);
      }
    }
  });

  it('never shows more steps than were walked', () => {
    for (const lagMs of [0, 30_000, 5 * MIN, 25 * MIN]) {
      const shown = walk({ spm: 110, minutes: 30, syncEveryS: 60, lagMs, before: 1200 });
      for (const s of shown) expect(s.steps).toBeLessThanOrEqual(s.truth);
    }
  });

  it('stays close to the truth when the source keeps up', () => {
    const shown = walk({ spm: 100, minutes: 10, syncEveryS: 60, lagMs: 0, before: 1500 });
    for (const s of shown) expect(s.truth - s.steps).toBeLessThanOrEqual(3);
  });

  it("doesn't count steps from the background twice when the app comes back", () => {
    // The source already has the 2,400 background steps; the new subscription starts from zero.
    const samples: LiveSample[] = [{ at: at(18, 0, 5), count: 0 }, { at: at(18, 0, 6), count: 1 }];
    const shown = stepsToShow({ date: '2026-11-12', synced: 6100, coveredUntil: at(18), samples, previous: null });
    expect(shown.steps).toBe(6101);
  });

  it('starts again from the new day at midnight', () => {
    const previous: Shown = { date: '2026-11-11', steps: 9350 };
    const shown = stepsToShow({ date: '2026-11-12', synced: 0, coveredUntil: day, samples: [], previous });
    expect(shown).toEqual({ date: '2026-11-12', steps: 0 });
  });

  it('counts live steps only after the last step the source has', () => {
    const samples = [
      { at: at(10, 0, 0), count: 0 },
      { at: at(10, 0, 50), count: 80 },
      { at: at(10, 1, 30), count: 140 },
    ];
    // The source has steps up to 10:01:00: only what came after it is added.
    expect(liveStepsSince(samples, at(10, 1))).toBe(0);
    expect(liveStepsSince(samples, at(10, 0, 30))).toBe(60);
  });
});

describe('steps with no known time', () => {
  it('count for the day the stretch began, so a morning never shows the night before', () => {
    const span = [{ from: at(-1), to: at(8), steps: 900 }]; // 11 pm to 8 am
    expect(untimedForDay(span, at(-24), day)).toBe(900);
    expect(untimedForDay(span, day, at(24))).toBe(0);
  });

  it('are in the total, but in no hour, no pace minute, and at a slow pace for calories', () => {
    const m = summarizeBuckets([], { weightKg: 70, strideM: 0.7 }, 800);
    expect(m.steps).toBe(800);
    expect(m.untimedSteps).toBe(800);
    expect(m.hourly.every((h) => h === 0)).toBe(true);
    expect(m.activeMin).toBe(0);
    expect(m.walkMin + m.briskMin + m.runMin).toBe(0);
    // Under 30 kcal for 800 steps at 70 kg.
    expect(m.activeKcal).toBeLessThan(30);
  });

  it('share a long record by time of day, with the night hours barely counting', () => {
    const span = [{ from: at(-1), to: at(8), steps: 900 }];
    expect(untimedShare(span, day, at(6), DEFAULT_HOUR_WEIGHTS)).toBeLessThan(900 * 0.15);
    expect(untimedShare(span, at(-24), day) + untimedShare(span, day, at(24))).toBeCloseTo(900);
  });
});

describe('minutes by pace', () => {
  it('tells walking, brisk walking and running apart', () => {
    const minute = (h: number, m: number, steps: number) => ({ start: at(h, m), end: at(h, m + 1), steps });
    const m = summarizeBuckets(
      [minute(7, 0, 20), minute(7, 1, 75), minute(7, 2, 110), minute(7, 3, 125), minute(7, 4, 160)],
      { weightKg: 70, strideM: 0.7 },
    );
    expect([m.walkMin, m.briskMin, m.runMin, m.activeMin]).toEqual([1, 2, 1, 3]);
  });
});

describe("the phone's two counters", () => {
  const since = at(10, 0, 20);
  const fake = (over: Partial<PhoneCounter> = {}): PhoneCounter => ({
    recorderSince: () => since,
    getBuckets: async (s, e) =>
      [at(9, 59), at(10, 0), at(10, 1), at(10, 2)].filter((m) => m >= Math.floor(s / MIN) * MIN && m < e).map((m) => ({ start: m, steps: 50 })),
    getUntimed: async () => [{ from: at(2), to: at(12), steps: 1000 }],
    getRecorderBuckets: async (s, e) =>
      [at(10, 1), at(10, 2)].filter((m) => m >= s && m < e).map((m) => ({ start: m, steps: 70 })),
    ...over,
  });

  it("reads the app's counter before Google's recorder started and the recorder after", async () => {
    const minutes = await phoneMinutes(fake(), at(9), at(11));
    expect(minutes.map((m) => [m.start, m.steps])).toEqual([
      [at(9, 59), 50],
      [at(10, 0), 50],
      [at(10, 1), 70],
      [at(10, 2), 70],
    ]);
  });

  it('falls back to the counter while Play services refuses', async () => {
    const minutes = await phoneMinutes(
      fake({ getRecorderBuckets: async () => Promise.reject(new Error('updating')) }),
      at(9),
      at(11),
    );
    expect(minutes.reduce((s, m) => s + m.steps, 0)).toBe(200);
  });

  it("keeps only the counter's untimed steps from before the recorder took over", async () => {
    // A 2 am–noon stretch of 1,000; the recorder has everything from 10:01.
    const before = await phoneUntimed(fake(), day, at(24));
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(1000);
    expect(await phoneUntimed(fake({ recorderSince: () => null }), day, at(24))).toBe(1000);
    // Not for the next day: the stretch began on this one.
    expect(await phoneUntimed(fake({ recorderSince: () => null }), at(24), at(48))).toBe(0);
  });
});

describe('long records from other apps (Health Connect)', () => {
  it("moves an overnight catch-up record out of the night's minutes", () => {
    // An app stopped by the battery saver writes 2,200 steps for 9 pm–8 am once it runs again.
    const record = { from: at(-3), to: at(8), steps: 2200 };
    expect(isCoarseRecord(record.from, record.to, record.steps)).toBe(true);
    expect(isCoarseRecord(at(9), at(9, 10), 1000)).toBe(false);

    // Health Connect spreads it at 3.3 steps a minute over today's first 8 hours, and a real walk sits at 7:30.
    const perMinute = 2200 / (11 * 60);
    const buckets: StepBucket[] = [];
    for (let t = day; t < at(8); t += MIN) {
      const walkSteps = t >= at(7, 30) && t < at(7, 40) ? 100 : 0;
      buckets.push({ start: t, end: t + MIN, steps: perMinute + walkSteps });
    }
    const { buckets: timed, untimed } = splitCoarse(buckets, [record]);
    expect(untimed).toBeCloseTo(1600, 0);
    expect(timed.reduce((s, b) => s + b.steps, 0)).toBeCloseTo(1000, 0);
    const m = summarizeBuckets(timed, { weightKg: 70, strideM: 0.7 }, untimed);
    expect(m.hourly.slice(0, 7).every((h) => h === 0)).toBe(true);
    expect(m.hourly[7]).toBe(1000);
    expect(m.steps).toBe(2600);
  });
});

describe("Health Connect's figures for a day", () => {
  const minutes = (from: number, to: number, perMinute: number) => {
    const out: StepBucket[] = [];
    for (let t = from; t < to; t += MIN) out.push({ start: t, end: t + MIN, steps: perMinute });
    return out;
  };
  // Fit records a walk at 7:30 in detail; another app writes 2,200 steps for 9 pm–8 am once it runs again.
  const catchUp = { from: at(-3), to: at(8), count: 2200, origin: 'com.other.app' };
  const walk = { from: at(7, 30), to: at(7, 40), count: 1000, origin: 'com.google.android.apps.fitness' };
  const perMinute = 2200 / (11 * 60);

  it("puts none of last night's catch-up record in today", () => {
    const buckets = minutes(day, at(8), perMinute).map((b) =>
      b.start >= at(7, 30) && b.start < at(7, 40) ? { ...b, steps: b.steps + 100 } : b,
    );
    const today = healthConnectWindow({ buckets, total: 1000 + perMinute * 480, records: [catchUp], start: day, end: at(11) });
    expect(Math.round(today.buckets.reduce((s, b) => s + b.steps, 0))).toBe(1000);
    expect(today.untimed).toBeCloseTo(0, 0);

    const yesterday = healthConnectWindow({
      buckets: minutes(at(-3), day, perMinute),
      total: perMinute * 180,
      records: [catchUp],
      start: at(-24),
      end: day,
    });
    expect(yesterday.untimed).toBeCloseTo(2200, 0);
  });

  it('drops a long record that only repeats a walk another app recorded in detail', () => {
    const record = { from: at(7), to: at(9), count: 1000, origin: 'com.other.app' };
    const buckets = minutes(at(7), at(9), 1000 / 120).map((b) =>
      b.start >= at(7, 30) && b.start < at(7, 40) ? { ...b, steps: 100 } : b,
    );
    const w = healthConnectWindow({ buckets, total: 1000 + (1000 / 120) * 110, records: [record, walk], start: day, end: at(11) });
    expect(Math.round(w.buckets.reduce((s, b) => s + b.steps, 0) + w.untimed)).toBeLessThan(1100);
  });

  it('keeps a catch-up written as a few impossible minutes out of the hours', () => {
    const w = healthConnectWindow({
      buckets: [{ start: at(9), end: at(9, 1), steps: 1500 }],
      total: 1500,
      records: [{ from: at(9), to: at(9, 1), count: 1500, origin: 'com.other.app' }],
      start: day,
      end: at(11),
    });
    expect(w.buckets).toEqual([]);
    expect(w.untimed).toBe(1500);
  });

  it("says how far its records reach, so live steps before that aren't added again", () => {
    const soFar = { from: day, to: at(10, 30), count: 3000, origin: 'com.other.app' };
    const w = healthConnectWindow({ buckets: minutes(day, at(10, 30), 3000 / 630), total: 3000, records: [soFar], start: day, end: at(11) });
    expect(w.lastRecordAt).toBe(at(10, 30));
  });
});

describe('a saved day', () => {
  const profile = { ...DEFAULT_PROFILE, dailyGoal: 8000, onboarded: true };
  const now = new Date(at(11));
  const source = (buckets: StepBucket[], untimed: number, id: StepSource['id'] = 'device-sensor'): StepSource => ({
    id,
    label: 'Test',
    isAvailable: async () => true,
    requestPermissions: async () => true,
    getStepBuckets: async (start, end) => buckets.filter((b) => b.start >= start.getTime() && b.start < end.getTime()),
    getUntimedSteps: async (start) => (start.getTime() === day ? untimed : 0),
    getDistanceM: async () => null,
    getFloors: async () => null,
    getDailyTotals: async () => [],
  });

  it('includes untimed steps in the total but not in the hours', async () => {
    const repo = await openRepository();
    const walk = Array.from({ length: 10 }, (_, i) => ({ start: at(9, i), end: at(9, i + 1), steps: 110 }));
    const { today, coveredUntil } = await syncRecent(repo, source(walk, 1100), profile, now);
    expect(today.steps).toBe(2200);
    expect(today.untimedSteps).toBe(1100);
    expect(today.briskMin).toBe(10);
    expect(coveredUntil).toBe(at(9, 10));
    const hourly = await repo.getHourly('2026-11-12');
    expect(hourly.reduce((a, b) => a + b, 0)).toBe(1100);
  });

  it("doesn't wipe a day another source counted when the new one has nothing for it", async () => {
    const repo = await openRepository();
    await syncRecent(repo, source([{ start: at(-20), end: at(-20) + MIN, steps: 5000 }], 0, 'health-connect'), profile, now);
    await syncRecent(repo, source([], 0), profile, now);
    expect((await repo.getDay('2026-11-11'))?.steps).toBe(5000);
  });

  it('gives a caller just after midnight its own sync, not the one still running from before', async () => {
    const repo = await openRepository();
    const walk = [{ start: at(9), end: at(9, 1), steps: 100 }];
    const late = runSync(repo, profile, source(walk, 0), new Date(at(-1, 59, 58)));
    const early = runSync(repo, profile, source(walk, 0), new Date(at(0, 0, 2)));
    expect((await late).today.date).toBe('2026-11-11');
    expect((await early).today.date).toBe('2026-11-12');
  });
});

describe('a recorded walk', () => {
  it('takes only the part of the edge minutes the walk covers', () => {
    const buckets = [
      { start: at(8, 55), end: at(8, 56), steps: 60 },
      { start: at(8, 56), end: at(8, 57), steps: 100 },
      { start: at(9, 20), end: at(9, 21), steps: 120 },
    ];
    // 08:55:40 to 09:20:15: 20 s of the first minute and 15 s of the last.
    expect(stepsInWindow(buckets, at(8, 55, 40), at(9, 20, 15))).toBe(20 + 100 + 30);
  });
});
