import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { CARD_LOOK, pressedColor, pressedColorOnAccent, splitCardStyle } from '../surface-style';

describe('card style', () => {
  it('equals the spec', () => {
    expect(CARD_LOOK.radius).toBe(CLEAN_SPEC.radius.card);
    expect(CARD_LOOK.radius).toBe(24);
    expect(CARD_LOOK.padding).toBe(16);
    expect(CARD_LOOK.boxShadow).toBe(CLEAN_SPEC.shadow.card);
  });

  it('presses with ink at 8 percent and white at 24 percent on accent', () => {
    expect(pressedColor('#111827')).toBe('#11182714');
    expect(parseInt('14', 16) / 255).toBeCloseTo(0.08, 1);
    expect(pressedColorOnAccent('#FFFFFF')).toBe('#FFFFFF3D');
    expect(parseInt('3D', 16) / 255).toBeCloseTo(0.24, 1);
  });

  it('splits content layout from placement so the shadow layer is not clipped', () => {
    const { outer, inner } = splitCardStyle({ flex: 1, marginTop: 8, padding: 4, gap: 2, flexDirection: 'row' });
    expect(outer).toEqual({ flex: 1, marginTop: 8 });
    expect(inner).toEqual({ padding: 4, gap: 2, flexDirection: 'row' });
  });
});
