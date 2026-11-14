/**
 * F, Sport data (app-look/project/F-Sport.dc.html).
 *
 * Feels like a pro training app: crisp numbers, thin rules, one orange
 * signal. Chrome is ink and white with hairline greys; the one colour is
 * the orange of today's steps. Food and water are drawn in ink, sleep in
 * graphite; near and over keep amber and red, always with a label too.
 * Inter Tight for words, Oswald for numbers (tabular figures).
 *
 * The mockup's orange #FF6A1A is only 2.9:1 on white, so the light scheme
 * marks steps in a deeper #D4520E (3:1 on the lane, 4.6:1 under ink text);
 * the dark scheme uses #FF6A1A as drawn. The main button is ink (light) or
 * white (dark): the mockup's orange button would fail 4.5:1 as text colour.
 *
 * Dark: the mockup's black hero card as the whole ground (#0E0E0E), white
 * text, #A3A3A3 labels, #333333 rules and a #3A3A3A lane.
 */

import { InterTight_400Regular } from '@expo-google-fonts/inter-tight/400Regular';
import { InterTight_500Medium } from '@expo-google-fonts/inter-tight/500Medium';
import { InterTight_600SemiBold } from '@expo-google-fonts/inter-tight/600SemiBold';
import { Oswald_500Medium } from '@expo-google-fonts/oswald/500Medium';
import { Oswald_600SemiBold } from '@expo-google-fonts/oswald/600SemiBold';

import { type RadiusScale, schemeFromRoles, type SchemeRoles, type TypeScaleShape } from '../tokens';
import type { ThemeDef } from './types';

const light: SchemeRoles = {
  // Ink buttons, as the mockup's outlined and filled controls.
  primary: '#0E0E0E',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EDEDED',
  onPrimaryContainer: '#0E0E0E',
  secondary: '#3D3D3D',
  onSecondary: '#FFFFFF',
  // The selected segment and the navigation pill: solid ink, white icon.
  secondaryContainer: '#0E0E0E',
  onSecondaryContainer: '#FFFFFF',
  // The orange signal, for an accent button with ink text.
  tertiary: '#D4520E',
  onTertiary: '#0E0E0E',
  tertiaryContainer: '#FFE1CF',
  onTertiaryContainer: '#4A1C00',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#FFE4E0',
  onErrorContainer: '#8C1D18',
  background: '#FFFFFF',
  onBackground: '#0E0E0E',
  surface: '#FFFFFF',
  onSurface: '#0E0E0E',
  surfaceVariant: '#EDEDED',
  onSurfaceVariant: '#6B6B6B',
  surfaceDim: '#DCDCDC',
  surfaceBright: '#FFFFFF',
  // Near-white steps, so the mockup's #6B6B6B labels keep 4.5:1 on all of them.
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FAFAFA',
  surfaceContainer: '#F5F5F5',
  surfaceContainerHigh: '#F0F0F0',
  surfaceContainerHighest: '#EDEDED',
  // The mockup's black hero card.
  inverseSurface: '#0E0E0E',
  inverseOnSurface: '#FFFFFF',
  inversePrimary: '#FF6A1A',
  outline: '#8A8A8A',
  outlineVariant: '#E3E3E3',
  surfaceTint: '#0E0E0E',
  shadow: '#000000',
  scrim: '#000000',

  steps: '#D4520E',
  onSteps: '#0E0E0E',
  stepsContainer: '#FFE1CF',
  onStepsContainer: '#4A1C00',
  food: '#0E0E0E',
  onFood: '#FFFFFF',
  foodContainer: '#EDEDED',
  onFoodContainer: '#0E0E0E',
  // Split bar: ink, orange, grey (the mockup's carbs, protein, fat in one family).
  food2: '#D4520E',
  food3: '#6B6B6B',
  water: '#3D3D3D',
  onWater: '#FFFFFF',
  waterContainer: '#EDEDED',
  onWaterContainer: '#0E0E0E',
  sleep: '#6B6B6B',
  onSleep: '#FFFFFF',
  sleepContainer: '#EDEDED',
  onSleepContainer: '#0E0E0E',
  near: '#9A5500',
  onNear: '#FFFFFF',
  nearContainer: '#FFE6C2',
  onNearContainer: '#3D2800',
  over: '#B3261E',
  onOver: '#FFFFFF',

  lane: '#DCDCDC',
  tick: '#FFFFFF',
  laneTick: '#6B6B6B',
};

const dark: SchemeRoles = {
  primary: '#FFFFFF',
  onPrimary: '#0E0E0E',
  primaryContainer: '#2E2E2E',
  onPrimaryContainer: '#FFFFFF',
  secondary: '#C2C2C2',
  onSecondary: '#0E0E0E',
  secondaryContainer: '#F2F2F2',
  onSecondaryContainer: '#0E0E0E',
  tertiary: '#FF6A1A',
  onTertiary: '#0E0E0E',
  tertiaryContainer: '#4A2006',
  onTertiaryContainer: '#FFD9C2',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  background: '#0E0E0E',
  onBackground: '#FFFFFF',
  surface: '#0E0E0E',
  onSurface: '#FFFFFF',
  surfaceVariant: '#2E2E2E',
  onSurfaceVariant: '#A3A3A3',
  surfaceDim: '#0E0E0E',
  surfaceBright: '#333333',
  surfaceContainerLowest: '#080808',
  surfaceContainerLow: '#141414',
  surfaceContainer: '#1A1A1A',
  surfaceContainerHigh: '#242424',
  surfaceContainerHighest: '#2E2E2E',
  inverseSurface: '#F2F2F2',
  inverseOnSurface: '#0E0E0E',
  inversePrimary: '#0E0E0E',
  outline: '#8A8A8A',
  outlineVariant: '#333333',
  surfaceTint: '#FFFFFF',
  shadow: '#000000',
  scrim: '#000000',

  steps: '#FF6A1A',
  onSteps: '#0E0E0E',
  stepsContainer: '#4A2006',
  onStepsContainer: '#FFD9C2',
  food: '#F2F2F2',
  onFood: '#0E0E0E',
  foodContainer: '#2E2E2E',
  onFoodContainer: '#F2F2F2',
  food2: '#FF6A1A',
  food3: '#8A8A8A',
  water: '#C2C2C2',
  onWater: '#0E0E0E',
  waterContainer: '#2E2E2E',
  onWaterContainer: '#F2F2F2',
  sleep: '#8A8A8A',
  onSleep: '#0E0E0E',
  sleepContainer: '#2E2E2E',
  onSleepContainer: '#F2F2F2',
  near: '#FFB547',
  onNear: '#3D2800',
  nearContainer: '#4D3500',
  onNearContainer: '#FFE2B0',
  over: '#FFB4AB',
  onOver: '#690005',

  lane: '#3A3A3A',
  tick: '#FFFFFF',
  laneTick: '#A3A3A3',
};

/**
 * From the mockup: body 15/24 at 400, titles 20/24 at 600, labels 12/16 at
 * 600 with wide tracking (the mockup also sets them in capitals), buttons
 * 15 at 600. Numerals in Oswald: the hero 64 at 600, stats 32 and 20 at 500.
 * The mockup has no 700, so `bold` uses the 600 file too.
 */
const type: TypeScaleShape = {
  displayLarge: { size: 57, line: 64, weight: 'semibold', tracking: -0.5 },
  displayMedium: { size: 45, line: 52, weight: 'semibold', tracking: -0.25 },
  displaySmall: { size: 36, line: 44, weight: 'semibold', tracking: 0 },
  headlineLarge: { size: 32, line: 40, weight: 'semibold', tracking: 0 },
  headlineMedium: { size: 28, line: 36, weight: 'semibold', tracking: 0 },
  headlineSmall: { size: 24, line: 32, weight: 'semibold', tracking: 0 },
  /** "Fri, 14 Nov", "Morning walk · 7:10 am". */
  titleLarge: { size: 20, line: 24, weight: 'semibold', tracking: 0 },
  /** List row titles: "Morning walk", "Sodium". */
  titleMedium: { size: 15, line: 24, weight: 'semibold', tracking: 0 },
  titleSmall: { size: 14, line: 20, weight: 'semibold', tracking: 0 },
  bodyLarge: { size: 15, line: 24, weight: 'regular', tracking: 0 },
  bodyMedium: { size: 14, line: 20, weight: 'regular', tracking: 0 },
  bodySmall: { size: 12, line: 16, weight: 'regular', tracking: 0 },
  /** Buttons. */
  labelLarge: { size: 15, line: 24, weight: 'semibold', tracking: 0 },
  /** "STEPS", "KM", "LAST 7 DAYS": 0.08 em. */
  labelMedium: { size: 12, line: 16, weight: 'semibold', tracking: 1 },
  labelSmall: { size: 12, line: 16, weight: 'semibold', tracking: 1 },
  /** Today's steps. Oswald's tall figures need a little more than the mockup's 64 line. */
  numeralHero: { size: 64, line: 72, weight: 'semibold', tracking: 0, numeral: true },
  /** The kcal of a dish, a walk's distance. */
  numeralLarge: { size: 64, line: 72, weight: 'semibold', tracking: 0, numeral: true },
  /** Km, active min, pace. */
  numeralMedium: { size: 32, line: 40, weight: 'medium', tracking: 0, numeral: true },
  /** A row's kcal, a macro. */
  numeralSmall: { size: 20, line: 24, weight: 'medium', tracking: 0, numeral: true },
};

/** Squared off: 4 dp bars and fields, 8 dp chips, 16 dp cards and FAB. */
const radius: RadiusScale = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 16,
  xl: 24,
  full: 999,
};

const theme: ThemeDef = {
  id: 'f',
  name: 'Sport data',
  description: 'Bold numbers and sharp bars, like a training log.',
  mode: 'system',
  colors: { light: schemeFromRoles(light), dark: schemeFromRoles(dark) },
  fonts: {
    regular: { family: 'InterTight_400Regular', source: InterTight_400Regular },
    medium: { family: 'InterTight_500Medium', source: InterTight_500Medium },
    semibold: { family: 'InterTight_600SemiBold', source: InterTight_600SemiBold },
    bold: { family: 'InterTight_600SemiBold', source: InterTight_600SemiBold },
    numeralMedium: { family: 'Oswald_500Medium', source: Oswald_500Medium },
    numeral: { family: 'Oswald_600SemiBold', source: Oswald_600SemiBold },
  },
  type,
  radius,
  /**
   * F: 12 dp corners, flat. Buttons keep sentence case as drawn ("Save to lunch", "Keep");
   * chips take the mockup's small tracked capitals (its "HIGH" tag).
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
    chipCase: 'upper',
    fabRadius: 12,
    fabShadow: false,
  },
};

export default theme;
