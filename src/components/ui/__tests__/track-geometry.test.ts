import { describe, expect, it } from '@jest/globals';

import { fitTrackHeight, lapPosition, pointOnTrack, trackPath, trackShape } from '../track-geometry';

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe('track geometry', () => {
  const shape = trackShape(328, 220, 24);

  it('measures the centre line of the lane', () => {
    expect(shape.r).toBe(98);
    expect(shape.straight).toBe(108);
    close(shape.perimeter, 2 * 108 + 2 * Math.PI * 98);
  });

  it('starts at the middle of the bottom straight and runs anticlockwise', () => {
    const start = pointOnTrack(shape, 0);
    close(start.x, 164);
    close(start.y, 110 + 98);
    // A quarter of the way round is on the right bend, above the start.
    const quarter = pointOnTrack(shape, 0.25);
    expect(quarter.x).toBeGreaterThan(164 + 54);
    expect(quarter.y).toBeLessThan(start.y);
    // Half way is the middle of the top straight.
    const halfway = pointOnTrack(shape, 0.5);
    close(halfway.x, 164);
    close(halfway.y, 110 - 98);
    close(halfway.ny, -1);
    // Three quarters is on the left bend.
    expect(pointOnTrack(shape, 0.75).x).toBeLessThan(164 - 54);
  });

  it('comes back to the start after a lap', () => {
    const lap = pointOnTrack(shape, 1);
    close(lap.x, 164);
    close(lap.y, 208);
    const almost = pointOnTrack(shape, 0.999);
    expect(Math.abs(almost.x - 164)).toBeLessThan(2);
  });

  it('keeps every point on the lane centre line', () => {
    for (let f = 0; f < 1; f += 0.01) {
      const p = pointOnTrack(shape, f);
      const half = shape.straight / 2;
      const dx = Math.max(0, Math.abs(p.x - shape.cx) - half);
      close(Math.hypot(dx, p.y - shape.cy), shape.r);
      close(Math.hypot(p.nx, p.ny), 1);
    }
  });

  it('draws a closed path from the start', () => {
    expect(trackPath(shape)).toMatch(/^M 164 208 H 218 A 98 98 0 0 0 218 12 H 110 A 98 98 0 0 0 110 208 Z$/);
  });

  it('copes with a box taller than it is wide', () => {
    const round = trackShape(100, 200, 20);
    expect(round.straight).toBe(0);
    expect(round.r).toBe(40);
  });
});

describe('laps', () => {
  it('fills the lane up to the goal, then runs the next lap', () => {
    expect(lapPosition(0)).toEqual({ covered: 0, runner: 0, lap: 1 });
    expect(lapPosition(0.4)).toEqual({ covered: 0.4, runner: 0.4, lap: 1 });
    expect(lapPosition(1)).toEqual({ covered: 1, runner: 0, lap: 2 });
    const past = lapPosition(2.25);
    expect(past.covered).toBe(1);
    close(past.runner, 0.25);
    expect(past.lap).toBe(3);
  });

  it('treats nonsense as the start', () => {
    expect(lapPosition(Number.NaN)).toEqual({ covered: 0, runner: 0, lap: 1 });
    expect(lapPosition(-3)).toEqual({ covered: 0, runner: 0, lap: 1 });
  });
});

describe('fitTrackHeight', () => {
  it('keeps the given height when the infield fits', () => {
    expect(fitTrackHeight(206, 120, 320, 24)).toBe(206);
    expect(fitTrackHeight(206, 0, 320, 24)).toBe(206);
  });

  it('grows the track so large text stays inside the lane', () => {
    // 180 dp of text at font scale 2 needs 180 + 2 × (24 + 8) = 244 dp.
    expect(fitTrackHeight(206, 180, 320, 24)).toBe(244);
  });

  it('never grows taller than the track is wide', () => {
    expect(fitTrackHeight(135, 300, 256, 16)).toBe(256);
  });
});
