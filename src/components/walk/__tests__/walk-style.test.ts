import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { chunk, segmentWidth, STAT_ICON, WALK_STYLE } from '../walk-style';

describe('walk screen numbers (spec 5.9, 5.11)', () => {
  it('uses the spec sizes', () => {
    expect(WALK_STYLE.map).toMatchObject({ height: 160, radius: 24 });
    expect(WALK_STYLE.stat).toMatchObject({ height: 72, paddingX: 16, gap: 12, radius: 24, columns: 2 });
    expect(WALK_STYLE.part.height).toBe(56);
    expect(WALK_STYLE.segmented).toMatchObject({ width: 216, height: 40, padding: 4, radius: 20, selectedRadius: 16 });
    expect(WALK_STYLE.sparkline).toMatchObject({ width: 128, height: 32 });
    expect(WALK_STYLE.dots).toEqual({ start: { r: 6, ring: 2.5 }, end: { r: 6.5, ring: 2.5 } });
    expect(WALK_STYLE.sideMargin).toBe(CLEAN_SPEC.space.sideMargin);
  });

  it('splits the segments (216 - 8) / 3 each', () => {
    expect(segmentWidth()).toBeCloseTo(69.33, 2);
  });

  it('draws the mockup icons on the four stat cards', () => {
    expect([STAT_ICON.time, STAT_ICON.steps, STAT_ICON.pace, STAT_ICON.floors]).toEqual(['clock', 'feet', 'gauge', 'stairs']);
  });

  it('lays the cards two to a row', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
    expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
