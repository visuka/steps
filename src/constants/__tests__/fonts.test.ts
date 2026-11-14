import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '../themes/clean-spec';
import { CLEAN_FONT_FILES, fontFor, TELUGU_FONT } from '../themes/fonts';

describe('fontFor', () => {
  it('returns the per-weight family name for 300, 400 and 500', () => {
    expect(fontFor(300)).toBe('Poppins_300Light');
    expect(fontFor(400)).toBe('Poppins_400Regular');
    expect(fontFor(500)).toBe('Poppins_500Medium');
  });

  it('matches the family names in clean-spec.ts', () => {
    expect(fontFor(300)).toBe(CLEAN_SPEC.fonts.android.light);
    expect(fontFor(400)).toBe(CLEAN_SPEC.fonts.android.regular);
    expect(fontFor(500)).toBe(CLEAN_SPEC.fonts.android.medium);
  });

  it('gives Telugu its own family', () => {
    expect(TELUGU_FONT).toBe('NotoSansTelugu_400Regular');
  });

  it('loads a file for every family name the spec uses', () => {
    const names = [fontFor(300), fontFor(400), fontFor(500), TELUGU_FONT];
    for (const name of names) {
      expect(CLEAN_FONT_FILES[name]).toBeDefined();
    }
    expect(Object.keys(CLEAN_FONT_FILES).sort()).toEqual([...names].sort());
  });
});
