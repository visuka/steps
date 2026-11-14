import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { BAR_FAB_CLEARANCE, FAB_STYLE } from '../fab-style';

describe('extended fab style', () => {
  it('equals the spec', () => {
    expect(FAB_STYLE.minHeight).toBe(56);
    expect(FAB_STYLE.radius).toBe(28);
    expect(FAB_STYLE.boxShadow).toBe(CLEAN_SPEC.shadow.fab);
    expect(FAB_STYLE.minHeight).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
  });

  it('clears the bottom bar: 56 round FAB, lifted 7.5, plus 16', () => {
    expect(BAR_FAB_CLEARANCE).toBe(79.5);
  });
});
