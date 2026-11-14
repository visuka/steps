/**
 * A, Daylight (app-look/project/Main.dc.html). Light only, as mocked.
 *
 * Crisp white, one deep teal, big calm numbers; quiet like a banking app.
 * White cards with a hairline edge on a pale grey ground (#F6F7F8 on Today,
 * white on a food result and a walk), the steps ring, every bar and every
 * main action in the one teal #0F6E64, secondary text in slate #5B636B.
 * Inter throughout, numerals at 700 (hero) and 600 with tabular figures.
 *
 * Every data mark is the one teal, as drawn (food bar, water dots, macro
 * bars); food, water and sleep are told apart by their labels and icons.
 *
 * Changes from the mockup, for the contrast rules:
 * - the lane is #CFD5DA (mockup #E7EBED, 1.1:1 on the grey ground) so it
 *   shows 1.25:1 on every card and the teal stays 3:1 on it.
 */

import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

import { type RadiusScale, schemeFromRoles, type SchemeRoles, type TypeScaleShape } from '../tokens';
import type { ThemeDef } from './types';

const TEAL = '#0F6E64';

const light: SchemeRoles = {
  // The one teal: the ring, "Log food", "Save to lunch", outlined buttons.
  primary: TEAL,
  onPrimary: '#FFFFFF',
  primaryContainer: '#DDEFEB',
  onPrimaryContainer: '#0A4A43',
  secondary: '#4A5259',
  onSecondary: '#FFFFFF',
  // The navigation pill.
  secondaryContainer: '#DDEFEB',
  onSecondaryContainer: '#0A4A43',
  tertiary: '#4A5259',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#EDEFF1',
  onTertiaryContainer: '#101418',
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
  // Icon plates, the "1 bowl" chip and the segmented control's well.
  surfaceContainerLow: '#F1F3F4',
  surfaceContainer: '#EDEFF1',
  surfaceContainerHigh: '#E7EBED',
  surfaceContainerHighest: '#E1E6E8',
  inverseSurface: '#2A3036',
  inverseOnSurface: '#EDEFF1',
  inversePrimary: '#7FD3C6',
  outline: '#737C84',
  // The card, row and nav-bar hairline.
  outlineVariant: '#E5E8EB',
  surfaceTint: TEAL,
  shadow: '#000000',
  scrim: '#000000',

  steps: TEAL,
  onSteps: '#FFFFFF',
  stepsContainer: '#DDEFEB',
  onStepsContainer: '#0A4A43',
  // Food, water and sleep marks: the same teal, as drawn.
  food: TEAL,
  onFood: '#FFFFFF',
  foodContainer: '#DDEFEB',
  onFoodContainer: '#0A4A43',
  food2: '#0A4A43',
  food3: '#5B636B',
  water: TEAL,
  onWater: '#FFFFFF',
  waterContainer: '#DDEFEB',
  onWaterContainer: '#0A4A43',
  sleep: TEAL,
  onSleep: '#FFFFFF',
  sleepContainer: '#DDEFEB',
  onSleepContainer: '#0A4A43',
  // The sodium row: brown on cream, with a brown "High" chip.
  near: '#7A4300',
  onNear: '#FFFFFF',
  nearContainer: '#FBF1E1',
  onNearContainer: '#7A4300',
  over: '#B3261E',
  onOver: '#FFFFFF',

  lane: '#CFD5DA',
  tick: '#FFFFFF',
  laneTick: '#5B636B',
};

/**
 * The mockup's scale: 13/16 labels, 15/20 body, 18/24 row values, titles and
 * buttons, 24/32 the date and stat numbers, 48/48 the big numbers. Titles
 * 600, body 400. Tracking: -0.01em and -0.03em, in dp.
 */
const type: TypeScaleShape = {
  displayLarge: { size: 57, line: 64, weight: 'bold', tracking: -1.7 },
  displayMedium: { size: 45, line: 52, weight: 'bold', tracking: -1.35 },
  displaySmall: { size: 36, line: 44, weight: 'bold', tracking: -1.08 },
  headlineLarge: { size: 32, line: 40, weight: 'semibold', tracking: -0.32 },
  headlineMedium: { size: 28, line: 36, weight: 'semibold', tracking: -0.28 },
  /** "Fri, 14 Nov": 24/32 at 600, -0.01em. */
  headlineSmall: { size: 24, line: 32, weight: 'semibold', tracking: -0.24 },
  /** The dish name, "Morning walk · 7:10 am", row values: 18/24 at 600. */
  titleLarge: { size: 18, line: 24, weight: 'semibold', tracking: 0 },
  /** "Walk 28 min" row, "6 h 50 m": 18/24 at 500. */
  titleMedium: { size: 18, line: 24, weight: 'medium', tracking: 0 },
  /** Section labels: "Ingredients", "Parts": 13/16 at 600. */
  titleSmall: { size: 13, line: 16, weight: 'semibold', tracking: 0 },
  bodyLarge: { size: 15, line: 24, weight: 'regular', tracking: 0 },
  /** Row text: "Food", "Morning walk", ingredient lines: 15/20. */
  bodyMedium: { size: 15, line: 20, weight: 'regular', tracking: 0 },
  /** "of goal", "distance", the note line: 13/16. */
  bodySmall: { size: 13, line: 16, weight: 'regular', tracking: 0 },
  /** Main buttons: 18 at 600. */
  labelLarge: { size: 18, line: 24, weight: 'semibold', tracking: 0 },
  /** Navigation, chips: 13/16 at 600. */
  labelMedium: { size: 13, line: 16, weight: 'semibold', tracking: 0 },
  labelSmall: { size: 13, line: 16, weight: 'regular', tracking: 0 },
  /** 6,240 inside the ring: 48/48 at 700, -0.03em. */
  numeralHero: { size: 48, line: 48, weight: 'bold', tracking: -1.44, numeral: true },
  /** 412 kcal. */
  numeralLarge: { size: 48, line: 48, weight: 'bold', tracking: -1.44, numeral: true },
  /** 78 %, 4.6 km, 2.3 km, 13:55 /km: 24/32 at 600, -0.01em. */
  numeralMedium: { size: 24, line: 32, weight: 'medium', tracking: -0.24, numeral: true },
  /** 1,280 kcal, 38 g: 18/24 at 600. */
  numeralSmall: { size: 18, line: 24, weight: 'medium', tracking: 0, numeral: true },
};

/** 24 dp cards, 12 dp icon plates, 16 dp chips, 20 dp map and segments, 28 dp for the 56 dp buttons. */
const radius: RadiusScale = {
  none: 0,
  xs: 12,
  sm: 16,
  md: 24,
  lg: 28,
  xl: 32,
  full: 999,
};

const scheme = schemeFromRoles(light);

const theme: ThemeDef = {
  id: 'a',
  name: 'Daylight',
  description: 'Clean and bright. White cards, a ring for steps.',
  mode: 'light',
  colors: { light: scheme, dark: scheme },
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
  /** A: pill buttons, 56 dp main actions with 18 dp labels, 48 dp row buttons with 15 dp labels, flat. */
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
    actionHeight: 56,
    compactLabel: { size: 15, line: 20, weight: 'semibold' },
    filledRole: 'primary',
    outlined: { border: 'primary', fill: '#FFFFFF', ink: 'primary' },
    overline: { size: 13, line: 16, weight: 'semibold', tracking: 0, case: 'none', color: 'onSurfaceVariant' },
    segment: {
      height: 48,
      well: 'surfaceContainerLow',
      wellBorder: null,
      radius: 24,
      pad: 4,
      selected: '#FFFFFF',
      onSelected: 'primary',
      selectedBorder: '#DDE2E5',
      selectedRadius: 20,
      idle: 'onSurfaceVariant',
      divider: null,
      check: false,
      label: { size: 15, weight: 'medium', selectedWeight: 'semibold' },
    },
    nav: {
      height: 80,
      background: '#FFFFFF',
      border: 'outlineVariant',
      pill: 'primaryContainer',
      onPill: 'primary',
      pillWidth: 56,
      active: 'primary',
      idle: 'onSurfaceVariant',
      label: { size: 13, line: 16, weight: 'regular', activeWeight: 'semibold' },
    },
  },
  // The mockup's map: grey land, white streets, a pale green park, the teal route.
  map: {
    base: 'light',
    land: '#F1F3F4',
    road: '#FFFFFF',
    minorRoad: '#FFFFFF',
    park: '#E4EBE8',
    water: '#DCE7EC',
    building: '#E7EBED',
    label: '#5B636B',
    border: '#E5E8EB',
    radius: 20,
    height: 184,
    route: TEAL,
    routeWidth: 4,
    casing: null,
    start: '#FFFFFF',
    startRing: TEAL,
    end: TEAL,
    endRing: '#FFFFFF',
  },
};

export default theme;
