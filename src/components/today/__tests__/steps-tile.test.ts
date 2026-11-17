/**
 * The Steps tile's figures (owner, 17 Nov 2026): dots per hour, the hours on
 * your feet, the dot grid and the bars' black pills and red dots.
 */
import { describe, expect, it } from '@jest/globals';

import { activeRange, dotGrid, goalTrack, hourDots, sleepTrack } from '../steps-tile-model';

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

const len = (p: { from: number; to: number; dot: boolean }[]) => p.filter((x) => !x.dot).reduce((t, x) => t + x.to - x.from, 0);

describe('dotGrid', () => {
  const h = hours([
    [7, 2000],
    [8, 1800],
    [13, 900],
    [14, 1200],
    [20, 5000],
  ]);
  it('lights two columns an hour as smooth peaks, none after now', () => {
    const { n } = dotGrid(h, 15, 7, 2);
    expect(n).toHaveLength(48);
    expect(Math.max(...n)).toBe(7);
    expect(n[15]).toBeGreaterThan(0);
    expect(n.slice(32).every((x) => x === 0)).toBe(true);
    expect(n[0]).toBe(0);
  });
  it('marks only the latest peak as recent', () => {
    const { n, recent } = dotGrid(h, 15, 7, 2);
    expect(recent.some(Boolean)).toBe(true);
    expect(recent.slice(0, 20).some(Boolean)).toBe(false);
    recent.forEach((r, c) => r && expect(n[c]).toBeGreaterThan(0));
  });
  it('is empty with no steps and copes with bad numbers', () => {
    expect(dotGrid(day, 12).n.every((x) => x === 0)).toBe(true);
    expect(dotGrid([NaN, -5], 23).recent.some(Boolean)).toBe(false);
  });
});

describe('goalTrack', () => {
  it('fills up to the steps with long pills and red dots at the quarters passed', () => {
    const g = goalTrack(6000, 10000);
    expect(g.filled).toBeCloseTo(0.6);
    expect(len(g.parts)).toBeCloseTo(0.6, 6);
    expect(g.parts.filter((x) => x.dot).map((x) => x.from)).toEqual([0.25, 0.5]);
    expect(g.parts.filter((x) => !x.dot).every((x) => !x.red)).toBe(true);
  });
  it('is empty at nothing or without a goal', () => {
    expect(goalTrack(0, 7000)).toEqual({ filled: 0, parts: [] });
    expect(goalTrack(5000, 0)).toEqual({ filled: 0, parts: [] });
  });
  it('shows the steps past the goal as one red pill', () => {
    const g = goalTrack(14000, 7000);
    expect(g.filled).toBe(1);
    const red = g.parts.filter((x) => x.red && !x.dot);
    expect(red).toEqual([{ from: 0.5, to: 1, red: true, dot: false }]);
    expect(g.parts.filter((x) => x.dot).map((x) => x.from)).toEqual([0.125, 0.25, 0.375]);
  });
});

describe('sleepTrack', () => {
  it('draws two pills and a red dot at the end', () => {
    const t = sleepTrack(0.8);
    expect(len(t)).toBeCloseTo(0.8, 6);
    expect(t[t.length - 1]).toEqual({ from: 0.8, to: 0.8, red: true, dot: true });
    expect(t.filter((x) => !x.dot)).toHaveLength(2);
  });
  it('is empty at nothing', () => {
    expect(sleepTrack(0)).toEqual([]);
    expect(sleepTrack(NaN)).toEqual([]);
  });
});
