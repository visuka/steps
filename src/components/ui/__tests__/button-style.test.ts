import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { BUTTON_STYLE, rippleKind } from '../button-style';

describe('button style', () => {
  it('equals spec 5.8 and 10.3', () => {
    expect(BUTTON_STYLE.minHeight).toBe(48);
    expect(BUTTON_STYLE.minHeight).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
    expect(BUTTON_STYLE.radius).toBe(16);
    expect(BUTTON_STYLE.editWidth).toBe(112);
    expect(BUTTON_STYLE.disabled).toEqual({ bg: 'surfaceContainerHigh', fg: 'onSurfaceVariant', border: 'outlineVariant' });
  });

  it('keeps an inline text link at 48 dp to hit', () => {
    const { paddingVertical, hitSlop } = BUTTON_STYLE.inline;
    // About 20 dp of label plus its padding and slop.
    expect(20 + 2 * paddingVertical + hitSlop.top + hitSlop.bottom).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
  });

  it('ripples white on accent and ink elsewhere', () => {
    expect(rippleKind('filled')).toBe('onAccent');
    for (const k of ['tonal', 'secondary', 'outlined', 'text'] as const) expect(rippleKind(k)).toBe('onSurface');
  });
});
