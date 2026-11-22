import { describe, expect, it } from '@jest/globals';

import type { ActivityTransition, MinuteBucket, MinuteFeature } from '../../../modules/step-counter';
import { stepsToShow } from '@/lib/live-steps';

import { buildMinuteRows } from '../minute-detail';
import { type PhoneCounter, phoneWindow } from '../phone-steps';
import { activityAt, filterRiding, judgeMinute } from '../step-filter';

const MINUTE = 60_000;
const T0 = Date.UTC(2026, 10, 22, 8, 0);
const at = (min: number) => T0 + min * MINUTE;

const walkingBurst = (start: number): MinuteFeature => ({ start, burstMs: 10_000, rhythm: 0.93, push: 0.2, brake: 0.2, speedGained: 0.6, buzz: 0.05 });
const motorbikeBurst = (start: number): MinuteFeature => ({ start, burstMs: 10_000, rhythm: 0.3, push: 1.8, brake: 3.5, speedGained: 6.5, buzz: 0.6 });
const carBurst = (start: number): MinuteFeature => ({ start, burstMs: 10_000, rhythm: 0.2, push: 1.2, brake: 4.0, speedGained: 2.0, buzz: 0.2 });
const pottering = (start: number): MinuteFeature => ({ start, burstMs: 10_000, rhythm: 0.25, push: 0.4, brake: 0.5, speedGained: 0.8, buzz: 0.1 });

const enter = (t: number, activity: string): ActivityTransition => ({ t, activity, enter: true });
const exit = (t: number, activity: string): ActivityTransition => ({ t, activity, enter: false });

describe('one minute', () => {
  it('keeps steady walking, even when Android still says vehicle', () => {
    expect(judgeMinute(105, walkingBurst(0), null)).toBeNull();
    expect(judgeMinute(105, walkingBurst(0), 'vehicle')).toBeNull();
  });

  it('keeps slow, irregular steps at home: no riding signal', () => {
    expect(judgeMinute(20, pottering(0), null)).toBeNull();
    expect(judgeMinute(20, pottering(0), 'still')).toBeNull();
    expect(judgeMinute(20, null, null)).toBeNull();
  });

  it('never removes on one signal', () => {
    expect(judgeMinute(80, null, 'vehicle')).toBeNull();
    expect(judgeMinute(80, { ...walkingBurst(0), brake: 3 }, null)).toBeNull();
    expect(judgeMinute(80, { ...walkingBurst(0), buzz: 0.9 }, null)).toBeNull();
  });

  it('removes a motorbike or car minute', () => {
    expect(judgeMinute(40, motorbikeBurst(0), null)).toBe('vehicle');
    expect(judgeMinute(40, carBurst(0), 'vehicle')).toBe('vehicle');
  });

  it('removes bumps Android calls a vehicle when the steps are few', () => {
    expect(judgeMinute(25, null, 'vehicle')).toBe('vehicle');
  });

  it('calls it a bicycle only when Android says so and there is no engine buzz', () => {
    expect(judgeMinute(30, { ...walkingBurst(0), brake: 2.8 }, 'bicycle')).toBe('bicycle');
    expect(judgeMinute(30, motorbikeBurst(0), 'bicycle')).toBe('vehicle');
  });

  it('removes more than anyone walks in a minute', () => {
    expect(judgeMinute(260, null, null)).toBe('vehicle');
  });
});

describe('Android activity at a time', () => {
  it('is the last activity entered and not left', () => {
    const tr = [enter(at(0), 'vehicle'), exit(at(10), 'vehicle'), enter(at(10), 'walking')];
    expect(activityAt(tr, at(5))).toBe('vehicle');
    expect(activityAt(tr, at(11))).toBe('walking');
    expect(activityAt(tr, at(-1))).toBeNull();
  });
});

describe('a morning: walk, ride a motorbike, walk', () => {
  // 08:00–08:04 walking, 08:05–08:24 on a motorbike (Android: vehicle), 08:25–08:29 walking.
  const minutes: MinuteBucket[] = [];
  const features: MinuteFeature[] = [];
  for (let i = 0; i < 30; i++) {
    const riding = i >= 5 && i < 25;
    minutes.push({ start: at(i), steps: riding ? 35 : 110 });
    // A burst about every minute, missing on some riding minutes.
    if (riding && i % 4 === 3) continue;
    features.push(riding ? motorbikeBurst(at(i)) : walkingBurst(at(i)));
  }
  const transitions = [enter(at(5), 'vehicle'), exit(at(26), 'vehicle'), enter(at(26), 'walking')];

  it('takes out only the ride', () => {
    const { kept, removed } = filterRiding(minutes, features, transitions);
    expect(removed.map((m) => m.start)).toEqual(minutes.slice(5, 25).map((m) => m.start));
    expect(kept.reduce((s, m) => s + m.steps, 0)).toBe(10 * 110);
    expect(removed.every((m) => m.kind === 'vehicle')).toBe(true);
  });

  it('keeps the walk after the ride while Android still says vehicle', () => {
    const { kept } = filterRiding(minutes, features, transitions);
    expect(kept.map((m) => m.start)).toContain(at(25));
  });

  it('removes nothing without bursts or Android signals', () => {
    const { removed } = filterRiding(minutes, [], []);
    expect(removed).toEqual([]);
  });
});

describe('a riding minute with no burst', () => {
  it('goes out in the middle of a ride, with many steps it stays', () => {
    const minutes = [
      { start: at(0), steps: 70 },
      { start: at(1), steps: 70 },
      { start: at(2), steps: 70 },
      { start: at(3), steps: 130 },
    ];
    const features = [carBurst(at(0)), carBurst(at(2))];
    const transitions = [{ t: at(-1), activity: 'vehicle', enter: true }];
    const { removed } = filterRiding(minutes, features, transitions);
    expect(removed.map((m) => m.start)).toEqual([at(0), at(1), at(2)]);
  });
});

describe('the phone window', () => {
  const counter = (feats: MinuteFeature[], trans: ActivityTransition[]): PhoneCounter => ({
    getBuckets: async () => [
      { start: at(0), steps: 110 },
      { start: at(1), steps: 40 },
    ],
    getUntimed: async () => [],
    recorderSince: () => null,
    getRecorderBuckets: async () => [],
    getMinuteFeatures: async () => feats,
    getActivityTransitions: async () => trans,
  });

  it('leaves riding minutes out of the day', async () => {
    const w = await phoneWindow(counter([walkingBurst(at(0)), motorbikeBurst(at(1))], []), at(0), at(2), at(3));
    expect(w.minutes).toEqual([{ start: at(0), steps: 110 }]);
    expect(w.removed).toEqual([{ start: at(1), steps: 40, kind: 'vehicle' }]);
  });

  it('removes nothing when the readings fail', async () => {
    const failing = { ...counter([], []), getMinuteFeatures: async () => Promise.reject(new Error('no')) };
    const w = await phoneWindow(failing, at(0), at(2), at(3));
    expect(w.minutes).toHaveLength(2);
    expect(w.removed).toEqual([]);
  });

  it('removes nothing on a build without the readings', async () => {
    const { getMinuteFeatures: _f, getActivityTransitions: _t, ...old } = counter([], []);
    const w = await phoneWindow(old, at(0), at(2), at(3));
    expect(w.minutes).toHaveLength(2);
  });
});

describe('the Step check minutes', () => {
  it('marks the minutes taken out', () => {
    const rows = buildMinuteRows(T0, [{ start: at(0), steps: 110 }, { start: at(1), steps: 40 }], null, [walkingBurst(at(0)), motorbikeBurst(at(1))], []);
    expect(rows.map((r) => r.removed)).toEqual([null, 'vehicle']);
  });
});

describe('getting off a bus', () => {
  it('keeps the first slow walking minute while Android still says vehicle', () => {
    expect(judgeMinute(40, walkingBurst(0), 'vehicle')).toBeNull();
  });

  it('still takes out slow bumps Android calls a vehicle when the burst is irregular', () => {
    expect(judgeMinute(40, pottering(0), 'vehicle')).toBe('vehicle');
  });
});

describe("which removed steps were the recorder's", () => {
  it("splits at the recorder's last saved minute", async () => {
    const c: PhoneCounter = {
      getBuckets: async (s, e) => [{ start: at(3), steps: 30 }].filter((m) => m.start >= s && m.start < e),
      getUntimed: async () => [],
      recorderSince: () => at(-60),
      getRecorderBuckets: async () => [{ start: at(1), steps: 30 }],
      getMinuteFeatures: async () => [motorbikeBurst(at(1)), motorbikeBurst(at(3))],
      getActivityTransitions: async () => [],
    };
    const w = await phoneWindow(c, at(0), at(5), at(5));
    expect(w.removed.map((m) => m.start)).toEqual([at(1), at(3)]);
    const recorded = w.removed.filter((m) => m.start >= w.recorderFrom && m.start < w.recorderUntil);
    expect(recorded.map((m) => m.start)).toEqual([at(1)]);
  });
});

describe("the Step check uses the day's verdict when it has it", () => {
  it('marks what the day took out, not its own hour-only guess', () => {
    const rows = buildMinuteRows(T0, [{ start: at(0), steps: 70 }], null, [], [], [{ start: at(0), steps: 70, kind: 'vehicle' }]);
    expect(rows[0].removed).toBe('vehicle');
  });
});

describe('the number on Today', () => {
  it('drops when a sync leaves out riding steps the live sensor had added', () => {
    const samples = [
      { at: at(0), count: 0 },
      { at: at(10), count: 400 },
    ];
    const shown = stepsToShow({ date: 'd', synced: 1000, coveredUntil: at(-1), samples, previous: null });
    expect(shown.steps).toBe(1400);
    // The sync took the ride out: nothing new synced, 400 taken out.
    const after = stepsToShow({ date: 'd', synced: 1000, coveredUntil: at(11), samples, previous: shown, removed: 400 });
    expect(after.steps).toBe(1000);
  });

  it('still holds a dip when nothing more was taken out', () => {
    const samples = [
      { at: at(0), count: 0 },
      { at: at(10), count: 100 },
    ];
    const shown = stepsToShow({ date: 'd', synced: 1000, coveredUntil: at(-1), samples, previous: null });
    const after = stepsToShow({ date: 'd', synced: 1040, coveredUntil: at(11), samples, previous: shown });
    expect(after.steps).toBe(1100);
  });
});
