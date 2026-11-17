/**
 * The Steps tile's figures (owner, 17 Nov 2026): dots per hour, the hours on
 * your feet, and the goal bar's black, red and hatched segments.
 */
import { describe, expect, it } from '@jest/globals';

import { activeRange, goalSegments, hourDots } from '../steps-tile-model';

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

describe('goalSegments', () => {
  it('fills black up to the steps before the goal', () => {
    expect(goalSegments(3500, 7000, 28)).toEqual({ done: 14, extra: 0, left: 14 });
    expect(goalSegments(0, 7000, 28)).toEqual({ done: 0, extra: 0, left: 28 });
  });
  it('shows the steps past the goal in red', () => {
    expect(goalSegments(14000, 7000, 28)).toEqual({ done: 14, extra: 14, left: 0 });
    expect(goalSegments(7000, 7000, 28)).toEqual({ done: 28, extra: 0, left: 0 });
  });
  it('keeps at least one segment of each colour past the goal', () => {
    const s = goalSegments(1_000_000, 7000, 28);
    expect(s.done).toBe(1);
    expect(s.extra).toBe(27);
  });
  it('is all left without a goal', () => {
    expect(goalSegments(5000, 0, 28)).toEqual({ done: 0, extra: 0, left: 28 });
  });
});
