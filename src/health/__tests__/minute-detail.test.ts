import { describe, expect, it, jest } from '@jest/globals';

import type { ActivityTransition, MinuteBucket, MinuteFeature } from '../../../modules/step-counter';
import {
  activityAt,
  activityLabel,
  buildMinuteRows,
  featuresText,
  type HourSource,
  hourStart,
  loadHourMinutes,
  stepsText,
} from '../minute-detail';

const MIN = 60_000;
const H = hourStart(8, new Date(2026, 10, 15));
const feature = (start: number, over: Partial<MinuteFeature> = {}): MinuteFeature => ({
  start,
  burstMs: 10_000,
  rhythm: 0.82,
  push: 0.36,
  brake: 1.24,
  speedGained: 5.06,
  buzz: 0.1,
  ...over,
});
const tr = (t: number, activity: string, enter: boolean): ActivityTransition => ({ t, activity, enter });

describe('activityAt', () => {
  const list = [tr(H - 5 * MIN, 'still', true), tr(H + MIN, 'still', false), tr(H + MIN, 'walking', true), tr(H + 10 * MIN, 'walking', false), tr(H + 10 * MIN, 'bicycle', true)];

  it('is the last activity entered and not left', () => {
    expect(activityAt(list, H)).toBe('still');
    expect(activityAt(list, H + 5 * MIN)).toBe('walking');
    expect(activityAt(list, H + 20 * MIN)).toBe('bicycle');
  });

  it('is nothing before Android said anything, or after an exit with no entry', () => {
    expect(activityAt([], H)).toBeNull();
    expect(activityAt([tr(H, 'still', true), tr(H + MIN, 'still', false)], H + 2 * MIN)).toBeNull();
  });

  it('puts the changes in time order first', () => {
    expect(activityAt([tr(H + 5 * MIN, 'walking', true), tr(H, 'still', true)], H + 6 * MIN)).toBe('walking');
  });

  it('names the activities', () => {
    expect(activityLabel('bicycle')).toBe('Bicycle');
    expect(activityLabel(null)).toBe('No signal');
  });
});

describe('buildMinuteRows', () => {
  const counted: MinuteBucket[] = [{ start: H, steps: 100 }, { start: H + MIN, steps: 90 }, { start: H + 70 * MIN, steps: 50 }];
  const recorded: MinuteBucket[] = [{ start: H, steps: 104 }, { start: H + 3 * MIN, steps: 20 }];

  it('lists each minute with steps or a reading, in time order, inside the hour only', () => {
    const rows = buildMinuteRows(H, counted, recorded, [feature(H + MIN), feature(H + 5 * MIN)], []);
    expect(rows.map((r) => (r.start - H) / MIN)).toEqual([0, 1, 3, 5]);
    expect(rows[0]).toMatchObject({ recorder: 104, counter: 100, features: null });
    expect(rows[1]).toMatchObject({ recorder: 0, counter: 90 });
    expect(rows[1].features?.rhythm).toBe(0.82);
    expect(rows[2]).toMatchObject({ recorder: 20, counter: 0 });
    expect(rows[3]).toMatchObject({ recorder: 0, counter: 0 });
  });

  it('has no recorder figure when the phone has no recorder', () => {
    const rows = buildMinuteRows(H, counted, null, [], []);
    expect(rows.map((r) => r.recorder)).toEqual([null, null]);
    expect(stepsText(rows[0])).toBe('100');
    expect(stepsText({ recorder: 104, counter: 100 })).toBe('104 / 100');
  });

  it("gives each minute the activity at its middle", () => {
    const rows = buildMinuteRows(H, counted, null, [], [tr(H - MIN, 'walking', true), tr(H + MIN + 10_000, 'bicycle', true)]);
    expect(rows.map((r) => r.activity)).toEqual(['walking', 'bicycle']);
  });
});

describe('words', () => {
  it('writes a minute\'s figures on one line', () => {
    expect(featuresText(feature(H))).toBe('Rhythm 0.82 · Push 0.4 · Braking 1.2 · Speed gained 5.1 m/s · Buzz 0.10');
    expect(featuresText(null)).toBe('No movement reading');
  });
});

describe('loadHourMinutes', () => {
  const source = (over: Partial<HourSource> = {}): HourSource => ({
    recorderStatus: () => 'ready',
    getBuckets: async () => [{ start: H, steps: 100 }],
    getRecorderBuckets: async () => [{ start: H, steps: 104 }],
    getMinuteFeatures: async () => [feature(H)],
    getActivityTransitions: async () => [tr(H - MIN, 'walking', true)],
    ...over,
  });

  it('reads the hour from every source and puts it together', async () => {
    const asked: [string, number, number][] = [];
    const rows = await loadHourMinutes(
      source({
        getMinuteFeatures: async (a, b) => {
          asked.push(['features', a, b]);
          return [feature(H)];
        },
        getActivityTransitions: async (a, b) => {
          asked.push(['transitions', a, b]);
          return [tr(H - MIN, 'walking', true)];
        },
      }),
      H,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ recorder: 104, counter: 100, activity: 'walking' });
    expect(asked[0]).toEqual(['features', H, H + 60 * MIN]);
    // Android's last change can be hours old.
    expect(asked[1][1]).toBeLessThan(H - 5 * 60 * MIN);
  });

  it('skips the recorder when the phone has none', async () => {
    const getRecorderBuckets = jest.fn(async () => []);
    const rows = await loadHourMinutes(source({ recorderStatus: () => 'unavailable', getRecorderBuckets }), H);
    expect(getRecorderBuckets).not.toHaveBeenCalled();
    expect(rows[0].recorder).toBeNull();
  });

  it('shows the steps even when an older build cannot give the new figures', async () => {
    const rows = await loadHourMinutes(
      source({
        getMinuteFeatures: async () => {
          throw new Error('not a function');
        },
        getActivityTransitions: async () => {
          throw new Error('not a function');
        },
      }),
      H,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ counter: 100, features: null, activity: null });
  });
});
