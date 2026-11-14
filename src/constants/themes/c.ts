/**
 * C, Ink and saffron (app-look/project/C-Ink.dc.html).
 *
 * Calm and editorial: warm paper, indigo ink, one saffron highlight. Areas are
 * set apart by hairlines and small saffron overlines, not by coloured plates.
 * Today's steps are a big serif number over a ten-segment saffron bar; food
 * bars are ink. The main button is solid ink with paper text, the rest are
 * ink outlines. Inter for the interface, Fraunces 600 for numbers and titles.
 *
 * Changes from the mockup, so every pair passes the contrast tests:
 * - The bar saffron #C9821B is 2.9:1 on paper and 2.3:1 on the lane, so the
 *   steps mark is the deeper saffron #A0640E (4.4:1 on paper, 3.2:1 on the lane).
 * - The empty lane #E4DDD0 is only 1.23:1 on paper, so it is #D9D1C2 (1.38:1).
 * - The mockup shows no water, sleep or warning marks and no dark scheme;
 *   those are designed here in the same ink, slate and rust family. Dark is
 *   "ink at night": paper-coloured text on deep indigo, saffron lifted.
 *
 * Fraunces titles: display, headline and titleLarge are marked `display`, so
 * they are set in the numeral face (Fraunces 600). `bold` is Inter 600 (the
 * mockup never uses Inter above 600), so the navigation bar's active label and
 * React Navigation's heavy header stay Inter.
 */

import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';

import { type RadiusScale, schemeFromRoles, type SchemeRoles, type TypeScaleShape } from '../tokens';
import type { ThemeDef } from './types';

const light: SchemeRoles = {
  // Solid ink, as the mockup's "Log food" and "Save to lunch", with paper text.
  primary: '#1F2A44',
  onPrimary: '#F7F4EE',
  primaryContainer: '#E3E6EE',
  onPrimaryContainer: '#1F2A44',
  secondary: '#4E5465',
  onSecondary: '#FFFFFF',
  // The navigation pill and tonal buttons: the mockup's warm #EADCC4.
  secondaryContainer: '#EADCC4',
  onSecondaryContainer: '#1F2A44',
  // The saffron of the overlines ("STEPS", "RECENT").
  tertiary: '#8A5A12',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#F3E3C4',
  onTertiaryContainer: '#4A3008',
  // The rust of the sodium warning and its chip.
  error: '#8E3218',
  onError: '#FFFFFF',
  errorContainer: '#F3DED4',
  onErrorContainer: '#8E3218',
  background: '#F7F4EE',
  onBackground: '#1F2A44',
  surface: '#F7F4EE',
  onSurface: '#1F2A44',
  surfaceVariant: '#E4DDD0',
  onSurfaceVariant: '#4E5465',
  surfaceDim: '#DDD6C9',
  surfaceBright: '#FBF9F5',
  surfaceContainerLowest: '#FBF9F5',
  surfaceContainerLow: '#F3EFE8',
  surfaceContainer: '#F0EBE2',
  surfaceContainerHigh: '#EAE4D8',
  surfaceContainerHighest: '#E4DDD0',
  inverseSurface: '#1F2A44',
  inverseOnSurface: '#F7F4EE',
  inversePrimary: '#E3B867',
  outline: '#6E675B',
  // The hairlines between rows and around the map.
  outlineVariant: '#DCD5C8',
  surfaceTint: '#1F2A44',
  shadow: '#000000',
  scrim: '#000000',

  steps: '#A0640E',
  onSteps: '#FFFFFF',
  stepsContainer: '#F3E3C4',
  onStepsContainer: '#5A3A08',
  // Food bars are ink in the mockup; the split bar adds slate and saffron brown.
  food: '#1F2A44',
  onFood: '#F7F4EE',
  foodContainer: '#E3E6EE',
  onFoodContainer: '#1F2A44',
  food2: '#5C6B8A',
  food3: '#8A5A12',
  water: '#2F5A8A',
  onWater: '#FFFFFF',
  waterContainer: '#DCE6F0',
  onWaterContainer: '#173A5E',
  sleep: '#5E4A7A',
  onSleep: '#FFFFFF',
  sleepContainer: '#E6DFEE',
  onSleepContainer: '#3A2A52',
  near: '#8A5A12',
  onNear: '#FFFFFF',
  nearContainer: '#F5E3BF',
  onNearContainer: '#4A3008',
  over: '#8E3218',
  onOver: '#FFFFFF',

  lane: '#D9D1C2',
  // The gaps between bar segments are paper.
  tick: '#F7F4EE',
  laneTick: '#6E675B',
};

const dark: SchemeRoles = {
  primary: '#EDE7DB',
  onPrimary: '#1F2A44',
  primaryContainer: '#2E3A58',
  onPrimaryContainer: '#E3E6EE',
  secondary: '#B9BCC8',
  onSecondary: '#232A3B',
  secondaryContainer: '#3E3527',
  onSecondaryContainer: '#F2E6CF',
  tertiary: '#E6B35A',
  onTertiary: '#3A2604',
  tertiaryContainer: '#4A3610',
  onTertiaryContainer: '#F5E3BF',
  error: '#F2A48C',
  onError: '#4A1608',
  errorContainer: '#5C2414',
  onErrorContainer: '#F8D9CE',
  background: '#161C2C',
  onBackground: '#EDE7DB',
  surface: '#161C2C',
  onSurface: '#EDE7DB',
  surfaceVariant: '#323A4F',
  onSurfaceVariant: '#B9BCC8',
  surfaceDim: '#161C2C',
  surfaceBright: '#363E54',
  surfaceContainerLowest: '#10151F',
  surfaceContainerLow: '#1B2232',
  surfaceContainer: '#1F2637',
  surfaceContainerHigh: '#283044',
  surfaceContainerHighest: '#323A4F',
  inverseSurface: '#EDE7DB',
  inverseOnSurface: '#1F2A44',
  inversePrimary: '#8A5A12',
  outline: '#8C93A6',
  outlineVariant: '#343C51',
  surfaceTint: '#EDE7DB',
  shadow: '#000000',
  scrim: '#000000',

  steps: '#E3A43F',
  onSteps: '#2A1A02',
  stepsContainer: '#4A3610',
  onStepsContainer: '#F5E3BF',
  food: '#C9D0E2',
  onFood: '#1F2A44',
  foodContainer: '#2E3A58',
  onFoodContainer: '#E3E6EE',
  food2: '#8FA0C4',
  food3: '#D9A869',
  water: '#8DB8E6',
  onWater: '#102A46',
  waterContainer: '#1E3A5A',
  onWaterContainer: '#DCE6F0',
  sleep: '#C4AEE0',
  onSleep: '#2E2045',
  sleepContainer: '#3A2E52',
  onSleepContainer: '#E6DFEE',
  near: '#E8BE6A',
  onNear: '#3A2604',
  nearContainer: '#4A3610',
  onNearContainer: '#F5E3BF',
  over: '#F2A48C',
  onOver: '#4A1608',

  lane: '#3A4359',
  tick: '#161C2C',
  laneTick: '#A3A8B8',
};

/**
 * From the mockup: titles Fraunces 600 at 22/28, body Inter 400 at 16/24 and
 * 14/20, labels Inter 600, overlines and navigation 12/16, big numerals
 * Fraunces 600 at 48/56, small ones 22/28. Weight names map to files in
 * `fonts` below: regular Inter 400, medium Inter 500, semibold Inter 600,
 * and display, headline and titleLarge set in the numeral face (Fraunces 600).
 * `bold` is Inter 600 (the mockup has no Inter 700), so a fontWeight 700 on UI
 * text, such as the navigation bar's active label, stays Inter.
 */
const type: TypeScaleShape = {
  displayLarge: { size: 57, line: 64, weight: 'semibold', tracking: -0.5, display: true },
  displayMedium: { size: 45, line: 52, weight: 'semibold', tracking: -0.25, display: true },
  displaySmall: { size: 36, line: 44, weight: 'semibold', tracking: 0, display: true },
  headlineLarge: { size: 32, line: 40, weight: 'semibold', tracking: 0, display: true },
  headlineMedium: { size: 28, line: 36, weight: 'semibold', tracking: 0, display: true },
  /** "Today", "Morning walk · 7:10 am". */
  headlineSmall: { size: 22, line: 28, weight: 'semibold', tracking: 0, display: true },
  /** The typed dish. */
  titleLarge: { size: 22, line: 28, weight: 'semibold', tracking: 0, display: true },
  /** Row names: "Food", "Water", "1 bowl", "Sodium". */
  titleMedium: { size: 16, line: 24, weight: 'semibold', tracking: 0 },
  titleSmall: { size: 14, line: 20, weight: 'semibold', tracking: 0 },
  bodyLarge: { size: 16, line: 24, weight: 'regular', tracking: 0 },
  bodyMedium: { size: 14, line: 20, weight: 'regular', tracking: 0 },
  bodySmall: { size: 12, line: 16, weight: 'regular', tracking: 0 },
  /** Buttons: 16/24 at 600. */
  labelLarge: { size: 16, line: 24, weight: 'semibold', tracking: 0 },
  /** Chips and segmented buttons: 14/20 at 600. */
  labelMedium: { size: 14, line: 20, weight: 'semibold', tracking: 0 },
  /** Navigation labels and the small overlines (the mockup sets those in capitals, 0.12em). */
  labelSmall: { size: 12, line: 16, weight: 'semibold', tracking: 0.5 },
  /** Today's steps. */
  numeralHero: { size: 48, line: 56, weight: 'semibold', tracking: 0, numeral: true },
  /** A dish's kcal, the walk's distance. */
  numeralLarge: { size: 48, line: 56, weight: 'semibold', tracking: 0, numeral: true },
  numeralMedium: { size: 28, line: 36, weight: 'semibold', tracking: 0, numeral: true },
  /** Food, water, sleep figures in a row; distance, minutes, a macro. */
  numeralSmall: { size: 22, line: 28, weight: 'semibold', tracking: 0, numeral: true },
};

/** Quiet corners: 12 dp buttons, fields and cards, 8 dp chips and segments. */
const radius: RadiusScale = {
  none: 0,
  xs: 12,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 16,
  full: 999,
};

const theme: ThemeDef = {
  id: 'c',
  name: 'Ink and saffron',
  description: 'Paper and ink, with saffron for the numbers that matter.',
  mode: 'system',
  colors: { light: schemeFromRoles(light), dark: schemeFromRoles(dark) },
  fonts: {
    regular: { family: 'Inter_400Regular', source: Inter_400Regular },
    medium: { family: 'Inter_500Medium', source: Inter_500Medium },
    semibold: { family: 'Inter_600SemiBold', source: Inter_600SemiBold },
    bold: { family: 'Inter_600SemiBold', source: Inter_600SemiBold },
    numeralMedium: { family: 'Fraunces_600SemiBold', source: Fraunces_600SemiBold },
    numeral: { family: 'Fraunces_600SemiBold', source: Fraunces_600SemiBold },
  },
  type,
  radius,
  /**
   * C: 12 dp corners on every button and the FAB (the mockup's squared ink buttons), flat.
   */
  style: {
    tile: 'outlined',
    hero: 'bar',
    bar: 'segmented',
    navIndicator: 'neutral',
    numeralTabular: true,
    buttonRadius: 12,
    buttonHeight: 48,
    buttonCase: 'none',
    chipCase: 'none',
    fabRadius: 12,
    fabShadow: false,
  },
};

export default theme;
