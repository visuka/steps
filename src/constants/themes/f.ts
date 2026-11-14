/**
 * F, Sport data (app-look/project/F-Sport.dc.html). Light only, as mocked.
 *
 * Feels like a pro training app: crisp numbers, thin rules, one orange
 * signal. Chrome is ink and white with hairline greys; the one colour is
 * the orange of today's steps. Food and water are drawn in ink, sleep in
 * graphite; near and over keep amber and red, always with a label too.
 * Inter Tight for words, Oswald for numbers (tabular figures).
 *
 * As drawn: the black hero block (steps, a dish, a walk) with white
 * numbers, #A3A3A3 labels, #333333 rules, orange #FF6A1A marks on a #3A3A3A
 * lane (`block`); "Log food" and "Save to lunch" in orange with ink labels
 * (tertiary, style.filledRole); ink outlined buttons; small tracked capitals
 * only for labels and the "HIGH" tag, never for chips or buttons.
 *
 * Changes from the mockup, for the contrast rules:
 * - on white, #FF6A1A is 2.9:1, so steps marks on the page (and as text
 *   colour) are the same orange darkened just enough: #DB4D00 (3.0:1 on the
 *   lane, 4.7:1 under ink). On the black block the orange is #FF6A1A as drawn.
 * - the 7-day chart's under-average bars are #5F5F5F (mockup #4A4A4A, 2.2:1
 *   on the black block).
 * - ink stays the primary (text buttons and links need 4.5:1 on white).
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
  tertiary: '#FF6A1A',
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
  // Icon plates.
  surfaceContainerHigh: '#F2F2F2',
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

  steps: '#DB4D00',
  onSteps: '#0E0E0E',
  stepsContainer: '#FFE1CF',
  onStepsContainer: '#4A1C00',
  food: '#0E0E0E',
  onFood: '#FFFFFF',
  foodContainer: '#EDEDED',
  onFoodContainer: '#0E0E0E',
  // Split bar: ink, orange, grey (the mockup's carbs, protein, fat in one family).
  food2: '#DB4D00',
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

/**
 * From the mockup: body 15/24 at 400, titles 20/24 at 600, navigation 12/16
 * at 500 (600 selected), buttons 15/24 at 600; the tracked capital labels
 * are style.overline. Numerals in Oswald: the hero 64 at 600, stats 32 and
 * 20 at 500. Oswald's tall figures are clipped on Android at a line equal to
 * their size, so the 64 and 32 figures get 72 and 40 lines (the mockup: 64, 32).
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
  bodyMedium: { size: 15, line: 24, weight: 'regular', tracking: 0 },
  bodySmall: { size: 12, line: 16, weight: 'regular', tracking: 0 },
  /** Buttons. */
  labelLarge: { size: 15, line: 24, weight: 'semibold', tracking: 0 },
  /** Navigation, tile notes. */
  labelMedium: { size: 12, line: 16, weight: 'medium', tracking: 0 },
  labelSmall: { size: 12, line: 16, weight: 'semibold', tracking: 0 },
  /** Today's steps. */
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

const scheme = schemeFromRoles(light);

const theme: ThemeDef = {
  id: 'f',
  name: 'Sport data',
  description: 'Bold numbers and sharp bars, like a training log.',
  mode: 'light',
  colors: { light: scheme, dark: scheme },
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
   * F: 12 dp corners, flat, 56 dp main actions in orange with ink labels.
   * Buttons and chips keep sentence case as drawn ("Save to lunch", "1 glass").
   */
  style: {
    tile: 'outlined',
    hero: 'block',
    bar: 'segmented',
    navIndicator: 'neutral',
    numeralTabular: true,
    buttonRadius: 12,
    buttonHeight: 48,
    buttonCase: 'none',
    chipCase: 'none',
    fabRadius: 12,
    fabShadow: false,
    actionHeight: 56,
    compactLabel: { size: 15, line: 24, weight: 'semibold' },
    filledRole: 'tertiary',
    outlined: { border: 'primary', fill: '#FFFFFF', ink: 'primary' },
    // "INGREDIENTS", "PARTS", "FOOD": 12/16 at 600, 0.08em, capitals.
    overline: { size: 12, line: 16, weight: 'semibold', tracking: 0.96, case: 'upper', color: 'onSurfaceVariant' },
    kicker: { size: 12, line: 16, weight: 'semibold', tracking: 0.96, case: 'upper', color: 'onSurfaceVariant' },
    segment: {
      height: 48,
      well: null,
      wellBorder: 'primary',
      radius: 12,
      pad: 0,
      selected: 'primary',
      onSelected: 'onPrimary',
      selectedBorder: null,
      selectedRadius: 0,
      idle: 'secondary',
      divider: 'outlineVariant',
      check: false,
      label: { size: 15, weight: 'medium', selectedWeight: 'semibold' },
    },
    nav: {
      height: 72,
      background: 'surface',
      border: 'outlineVariant',
      pill: 'secondaryContainer',
      onPill: 'onSecondaryContainer',
      pillWidth: 56,
      active: 'onSurface',
      idle: 'onSurfaceVariant',
      label: { size: 12, line: 16, weight: 'medium', activeWeight: 'semibold' },
    },
  },
  block: {
    plate: '#0E0E0E',
    text: '#FFFFFF',
    quiet: '#A3A3A3',
    rule: '#333333',
    lane: '#3A3A3A',
    mark: '#FF6A1A',
    mark2: '#FFFFFF',
    mark3: '#6B6B6B',
    chip: '#FF6A1A',
    onChip: '#0E0E0E',
    barHigh: '#8A8A8A',
    barLow: '#5F5F5F',
    average: '#6B6B6B',
  },
  // The mockup's map: light grey land and blocks, white streets, the ink route, an orange end dot.
  map: {
    base: 'light',
    land: '#EDEDED',
    road: '#FFFFFF',
    minorRoad: '#FFFFFF',
    park: '#E3E8E0',
    water: '#DCE3E8',
    building: '#E0E0E0',
    label: '#6B6B6B',
    border: null,
    radius: 16,
    height: 184,
    route: '#0E0E0E',
    routeWidth: 4,
    casing: null,
    start: '#FFFFFF',
    startRing: '#0E0E0E',
    end: '#FF6A1A',
    endRing: '#0E0E0E',
  },
};

export default theme;
