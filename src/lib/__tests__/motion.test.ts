import { describe, expect, it } from '@jest/globals';

import {
  classify,
  liveLabel,
  type MotionLabel,
  type MotionWindow,
  nextLabel,
  stepDataUsable,
  stepSeconds,
  stepsIn,
  stepTimeline,
  windowAt,
} from '@/lib/motion';

import { arRows, chain, gpsFor, standing, stepRows, straight, T0 } from './walk-fixtures';

const w = (over: Partial<MotionWindow>): MotionWindow => ({
  t: T0,
  seconds: 30,
  speed: null,
  netM: null,
  cadence: null,
  ar: null,
  arVehicleS: 0,
  fastS: 0,
  max10: null,
  indoor: false,
  ...over,
});

describe('step timeline', () => {
  it('spreads regular rows over their 5 s and late batches over the seconds just before them', () => {
    const tl = stepTimeline([
      { t: T0, steps: 0 },
      { t: T0 + 5000, steps: 10 },
      { t: T0 + 10_000, steps: 20 },
      // 60 s of nothing, then a batch of 40: taken in the last 20 s, not over the whole minute.
      { t: T0 + 70_000, steps: 60 },
    ])!;
    expect(tl.total).toBe(60);
    expect(stepsIn(tl, T0, T0 + 10_000)).toBeCloseTo(20);
    expect(stepsIn(tl, T0 + 10_000, T0 + 50_000)).toBeCloseTo(0);
    expect(stepsIn(tl, T0 + 50_000, T0 + 70_000)).toBeCloseTo(40);
    expect(stepSeconds(tl, T0, T0 + 70_000)).toBeCloseTo(30);
  });

  it('has no timeline without rows', () => {
    expect(stepTimeline([])).toBeNull();
    expect(stepTimeline(null)).toBeNull();
  });
});

describe('labels for a walk', () => {
  const walk = (over: Partial<MotionWindow>) => classify(w(over), 'walk');

  it('follows every row of the table', () => {
    // In a vehicle?
    expect(walk({ speed: 0.8, cadence: 10, netM: 45 })).toBe('vehicle');
    expect(walk({ speed: 2.6, cadence: 110, netM: 80 })).toBe('vehicle');
    expect(walk({ speed: 2.1, cadence: 50, netM: 60 })).toBe('vehicle'); // 2.5 m steps
    expect(walk({ speed: 1.2, cadence: 100, ar: { type: 'vehicle', conf: 80 } })).toBe('vehicle');
    // Cycling?
    expect(walk({ speed: 5, cadence: 70, netM: 150, ar: { type: 'bicycle', conf: 65 } })).toBe('cycling');
    // Running, brisk walk, walking, standing still.
    expect(walk({ speed: 2.8, cadence: 160, netM: 80 })).toBe('running');
    expect(walk({ speed: 2.1, cadence: 125, netM: 60 })).toBe('running');
    expect(walk({ speed: 1.5, cadence: 110, netM: 45 })).toBe('brisk');
    expect(walk({ speed: 1.1, cadence: 80, netM: 33 })).toBe('walking');
    expect(walk({ speed: 0.1, cadence: 5, netM: 2 })).toBe('still');
  });

  it('uses speed alone without cadence: a vehicle only from 15 km/h', () => {
    expect(walk({ speed: 1.3 })).toBe('brisk');
    expect(walk({ speed: 0.7 })).toBe('walking');
    expect(walk({ speed: 2.2 })).toBe('running');
    expect(walk({ speed: 3.3 })).toBe('running');
    expect(walk({ speed: 4.3 })).toBe('vehicle');
    expect(walk({ speed: 0.1 })).toBe('still');
  });

  it('flags pedalling with the phone in a pocket, not "Running"', () => {
    // 18 km/h at 140 steps a minute: 2.14 m steps.
    expect(walk({ speed: 5, cadence: 140, netM: 150 })).toBe('vehicle');
    // 18 km/h at 70 steps a minute.
    expect(walk({ speed: 5, cadence: 70, netM: 150 })).toBe('vehicle');
    // Jogging at 10 km/h and 160 steps a minute is running.
    expect(walk({ speed: 2.78, cadence: 160, netM: 83 })).toBe('running');
    // 6 m/s held for the whole window is never on foot.
    expect(walk({ speed: 6.1, cadence: 190, netM: 180 })).toBe('vehicle');
  });

  it('indoors uses cadence and Activity Recognition only', () => {
    expect(walk({ indoor: true, cadence: 105 })).toBe('brisk');
    expect(walk({ indoor: true, cadence: null, ar: { type: 'walking', conf: 70 } })).toBe('walking');
    expect(walk({ indoor: true, cadence: 0, ar: { type: 'vehicle', conf: 80 } })).toBe('vehicle');
  });

  it('keeps the previous label in the gaps of the table', () => {
    // 25 steps a minute at 0.4 m/s is in no row.
    expect(classify(w({ speed: 0.4, cadence: 25 }), 'walk', 'brisk')).toBe('brisk');
    expect(classify(w({ speed: 0.4, cadence: 25 }), 'walk', 'vehicle')).toBe('vehicle');
    expect(classify(w({ speed: 0.4, cadence: 25 }), 'walk', null)).toBe('walking');
    // Every combination gives a label.
    const labels = new Set<MotionLabel>();
    for (const speed of [null, 0, 0.2, 0.4, 0.6, 1, 1.5, 2, 2.5, 3, 4, 5, 7]) {
      for (const cadence of [null, 0, 10, 25, 35, 50, 80, 105, 125, 145, 170]) {
        labels.add(classify(w({ speed, cadence, netM: (speed ?? 0) * 30 }), 'walk', 'walking'));
      }
    }
    expect(labels.size).toBeGreaterThan(4);
  });
});

describe('labels for a ride', () => {
  const ride = (kmh: number, over: Partial<MotionWindow> = {}) =>
    classify(w({ speed: kmh / 3.6, max10: kmh / 3.6, fastS: kmh / 3.6 >= 12.5 ? 120 : 0, ...over }), 'ride');

  it('never calls city riding a vehicle; 50 km/h held is one', () => {
    expect(ride(10)).toBe('riding');
    expect(ride(20)).toBe('riding');
    expect(ride(30)).toBe('riding');
    expect(ride(50)).toBe('vehicle');
    expect(ride(1)).toBe('stopped');
  });

  it('needs 35 km/h with Activity Recognition saying vehicle (it often calls cycling a vehicle)', () => {
    expect(ride(20, { arVehicleS: 300, ar: { type: 'vehicle', conf: 90 } })).toBe('riding');
    expect(ride(40, { fastS: 0, max10: 40 / 3.6, arVehicleS: 150 })).toBe('vehicle');
  });
});

describe('label changes', () => {
  it('changes only after two checks in a row agree', () => {
    let s = nextLabel({ label: null, pending: null }, 'walking');
    expect(s.label).toBe('walking');
    s = nextLabel(s, 'running');
    expect(s.label).toBe('walking');
    s = nextLabel(s, 'walking');
    expect(s.label).toBe('walking');
    s = nextLabel(s, 'running');
    s = nextLabel(s, 'running');
    expect(s.label).toBe('running');
  });

  it('one odd window in a recorded walk does not flip the live label', () => {
    // Brisk walking for 3 minutes with one 15 s stretch at a fast jog.
    const path = chain(straight(90, 1.4), straight(15, 3.2, 0, 0), straight(90, 1.4));
    const points = gpsFor(path, { seed: 3, white: 2, doppler: true });
    const steps = stepTimeline(stepRows(195, (s) => (s >= 90 && s < 105 ? 165 : 110)));
    const label = liveLabel({ points, steps, activities: [] }, 'walk', T0, T0 + 120_000);
    expect(label).toBe('brisk');
  });

  it('follows a lasting change from walking to running', () => {
    const path = chain(straight(90, 1.4), straight(90, 3));
    const points = gpsFor(path, { seed: 4, white: 2, doppler: true });
    const steps = stepTimeline(stepRows(180, (s) => (s < 90 ? 105 : 165)));
    expect(liveLabel({ points, steps, activities: [] }, 'walk', T0, T0 + 175_000)).toBe('running');
  });

  it('shows "In a vehicle?" once steps stop and the speed stays, even while the newest steps lag', () => {
    const path = chain(straight(60, 1.4), straight(120, 4));
    const points = gpsFor(path, { seed: 5, white: 2, doppler: true });
    const rows = stepRows(60, () => 110);
    const label = liveLabel({ points, steps: stepTimeline(rows), activities: [] }, 'walk', T0, T0 + 175_000);
    expect(label).toBe('vehicle');
  });
});

describe('windows', () => {
  it('reads cadence as unknown before the first step event', () => {
    const points = gpsFor(standing(120), { seed: 1 });
    const steps = stepTimeline(stepRows(120, () => 100, T0 + 60_000));
    expect(windowAt({ points, steps, activities: [] }, T0 + 30_000).cadence).toBeNull();
    expect(windowAt({ points, steps, activities: [] }, T0 + 120_000).cadence).toBeCloseTo(100, -1);
  });

  it('takes the latest Activity Recognition result within a minute', () => {
    const acts = [...arRows(0, 60, 'walking', 70), ...arRows(70, 120, 'vehicle', 85)];
    const win = windowAt({ points: [], steps: null, activities: acts }, T0 + 120_000);
    expect(win.ar).toEqual({ type: 'vehicle', conf: 85 });
    expect(win.arVehicleS).toBeGreaterThanOrEqual(50);
  });
});

describe('step data', () => {
  const stride = 0.7;

  it('falls back to the speed rules when the counter sends almost nothing', () => {
    const points = gpsFor(straight(600, 1.4), { seed: 2, doppler: true });
    // A sensor that sent its first event and then nothing.
    const silent = stepTimeline([
      { t: T0, steps: 0 },
      { t: T0 + 300_000, steps: 12 },
    ]);
    expect(stepDataUsable(silent, points, stride)).toBe(false);
    expect(stepDataUsable(stepTimeline(stepRows(600, () => 115)), points, stride)).toBe(true);
    expect(stepDataUsable(null, points, stride)).toBe(false);
  });

  it('a stroller walk with no steps is not a vehicle', () => {
    // Pushing a stroller at 4 km/h with the phone on the handle: 0 steps a minute.
    const points = gpsFor(straight(300, 1.1), { seed: 6, doppler: true });
    const silent = stepTimeline([{ t: T0, steps: 0 }]);
    const usable = stepDataUsable(silent, points, stride) ? silent : null;
    expect(usable).toBeNull();
    const win = windowAt({ points, steps: usable, activities: [] }, T0 + 200_000);
    expect(classify(win, 'walk')).toBe('walking');
  });
});
