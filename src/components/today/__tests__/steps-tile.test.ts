/**
 * The Steps tile's figures (owner, 17 Nov 2026): dots per hour, the hours on
 * your feet, and the bars' black and red pills.
 */
import { describe, expect, it } from '@jest/globals';

import { activeRange, clusterDots, goalPills, hourDots, pillRun } from '../steps-tile-model';

const day = Array.from({ length: 24 }, () => 0);
const hours = (pairs: [number, number][]) => {
  const h = [...day];
  for (const [i, s] of pairs) h[i] = s;
  return h;
};

describe('hourDots', () => {
  it('lights dots by steps against the busiest hour, at least one, none after now', () => {
    const h = hours([
      [6, 100],
      [9, 2000],
      [12, 1000],
      [15, 3000],
    ]);
    const d = hourDots(h, 12, 5);
    expect(d[6]).toBe(1);
    expect(d[9]).toBe(5);
    expect(d[12]).toBe(3);
    expect(d[15]).toBe(0);
    expect(d[0]).toBe(0);
    expect(d).toHaveLength(24);
  });
  it('copes with bad numbers', () => {
    expect(hourDots([NaN, -5, 10], 23, 5).slice(0, 3)).toEqual([0, 0, 5]);
  });
});

describe('activeRange', () => {
  it('is null with no steps yet', () => {
    expect(activeRange(day, 10)).toBeNull();
  });
  it('runs from the first hour with steps to the end of the last', () => {
    expect(activeRange(hours([[6, 50], [13, 900]]), 15)).toBe('06:00 – 14:00');
  });
  it('ends at NOW while this hour has steps', () => {
    expect(activeRange(hours([[7, 50], [15, 900]]), 15)).toBe('07:00 – NOW');
  });
});

describe('pillRun', () => {
  const sum = (p: { w: number }[]) => p.reduce((t, x) => t + x.w, 0);
  it('fills exactly the share with mixed lengths and a red lead', () => {
    const p = pillRun(0.6);
    expect(sum(p)).toBeCloseTo(0.6, 6);
    expect(new Set(p.map((x) => x.w.toFixed(3))).size).toBeGreaterThan(2);
    expect(p[p.length - 1].red).toBe(true);
    expect(p.slice(0, -1).every((x) => !x.red)).toBe(true);
  });
  it('makes fewer, longer pills when stretched', () => {
    expect(pillRun(0.8, null, false, 2.5).length).toBeLessThan(pillRun(0.8, null, false).length);
    expect(sum(pillRun(0.8, null, false, 2.5))).toBeCloseTo(0.8, 6);
  });
  it('can stay all black', () => {
    expect(pillRun(0.5, null, false).every((x) => !x.red)).toBe(true);
  });
  it('turns red after the goal', () => {
    const p = pillRun(1, 0.5);
    expect(sum(p)).toBeCloseTo(1, 6);
    expect(sum(p.filter((x) => !x.red))).toBeCloseTo(0.5, 6);
    expect(sum(p.filter((x) => x.red))).toBeCloseTo(0.5, 6);
  });
  it('is empty at nothing and copes with bad numbers', () => {
    expect(pillRun(0)).toEqual([]);
    expect(pillRun(NaN)).toEqual([]);
  });
});

describe('goalPills', () => {
  it('fills up to the steps before the goal', () => {
    expect(goalPills(3500, 7000).filled).toBeCloseTo(0.5);
    expect(goalPills(0, 7000)).toEqual({ filled: 0, pills: [] });
    expect(goalPills(5000, 0)).toEqual({ filled: 0, pills: [] });
  });
  it('shows the steps past the goal in red', () => {
    const g = goalPills(14000, 7000);
    expect(g.filled).toBe(1);
    expect(g.pills.filter((x) => x.red).reduce((t, x) => t + x.w, 0)).toBeCloseTo(0.5, 6);
  });
});

describe('clusterDots', () => {
  it('makes a small peak, the middle tallest', () => {
    expect(clusterDots(0)).toEqual([0, 0, 0]);
    expect(clusterDots(1)).toEqual([1, 1, 1]);
    expect(clusterDots(8)).toEqual([5, 8, 6]);
  });
});
