import { describe, expect, it } from '@jest/globals';

import { type AccelBurst, buzzScore, computeMovementFeatures, NO_FEATURES, rhythmScore, smooth } from '../movement-features';

const G = 9.81;

/** A burst of `seconds` at `rate` Hz; `axes` gives the three readings at time t. */
function burst(seconds: number, rate: number, axes: (t: number) => [number, number, number]): AccelBurst {
  const b: AccelBurst = { t: [], x: [], y: [], z: [] };
  const n = Math.round(seconds * rate) + 1;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const [x, y, z] = axes(t);
    b.t.push(t);
    b.x.push(x);
    b.y.push(y);
    b.z.push(z);
  }
  return b;
}

/** Tiny deterministic noise, so a test never depends on a random number. */
const wobble = (t: number, k: number) => 0.02 * Math.sin(t * 37.3 * k + k);

describe('walking', () => {
  // A phone lying flat in a pocket: up-down bounce at 2 steps a second, a little sway forward and back.
  const walking = burst(10, 25, (t) => [0.4 * Math.sin(2 * Math.PI * 2 * t + 1), wobble(t, 2), G + 3 * Math.sin(2 * Math.PI * 2 * t)]);

  it('has a high rhythm', () => {
    expect(computeMovementFeatures(walking).rhythm).toBeGreaterThan(0.9);
  });

  it('has a small push, braking and speed gain, and no buzz', () => {
    const f = computeMovementFeatures(walking);
    expect(f.push).toBeLessThan(0.3);
    expect(f.brake).toBeLessThan(0.3);
    expect(f.speedGained).toBeLessThan(1);
    expect(f.buzz).toBeLessThan(0.1);
  });

  it('gives the same figures whichever way the phone lies', () => {
    const upright = burst(10, 25, (t) => [G + 3 * Math.sin(2 * Math.PI * 2 * t), 0.4 * Math.sin(2 * Math.PI * 2 * t + 1), wobble(t, 3)]);
    const a = computeMovementFeatures(walking);
    const b = computeMovementFeatures(upright);
    expect(b.rhythm).toBeCloseTo(a.rhythm, 1);
    expect(b.speedGained).toBeLessThan(1);
  });
});

describe('a vehicle speeding up', () => {
  // Flat, still for 1.5 s, then 2 m/s^2 forward for 6 s, then steady.
  const ramp = burst(10, 25, (t) => [t >= 1.5 && t < 7.5 ? 2 : 0, wobble(t, 5), G + wobble(t, 7)]);

  it('gains about 12 m/s over the 6 s', () => {
    const f = computeMovementFeatures(ramp);
    expect(f.speedGained).toBeGreaterThan(8);
    expect(f.speedGained).toBeLessThan(13);
  });

  it('pushes forward and has no rhythm', () => {
    const f = computeMovementFeatures(ramp);
    expect(f.push).toBeGreaterThan(1.2);
    expect(f.push).toBeLessThan(2.2);
    expect(f.rhythm).toBeLessThan(0.5);
  });

  it('calls braking the same size backwards', () => {
    const braking = burst(10, 25, (t) => [t >= 1.5 && t < 7.5 ? -2 : 0, wobble(t, 5), G + wobble(t, 7)]);
    const f = computeMovementFeatures(braking);
    // Forward is the way the speed grew, so a slow-down alone reads as a push the other way round.
    expect(f.speedGained).toBeGreaterThan(8);
    expect(f.push).toBeGreaterThan(1.2);
  });

  it('tells braking from pushing when both happen', () => {
    // A gentle 0.5 m/s^2 push for 6 s, then a hard 4 m/s^2 slow-down for half a second.
    const both = burst(10, 25, (t) => [t >= 1.5 && t < 7.5 ? 0.5 : t >= 8 && t < 8.5 ? -4 : 0, 0, G]);
    const f = computeMovementFeatures(both);
    expect(f.brake).toBeGreaterThan(f.push);
  });
});

describe('engine buzz', () => {
  it('is high for shaking at 30 Hz', () => {
    const buzzing = burst(10, 100, (t) => [0.5 * Math.sin(2 * Math.PI * 30 * t), 0, G + 0.8 * Math.sin(2 * Math.PI * 30 * t + 2)]);
    expect(buzzScore(buzzing, 100)).toBeGreaterThan(0.9);
    expect(computeMovementFeatures(buzzing).buzz).toBeGreaterThan(0.9);
  });

  // The phone is read at about 25 Hz, so the highest frequency it can see is 12.5 Hz.
  it('is high for shaking at 10 Hz read at 25 Hz', () => {
    const buzzing = burst(10, 25, (t) => [0.5 * Math.sin(2 * Math.PI * 10 * t), 0, G + 0.8 * Math.sin(2 * Math.PI * 10 * t + 2)]);
    expect(computeMovementFeatures(buzzing).buzz).toBeGreaterThan(0.9);
  });

  it('does not see shaking at 30 Hz when read at 25 Hz (it folds down to 5 Hz)', () => {
    const buzzing = burst(10, 25, (t) => [0.5 * Math.sin(2 * Math.PI * 30 * t), 0, G + 0.8 * Math.sin(2 * Math.PI * 30 * t + 2)]);
    expect(computeMovementFeatures(buzzing).buzz).toBeLessThan(0.1);
  });

  it('is zero for a phone that hardly shakes', () => {
    const still = burst(10, 25, (t) => [wobble(t, 1), wobble(t, 2), G + wobble(t, 3)]);
    expect(computeMovementFeatures(still).buzz).toBe(0);
    expect(computeMovementFeatures(still).rhythm).toBe(0);
  });
});

describe('short or odd bursts', () => {
  it('gives nothing for too few readings or too short a time', () => {
    expect(computeMovementFeatures(burst(2, 25, () => [0, 0, G]))).toEqual(NO_FEATURES);
    expect(computeMovementFeatures({ t: [], x: [], y: [], z: [] })).toEqual(NO_FEATURES);
  });

  it('gives nothing when the axes do not match the times', () => {
    const b = burst(10, 25, () => [0, 0, G]);
    expect(computeMovementFeatures({ ...b, x: b.x.slice(1) })).toEqual(NO_FEATURES);
  });
});

describe('helpers', () => {
  it('smooths a sine of whole periods to nothing', () => {
    const s = Array.from({ length: 101 }, (_, i) => Math.sin((2 * Math.PI * 2 * i) / 25));
    const out = smooth(s, 50);
    expect(Math.abs(out[50])).toBeLessThan(0.05);
  });

  it('finds no rhythm in a straight line', () => {
    expect(rhythmScore(Array.from({ length: 100 }, (_, i) => i * 0.01), 25)).toBeLessThan(1);
  });
});
