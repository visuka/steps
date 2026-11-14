import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { TILE_STYLE, tileAccessibilityLabel, tileBottomPadding, valueIsMuted, valueTypeRole, valueWithUnit } from '../stat-tile-style';

describe('stat tile style', () => {
  it('is a touch target of at least 48', () => {
    expect(TILE_STYLE.minHeight).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
  });

  it('nests the unit after one space', () => {
    expect(valueWithUnit('5', 'of 8 glasses')).toEqual({ value: '5 ', unit: 'of 8 glasses' });
    expect(valueWithUnit('6 h 50', 'min')).toEqual({ value: '6 h 50 ', unit: 'min' });
    expect(valueWithUnit('2.3')).toEqual({ value: '2.3' });
  });

  it('builds the spoken label', () => {
    expect(tileAccessibilityLabel('Water', '5', 'of 8 glasses')).toBe('Water, 5 of 8 glasses');
    expect(tileAccessibilityLabel('Morning walk', '2.3', 'km', '32 min')).toBe('Morning walk, 2.3 km, 32 min');
  });

  it('shortens the bottom padding only for a note without a bar', () => {
    expect(tileBottomPadding(true, false)).toBe(6);
    expect(tileBottomPadding(false, false)).toBe(TILE_STYLE.padding);
    expect(tileBottomPadding(true, true)).toBe(TILE_STYLE.padding);
  });
});

describe('stat tile value style', () => {
  it('picks the role and the muted colour', () => {
    expect(valueTypeRole()).toBe('titleMedium');
    expect(valueTypeRole('default')).toBe('titleMedium');
    expect(valueTypeRole('mutedValue')).toBe('titleMedium');
    expect(valueTypeRole('muted')).toBe('bodyMedium');
    expect(valueIsMuted()).toBe(false);
    expect(valueIsMuted('muted')).toBe(true);
    expect(valueIsMuted('mutedValue')).toBe(true);
  });
});
