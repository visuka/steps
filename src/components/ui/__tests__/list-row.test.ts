import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { ROW, rowLook, rowRipple } from '../list-row-style';

describe('list row (spec 5.10, 5.11)', () => {
  it('has the spec numbers', () => {
    expect(ROW.height).toBe(48);
    expect(ROW.tallHeight).toBe(56);
    expect(ROW.gap).toBe(12);
    expect(ROW.hairline).toBe(1);
    expect(ROW.height).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
  });

  it('keeps the old 56 / 72 rows for callers that pass no new props', () => {
    expect(rowLook({})).toEqual({ spec: false, minHeight: 56, hairline: false });
    expect(rowLook({ supporting: true })).toEqual({ spec: false, minHeight: 72, hairline: false });
  });

  it('spec rows are 48, or 56 when tall', () => {
    expect(rowLook({ last: false }).minHeight).toBe(48);
    expect(rowLook({ tall: true }).minHeight).toBe(56);
    expect(rowLook({ tall: false }).minHeight).toBe(48);
  });

  it('draws the hairline on all but the last row unless told otherwise', () => {
    expect(rowLook({ last: false }).hairline).toBe(true);
    expect(rowLook({ tall: true }).hairline).toBe(true);
    expect(rowLook({ last: true }).hairline).toBe(false);
    expect(rowLook({ last: true, hairline: true }).hairline).toBe(true);
    expect(rowLook({ hairline: false }).hairline).toBe(false);
    expect(rowLook({ hairline: true }).spec).toBe(true);
  });

  it('presses as an 8 % ripple over the row and dims to 0.38 when disabled', () => {
    expect(rowRipple('#111827')).toEqual({ color: '#11182714', foreground: true });
    expect(ROW.disabledOpacity).toBe(0.38);
  });
});
