import { describe, expect, it } from '@jest/globals';

import { clampShare, RING, ringArc, ringLabel, ringSize } from '../ring-geometry';

describe('ring geometry', () => {
  it('clamps the share between 0 and 1', () => {
    expect(clampShare(0, 100)).toBe(0);
    expect(clampShare(50, 100)).toBe(0.5);
    expect(clampShare(250, 100)).toBe(1);
    expect(clampShare(5, 0)).toBe(0);
    expect(clampShare(-3, 10)).toBe(0);
  });

  it('keeps size inside 40..88', () => {
    expect(ringSize(10)).toBe(RING.minSize);
    expect(ringSize(60)).toBe(60);
    expect(ringSize(200)).toBe(RING.maxSize);
  });

  it('draws share x circumference', () => {
    const r = 18;
    const c = 2 * Math.PI * r;
    const half = ringArc(0.5, r);
    expect(half.circumference).toBeCloseTo(c, 6);
    expect(half.dasharray).toBe(`${0.5 * c} ${c}`);
    expect(ringArc(2, r).dasharray).toBe(`${c} ${c}`);
    expect(ringArc(-1, r).dasharray).toBe(`0 ${c}`);
  });

  it('labels in percent, capped at 100', () => {
    expect(ringLabel(3120, 8000)).toBe('39 percent');
    expect(ringLabel(9000, 8000)).toBe('100 percent');
  });
});
