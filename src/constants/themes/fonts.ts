/**
 * Clean+ fonts (docs/design/spec.md section 1). On Android each weight is its
 * own family name, so text picks its face by family, not by fontWeight: a
 * custom font with fontWeight falls back to the system font.
 */

// One file per weight (not the package root, which would bundle every weight).
import { NotoSansTelugu_400Regular } from '@expo-google-fonts/noto-sans-telugu/400Regular';
import { Poppins_300Light } from '@expo-google-fonts/poppins/300Light';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';

import { CLEAN_SPEC } from './clean-spec';

export type CleanWeight = 300 | 400 | 500;

/** Family name for a Clean+ weight. Only the three weights in the spec exist. */
export function fontFor(weight: CleanWeight): string {
  switch (weight) {
    case 300:
      return CLEAN_SPEC.fonts.android.light;
    case 400:
      return CLEAN_SPEC.fonts.android.regular;
    case 500:
      return CLEAN_SPEC.fonts.android.medium;
  }
}

/** Family name for Telugu text (`.te`): Noto Sans Telugu 400. */
export const TELUGU_FONT: string = CLEAN_SPEC.fonts.android.telugu;

/** Font files for expo-font, keyed by family name: only the faces the spec uses. */
export const CLEAN_FONT_FILES: Record<string, number> = {
  [CLEAN_SPEC.fonts.android.light]: Poppins_300Light,
  [CLEAN_SPEC.fonts.android.regular]: Poppins_400Regular,
  [CLEAN_SPEC.fonts.android.medium]: Poppins_500Medium,
  [CLEAN_SPEC.fonts.android.telugu]: NotoSansTelugu_400Regular,
};
