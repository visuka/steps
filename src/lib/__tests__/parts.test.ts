import { describe, expect, it } from '@jest/globals';

import { stepDataUsable, stepTimeline } from '@/lib/motion';
import { findParts, type FoundPart } from '@/lib/parts';
import type { ActivitySample, StepSample, WalkActivity } from '@/lib/walk';

import { arRows, chain, gpsFor, type Path, standing, stepRows, straight, T0 } from './walk-fixtures';

const kmh = (v: number) => v / 3.6;

/** Stop-and-go traffic: bursts at `v` with standing in between, the hard starts of a motor vehicle. */
function stopAndGo(seconds: number, v: number): Path {
  const legs: Path[] = [];
  for (let s = 0; s < seconds; s += 30) legs.push(straight(Math.min(20, seconds - s), v), standing(Math.min(10, Math.max(0, seconds - s - 20))));
  return chain(...legs.filter((l) => l.seconds > 0));
}

/** Pedalling away from each stop: speed builds up over 10 s. */
function gentle(seconds: number, v: number): Path {
  const legs: Path[] = [];
  for (let s = 0; s < seconds; s += 60) {
    for (let k = 1; k <= 5; k++) legs.push(straight(2, (v * k) / 5));
    legs.push(straight(Math.min(50, seconds - s - 10), v));
  }
  return chain(...legs.filter((l) => l.seconds > 0));
}

function parts(opts: {
  path: Path;
  spm: (s: number) => number;
  acts?: ActivitySample[];
  activity?: WalkActivity;
  noSteps?: boolean;
  doppler?: boolean;
  seed?: number;
  indoor?: boolean;
}): FoundPart[] {
  const points = gpsFor(opts.path, { seed: opts.seed ?? 1, white: 3, accBase: 6, doppler: opts.doppler ?? true });
  const rows: StepSample[] | null = opts.noSteps ? null : stepRows(opts.path.seconds, opts.spm);
  const timeline = stepTimeline(rows);
  const steps = timeline && stepDataUsable(timeline, points, 0.7) ? timeline : null;
  return findParts({
    points: opts.indoor ? [] : points,
    steps,
    activities: opts.acts ?? [],
    modes: [],
    initialIndoor: !!opts.indoor,
    activity: opts.activity ?? 'walk',
    startedAt: T0,
    endedAt: T0 + opts.path.seconds * 1000,
  });
}

const walking = (s: number) => straight(s, 1.4);

describe('vehicle parts in a walk', () => {
  it('walk, 3 minutes in a car at 12 km/h, walk: one part of about 600 m, left out', () => {
    const path = chain(walking(180), straight(180, kmh(12)), walking(180));
    const found = parts({ path, spm: (s) => (s >= 180 && s < 360 ? 3 : 110) });
    expect(found).toHaveLength(1);
    const [p] = found;
    expect(p.startT - T0).toBeGreaterThanOrEqual(150_000);
    expect(p.endT - T0).toBeLessThanOrEqual(390_000);
    expect(((p.endT - p.startT) / 1000) * kmh(12)).toBeGreaterThan(500);
    expect(p.defaultKeep).toBe(false);
  });

  it('a 40 s stop inside a car part is still one part', () => {
    const path = chain(walking(120), straight(90, kmh(25)), standing(40), straight(90, kmh(25)), walking(120));
    const found = parts({ path, spm: (s) => (s >= 120 && s < 340 ? 2 : 110) });
    expect(found).toHaveLength(1);
  });

  it('a long jam in an auto with bumps counted as steps stays one part', () => {
    // 4 minutes nearly stopped with 15 false steps, then slow traffic with
    // 70 "steps" a minute from bumps at 2 m/s (1.7 m steps: not walking).
    const path = chain(walking(120), straight(90, kmh(30)), standing(240), straight(60, 2), straight(90, kmh(30)), walking(120));
    const found = parts({
      path,
      spm: (s) => (s < 120 || s >= 600 ? 110 : s >= 450 && s < 510 ? 70 : s >= 210 && s < 450 ? 0.06 : 2),
    });
    expect(found).toHaveLength(1);
  });

  it('a 45 s creep is not a part', () => {
    const path = chain(walking(120), straight(45, kmh(15)), walking(120));
    expect(parts({ path, spm: (s) => (s >= 120 && s < 165 ? 0 : 110) })).toHaveLength(0);
  });

  it('jogging at 10 km/h and 160 steps a minute is not a part', () => {
    const path = chain(walking(120), straight(300, kmh(10)), walking(120));
    expect(parts({ path, spm: (s) => (s >= 120 && s < 420 ? 160 : 110) })).toHaveLength(0);
  });

  it('pedalling with the phone in a pocket (18 km/h at 70 or 140 steps a minute) is flagged', () => {
    for (const cadence of [70, 140]) {
      const path = chain(walking(120), straight(240, kmh(18)), walking(120));
      expect(parts({ path, spm: (s) => (s >= 120 && s < 360 ? cadence : 110) })).toHaveLength(1);
    }
  });

  it('AR bicycle is cycling, AR car with hard starts is a vehicle, 20 km/h with no AR is unsure', () => {
    const bike = chain(walking(120), gentle(300, kmh(18)), walking(120));
    const spm = (s: number) => (s >= 120 && s < 420 ? 40 : 110);
    expect(parts({ path: bike, spm, acts: arRows(120, 420, 'bicycle', 80) }).map((p) => p.kind)).toEqual(['cycle']);

    const car = chain(walking(120), stopAndGo(300, kmh(35)), walking(120));
    const carParts = parts({ path: car, spm: (s) => (s >= 120 && s < 420 ? 2 : 110), acts: arRows(130, 420, 'vehicle', 85) });
    expect(carParts.map((p) => p.kind)).toEqual(['vehicle']);
    expect(carParts[0].defaultKeep).toBe(false);

    const plain = chain(walking(120), straight(300, kmh(20)), walking(120));
    expect(parts({ path: plain, spm: (s) => (s >= 120 && s < 420 ? 5 : 110) }).map((p) => p.kind)).toEqual(['unsure']);
  });

  it('AR IN_VEHICLE at bike speeds with gentle starts asks instead of removing', () => {
    const path = chain(walking(120), gentle(300, kmh(16)), walking(120));
    const found = parts({ path, spm: (s) => (s >= 120 && s < 420 ? 30 : 110), acts: arRows(120, 420, 'vehicle', 70) });
    expect(found.map((p) => p.kind)).toEqual(['unsure']);
  });

  it('without step data: 8 km/h is not a part, 20 km/h is', () => {
    const slow = chain(walking(120), straight(300, kmh(8)), walking(120));
    expect(parts({ path: slow, spm: () => 0, noSteps: true })).toHaveLength(0);
    const fast = chain(walking(120), straight(300, kmh(20)), walking(120));
    expect(parts({ path: fast, spm: () => 0, noSteps: true })).toHaveLength(1);
  });

  it('pushing a stroller with no steps counted stays in the walk by default', () => {
    // The counter works (the walk before has steps), the phone on the handle counts none.
    const path = chain(walking(180), straight(300, kmh(4)));
    const found = parts({ path, spm: (s) => (s < 180 ? 110 : 0) });
    for (const p of found) expect(p.defaultKeep).toBe(true);
  });

  it('indoors, a minute of AR IN_VEHICLE is a part (no route to go on)', () => {
    const path = chain(standing(120), standing(240), standing(120));
    const found = parts({
      path,
      spm: (s) => (s < 120 || s >= 360 ? 100 : 0),
      acts: [...arRows(0, 110, 'walking', 70), ...arRows(130, 350, 'vehicle', 85), ...arRows(370, 480, 'walking', 70)],
      indoor: true,
    });
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe('vehicle');
    expect(found[0].defaultKeep).toBe(false);
  });
});

describe('vehicle parts in a ride', () => {
  it('riding at 25 km/h has none; 3 minutes at 60 km/h is a vehicle', () => {
    expect(parts({ path: straight(600, kmh(25)), spm: () => 0, activity: 'ride' })).toHaveLength(0);
    const path = chain(straight(300, kmh(22)), straight(180, kmh(60)), straight(300, kmh(22)));
    const found = parts({ path, spm: () => 0, activity: 'ride' });
    expect(found.map((p) => p.kind)).toEqual(['vehicle']);
    // Kept until the person removes it.
    expect(found[0].defaultKeep).toBe(true);
  });

  it('a cycling ride that AR reports as IN_VEHICLE is not flagged', () => {
    const path = straight(900, kmh(22));
    expect(parts({ path, spm: () => 0, activity: 'ride', acts: arRows(0, 900, 'vehicle', 90) })).toHaveLength(0);
  });

  it('a 20 s descent at 60 km/h makes no part (too short)', () => {
    const path = chain(straight(300, kmh(20)), straight(20, kmh(60)), straight(300, kmh(20)));
    const found = parts({ path, spm: () => 0, activity: 'ride' });
    for (const p of found) expect(p.defaultKeep).toBe(true);
  });
});
