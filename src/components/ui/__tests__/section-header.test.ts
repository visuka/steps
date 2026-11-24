import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { SECTION, headerMarginBottom, headerMarginTop, headerSlop, headingTextDistance, headingTextGapBelow, rowTouchHeight } from '../section-header-style';

describe('section header (spec 5.10)', () => {
  it('has the spec gaps', () => {
    expect(SECTION.gapSection).toBe(24);
    expect(SECTION.gapSub).toBe(16);
    expect(SECTION.lineHeight).toBe(22);
  });

  it('a text-only heading adds only the spec distance minus the 16 block gap of Screen', () => {
    expect(headerMarginTop('section', false)).toBe(8);
    expect(headerMarginTop('sub', false)).toBe(0);
    expect(headingTextDistance('section', false)).toBe(24);
    expect(headingTextDistance('sub', false)).toBe(16);
    expect(rowTouchHeight(false)).toBe(0);
  });

  it('a heading with a button is at least 48 high and keeps its text where the spec puts it', () => {
    expect(rowTouchHeight(true)).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
    // 48 high row, 22 line centred: 13 above the text, so the margin is 13 less.
    expect(headerMarginTop('section', true)).toBe(-5);
    expect(headerMarginTop('sub', true)).toBe(-13);
    expect(headingTextDistance('section', true)).toBe(24);
    expect(headingTextDistance('sub', true)).toBe(16);
  });

  it('sits 8 above its own block, with or without a button, and the button target stays clear of it', () => {
    expect(headerMarginBottom(false)).toBe(-8);
    expect(headerMarginBottom(true)).toBe(-21);
    expect(headingTextGapBelow(false)).toBe(8);
    expect(headingTextGapBelow(true)).toBe(8);
    const slop = headerSlop();
    expect(slop.bottom).toBeLessThanOrEqual(SECTION.gapBelow);
    expect(SECTION.lineHeight + slop.top + slop.bottom).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
  });
});
