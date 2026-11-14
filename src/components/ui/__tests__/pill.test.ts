import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { heroColors } from '../hero-colors';
import { PILL_STYLE, pillColors } from '../pill-style';

const theme = {
  primary: '#1F4FD8',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E8EEFC',
  error: '#B42318',
  errorContainer: '#FDECEA',
};

describe('pill style', () => {
  it('equals spec 5.6', () => {
    expect(PILL_STYLE.minHeight).toBe(24);
    expect(PILL_STYLE.radius).toBe(12);
    expect(PILL_STYLE.radius).toBe(CLEAN_SPEC.radius.pill);
    expect(PILL_STYLE.paddingX).toBe(8);
    expect(PILL_STYLE.warningPaddingLeft).toBe(4);
    expect(PILL_STYLE.warningGap).toBe(4);
    expect(PILL_STYLE.iconSize).toBe(20);
    expect(PILL_STYLE.fontWeight).toBe('500');
  });

  it('picks colours per variant from roles', () => {
    expect(pillColors(theme, 'tint')).toEqual({ fill: theme.primaryContainer, text: theme.primary });
    expect(pillColors(theme, 'warning')).toEqual({ fill: theme.errorContainer, text: theme.error });
    const h = heroColors(theme);
    expect(pillColors(theme, 'hero')).toEqual({ fill: h.pill, text: h.strong });
    expect(pillColors(theme, 'hero').fill).toBe(CLEAN_SPEC.colors.heroPill);
  });
});
