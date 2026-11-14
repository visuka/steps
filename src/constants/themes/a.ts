/**
 * A, Daylight (app-look/project/Main.dc.html).
 *
 * Crisp white, one deep teal, big calm numbers; quiet like a banking app.
 * White cards with a hairline edge on a pale grey ground, the steps ring and
 * every main action in deep teal #0F6E64, secondary text in slate #5B636B.
 * Inter throughout, numerals at 700 (hero) and 600 with tabular figures.
 *
 * The mockup draws every mark in the one teal. Food, water and sleep get
 * their own quiet hues here (amber-brown, blue, indigo) so charts that show
 * several at once stay readable; steps keep the teal.
 *
 * Dark: the same layout on a cool near-black, teal lifted to a light mint.
 */

import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

import { type RadiusScale, schemeFromRoles, type SchemeRoles, type TypeScaleShape } from '../tokens';
import type { ThemeDef } from './types';

const light: SchemeRoles = {
  // The one teal: the ring, "Log food", "Save to lunch", outlined buttons.
  primary: '#0F6E64',
  onPrimary: '#FFFFFF',
  primaryContainer: '#DDEFEB',
  onPrimaryContainer: '#0A4A43',
  secondary: '#4A5259',
  onSecondary: '#FFFFFF',
  // The navigation pill and the selected segment's tint.
  secondaryContainer: '#DDEFEB',
  onSecondaryContainer: '#0A4A43',
  tertiary: '#4F46A0',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#E6E3F7',
  onTertiaryContainer: '#2E2770',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#FCEDEC',
  onErrorContainer: '#8C1D18',
  // Today's ground is pale grey; cards are white with a hairline (tile: 'outlined').
  background: '#F6F7F8',
  onBackground: '#101418',
  surface: '#F6F7F8',
  onSurface: '#101418',
  surfaceVariant: '#E1E6E8',
  onSurfaceVariant: '#5B636B',
  surfaceDim: '#D9DEE2',
  surfaceBright: '#FFFFFF',
  surfaceContainerLowest: '#FFFFFF',
  // Icon plates and the "1 bowl" chip.
  surfaceContainerLow: '#F1F3F4',
  surfaceContainer: '#EEF0F2',
  surfaceContainerHigh: '#E9ECEE',
  surfaceContainerHighest: '#E1E6E8',
  inverseSurface: '#2A3036',
  inverseOnSurface: '#EEF0F2',
  inversePrimary: '#7FD3C6',
  outline: '#737C84',
  // The card and nav-bar hairline.
  outlineVariant: '#E5E8EB',
  surfaceTint: '#0F6E64',
  shadow: '#000000',
  scrim: '#000000',

  steps: '#0F6E64',
  onSteps: '#FFFFFF',
  stepsContainer: '#DDEFEB',
  onStepsContainer: '#0A4A43',
  food: '#9A4F14',
  onFood: '#FFFFFF',
  foodContainer: '#FBEBDD',
  onFoodContainer: '#663005',
  food2: '#6B3A12',
  food3: '#3F230C',
  water: '#1D5F9E',
  onWater: '#FFFFFF',
  waterContainer: '#DDEBF8',
  onWaterContainer: '#0E3A63',
  sleep: '#5348A6',
  onSleep: '#FFFFFF',
  sleepContainer: '#E6E3F7',
  onSleepContainer: '#2E2770',
  // The sodium row: brown on cream with a "High" label.
  near: '#7A4300',
  onNear: '#FFFFFF',
  nearContainer: '#FBF1E1',
  onNearContainer: '#7A4300',
  over: '#B3261E',
  onOver: '#FFFFFF',

  // A touch darker than the mockup's #E7EBED so the lane still shows on grey cards.
  lane: '#CFD5DA',
  tick: '#FFFFFF',
  laneTick: '#5B636B',
};

const dark: SchemeRoles = {
  primary: '#72CFC1',
  onPrimary: '#00382F',
  primaryContainer: '#0F4F47',
  onPrimaryContainer: '#BDEDE5',
  secondary: '#B3C2C8',
  onSecondary: '#1E2A2F',
  secondaryContainer: '#1F3F3A',
  onSecondaryContainer: '#BDEDE5',
  tertiary: '#BBB4F2',
  onTertiary: '#2A2468',
  tertiaryContainer: '#3A3480',
  onTertiaryContainer: '#E3E0FF',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  background: '#0F1316',
  onBackground: '#E6E9EC',
  surface: '#0F1316',
  onSurface: '#E6E9EC',
  surfaceVariant: '#2E353A',
  onSurfaceVariant: '#A9B2B9',
  surfaceDim: '#0F1316',
  surfaceBright: '#353C42',
  surfaceContainerLowest: '#0A0D10',
  surfaceContainerLow: '#161B1F',
  surfaceContainer: '#1B2024',
  surfaceContainerHigh: '#242A2F',
  surfaceContainerHighest: '#2E353A',
  inverseSurface: '#E6E9EC',
  inverseOnSurface: '#2A3036',
  inversePrimary: '#0F6E64',
  outline: '#8A939A',
  outlineVariant: '#343B41',
  surfaceTint: '#72CFC1',
  shadow: '#000000',
  scrim: '#000000',

  steps: '#72CFC1',
  onSteps: '#00382F',
  stepsContainer: '#0F4F47',
  onStepsContainer: '#BDEDE5',
  food: '#F0A56C',
  onFood: '#4A2004',
  foodContainer: '#5A2A06',
  onFoodContainer: '#FFDCC2',
  food2: '#FFD9BF',
  food3: '#C98048',
  water: '#8EC1F5',
  onWater: '#0B3A66',
  waterContainer: '#0E3A63',
  onWaterContainer: '#D3E6FA',
  sleep: '#BBB4F2',
  onSleep: '#2A2468',
  sleepContainer: '#3A3480',
  onSleepContainer: '#E3E0FF',
  near: '#F2B33D',
  onNear: '#3D2800',
  nearContainer: '#5A3D00',
  onNearContainer: '#FFE2B0',
  over: '#FFB4AB',
  onOver: '#690005',

  lane: '#353C42',
  tick: '#E6E9EC',
  laneTick: '#9AA3AA',
};

/**
 * From the mockup: 13 labels, 15 body, 18 row values and titles, 24 date
 * and stat numbers, 48 for the big numbers. Titles 600, body 400.
 * Numerals: weight medium maps to Inter 600 (stat numbers), bold to 700 (hero).
 * Tracking: the mockup's -0.01em and -0.03em, in dp.
 */
const type: TypeScaleShape = {
  displayLarge: { size: 57, line: 64, weight: 'bold', tracking: -1.2 },
  displayMedium: { size: 45, line: 52, weight: 'bold', tracking: -0.9 },
  displaySmall: { size: 36, line: 44, weight: 'bold', tracking: -0.7 },
  headlineLarge: { size: 32, line: 40, weight: 'semibold', tracking: -0.3 },
  headlineMedium: { size: 28, line: 36, weight: 'semibold', tracking: -0.3 },
  /** "Fri, 14 Nov". */
  headlineSmall: { size: 24, line: 32, weight: 'semibold', tracking: -0.24 },
  /** The dish name, "Morning walk · 7:10 am", row values. */
  titleLarge: { size: 18, line: 24, weight: 'semibold', tracking: 0 },
  titleMedium: { size: 16, line: 24, weight: 'semibold', tracking: 0 },
  /** Section labels: "Ingredients", "Parts". */
  titleSmall: { size: 13, line: 16, weight: 'semibold', tracking: 0 },
  bodyLarge: { size: 16, line: 24, weight: 'regular', tracking: 0 },
  /** Row text: "Food", "Morning walk", ingredient lines. */
  bodyMedium: { size: 15, line: 20, weight: 'regular', tracking: 0 },
  bodySmall: { size: 13, line: 16, weight: 'regular', tracking: 0 },
  /** Buttons: 15 to 18 at 600 in the mockup. */
  labelLarge: { size: 16, line: 20, weight: 'semibold', tracking: 0 },
  /** Navigation, "of goal", "distance". */
  labelMedium: { size: 13, line: 16, weight: 'semibold', tracking: 0 },
  labelSmall: { size: 12, line: 16, weight: 'medium', tracking: 0 },
  /** 6,240 inside the ring. */
  numeralHero: { size: 48, line: 52, weight: 'bold', tracking: -1.4, numeral: true },
  /** 412 kcal. */
  numeralLarge: { size: 48, line: 52, weight: 'bold', tracking: -1.4, numeral: true },
  /** 78 %, 4.6 km, 13:55 /km. */
  numeralMedium: { size: 24, line: 32, weight: 'medium', tracking: -0.24, numeral: true },
  /** 1,280 kcal, 38 g, 6 h 50 m. */
  numeralSmall: { size: 18, line: 24, weight: 'medium', tracking: 0, numeral: true },
};

/** 24 dp cards, 12 dp icon plates and rows, 16 dp chips, 28 dp for the 56 dp buttons. */
const radius: RadiusScale = {
  none: 0,
  xs: 12,
  sm: 16,
  md: 24,
  lg: 28,
  xl: 32,
  full: 999,
};

const theme: ThemeDef = {
  id: 'a',
  name: 'Daylight',
  description: 'Clean and bright. White cards, a ring for steps.',
  mode: 'system',
  colors: { light: schemeFromRoles(light), dark: schemeFromRoles(dark) },
  fonts: {
    regular: { family: 'Inter_400Regular', source: Inter_400Regular },
    medium: { family: 'Inter_500Medium', source: Inter_500Medium },
    semibold: { family: 'Inter_600SemiBold', source: Inter_600SemiBold },
    bold: { family: 'Inter_700Bold', source: Inter_700Bold },
    numeralMedium: { family: 'Inter_600SemiBold', source: Inter_600SemiBold },
    numeral: { family: 'Inter_700Bold', source: Inter_700Bold },
  },
  type,
  radius,
  /**
   * A: pill buttons 48 dp (56 in the mockup's bottom bar), the Log food FAB a 28 dp pill, flat.
   */
  style: {
    tile: 'outlined',
    hero: 'ring',
    bar: 'solid',
    navIndicator: 'neutral',
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
