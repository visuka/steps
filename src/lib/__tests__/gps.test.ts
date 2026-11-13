import { describe, expect, it } from '@jest/globals';

import {
  dropStill,
  gateFixes,
  GPS,
  gpsState,
  learnStride,
  smoothTrack,
  trackStretch,
  walkStride,
  warmUpIndex,
} from '@/lib/gps';
import { stepTimeline } from '@/lib/motion';
import { cleanPoints, distanceM, walkStats, type WalkPoint } from '@/lib/walk';

import { chain, gpsFor, laps, pathLength, rng, standing, stepRows, straight, T0, toLatLon } from './walk-fixtures';

const SEEDS = [1, 2, 3, 4, 5];
const old = (raw: WalkPoint[]) => walkStats(cleanPoints(raw)).distanceM;

describe("the owner's park walk", () => {
  // 7 minutes of laps in a 70 x 45 m park at 116 steps a minute (811 steps):
  // about 570 m. The phone's fixes drift and get pulled across the roads
  // around the park; the old maths made 0.85-1.07 km of it.
  const path = laps(420, 1.36, 70, 45);
  const noise = { white: 2, drift: 4, driftTauS: 60, excursionEveryS: 60, excursionS: 14, excursionM: 28, accBase: 7, accShare: 0.3 };
  const steps = stepTimeline(stepRows(420, () => 116));

  it('comes out near 0.55-0.6 km instead of 0.9 km', () => {
    const results = SEEDS.map((seed) => {
      const raw = gpsFor(path, { ...noise, seed });
      expect(old(raw)).toBeGreaterThan(840);
      return trackStretch(raw, { cls: 'walk', from: T0, to: T0 + 420_000, steps, strideM: 0.7 }).distanceM;
    });
    for (const d of results) {
      expect(d).toBeGreaterThan(540);
      expect(d).toBeLessThan(620);
    }
    const mean = results.reduce((s, d) => s + d, 0) / results.length;
    expect(mean).toBeGreaterThan(550);
    expect(mean).toBeLessThan(600);
  });

  it('is within 3% when the fixes carry Doppler speed', () => {
    for (const seed of SEEDS) {
      const raw = gpsFor(path, { ...noise, seed, doppler: true });
      const d = trackStretch(raw, { cls: 'walk', from: T0, to: T0 + 420_000, steps, strideM: 0.7 }).distanceM;
      expect(Math.abs(d - 570) / 570).toBeLessThan(0.03);
    }
  });

  it('uses steps x stride where poor GPS zig-zags across the road, and says so', () => {
    // A slow swing across a road, 26 m each way every 20 s, with 13 m
    // accuracy: it passes every jump check and doubles the distance.
    const truth = straight(420, 1.36);
    const raw = gpsFor(truth, { seed: 9, white: 2, accBase: 13, accShare: 0 }).map((p, i) => {
      const swing = 26 * Math.sin((2 * Math.PI * i * 2) / 20);
      return { ...p, lon: p.lon + swing / 108_500 };
    });
    expect(old(raw)).toBeGreaterThan(900);
    const tr = trackStretch(raw, { cls: 'walk', from: T0, to: T0 + 420_000, steps, strideM: 0.7 });
    expect(tr.distanceM).toBeGreaterThan(540);
    expect(tr.distanceM).toBeLessThan(620);
    expect(tr.stepM).toBeGreaterThan(tr.gpsM);
    expect(tr.fromSteps.length).toBeGreaterThan(0);
    expect(tr.weak.length).toBeGreaterThan(0);
  });
});

describe('noisy tracks within 10% of the truth', () => {
  it('a lane walk with fixes zig-zagging between the buildings', () => {
    const path = straight(450, 1.3);
    const truth = pathLength(path);
    for (const seed of SEEDS) {
      const raw = gpsFor(path, { seed, white: 3, excursionEveryS: 15, excursionS: 8, excursionM: 14, drift: 3, accBase: 8 });
      expect(old(raw)).toBeGreaterThan(1.5 * truth);
      const d = trackStretch(raw, { cls: 'walk', from: T0, to: T0 + 450_000, steps: stepTimeline(stepRows(450, () => 112)), strideM: 0.7 }).distanceM;
      expect(Math.abs(d - truth) / truth).toBeLessThan(0.1);
    }
  });

  it('a cold start whose first fixes are 100 m off', () => {
    const path = straight(300, 1.4);
    for (const seed of SEEDS) {
      const raw = gpsFor(path, { seed, white: 2.5, warmM: 120, warmS: 30, accShare: 0.45 });
      const tr = trackStretch(raw, { cls: 'walk', from: T0, to: T0 + 300_000, steps: stepTimeline(stepRows(300, () => 115)), strideM: 0.7 });
      expect(tr.routeFrom).toBeGreaterThan(T0);
      expect(Math.abs(tr.distanceM - 420) / 420).toBeLessThan(0.1);
      // The "Finding GPS…" seconds are counted from steps.
      expect(tr.fromSteps[0][0]).toBe(T0);
    }
  });

  it('a bike ride', () => {
    const path = laps(1200, 6, 600, 400);
    const truth = pathLength(path);
    for (const seed of SEEDS) {
      for (const doppler of [true, false]) {
        const raw = gpsFor(path, { seed, white: 3, drift: 3, accBase: 5, doppler });
        const d = trackStretch(raw, { cls: 'ride', from: T0, to: T0 + 1_200_000 }).distanceM;
        expect(Math.abs(d - truth) / truth).toBeLessThan(0.05);
      }
    }
  });

  it('walking tiny laps on a terrace, where GPS can’t see the loops, comes from steps', () => {
    const path = laps(420, 1.25, 8, 5);
    const raw = gpsFor(path, { seed: 2, white: 3, drift: 3, accBase: 8 });
    const tr = trackStretch(raw, { cls: 'walk', from: T0, to: T0 + 420_000, steps: stepTimeline(stepRows(420, () => 110)), strideM: 0.7 });
    expect(tr.distanceM).toBeCloseTo(110 * 7 * 0.7, -1);
  });
});

describe('standing still', () => {
  const walkStandWalk = chain(straight(120, 1.4), standing(300), straight(120, 1.4));
  const walkOnly = chain(straight(120, 1.4), straight(120, 1.4));
  const spm = (s: number) => (s < 120 || s >= 420 ? 110 : 0);

  it('adds under 5 m in 5 minutes when the step counter shows no steps', () => {
    for (const seed of SEEDS) {
      const noise = { seed, white: 3, drift: 4, accBase: 7 };
      const withStop = trackStretch(gpsFor(walkStandWalk, noise), {
        cls: 'walk',
        from: T0,
        to: T0 + 540_000,
        steps: stepTimeline(stepRows(540, spm)),
        strideM: 0.7,
      });
      const stopS = 300;
      // The same two walks without the stop, measured the same way.
      const without = trackStretch(gpsFor(walkOnly, noise), {
        cls: 'walk',
        from: T0,
        to: T0 + 240_000,
        steps: stepTimeline(stepRows(240, () => 110)),
        strideM: 0.7,
      });
      expect(withStop.distanceM - without.distanceM).toBeLessThan(5 + 0.05 * without.distanceM);
      expect(withStop.movingS).toBeLessThan(240 + stopS / 10);
    }
  });

  it('draws nothing while standing', () => {
    const raw = gpsFor(walkStandWalk, { seed: 4, white: 3, drift: 4 });
    const steps = stepTimeline(stepRows(540, spm));
    const kept = dropStill(gateFixes(raw, () => GPS.WALK_MS), 'walk', steps);
    const during = kept.filter((p) => p.t > T0 + 140_000 && p.t < T0 + 400_000);
    expect(during.length).toBeLessThanOrEqual(1);
  });

  it('without step data: Doppler, or staying within 20 m, freezes it too', () => {
    for (const seed of SEEDS) {
      const raw = gpsFor(standing(300), { seed, white: 3, drift: 4, accBase: 7 });
      expect(old(raw)).toBeGreaterThan(300);
      const dop = gpsFor(standing(300), { seed, white: 3, drift: 4, accBase: 7, doppler: true });
      expect(trackStretch(dop, { cls: 'walk', from: T0, to: T0 + 300_000 }).distanceM).toBeLessThan(5);
      expect(trackStretch(raw, { cls: 'walk', from: T0, to: T0 + 300_000 }).distanceM).toBeLessThan(15);
    }
  });
});

describe('the steps of the pipeline', () => {
  const at = (s: number, x: number, y: number, acc: number): WalkPoint => ({ t: T0 + s * 1000, ...toLatLon(x, y), acc });

  it('starts the route after two good fixes in a row, or the best fix after 45 s', () => {
    expect(warmUpIndex([at(0, 0, 0, 40), at(2, 0, 0, 18), at(4, 0, 0, 25), at(6, 0, 0, 12), at(8, 0, 0, 9)])).toBe(3);
    const rough = Array.from({ length: 30 }, (_, i) => at(i * 2, 0, 0, i === 10 ? 22 : 28));
    expect(warmUpIndex(rough)).toBe(10);
    expect(warmUpIndex(rough.slice(0, 5))).toBeNull();
  });

  it('drops fixes over 25 m, takes 30 m ones only after 20 s with nothing better', () => {
    const fixes = [at(0, 0, 0, 8), at(2, 2, 0, 27), at(4, 5, 0, 26), at(24, 30, 0, 28), at(26, 33, 0, 40)];
    const kept = gateFixes(fixes, () => GPS.WALK_MS);
    expect(kept.map((p) => p.t - T0)).toEqual([0, 24_000]);
  });

  it('drops a jump, and recovers when it was the kept fix that was wrong', () => {
    const fixes = [at(0, 0, 0, 5), at(2, 3, 0, 5), at(4, 45, 0, 5), at(6, 6, 0, 5), at(8, 9, 0, 5)];
    expect(gateFixes(fixes, () => GPS.WALK_MS).map((p) => p.t - T0)).toEqual([0, 2000, 6000, 8000]);
    // A wrong first fix: 20 s of consistent fixes elsewhere take over.
    const wrongStart = [at(0, 200, 0, 6), ...Array.from({ length: 12 }, (_, i) => at(2 + 2 * i, 2.8 * i, 0, 6))];
    expect(gateFixes(wrongStart, () => GPS.WALK_MS).length).toBeGreaterThan(10);
  });

  it('smooths without lagging behind a straight walk', () => {
    const r = rng(11);
    const fixes: WalkPoint[] = Array.from({ length: 150 }, (_, i) => at(i * 2, (r() - 0.5) * 8, i * 2 * 1.4 + (r() - 0.5) * 8, 8));
    const smooth = smoothTrack(fixes, 'walk');
    const end = toLatLon(0, 149 * 2 * 1.4);
    expect(distanceM(smooth[smooth.length - 1], end)).toBeLessThan(6);
    const wobble = smooth.reduce((s, p) => s + Math.abs(((p.lon - toLatLon(0, 0).lon) * 108_500)), 0) / smooth.length;
    expect(wobble).toBeLessThan(2.5);
  });

  it('says "Finding GPS…" until the route starts, then OK', () => {
    const cold = gpsFor(straight(30, 1.4), { seed: 1, accBase: 35, accShare: 0 });
    expect(gpsState(trackStretch(cold, { cls: 'walk', from: T0, to: T0 + 30_000 }), T0 + 30_000, false)).toBe('finding');
    const good = gpsFor(straight(60, 1.4), { seed: 1 });
    expect(gpsState(trackStretch(good, { cls: 'walk', from: T0, to: T0 + 60_000 }), T0 + 60_000, false)).toBe('ok');
    expect(gpsState(null, T0, true)).toBe('off');
  });
});

describe('stride', () => {
  it('learns the stride from good GPS walking at 90-130 steps a minute', () => {
    // 10 minutes at 1.35 m/s and 108 steps a minute: a 0.75 m stride.
    const raw = gpsFor(straight(600, 1.35), { seed: 3, white: 2, accBase: 4, accShare: 0.2 });
    const tr = trackStretch(raw, { cls: 'walk', from: T0, to: T0 + 600_000, steps: stepTimeline(stepRows(600, () => 108)), strideM: 0.68 });
    expect(tr.stride).not.toBeNull();
    expect(tr.stride!.metres / tr.stride!.steps).toBeCloseTo(0.75, 1);
  });

  it('blends walks and prefers the person’s own setting', () => {
    let learned = learnStride(null, { metres: 300, steps: 400 });
    expect(learned!.strideM).toBeCloseTo(0.75);
    learned = learnStride(learned, { metres: 300, steps: 430 });
    expect(learned!.strideM).toBeGreaterThan(0.71);
    expect(learned!.strideM).toBeLessThan(0.75);
    // A stride no walker has is ignored.
    expect(learnStride(learned, { metres: 400, steps: 200 })).toBe(learned);
    expect(walkStride({ strideM: 0.8 }, 0.68, learned)).toBe(0.8);
    expect(walkStride({ strideM: null }, 0.68, learned)).toBeCloseTo(0.72, 1);
    expect(walkStride({ strideM: null }, 0.68, { strideM: 0.9, metres: 250 })).toBe(0.68);
  });
});
