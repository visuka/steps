import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { CHIP_STYLE, chipHitSlopVertical } from '../chip-style';

describe('chip style', () => {
  it('equals spec 5.9', () => {
    expect(CHIP_STYLE.radius).toBe(CLEAN_SPEC.radius.chip);
    expect(CHIP_STYLE.radius).toBe(20);
    expect(CHIP_STYLE.minHeight).toBe(40);
    expect(CHIP_STYLE.paddingLeft).toBe(16);
    expect(CHIP_STYLE.paddingRight).toBe(12);
    expect(CHIP_STYLE.gapTrailing).toBe(4);
    expect(CHIP_STYLE.iconSize).toBe(20);
    expect(CHIP_STYLE.dotSize).toBe(8);
    expect(CHIP_STYLE.dotRadius).toBe(CLEAN_SPEC.radius.dot);
    expect(CHIP_STYLE.dotRadius).toBe(4);
  });

  it('is hit across at least 48 dp', () => {
    expect(CHIP_STYLE.minHeight + 2 * chipHitSlopVertical()).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
  });
});
