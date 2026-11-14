/**
 * E, Calm and large (app-look/project/E-Calm.dc.html). Light only, as mocked.
 *
 * Big, clear and unhurried; made first for parents 55+. A warm parchment
 * ground with white cards edged in a 1 dp sand line, one deep green for the
 * main action and for steps, rust for food, blue for water, warm umber for
 * sleep. Figtree throughout: body 18, labels 16 at the least, titles 24,
 * the steps hero 72, all numbers in tabular figures.
 *
 * Changes from the mockup, for the contrast rules: the lane is the frame
 * sand #D6CDBE (the mockup's #E9E3D8 is too faint on the parchment ground).
 */

import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';

import { type RadiusScale, schemeFromRoles, type SchemeRoles, type TypeScaleShape } from '../tokens';
import type { ThemeDef } from './types';

const light: SchemeRoles = {
  // Deep green: "Log food", "Save to lunch", the selected tab's ink.
  primary: '#1E4D3A',
  onPrimary: '#FFFFFF',
  // The round icon plates beside a walk.
  primaryContainer: '#E3EDE7',
  onPrimaryContainer: '#1E4D3A',
  secondary: '#4F6358',
  onSecondary: '#FFFFFF',
  // The navigation pill.
  secondaryContainer: '#D6E6DC',
  onSecondaryContainer: '#1E4D3A',
  tertiary: '#1F5FA8',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#E4EDF7',
  onTertiaryContainer: '#174A85',
  // The "High" sodium badge.
  error: '#A3261E',
  onError: '#FFFFFF',
  errorContainer: '#F8E3E1',
  onErrorContainer: '#A3261E',
  background: '#F5F1EA',
  onBackground: '#1F1B16',
  surface: '#F5F1EA',
  onSurface: '#1F1B16',
  surfaceVariant: '#E3DBCD',
  onSurfaceVariant: '#5E5649',
  surfaceDim: '#E3DBCD',
  surfaceBright: '#FBF9F5',
  // Cards are white (tile: 'outlined').
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F9F6F1',
  // Neutral icon plates, list dividers.
  surfaceContainer: '#EDE7DC',
  // The segmented control's well.
  surfaceContainerHigh: '#EAE3D7',
  surfaceContainerHighest: '#E3DBCD',
  inverseSurface: '#34302A',
  inverseOnSurface: '#F5F1EA',
  inversePrimary: '#A8D3BC',
  // The card edge is the mockup's #E3DBCD (outlineVariant); outline is darker so a field's edge shows 3:1.
  outline: '#857B6D',
  outlineVariant: '#E3DBCD',
  surfaceTint: '#1E4D3A',
  shadow: '#000000',
  scrim: '#000000',

  steps: '#1E4D3A',
  onSteps: '#FFFFFF',
  stepsContainer: '#D6E6DC',
  onStepsContainer: '#1E4D3A',
  food: '#9A4A2B',
  onFood: '#FFFFFF',
  // The macro plates on a food result.
  foodContainer: '#F6EDE7',
  onFoodContainer: '#7A3519',
  food2: '#6E5212',
  food3: '#4E2A1A',
  water: '#1F5FA8',
  onWater: '#FFFFFF',
  // The "+ 1 glass" button.
  waterContainer: '#E4EDF7',
  onWaterContainer: '#174A85',
  sleep: '#4A4038',
  onSleep: '#FFFFFF',
  sleepContainer: '#EAE3D7',
  onSleepContainer: '#4A4038',
  near: '#8A5A00',
  onNear: '#FFFFFF',
  nearContainer: '#FBE7C2',
  onNearContainer: '#4A3000',
  over: '#A3261E',
  onOver: '#FFFFFF',

  // The mockup's lane (#E9E3D8) is too faint on the parchment ground; this is its frame sand.
  lane: '#D6CDBE',
  tick: '#FFFFFF',
  laneTick: '#6A6155',
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
    outlined: { border: 'primary', fill: '#FFFFFF', ink: 'primary' },
    // Card titles: "Ingredients", "Nutrients, at least": 18/24 at 700.
    overline: { size: 18, line: 24, weight: 'bold', tracking: 0, case: 'none', color: 'onSurface' },
    segment: {
      height: 56,
      well: 'surfaceContainerHigh',
      wellBorder: null,
      radius: 20,
      pad: 4,
      selected: '#FFFFFF',
      onSelected: 'primary',
      selectedBorder: 'primary',
      selectedRadius: 16,
      idle: '#4A4038',
      divider: null,
      check: false,
      label: { size: 18, weight: 'semibold', selectedWeight: 'bold' },
    },
    nav: {
      height: 72,
      background: '#FFFFFF',
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
    land: '#ECE6DA',
    road: '#FFFFFF',
    minorRoad: '#DDD5C7',
    park: '#DCE3D2',
    water: '#D5E1EA',
    building: '#E4DDD0',
    label: '#5E5649',
    border: '#E3DBCD',
    radius: 20,
    height: 160,
    route: '#1E4D3A',
    routeWidth: 6,
    casing: null,
    start: '#FFFFFF',
    startRing: '#1E4D3A',
    end: '#1E4D3A',
    endRing: '#FFFFFF',
  },
};

export default theme;
