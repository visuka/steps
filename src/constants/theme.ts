/**
 * The park-track world: Material 3 colour roles for light and dark, the 8 dp
 * spacing scale, shapes, motion and the type scale with its fonts. The values
 * live in tokens.ts (plain data, tested for contrast); this file adds the
 * font families, which differ on the web preview.
 *
 * Read colours with useTheme() (hooks/use-theme). Text styles come from
 * <ThemedText type="bodyLarge" /> or Type.bodyLarge; never hand-pick a size.
 */

import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

import { type FontWeightName, TypeScale, type TypeRole, type TypeSpec } from './tokens';

export * from './tokens';

/**
 * Loaded in app/_layout.tsx from @expo-google-fonts. Barlow is the one UI
 * family; Barlow Condensed is its own condensed cut, for the big numbers.
 * Neither has Indian scripts: Android draws those with the system's Noto
 * fonts, glyph by glyph, and the web preview falls back the same way.
 */
export const FontFiles = {
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  bold: 'Barlow_700Bold',
  numeralMedium: 'BarlowCondensed_500Medium',
  numeral: 'BarlowCondensed_600SemiBold',
} as const;

/** The web preview names a fallback chain; phones fall back on their own. */
const WEB_FALLBACK = ", 'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Telugu', system-ui, sans-serif";
const family = (file: string) => (Platform.OS === 'web' ? `${file}${WEB_FALLBACK}` : file);

export const Fonts = {
  regular: family(FontFiles.regular),
  medium: family(FontFiles.medium),
  semibold: family(FontFiles.semibold),
  bold: family(FontFiles.bold),
  numeralMedium: family(FontFiles.numeralMedium),
  numeral: family(FontFiles.numeral),
  /** Kept for old code that asked for these. */
  sans: family(FontFiles.regular),
  rounded: family(FontFiles.medium),
  serif: Platform.OS === 'web' ? 'Georgia, serif' : 'serif',
  mono: Platform.OS === 'web' ? 'ui-monospace, monospace' : 'monospace',
} as const;

/** The UI face for a weight name or a CSS-style weight (400, '600', 'bold'). */
export function uiFont(weight: FontWeightName | TextStyle['fontWeight'] | undefined): string {
  switch (weight) {
    case 'medium':
    case '500':
    case 500:
      return Fonts.medium;
    case 'semibold':
    case '600':
    case 600:
      return Fonts.semibold;
    case 'bold':
    case '700':
    case 700:
    case '800':
    case 800:
    case '900':
    case 900:
    case 'heavy':
    case 'black':
      return Fonts.bold;
    default:
      return Fonts.regular;
  }
}

/** The numeral face for a weight: 500 and below are Medium, the rest SemiBold. */
export function numeralFont(weight: FontWeightName | TextStyle['fontWeight'] | undefined): string {
  switch (weight) {
    case 'regular':
    case 'medium':
    case 'normal':
    case '400':
    case 400:
    case '500':
    case 500:
      return Fonts.numeralMedium;
    default:
      return Fonts.numeral;
  }
}

function toStyle(spec: TypeSpec): TextStyle {
  return {
    fontFamily: spec.numeral ? numeralFont(spec.weight) : uiFont(spec.weight),
    fontSize: spec.size,
    lineHeight: spec.line,
    letterSpacing: spec.tracking,
    ...(spec.numeral ? { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] } : null),
  };
}

/** Ready-made text styles for every role of the type scale. */
export const Type = Object.fromEntries(
  (Object.keys(TypeScale) as TypeRole[]).map((role) => [role, toStyle(TypeScale[role])]),
) as Record<TypeRole, TextStyle>;

/** How much the big numerals may grow with the phone's text size; they are large already. */
export const NumeralMaxScale = 1.3;

/** Old name for the space the tab bar takes; the bar now takes its own room, so screens need none. */
export const BottomTabInset = 0;
