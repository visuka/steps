import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { SCREEN, backHitSlop, bottomOffset, bottomPadding, subtitleIndent, topPadding } from '../screen-style';

describe('screen frame (spec 5.9, 7)', () => {
  it('takes its numbers from the spec', () => {
    expect(SCREEN.sideMargin).toBe(24);
    expect(SCREEN.sideMargin).toBe(CLEAN_SPEC.space.sideMargin);
    expect(SCREEN.topGapTab).toBe(24);
    expect(SCREEN.topGapPushed).toBe(16);
    expect(SCREEN.topBarHeight).toBe(40);
    expect(SCREEN.back.iconSize).toBe(20);
    expect(SCREEN.back.marginLeft).toBe(-4);
    expect(SCREEN.back.titleGap).toBe(8);
  });

  it('top padding is the status-bar inset plus the gap, so the header never sits under the status bar', () => {
    for (const inset of [0, 24, 28, 36, 47.5]) {
      expect(topPadding(inset, false)).toBe(inset + 24);
      expect(topPadding(inset, true)).toBe(inset + 16);
      expect(topPadding(inset, false)).toBeGreaterThan(inset);
    }
  });

  it('the back control has a touch area of at least 48 x 48', () => {
    const slop = backHitSlop();
    expect(SCREEN.back.iconSize + slop.left + slop.right).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
    expect(SCREEN.topBarHeight + slop.top + slop.bottom).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
  });

  it('lines a subtitle up with the title beside the chevron', () => {
    expect(subtitleIndent()).toBe(24);
  });

  it('keeps content clear of the gesture bar and the FAB', () => {
    expect(bottomPadding(true, 30, false)).toBe(24);
    expect(bottomPadding(false, 30, false)).toBe(54);
    expect(bottomPadding(true, 0, true)).toBe(24 + 56 + 16);
  });

  it('puts the overlay 16 above the bar in the tabs and 24 above the bottom elsewhere (spec 10.3)', () => {
    expect(bottomOffset(true, 30)).toBe(16);
    expect(bottomOffset(false, 30)).toBe(54);
    expect(bottomOffset(false, 0)).toBe(24);
  });
});
