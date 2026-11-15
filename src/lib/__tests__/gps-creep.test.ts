import { describe, expect, it } from '@jest/globals';

import { creeping, dropStill } from '../gps';
import type { WalkPoint } from '../walk';

// About 1 m of latitude.
const M = 1 / 111_320;
const at = (s: number, north: number): WalkPoint => ({ t: s * 1000, lat: 17 + north * M, lon: 78, acc: 12 });

describe('GPS creep while sitting', () => {
  it('drift of 100 m over 3 minutes with no steps adds no route', () => {
    // A fix every 2 s, creeping north at 0.55 m/s (the owner's sitting screenshot: 0.10 km in 3 min).
    const pts = Array.from({ length: 91 }, (_, k) => at(k * 2, k * 2 * 0.55));
    const kept = dropStill(pts, 'walk', null);
    expect(kept.length).toBeLessThan(35);
    expect(creeping(pts, 90)).toBe(true);
  });

  it('a slow walk (0.8 m/s) is kept', () => {
    const pts = Array.from({ length: 91 }, (_, k) => at(k * 2, k * 2 * 0.8));
    expect(creeping(pts, 90)).toBe(false);
    expect(dropStill(pts, 'walk', null).length).toBe(91);
  });

  it('the first minute is never called creep', () => {
    const pts = Array.from({ length: 20 }, (_, k) => at(k * 2, 0));
    expect(creeping(pts, 19)).toBe(false);
  });
});
