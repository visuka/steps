import { describe, expect, it } from '@jest/globals';

import { stepTimeline } from '@/lib/motion';
import { climbGain, countStairs, heightM } from '@/lib/stairs';
import type { PressureSample } from '@/lib/walk';

import { pressureRows, rng, stepRows, T0 } from './walk-fixtures';

/** Height that stays at h0, then moves by dh at `rate` m/s from `at` s. */
const move = (at: number, dh: number, rate: number, h0 = 0) => (s: number) =>
  s < at ? h0 : h0 + Math.sign(dh) * Math.min(Math.abs(dh), (s - at) * rate);

describe('barometer height', () => {
  it('matches Android’s formula', () => {
    expect(heightM(1013.25)).toBeCloseTo(0);
    // About 8.3 m per hPa near sea level.
    expect(heightM(1012.25)).toBeCloseTo(8.3, 0);
  });
});

describe('stairs and lifts', () => {
  it('counts 3 floors climbed by stairs', () => {
    // Walking, then 9 m of stairs at 0.2 m/s (45 s), then walking on.
    const pressure = pressureRows(300, move(100, 9, 0.2), { noiseHpa: 0.02 });
    const steps = stepTimeline(stepRows(300, (s) => (s >= 100 && s < 145 ? 90 : 100)));
    const r = countStairs(pressure, { steps })!;
    expect(r.floorsUp).toBe(3);
    expect(r.liftUp + r.liftDown + r.floorsDown).toBe(0);
  });

  it('counts a lift going 4 floors at 1.5 m/s', () => {
    // Walk to the lift, stand in it while it climbs 12 m, walk out.
    const pressure = pressureRows(240, move(100, 12, 1.5), { noiseHpa: 0.02 });
    const steps = stepTimeline(stepRows(240, (s) => (s >= 90 && s < 120 ? 0 : 100)));
    const r = countStairs(pressure, { steps })!;
    expect(r.liftUp).toBe(4);
    expect(r.floorsUp).toBe(0);
  });

  it('counts a lift down, even with steps walking in and out of it', () => {
    // One floor down in 3.5 s; walking right up to it and away from it.
    const pressure = pressureRows(200, move(100, -3.5, 1), { noiseHpa: 0.01 });
    const steps = stepTimeline(stepRows(200, (s) => (s >= 98 && s < 106 ? 0 : 110)));
    const r = countStairs(pressure, { steps })!;
    expect(r.liftDown).toBe(1);
    expect(r.floorsDown).toBe(0);
  });

  it('counts a lift when the phone slept and the readings stopped', () => {
    // No readings for 40 s (the non-wake-up barometer while the screen is off) and 9 m higher after.
    const rows = pressureRows(300, move(120, 9, 1.5)).filter((p) => p.t < T0 + 110_000 || p.t > T0 + 150_000);
    const steps = stepTimeline(stepRows(300, (s) => (s >= 105 && s < 155 ? 0 : 100)));
    const r = countStairs(rows, { steps })!;
    expect(r.liftUp).toBe(3);
  });

  it('ignores 2 hPa of weather over 2 hours, a 3 s door spike and ±0.06 hPa noise', () => {
    const pressure = pressureRows(7200, () => 0, {
      seed: 5,
      noiseHpa: 0.06,
      driftHpaPerS: 2 / 7200,
      spikes: [{ at: 1800, s: 3, hpa: 0.5 }],
    });
    const steps = stepTimeline(stepRows(7200, () => 60));
    const r = countStairs(pressure, { steps })!;
    expect(r.floorsUp + r.floorsDown + r.liftUp + r.liftDown).toBe(0);
  });

  it('calls a hill outdoors a climb, not stairs', () => {
    // 10 m up over 400 m of road, walking.
    const pressure = pressureRows(300, move(0, 10, 10 / 300), { noiseHpa: 0.01 });
    const steps = stepTimeline(stepRows(300, () => 110));
    const flat = countStairs(pressure, { steps, horizontalM: (a, b) => ((b - a) / 1000) * 1.35 })!;
    expect(flat.floorsUp).toBe(0);
    // The same climb in a stairwell (no route) is stairs.
    const steep = pressureRows(200, move(50, 10, 0.25), { noiseHpa: 0.01 });
    const inside = countStairs(steep, { steps, horizontalM: () => null })!;
    expect(inside.floorsUp).toBe(3);
    const outside = countStairs(steep, { steps, horizontalM: (a, b) => ((b - a) / 1000) * 1.35 })!;
    expect(outside.floorsUp).toBe(0);
    expect(outside.hillUpM).toBeGreaterThan(8);
  });

  it('leaves out the time in vehicle parts', () => {
    // A car drives up 30 m during 100-200 s.
    const pressure = pressureRows(300, move(100, 30, 0.3));
    const r = countStairs(pressure, { exclude: [[T0 + 95_000, T0 + 205_000]] })!;
    expect(r.floorsUp + r.liftUp).toBe(0);
  });

  it('without a barometer gives nulls', () => {
    expect(countStairs(null)).toBeNull();
    expect(countStairs([])).toBeNull();
    expect(climbGain(null)).toBeNull();
  });
});

describe('climb on a ride', () => {
  it('adds up the hills and ignores wind on the phone', () => {
    // Up 30 m, down 30 m, up 20 m, with gusts worth ±0.4 hPa.
    const r = rng(3);
    const profile = (s: number) => (s < 300 ? s * 0.1 : s < 600 ? 30 - (s - 300) * 0.1 : Math.min(20, (s - 600) * 0.1));
    const rows: PressureSample[] = pressureRows(900, profile).map((p) => ({ ...p, hpa: p.hpa + (r() * 2 - 1) * 0.4 }));
    const gain = climbGain(rows)!;
    expect(gain).toBeGreaterThan(42);
    expect(gain).toBeLessThan(58);
    // Flat with the same gusts: next to nothing.
    const flat = pressureRows(900, () => 0).map((p) => ({ ...p, hpa: p.hpa + (r() * 2 - 1) * 0.4 }));
    expect(climbGain(flat)!).toBeLessThan(4);
  });
});
