import { describe, expect, it, jest } from '@jest/globals';

import { openRepository } from '@/data/db.web';
import { DEFAULT_PROFILE } from '@/data/profile';
import type { Walk, WalkPart } from '@/data/types';
import type { StepSource } from '@/health/types';
import { estimateKcalFromSteps } from '@/lib/metrics';
import { indoorRideKcal, rideActiveKcal, type WalkPoint } from '@/lib/walk';
import {
  applyChoice,
  buildWalk,
  type BuildInput,
  interruptedEnd,
  isCounted,
  liveWalk,
  mainStretches,
  recount,
  refreshSteps,
} from '@/lib/walk-totals';
import { refreshWalkSteps } from '@/walks/save';

import { chain, gpsFor, pathLength, pressureRows, standing, stepRows, straight, T0, toLatLon } from './walk-fixtures';

// The phone's geocoder and location permission aren't here.
jest.mock('@/location/place', () => ({ placeName: async () => null }));

const kmh = (v: number) => v / 3.6;
const base = (over: Partial<BuildInput>): BuildInput => ({
  startedAt: T0,
  endedAt: T0,
  activity: 'walk',
  initialIndoor: false,
  points: [],
  steps: null,
  pressure: null,
  activities: [],
  modes: [],
  weightKg: 70,
  strideM: 0.7,
  ...over,
});

const walkCarWalk = () => {
  const path = chain(straight(180, 1.4), straight(180, kmh(12)), straight(180, 1.4));
  return base({
    endedAt: T0 + 540_000,
    points: gpsFor(path, { seed: 2, white: 3, accBase: 6, doppler: true }),
    steps: stepRows(540, (s) => (s >= 180 && s < 360 ? 3 : 110)),
  });
};

describe('building a walk', () => {
  it('a plain outdoor walk: route distance, the walk’s own steps, kcal by pace', () => {
    const path = straight(600, 1.4);
    const built = buildWalk(
      base({ endedAt: T0 + 600_000, points: gpsFor(path, { seed: 1, white: 3 }), steps: stepRows(600, () => 112) }),
    );
    expect(Math.abs(built.walk.distanceM - pathLength(path)) / pathLength(path)).toBeLessThan(0.05);
    expect(built.walk).toMatchObject({ activity: 'walk', indoor: false, distanceFrom: 'route', stepsFrom: 'walk' });
    expect(built.walk.steps).toBeCloseTo(1120, -1);
    // 10 minutes at 5 km/h is about 3.6 METs: (3.6 - 1) x 70 kg x 1/6 h.
    expect(built.walk.activeKcal).toBeGreaterThan(25);
    expect(built.walk.activeKcal).toBeLessThan(40);
    expect(built.walk.floorsUp).toBeNull();
    expect(built.parts).toHaveLength(0);
    expect(built.points.every((p) => p.part === null)).toBe(true);
  });

  it('leaves a car part out, and the main distance never jumps across it', () => {
    const built = buildWalk(walkCarWalk());
    expect(built.parts).toHaveLength(1);
    const [part] = built.parts;
    expect(part.defaultKeep).toBe(false);
    expect(part.distanceM).toBeGreaterThan(450);
    // Only the two walking stretches: 2 x 180 s at 1.4 m/s, about 500 m.
    expect(built.walk.distanceM).toBeGreaterThan(420);
    expect(built.walk.distanceM).toBeLessThan(560);
    // Walking kcal for the part come from its few steps, not 12 km/h "running".
    expect(part.kcalWalk).toBeLessThan(5);
    expect(built.points.some((p) => p.part === 0)).toBe(true);
  });

  it('an indoor walk: steps x stride, no route, indoor fixes ignored', () => {
    // A Wi-Fi fix a minute, wandering 30 m around the house.
    const fixes: WalkPoint[] = Array.from({ length: 10 }, (_, i) => ({
      t: T0 + i * 60_000,
      ...toLatLon((i % 2) * 25, (i % 3) * 15),
      acc: 18,
    }));
    const built = buildWalk(
      base({ endedAt: T0 + 600_000, initialIndoor: true, points: fixes, steps: stepRows(600, () => 90), modes: [{ t: T0, indoor: true }] }),
    );
    expect(built.walk.distanceFrom).toBe('steps');
    expect(built.walk.distanceM).toBeCloseTo(900 * 0.7, -1);
    expect(built.points).toHaveLength(0);
    expect(built.walk.stretches?.indoor).toEqual([[T0, T0 + 600_000]]);
    expect(built.walk.activeKcal).toBe(estimateKcalFromSteps(900, 70));
  });

  it('indoors, then outside: mixed distance, the route only from leaving', () => {
    const path = chain(standing(180), straight(300, 1.4));
    const points = gpsFor(path, { seed: 3, white: 3 });
    const built = buildWalk(
      base({
        endedAt: T0 + 480_000,
        initialIndoor: true,
        points,
        steps: stepRows(480, () => 100),
        modes: [
          { t: T0, indoor: true },
          { t: T0 + 180_000, indoor: false },
        ],
      }),
    );
    expect(built.walk.distanceFrom).toBe('mixed');
    expect(built.points.every((p) => p.t >= T0 + 180_000)).toBe(true);
    // 3 minutes indoors at 100 steps a minute (210 m) plus 420 m outside.
    expect(built.walk.distanceM).toBeGreaterThan(560);
    expect(built.walk.distanceM).toBeLessThan(700);
  });

  it('a walk with no step data takes its steps from the day’s buckets', () => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({ start: T0 + i * 60_000, end: T0 + (i + 1) * 60_000, steps: 100 }));
    const built = buildWalk(base({ endedAt: T0 + 600_000, points: gpsFor(straight(600, 1.3), { seed: 4 }), buckets }));
    expect(built.walk.stepsFrom).toBe('day');
    expect(built.walk.steps).toBe(1000);
  });

  it('counts stairs with a barometer, and leaves them null without one', () => {
    const move = (s: number) => (s < 100 ? 0 : Math.min(6, (s - 100) * 0.2));
    const built = buildWalk(
      base({
        endedAt: T0 + 300_000,
        initialIndoor: true,
        modes: [{ t: T0, indoor: true }],
        steps: stepRows(300, () => 95),
        pressure: pressureRows(300, move, { noiseHpa: 0.02 }),
      }),
    );
    expect(built.walk).toMatchObject({ floorsUp: 2, floorsDown: 0, liftUp: 0, liftDown: 0 });
  });
});

describe('rides', () => {
  it('ride kcal from the average moving speed; steps none', () => {
    const path = straight(1200, kmh(20));
    const built = buildWalk(base({ activity: 'ride', endedAt: T0 + 1_200_000, points: gpsFor(path, { seed: 5, doppler: true }) }));
    expect(built.walk).toMatchObject({ activity: 'ride', stepsFrom: 'none', steps: null, distanceFrom: 'route' });
    expect(built.walk.activeKcal).toBe(rideActiveKcal(built.walk.distanceM, built.walk.movingS, 70));
    // 20 km/h is about 7.6 METs: (7.6 - 1) x 70 kg x 1/3 h.
    expect(built.walk.activeKcal).toBeGreaterThan(140);
    expect(built.walk.activeKcal).toBeLessThan(170);
    expect(built.walk.topSpeedMs).toBeGreaterThan(kmh(18));
  });

  it('a 20 s descent at 60 km/h stays counted', () => {
    const path = chain(straight(300, kmh(20)), straight(20, kmh(60)), straight(300, kmh(20)));
    const built = buildWalk(base({ activity: 'ride', endedAt: T0 + 620_000, points: gpsFor(path, { seed: 6, doppler: true }) }));
    expect(built.parts.every(isCounted)).toBe(true);
    expect(Math.abs(built.walk.distanceM - pathLength(path)) / pathLength(path)).toBeLessThan(0.05);
  });

  it('an indoor ride: time and kcal only, (MET - 1) like every other figure', () => {
    const built = buildWalk(base({ activity: 'ride', initialIndoor: true, effort: 'steady', endedAt: T0 + 600_000 }));
    expect(built.walk).toMatchObject({ distanceM: 0, movingS: 600, distanceFrom: 'none', steps: null, effort: 'steady' });
    expect(built.walk.activeKcal).toBe(indoorRideKcal('steady', 600, 70));
    expect(indoorRideKcal('steady', 3600, 70)).toBe(350);
    expect(built.points).toHaveLength(0);
  });
});

describe('keep, cycle and remove', () => {
  const walk = (): Walk => ({
    id: 'w1',
    startedAt: T0,
    endedAt: T0 + 540_000,
    distanceM: 500,
    movingS: 360,
    steps: 660,
    activeKcal: 30,
    startPlace: null,
    weather: null,
    updatedAt: 1,
    activity: 'walk',
  });
  const part = (over: Partial<WalkPart> = {}): WalkPart => ({
    walkId: 'w1',
    ord: 0,
    startT: T0 + 180_000,
    endT: T0 + 360_000,
    kind: 'vehicle',
    steps: 9,
    distanceM: 600,
    movingS: 180,
    topSpeedMs: 3.4,
    kcalWalk: 1,
    kcalRide: 20,
    choice: null,
    defaultKeep: false,
    ...over,
  });

  it('keep then remove restores the walk; undo too', () => {
    const w = walk();
    const kept = applyChoice(w, [part()], 0, 'keep')!;
    expect(kept.walk).toMatchObject({ distanceM: 1100, movingS: 540, steps: 669, activeKcal: 31 });
    const removed = applyChoice(kept.walk, kept.parts, 0, 'remove')!;
    expect(removed.walk).toMatchObject({ distanceM: 500, movingS: 360, steps: 660, activeKcal: 30 });
    const cycled = applyChoice(removed.walk, removed.parts, 0, 'cycle')!;
    expect(cycled.walk).toMatchObject({ distanceM: 1100, movingS: 540, steps: 660, activeKcal: 50 });
    const undone = applyChoice(cycled.walk, cycled.parts, 0, null)!;
    expect(undone.walk).toMatchObject({ distanceM: 500, steps: 660, activeKcal: 30 });
    // Start, end and total time never move.
    expect(undone.walk.startedAt).toBe(w.startedAt);
    expect(undone.walk.endedAt).toBe(w.endedAt);
  });

  it('a part kept by default can be removed', () => {
    const w = { ...walk(), distanceM: 1100, movingS: 540, steps: 660, activeKcal: 40 };
    const stroller = part({ kind: 'unsure', defaultKeep: true, steps: 0, kcalWalk: 10 });
    expect(applyChoice(w, [stroller], 0, 'remove')!.walk).toMatchObject({ distanceM: 500, activeKcal: 30 });
  });

  it('never gives negative steps', () => {
    const w = { ...walk(), steps: 5 };
    const after = recount(w, [part({ choice: 'keep', steps: 50 })], [part({ choice: 'remove', steps: 50 })]);
    expect(after.steps).toBe(0);
    expect(recount({ ...w, steps: null }, [], [part({ choice: 'keep' })]).steps).toBeNull();
  });

  it('a ride keeps flagged parts with ride kcal', () => {
    const w = { ...walk(), activity: 'ride' as const, steps: null };
    const p = part({ defaultKeep: true });
    expect(applyChoice({ ...w, distanceM: 1100, activeKcal: 50 }, [p], 0, 'remove')!.walk).toMatchObject({ distanceM: 500, activeKcal: 30 });
  });
});

describe('steps arriving late', () => {
  const fixedSteps = (perMinute: number) => (a: number, b: number) => ((b - a) / 60_000) * perMinute;
  const walk: Walk = {
    id: 'w1',
    startedAt: T0,
    endedAt: T0 + 600_000,
    distanceM: 700,
    movingS: 600,
    steps: 800,
    activeKcal: 40,
    startPlace: null,
    weather: null,
    updatedAt: 1,
    activity: 'walk',
    stepsFrom: 'day',
    distanceFrom: 'steps',
  };

  it('sums the main time and kept parts; distance follows only when it came from steps', () => {
    const p: WalkPart = { walkId: 'w1', ord: 0, startT: T0 + 200_000, endT: T0 + 300_000, kind: 'unsure', steps: 0, distanceM: 0, movingS: 100, topSpeedMs: null, kcalWalk: 0, kcalRide: 0, choice: 'remove', defaultKeep: false };
    const r = refreshSteps(walk, [p], fixedSteps(100), 0.7, 70)!;
    // 500 s of main time at 100 a minute; the removed part adds nothing.
    expect(r.walk.steps).toBe(833);
    expect(r.walk.distanceM).toBe(583);
    expect(refreshSteps(walk, [{ ...p, choice: 'keep' }], fixedSteps(100), 0.7, 70)!.walk.steps).toBe(1000);
    expect(refreshSteps({ ...walk, distanceFrom: 'route' }, [p], fixedSteps(100), 0.7, 70)!.walk.distanceM).toBe(700);
    // The walk's own counter and rides are never re-read.
    expect(refreshSteps({ ...walk, stepsFrom: 'walk' }, [p], fixedSteps(100), 0.7, 70)).toBeNull();
    expect(refreshSteps({ ...walk, activity: 'ride' }, [p], fixedSteps(100), 0.7, 70)).toBeNull();
  });

  it('a refresh finishing after a keep/remove tap keeps the choice', async () => {
    const repo = await openRepository();
    const start = Date.now() - 3_600_000;
    const saved: Walk = { ...walk, startedAt: start, endedAt: start + 600_000, distanceFrom: 'route' };
    const p: WalkPart = { walkId: 'w1', ord: 0, startT: start + 200_000, endT: start + 300_000, kind: 'vehicle', steps: 5, distanceM: 400, movingS: 100, topSpeedMs: 4, kcalWalk: 1, kcalRide: 8, choice: null, defaultKeep: false };
    await repo.saveWalk(saved, [], [p]);

    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const source = {
      async getStepBuckets(from: Date, to: Date) {
        await gate;
        const out = [];
        for (let t = from.getTime(); t < to.getTime(); t += 60_000) out.push({ start: t, end: t + 60_000, steps: 100 });
        return out;
      },
    } as unknown as StepSource;

    // The detail screen opens and starts the refresh with the walk it loaded…
    const refreshing = refreshWalkSteps(repo, source, DEFAULT_PROFILE, saved, []);
    // …and the person taps "Add to walk" before it finishes.
    const afterTap = await repo.setPartChoice('w1', 0, 'keep');
    expect(afterTap?.distanceM).toBe(1100);
    release();
    const refreshed = await refreshing;
    const [stored] = await repo.getWalkParts('w1');
    expect(stored.choice).toBe('keep');
    expect(refreshed.distanceM).toBe(1100);
    // Main time (500 s) plus the kept part (100 s) at 100 a minute.
    expect(refreshed.steps).toBe(1000);
    expect((await repo.getWalk('w1'))?.walk.steps).toBe(1000);
  });
});

describe('while recording, and after an interruption', () => {
  it('shows "Finding GPS…" until the fixes settle, and a label', () => {
    const points = gpsFor(straight(30, 1.4), { seed: 1, accBase: 40, accShare: 0 });
    const live = liveWalk(base({ points, steps: stepRows(30, () => 110) }), T0 + 30_000);
    expect(live.last?.track?.routeFrom).toBeNull();
    expect(live.label).toBe('brisk');
  });

  it('an indoor walk interrupted with no fixes ends at its last sample', () => {
    const steps = stepRows(1200, () => 100);
    expect(interruptedEnd({ startedAt: T0, points: [], steps, pressure: [], activities: [] })).toBe(T0 + 1_200_000);
    expect(interruptedEnd({ startedAt: T0, points: [], steps: [], lastAliveAt: T0 + 90_000 })).toBe(T0 + 90_000);
    expect(interruptedEnd({ startedAt: T0 })).toBe(T0);
  });

  it('splits the main route at parts and at indoor/outdoor switches', () => {
    const stretches = mainStretches(
      T0,
      T0 + 1000_000,
      [{ startT: T0 + 300_000, endT: T0 + 400_000 }],
      [
        { t: T0, indoor: true },
        { t: T0 + 200_000, indoor: false },
      ],
      true,
    );
    expect(stretches.map((s) => [(s.from - T0) / 1000, (s.to - T0) / 1000, s.indoor, s.afterPart])).toEqual([
      [0, 200, true, false],
      [200, 300, false, false],
      [400, 1000, false, true],
    ]);
  });
});
