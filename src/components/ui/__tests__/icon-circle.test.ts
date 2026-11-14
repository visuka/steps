import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { ICON_CIRCLE_STYLE, iconCircleColors, iconCircleHitSlop, iconCircleRipple } from '../icon-circle-style';

const theme = {
  primary: 'p',
  onPrimary: 'op',
  primaryContainer: 'pc',
  food: 'f',
  foodContainer: 'fc',
  sleep: 's',
  sleepContainer: 'sc',
  surfaceContainer: 'sf',
  onSurfaceVariant: 'ov',
};

describe('icon circle style', () => {
  it('equals the spec', () => {
    expect(ICON_CIRCLE_STYLE.size).toBe(40);
    expect(ICON_CIRCLE_STYLE.radius).toBe(20);
    expect(ICON_CIRCLE_STYLE.iconSize).toBe(20);
  });

  it('maps tones to roles', () => {
    expect(iconCircleColors(theme, 'accent')).toEqual({ fill: 'pc', icon: 'p' });
    expect(iconCircleColors(theme, 'warm')).toEqual({ fill: 'fc', icon: 'f' });
    expect(iconCircleColors(theme, 'indigo')).toEqual({ fill: 'sc', icon: 's' });
    expect(iconCircleColors(theme, 'grey')).toEqual({ fill: 'sf', icon: 'ov' });
    expect(iconCircleColors(theme, 'accentSolid')).toEqual({ fill: 'p', icon: 'op' });
  });

  it('ripples with ink at 8 % on tinted circles and onPrimary at 24 % on the solid one', () => {
    const t = { onSurface: '#111827', onPrimary: '#FFFFFF' };
    expect(iconCircleRipple(t, 'accent')).toBe('#11182714');
    expect(iconCircleRipple(t, 'grey')).toBe('#11182714');
    expect(iconCircleRipple(t, 'accentSolid')).toBe('#FFFFFF3D');
  });

  it('reaches 48 dp when pressable', () => {
    expect(ICON_CIRCLE_STYLE.size + 2 * iconCircleHitSlop()).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
  });
});
