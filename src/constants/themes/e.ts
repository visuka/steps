/**
 * E, Calm and large (app-look/project/E-Calm.dc.html). Light only, as mocked.
 *
 * Big, clear and unhurried. Colours (owner, 17 Nov 2026, every screen): a
 * light grey ground (#F1F1F1), near-white cards (#FBFBFB) edged in a 1 dp
 * grey line, black for text, the main action and the data, greys for second
 * text and tracks, and one red (#C8201F, warnings and over the limit).
 * Figtree throughout: body 18, labels 16 at the least, titles 24,
 * the steps hero 72, all numbers in tabular figures.
 *
 * The lane is #CCCCCC so tracks still show on the grey ground (1.25:1).
 */

import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';

import { type RadiusScale, schemeFromRoles, type SchemeRoles, type TypeScaleShape } from '../tokens';
import type { ThemeDef } from './types';

const light: SchemeRoles = {
  // Deep green: "Log food", "Save to lunch", the selected tab's ink.
  primary: '#000000',
  onPrimary: '#FFFFFF',
  // The round icon plates beside a walk.
  primaryContainer: '#E6E6E6',
  onPrimaryContainer: '#000000',
  secondary: '#3C3C3C',
  onSecondary: '#FFFFFF',
  // The navigation pill.
  secondaryContainer: '#E2E2E2',
  onSecondaryContainer: '#000000',
  tertiary: '#3C3C3C',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#E8E8E8',
  onTertiaryContainer: '#000000',
  // The "High" sodium badge.
  error: '#C8201F',
  onError: '#FFFFFF',
  errorContainer: '#FDE4E4',
  onErrorContainer: '#A51A19',
  background: '#F1F1F1',
  onBackground: '#000000',
  surface: '#F1F1F1',
  onSurface: '#000000',
  surfaceVariant: '#DCDCDC',
  onSurfaceVariant: '#5E5E5E',
  surfaceDim: '#DCDCDC',
  surfaceBright: '#FBFBFB',
  // Cards are white (tile: 'outlined').
  surfaceContainerLowest: '#FBFBFB',
  surfaceContainerLow: '#F7F7F7',
  // Neutral icon plates, list dividers.
  surfaceContainer: '#E8E8E8',
  // The segmented control's well.
  surfaceContainerHigh: '#E4E4E4',
  surfaceContainerHighest: '#DCDCDC',
  inverseSurface: '#1A1A1A',
  inverseOnSurface: '#F1F1F1',
  inversePrimary: '#CFCFCF',
  // The card edge is the mockup's #E3DBCD (outlineVariant); outline is darker so a field's edge shows 3:1.
  outline: '#7C7C7C',
  outlineVariant: '#DCDCDC',
  surfaceTint: '#000000',
  shadow: '#000000',
  scrim: '#000000',

  steps: '#000000',
  onSteps: '#FFFFFF',
  stepsContainer: '#E2E2E2',
  onStepsContainer: '#000000',
  food: '#000000',
  onFood: '#FFFFFF',
  // The macro plates on a food result.
  foodContainer: '#ECECEC',
  onFoodContainer: '#000000',
  food2: '#5E5E5E',
  food3: '#3C3C3C',
  water: '#000000',
  onWater: '#FFFFFF',
  // The "+ 1 glass" button.
  waterContainer: '#E8E8E8',
  onWaterContainer: '#000000',
  sleep: '#3C3C3C',
  onSleep: '#FFFFFF',
  sleepContainer: '#E4E4E4',
  onSleepContainer: '#000000',
  near: '#5E5E5E',
  onNear: '#FFFFFF',
  nearContainer: '#E4E4E4',
  onNearContainer: '#000000',
  over: '#C8201F',
  onOver: '#FFFFFF',

  lane: '#CCCCCC',
  tick: '#FFFFFF',
  laneTick: '#5E5E5E',
};

/**
 * From the mockup: body 18, labels and secondary lines 16 (never smaller),
 * card titles 18 at 700, screen titles 24, buttons 18 at 700, the steps
 * hero 72. Weight names map to files in `fonts` below: regular 400,
 * medium and semibold 600, bold 700 (the mockup uses no other weights).
 */
const type: TypeScaleShape = {
  displayLarge: { size: 57, line: 64, weight: 'bold', tracking: -0.5 },
  displayMedium: { size: 45, line: 52, weight: 'bold', tracking: -0.5 },
  displaySmall: { size: 36, line: 44, weight: 'bold', tracking: 0 },
  /** Page heads: 32/40. */
  headlineLarge: { size: 32, line: 40, weight: 'bold', tracking: 0 },
  headlineMedium: { size: 28, line: 36, weight: 'bold', tracking: 0 },
  /** "Fri, 14 Nov", "Morning walk · 7:10 am". */
  headlineSmall: { size: 24, line: 32, weight: 'bold', tracking: 0 },
  /** The typed dish: 18/26 at 700. */
  titleLarge: { size: 18, line: 26, weight: 'bold', tracking: 0 },
  /** Card titles: "Ingredients", "Nutrients, at least". */
  titleMedium: { size: 18, line: 24, weight: 'bold', tracking: 0 },
  /** "Steps today", list row names. */
  titleSmall: { size: 18, line: 24, weight: 'semibold', tracking: 0 },
  bodyLarge: { size: 18, line: 26, weight: 'regular', tracking: 0 },
  bodyMedium: { size: 18, line: 24, weight: 'regular', tracking: 0 },
  /** Notes and secondary lines: 16 is the floor. */
  bodySmall: { size: 16, line: 24, weight: 'regular', tracking: 0 },
  /** Buttons: 18 at 700. */
  labelLarge: { size: 18, line: 24, weight: 'bold', tracking: 0 },
  /** Tile labels, navigation. */
  labelMedium: { size: 16, line: 24, weight: 'semibold', tracking: 0 },
  /** Chips and badges. */
  labelSmall: { size: 16, line: 22, weight: 'regular', tracking: 0 },
  /** Today's steps. */
  numeralHero: { size: 72, line: 72, weight: 'bold', tracking: -1, numeral: true },
  /** A walk's distance. */
  numeralLarge: { size: 32, line: 40, weight: 'bold', tracking: 0, numeral: true },
  /** Tile values: "1,280", "52 min". */
  numeralMedium: { size: 24, line: 32, weight: 'bold', tracking: 0, numeral: true },
  /** A macro, a list row's value. */
  numeralSmall: { size: 18, line: 24, weight: 'bold', tracking: 0, numeral: true },
};

/** Soft but not bubbly: 20 dp cards and buttons, 16 dp chips and inner plates, 32 dp sheets. */
const radius: RadiusScale = {
  none: 0,
  xs: 16,
  sm: 16,
  md: 20,
  lg: 20,
  xl: 32,
  full: 999,
};

const scheme = schemeFromRoles(light);

const theme: ThemeDef = {
  id: 'e',
  name: 'Calm and large',
  description: 'Bigger text and plenty of room. Soft and easy to read.',
  mode: 'light',
  colors: { light: scheme, dark: scheme },
  fonts: {
    regular: { family: 'Figtree_400Regular', source: Figtree_400Regular },
    medium: { family: 'Figtree_600SemiBold', source: Figtree_600SemiBold },
    semibold: { family: 'Figtree_600SemiBold', source: Figtree_600SemiBold },
    bold: { family: 'Figtree_700Bold', source: Figtree_700Bold },
    numeralMedium: { family: 'Figtree_600SemiBold', source: Figtree_600SemiBold },
    numeral: { family: 'Figtree_700Bold', source: Figtree_700Bold },
  },
  type,
  radius,
  /** E: big 56 dp buttons with 20 dp corners and 18 dp labels at 700, flat. */
  style: {
    tile: 'outlined',
    hero: 'bar',
    bar: 'solid',
    navIndicator: 'neutral',
    numeralTabular: true,
    buttonRadius: 20,
    buttonHeight: 56,
    buttonCase: 'none',
    chipCase: 'none',
    fabRadius: radius.lg,
    fabShadow: false,
    actionHeight: 56,
    compactLabel: { size: 18, line: 24, weight: 'bold' },
    filledRole: 'primary',
    outlined: { border: 'primary', fill: '#FBFBFB', ink: 'primary' },
    // Card titles: "Ingredients", "Nutrients, at least": 18/24 at 700.
    overline: { size: 18, line: 24, weight: 'bold', tracking: 0, case: 'none', color: 'onSurface' },
    segment: {
      height: 56,
      well: 'surfaceContainerHigh',
      wellBorder: null,
      radius: 20,
      pad: 4,
      selected: '#FBFBFB',
      onSelected: 'primary',
      selectedBorder: 'primary',
      selectedRadius: 16,
      idle: '#3C3C3C',
      divider: null,
      check: false,
      label: { size: 18, weight: 'semibold', selectedWeight: 'bold' },
    },
    nav: {
      height: 72,
      background: '#FBFBFB',
      border: 'outlineVariant',
      pill: 'secondaryContainer',
      onPill: 'primary',
      pillWidth: 56,
      active: 'primary',
      idle: 'onSurfaceVariant',
      label: { size: 16, line: 20, weight: 'semibold', activeWeight: 'bold' },
    },
  },
  // The mockup's map: parchment land, white streets, thin sand lanes, the deep green route.
  map: {
    base: 'light',
    land: '#F1F1F1',
    road: '#FBFBFB',
    minorRoad: '#DCDCDC',
    park: '#E4E4E4',
    water: '#DCDCDC',
    building: '#E8E8E8',
    label: '#5E5E5E',
    border: '#DCDCDC',
    radius: 20,
    height: 160,
    route: '#000000',
    routeWidth: 6,
    casing: null,
    start: '#FBFBFB',
    startRing: '#000000',
    end: '#000000',
    endRing: '#FBFBFB',
  },
};

export default theme;
