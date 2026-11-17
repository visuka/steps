import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { NAV, SLOT_VISUAL_HEIGHT, barHeight, slotTouch } from '../nav-style';

describe('bottom bar (docs/design.md "Bottom bar")', () => {
  it('has the design sizes', () => {
    expect(NAV.height).toBe(60);
    expect(NAV.hairline).toBe(0);
    expect(NAV.slotWidth).toBe(48);
    expect(NAV.iconSize).toBe(22);
    expect(SLOT_VISUAL_HEIGHT).toBe(48);
  });

  it('adds the system inset to the height', () => {
    expect(barHeight(0)).toBe(60);
    expect(barHeight(34)).toBe(94);
  });

  it('every slot can be tapped on at least 48 x 48', () => {
    const t = slotTouch();
    expect(t.width).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
    expect(t.height).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
  });

  it('fits three slots on a 320 dp screen', () => {
    expect(3 * NAV.slotWidth + 2 * NAV.slotGap + 2 * NAV.sidePadding).toBeLessThanOrEqual(320);
  });
});
