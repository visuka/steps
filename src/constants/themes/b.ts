/**
 * B, Night matte (app-look/project/B-Night.dc.html). Dark only.
 *
 * Quiet and matte, like a watch face at night: a blue-black ground
 * (#121417) with flat graphite plates (#1B1E22), chalk text and muted,
 * soft data colours (sage steps, sand food, slate-blue water, lilac sleep,
 * salmon for over). The one main button is sage with dark ink. Big
 * Manrope numerals at 800 with tabular figures; the steps hero is a ring.
 *
 * Changes from the mockup, for the contrast rules:
 * - outline is lifted to #7A8088 (the mockup's #3A414A borders are 1.6:1);
 *   #2E3339 stays as outlineVariant for hairlines and dividers.
 * - the lane is #2D3238 (mockup #2A2F35) so it shows 1.25:1 on a #1B1E22 card.
 * - the selected segment uses secondaryContainer (the sage nav pill,
 *   #2F3D32) instead of the mockup's chalk-white pill.
 * - near (amber) is not in the mockup; it is a warmer, stronger amber than food.
 */

import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';

import { type RadiusScale, schemeFromRoles, type SchemeRoles, type TypeScaleShape } from '../tokens';
import type { ThemeDef } from './types';

const night: SchemeRoles = {
  // "Log food", "Save to lunch": sage with the ground colour as ink.
  primary: '#A3C4A4',
  onPrimary: '#121417',
  primaryContainer: '#2F3D32',
  onPrimaryContainer: '#C8DEC8',
  secondary: '#A3A09A',
  onSecondary: '#121417',
  // The navigation pill, tonal buttons and the selected segment.
  secondaryContainer: '#2F3D32',
  onSecondaryContainer: '#C8DEC8',
  tertiary: '#B6AEDB',
  onTertiary: '#121417',
  tertiaryContainer: '#312D40',
  onTertiaryContainer: '#DCD7F0',
  error: '#F2A8A0',
  onError: '#3A1512',
  errorContainer: '#3F2523',
  onErrorContainer: '#F8CFCA',
  background: '#121417',
  onBackground: '#ECEAE6',
  surface: '#121417',
  onSurface: '#ECEAE6',
  surfaceVariant: '#2A2F35',
  onSurfaceVariant: '#A3A09A',
  surfaceDim: '#0B0C0E',
  surfaceBright: '#2A2F35',
  surfaceContainerLowest: '#0B0C0E',
  surfaceContainerLow: '#17191C',
  // Cards, tiles and the navigation bar.
  surfaceContainer: '#1B1E22',
  // Secondary buttons ("+1 glass", "Keep").
  surfaceContainerHigh: '#24282D',
  surfaceContainerHighest: '#2A2F35',
  inverseSurface: '#ECEAE6',
  inverseOnSurface: '#1B1E22',
  inversePrimary: '#3E6B44',
  outline: '#7A8088',
  outlineVariant: '#2E3339',
  surfaceTint: '#A3C4A4',
  shadow: '#000000',
  scrim: '#000000',

  steps: '#A3C4A4',
  onSteps: '#121417',
  stepsContainer: '#2F3D32',
  onStepsContainer: '#C8DEC8',
  food: '#E0BC86',
  onFood: '#121417',
  foodContainer: '#3A3324',
  onFoodContainer: '#F0DCB8',
  food2: '#F3DDB8',
  food3: '#B8935C',
  water: '#7E98BC',
  onWater: '#121417',
  waterContainer: '#26303D',
  onWaterContainer: '#CCD9EC',
  sleep: '#B6AEDB',
  onSleep: '#121417',
  sleepContainer: '#312D40',
  onSleepContainer: '#DCD7F0',
  near: '#F2B54A',
  onNear: '#121417',
  nearContainer: '#3D3220',
  onNearContainer: '#F8DDB0',
  // The mockup's "High" sodium: salmon on #3A2A24.
  over: '#F0A58C',
  onOver: '#121417',

  lane: '#2D3238',
  tick: '#121417',
  laneTick: '#8A9098',
};

/**
 * From the mockup: numbers and titles 800, labels and buttons 700 to 800,
 * body 600, quiet secondary text 400. Weight names map to files in `fonts`:
 * regular 400, medium 600, semibold 700, bold 800.
 */
const type: TypeScaleShape = {
  displayLarge: { size: 57, line: 64, weight: 'bold', tracking: -1 },
  displayMedium: { size: 45, line: 52, weight: 'bold', tracking: -0.5 },
  displaySmall: { size: 36, line: 44, weight: 'bold', tracking: -0.5 },
  headlineLarge: { size: 32, line: 40, weight: 'bold', tracking: -0.5 },
  headlineMedium: { size: 28, line: 36, weight: 'bold', tracking: -0.3 },
  /** "Fri, 14 Nov". */
  headlineSmall: { size: 22, line: 28, weight: 'bold', tracking: 0 },
  titleLarge: { size: 20, line: 28, weight: 'bold', tracking: 0 },
  /** The typed dish, "Morning walk · 7:10 am". */
  titleMedium: { size: 16, line: 24, weight: 'semibold', tracking: 0 },
  titleSmall: { size: 14, line: 20, weight: 'semibold', tracking: 0 },
  bodyLarge: { size: 16, line: 24, weight: 'medium', tracking: 0 },
  /** List rows: "Dried anchovy", "Sodium". */
  bodyMedium: { size: 14, line: 20, weight: 'medium', tracking: 0 },
  bodySmall: { size: 12, line: 16, weight: 'medium', tracking: 0 },
  /** Buttons: 16 at 800. */
  labelLarge: { size: 16, line: 20, weight: 'bold', tracking: 0 },
  /** Small caps-style labels ("FOOD", "INGREDIENTS") and navigation. */
  labelMedium: { size: 12, line: 16, weight: 'semibold', tracking: 0.8 },
  labelSmall: { size: 12, line: 16, weight: 'medium', tracking: 0.4 },
  /** Today's steps inside the ring. */
  numeralHero: { size: 48, line: 52, weight: 'bold', tracking: -1.5, numeral: true },
  /** The kcal of a dish, a walk's distance. */
  numeralLarge: { size: 48, line: 52, weight: 'bold', tracking: -1.5, numeral: true },
  /** Food and sleep tiles, walk stats. */
  numeralMedium: { size: 22, line: 28, weight: 'bold', tracking: 0, numeral: true },
  /** A macro's grams. */
  numeralSmall: { size: 16, line: 20, weight: 'bold', tracking: 0, numeral: true },
};

/** Soft: 20 dp cards, 16 dp inner tiles and pills, 28 dp for the main buttons. */
const radius: RadiusScale = {
  none: 0,
  xs: 12,
  sm: 16,
  md: 20,
  lg: 28,
  xl: 32,
  full: 999,
};

const scheme = schemeFromRoles(night);

const theme: ThemeDef = {
  id: 'b',
  name: 'Night',
  description: 'Matte and dark, easy on the eyes at any hour.',
  mode: 'dark',
  colors: { light: scheme, dark: scheme },
  fonts: {
    regular: { family: 'Manrope_400Regular', source: Manrope_400Regular },
    medium: { family: 'Manrope_600SemiBold', source: Manrope_600SemiBold },
    semibold: { family: 'Manrope_700Bold', source: Manrope_700Bold },
    bold: { family: 'Manrope_800ExtraBold', source: Manrope_800ExtraBold },
    numeralMedium: { family: 'Manrope_700Bold', source: Manrope_700Bold },
    numeral: { family: 'Manrope_800ExtraBold', source: Manrope_800ExtraBold },
  },
  type,
  radius,
  /**
   * B: pill buttons and a 28 dp pill FAB, flat on the matte ground.
   */
  style: {
    tile: 'plain',
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
