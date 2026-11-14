/**
 * The active theme: Material 3 colour roles for light and dark, the 8 dp
 * spacing scale, shapes, motion and the type scale with its fonts. Shared
 * shapes live in tokens.ts; each theme's values in themes/<id>.ts.
 *
 * The theme is picked once, at import, from the choice saved on the phone
 * (themes/choice.ts), so every StyleSheet.create below sees its fonts, type
 * and radius. Changing theme saves the choice and reloads the app
 * (themes/apply.ts). Light and dark switch live through useTheme().
 *
 * Read colours with useTheme() (hooks/use-theme). Text styles come from
 * <ThemedText type="bodyLarge" /> or Type.bodyLarge; never hand-pick a size.
 */

import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

import { activeTheme } from './themes';
import { buildControls, buildFonts, buildType, numeralFontOf, uiFontOf } from './themes/build';
import type { ThemeDef } from './themes/types';
import type { ColorScheme, FontWeightName, RadiusScale } from './tokens';

export * from './tokens';

/** The theme in use for this run of the app. */
export const ActiveTheme: ThemeDef = activeTheme();

/** The theme's switches for the shared components (tile, hero, bar, navIndicator, numeralTabular). */
export const Look = ActiveTheme.style;

/** The one scheme the theme keeps, 'light' or 'dark'; no theme follows the phone. */
export const ThemeMode = ActiveTheme.mode;

export const Colors: { light: ColorScheme; dark: ColorScheme } = ActiveTheme.colors;

/** Material 3 shape scale of the active theme, dp. */
export const Radius: RadiusScale = ActiveTheme.radius;

/** Button, chip and FAB shapes and label case of the active theme (themes/build.ts). */
export const Controls = buildControls(ActiveTheme);

/** The family names the active theme's files are loaded under (app/_layout.tsx). */
export const FontFiles = {
  regular: ActiveTheme.fonts.regular.family,
  medium: ActiveTheme.fonts.medium.family,
  semibold: ActiveTheme.fonts.semibold.family,
  bold: ActiveTheme.fonts.bold.family,
  numeralMedium: ActiveTheme.fonts.numeralMedium.family,
  numeral: ActiveTheme.fonts.numeral.family,
} as const;

export const Fonts = buildFonts(ActiveTheme, Platform.OS);

/** The UI face for a weight name or a CSS-style weight (400, '600', 'bold'). */
export function uiFont(weight: FontWeightName | TextStyle['fontWeight'] | undefined): string {
  return uiFontOf(Fonts, weight);
}

/** The numeral face for a weight: 500 and below are the medium file, the rest the numeral file. */
export function numeralFont(weight: FontWeightName | TextStyle['fontWeight'] | undefined): string {
  return numeralFontOf(Fonts, weight);
}

/** Ready-made text styles for every role of the active theme's type scale. */
export const Type = buildType(ActiveTheme, Fonts);

/** How much the big numerals may grow with the phone's text size; they are large already. */
export const NumeralMaxScale = 1.3;

/** Old name for the space the tab bar takes; the bar now takes its own room, so screens need none. */
export const BottomTabInset = 0;
