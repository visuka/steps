/**
 * What a theme is. Each theme is one file in this folder (park.ts, a.ts … f.ts)
 * exporting a ThemeDef as its default; index.ts lists them in order.
 *
 * Plain data with no React Native, so jest can check every theme. Font
 * sources are the @expo-google-fonts files (numbers once bundled); jest
 * maps those packages to a stub.
 *
 * The rules every theme keeps (tokens.ts, tested in __tests__/tokens.test.ts):
 * flat colour only; body text 4.5:1 and large text and marks 3:1 in every
 * scheme; colour is never the only signal; touch targets 48 dp; Indian
 * scripts fall back to the phone's Noto fonts; sizes follow the phone's text size.
 */

import type { ColorScheme, RadiusScale, TypeScaleShape } from '../tokens';

/** In the order the Appearance picker shows them. */
export const THEME_IDS = ['park', 'a', 'b', 'c', 'd', 'e', 'f'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/** Colour blocks. */
export const DEFAULT_THEME_ID: ThemeId = 'd';

/** One loaded font file: the family name screens ask for, and the file. */
export interface ThemeFont {
  /** The name it is loaded under, e.g. 'PlusJakartaSans_700Bold' (the export's own name). */
  family: string;
  /** The @expo-google-fonts export, e.g. PlusJakartaSans_700Bold. */
  source: number | string;
}

/**
 * The faces a theme uses: four UI weights and two numeral weights. A theme
 * may point two weights at the same file (D's numerals are its UI face at 700
 * and 800). The type scale's weight names pick among these.
 */
export interface ThemeFonts {
  regular: ThemeFont;
  medium: ThemeFont;
  semibold: ThemeFont;
  bold: ThemeFont;
  /** Numerals at weight regular or medium. */
  numeralMedium: ThemeFont;
  /** Numerals at weight semibold or bold. */
  numeral: ThemeFont;
}

/**
 * The few switches the shared components in components/ui read, so a theme
 * looks like its mockup on Today, Food and Walk without screens knowing which
 * theme is on.
 */
export interface ThemeStyle {
  /**
   * Stat tiles and cards that carry a data tone (StatTile/Card `tone`):
   * - 'filled': the tone's container colour, text in its `on` colour (D).
   * - 'outlined': surfaceContainerLowest with a 1 dp outlineVariant border.
   * - 'plain': a tonal surfaceContainer plate (park).
   * Untoned cards: 'plain' keeps tonal plates; 'filled' and 'outlined' draw
   * level 0 to 2 cards outlined, level 3 and 4 stay tonal.
   */
  tile: 'filled' | 'outlined' | 'plain';
  /**
   * How a progress hero is drawn (TrackProgress: Today's steps, Food's day energy):
   * - 'track': the oval running track with the number in its infield (park).
   * - 'ring': a circular ring, the number inside (A, B).
   * - 'bar': the number left-aligned over a thick bar (C, E, F).
   * - 'block': like 'bar', on a block of the tone's container colour (D).
   */
  hero: 'track' | 'ring' | 'bar' | 'block';
  /**
   * Straight progress bars (TickBar):
   * - 'ticked': ticks every tenth (park).
   * - 'solid': one flat fill, round ends (D, E).
   * - 'segmented': ten separate segments (C, F).
   */
  bar: 'ticked' | 'solid' | 'segmented';
  /**
   * The navigation bar's selected pill:
   * - 'neutral': secondaryContainer for every tab (park).
   * - 'tone': each tab's data container (Today and Activity steps, Food food, Journal and You sleep) (D).
   */
  navIndicator: 'neutral' | 'tone';
  /** Tabular (fixed-width) figures in the numeral styles, so counts don't jiggle. */
  numeralTabular: boolean;
  /*
   * Buttons, chips and the FAB (build.ts buildControls turns these into styles).
   * Each is optional; left out, it is park's look: pill buttons 48 dp tall,
   * labels as written, the FAB at radius.lg with its level 3 shadow.
   */
  /**
   * Corner radius of common and segmented buttons, dp; radius.full (999) is a
   * pill. Icon button marks take the same, up to their 20 dp half-width.
   * A, B, D: pills; C, F: 12; E: 20.
   */
  buttonRadius?: number;
  /** Minimum height of common buttons, dp. Never under 48 (the touch target). E: 56. */
  buttonHeight?: number;
  /** Case of button and FAB labels. The screen reader always gets the label as written. */
  buttonCase?: LabelCase;
  /**
   * Case of chip labels. 'upper' also sets them in labelMedium (F's small,
   * tracked capitals, as its "HIGH" tag).
   */
  chipCase?: LabelCase;
  /** Corner radius of the extended FAB, dp. Default radius.lg. */
  fabRadius?: number;
  /** The FAB's level 3 shadow. The flat mockups (A to F) draw none. Default true. */
  fabShadow?: boolean;
}

/** 'none' keeps a label as written; 'upper' draws it in capitals. */
export type LabelCase = 'none' | 'upper';

export interface ThemeDef {
  id: ThemeId;
  /** Shown in the picker, e.g. "Colour blocks". */
  name: string;
  /** One short line under the name. */
  description: string;
  /**
   * 'system' follows the phone's light or dark setting; 'light' and 'dark'
   * keep that scheme always. A dark-only theme sets 'dark' and gives its dark
   * scheme as both `colors.light` and `colors.dark` (and the reverse for light-only).
   */
  mode: 'system' | 'light' | 'dark';
  colors: { light: ColorScheme; dark: ColorScheme };
  fonts: ThemeFonts;
  type: TypeScaleShape;
  radius: RadiusScale;
  style: ThemeStyle;
}
