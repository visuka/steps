/**
 * D, Colour blocks (app-look/project/D-Blocks.dc.html). The default theme.
 *
 * Cheerful solid tiles: every area has its own colour, so it is found at a
 * glance. Steps are leaf green, food apricot, water sky, sleep lavender, each
 * as a flat block with its text in that block's deep `on` colour. Chrome is
 * white with warm-grey plates; the one main button is deep forest.
 * Plus Jakarta Sans throughout, numerals at 800 with tabular figures.
 *
 * Dark: the same four blocks as deep saturated plates with their pale tint as
 * text, on a warm near-black ground; marks lift to light tints.
 */

import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';

import { type RadiusScale, schemeFromRoles, type SchemeRoles, type TypeScaleShape } from '../tokens';
import type { ThemeDef } from './types';

const light: SchemeRoles = {
  // The one main action: deep forest, as the mockup's "Log food" and "Save to lunch".
  primary: '#12361A',
  onPrimary: '#FFFFFF',
  primaryContainer: '#CDEBC6',
  onPrimaryContainer: '#12361A',
  secondary: '#4C5F4E',
  onSecondary: '#FFFFFF',
  // Tonal buttons and the selected segment: the leaf block.
  secondaryContainer: '#CDEBC6',
  onSecondaryContainer: '#12361A',
  tertiary: '#5B47B0',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#E3DAFF',
  onTertiaryContainer: '#2C1F5E',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#FFEDEA',
  onErrorContainer: '#8C1D18',
  background: '#FFFFFF',
  onBackground: '#1B1D1A',
  surface: '#FFFFFF',
  onSurface: '#1B1D1A',
  surfaceVariant: '#E6E6E1',
  onSurfaceVariant: '#565A53',
  surfaceDim: '#DCDCD6',
  surfaceBright: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F7F7F4',
  surfaceContainer: '#F1F1EE',
  surfaceContainerHigh: '#EAEAE6',
  surfaceContainerHighest: '#E6E6E1',
  inverseSurface: '#2F312D',
  inverseOnSurface: '#F1F1EE',
  inversePrimary: '#9CD596',
  outline: '#767A72',
  outlineVariant: '#E0E0DA',
  surfaceTint: '#12361A',
  shadow: '#000000',
  scrim: '#000000',

  steps: '#2C6E36',
  onSteps: '#FFFFFF',
  stepsContainer: '#CDEBC6',
  onStepsContainer: '#12361A',
  food: '#A0521C',
  onFood: '#FFFFFF',
  foodContainer: '#FFD9BF',
  onFoodContainer: '#5A2A06',
  food2: '#6E3A10',
  food3: '#47230A',
  water: '#1F65A8',
  onWater: '#FFFFFF',
  waterContainer: '#CFE6FF',
  onWaterContainer: '#0B3A66',
  sleep: '#5B47B0',
  onSleep: '#FFFFFF',
  sleepContainer: '#E3DAFF',
  onSleepContainer: '#2C1F5E',
  near: '#8A5A00',
  onNear: '#FFFFFF',
  nearContainer: '#FFE2B0',
  onNearContainer: '#3D2800',
  over: '#B3261E',
  onOver: '#FFFFFF',

  // On the white ground the lane is warm grey; inside a block it is white (components/ui).
  lane: '#D6D6CF',
  tick: '#FFFFFF',
  laneTick: '#5C6058',
};

const dark: SchemeRoles = {
  primary: '#CDEBC6',
  onPrimary: '#12361A',
  primaryContainer: '#1F4A26',
  onPrimaryContainer: '#CDEBC6',
  secondary: '#B4CCB3',
  onSecondary: '#1F3322',
  secondaryContainer: '#1F4A26',
  onSecondaryContainer: '#CDEBC6',
  tertiary: '#BBA9FF',
  onTertiary: '#2C1F5E',
  tertiaryContainer: '#3A2C78',
  onTertiaryContainer: '#E3DAFF',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  background: '#121411',
  onBackground: '#E4E3DD',
  surface: '#121411',
  onSurface: '#E4E3DD',
  surfaceVariant: '#333531',
  onSurfaceVariant: '#C4C7BE',
  surfaceDim: '#121411',
  surfaceBright: '#383A35',
  surfaceContainerLowest: '#0D0F0C',
  surfaceContainerLow: '#1A1C19',
  surfaceContainer: '#1E201D',
  surfaceContainerHigh: '#282A27',
  surfaceContainerHighest: '#333531',
  inverseSurface: '#E4E3DD',
  inverseOnSurface: '#2F312D',
  inversePrimary: '#2C6E36',
  outline: '#8E9288',
  outlineVariant: '#43483F',
  surfaceTint: '#CDEBC6',
  shadow: '#000000',
  scrim: '#000000',

  steps: '#8FD08A',
  onSteps: '#0B2E12',
  stepsContainer: '#1F4A26',
  onStepsContainer: '#CDEBC6',
  food: '#F2A36E',
  onFood: '#4A2004',
  foodContainer: '#5A2A06',
  onFoodContainer: '#FFD9BF',
  food2: '#FFD9BF',
  food3: '#C97A44',
  water: '#8CC4FF',
  onWater: '#0B3A66',
  waterContainer: '#0E3A63',
  onWaterContainer: '#CFE6FF',
  sleep: '#BBA9FF',
  onSleep: '#2C1F5E',
  sleepContainer: '#3A2C78',
  onSleepContainer: '#E3DAFF',
  near: '#F2B33D',
  onNear: '#3D2800',
  nearContainer: '#5A3D00',
  onNearContainer: '#FFE2B0',
  over: '#FFB4AB',
  onOver: '#690005',

  lane: '#393C36',
  tick: '#E4E3DD',
  laneTick: '#A3A69C',
};

/**
 * From the mockup: titles 800, labels 700, body 500 (Jakarta has no light
 * look at 400 on a phone). Weight names map to files in `fonts` below:
 * regular 500, medium 600, semibold 700, bold 800.
 */
const type: TypeScaleShape = {
  displayLarge: { size: 57, line: 64, weight: 'bold', tracking: -1 },
  displayMedium: { size: 45, line: 52, weight: 'bold', tracking: -0.5 },
  displaySmall: { size: 36, line: 44, weight: 'bold', tracking: -0.5 },
  headlineLarge: { size: 32, line: 40, weight: 'bold', tracking: -0.5 },
  headlineMedium: { size: 28, line: 36, weight: 'bold', tracking: -0.3 },
  /** "Today", "Morning walk". */
  headlineSmall: { size: 28, line: 32, weight: 'bold', tracking: -0.3 },
  /** The typed dish, a block's big line. */
  titleLarge: { size: 20, line: 24, weight: 'semibold', tracking: 0 },
  /** A block's label row: "Steps", "Ingredients". */
  titleMedium: { size: 16, line: 24, weight: 'semibold', tracking: 0 },
  titleSmall: { size: 14, line: 20, weight: 'semibold', tracking: 0 },
  bodyLarge: { size: 16, line: 24, weight: 'regular', tracking: 0 },
  bodyMedium: { size: 14, line: 20, weight: 'regular', tracking: 0 },
  bodySmall: { size: 13, line: 16, weight: 'regular', tracking: 0 },
  /** Buttons: 16 at 800. */
  labelLarge: { size: 16, line: 20, weight: 'bold', tracking: 0 },
  /** Tile labels, chips, navigation. */
  labelMedium: { size: 13, line: 16, weight: 'semibold', tracking: 0 },
  labelSmall: { size: 12, line: 16, weight: 'semibold', tracking: 0 },
  /** Today's steps on the leaf block. */
  numeralHero: { size: 48, line: 52, weight: 'semibold', tracking: -1, numeral: true },
  /** The kcal on the food block. */
  numeralLarge: { size: 48, line: 52, weight: 'semibold', tracking: -1, numeral: true },
  /** Food and water tiles. */
  numeralMedium: { size: 28, line: 32, weight: 'semibold', tracking: 0, numeral: true },
  /** Distance, minutes, a macro. */
  numeralSmall: { size: 20, line: 24, weight: 'semibold', tracking: 0, numeral: true },
};

/** Soft and round: 28 dp blocks, 16 dp inner plates, pills everywhere else. */
const radius: RadiusScale = {
  none: 0,
  xs: 12,
  sm: 16,
  md: 28,
  lg: 28,
  xl: 32,
  full: 999,
};

const theme: ThemeDef = {
  id: 'd',
  name: 'Colour blocks',
  description: 'Cheerful solid tiles. Every area has its own colour, so you find it at a glance.',
  mode: 'system',
  colors: { light: schemeFromRoles(light), dark: schemeFromRoles(dark) },
  fonts: {
    regular: { family: 'PlusJakartaSans_500Medium', source: PlusJakartaSans_500Medium },
    medium: { family: 'PlusJakartaSans_600SemiBold', source: PlusJakartaSans_600SemiBold },
    semibold: { family: 'PlusJakartaSans_700Bold', source: PlusJakartaSans_700Bold },
    bold: { family: 'PlusJakartaSans_800ExtraBold', source: PlusJakartaSans_800ExtraBold },
    numeralMedium: { family: 'PlusJakartaSans_700Bold', source: PlusJakartaSans_700Bold },
    numeral: { family: 'PlusJakartaSans_800ExtraBold', source: PlusJakartaSans_800ExtraBold },
  },
  type,
  radius,
  /**
   * D: pill buttons and a 28 dp pill FAB, flat like the blocks.
   */
  style: {
    tile: 'filled',
    hero: 'block',
    bar: 'solid',
    navIndicator: 'tone',
    numeralTabular: true,
    buttonRadius: radius.full,
    buttonHeight: 48,
    buttonCase: 'none',
    chipCase: 'none',
    fabRadius: radius.lg,
    fabShadow: false,
  },
};

export default theme;
