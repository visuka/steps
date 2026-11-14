/**
 * D, Colour blocks (app-look/project/D-Blocks.dc.html). The default theme. Light only, as mocked.
 *
 * Cheerful solid tiles: every area has its own colour, so it is found at a
 * glance. Steps are leaf green, food apricot, water sky, sleep lavender, each
 * as a flat block with its text in that block's deep `on` colour. Chrome is
 * white with warm-grey plates; the one main button is deep forest.
 * Plus Jakarta Sans throughout, numerals at 800 with tabular figures.
 *
 * Today as drawn: the leaf steps block, food and water blocks side by side
 * (water with a white "+ 1 glass" pill), a lilac sleep strip, the walk row
 * outlined, and a full-width forest "Log food" button.
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
  /** Tile notes ("of 1,900 kcal", "Distance"), navigation: 13/16 at 500. */
  labelMedium: { size: 13, line: 16, weight: 'regular', tracking: 0 },
  labelSmall: { size: 13, line: 16, weight: 'regular', tracking: 0 },
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

const scheme = schemeFromRoles(light);

const theme: ThemeDef = {
  id: 'd',
  name: 'Colour blocks',
  description: 'Cheerful solid tiles. Every area has its own colour, so you find it at a glance.',
  mode: 'light',
  colors: { light: scheme, dark: scheme },
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
  /** D: pill buttons, 56 dp main actions, labels 16 at 800, flat like the blocks. */
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
    actionHeight: 56,
    compactLabel: { size: 16, line: 20, weight: 'bold' },
    filledRole: 'primary',
    // "Edit", "Keep": white with the mockup's #C4C7BF edge (the label carries the button).
    outlined: { border: '#C4C7BF', fill: '#FFFFFF', ink: 'onSurface' },
    // "Ingredients", "Parts": 16/24 at 700, as written.
    overline: { size: 16, line: 24, weight: 'semibold', tracking: 0, case: 'none', color: 'onSurface' },
    // "Fri, 14 Nov" over "Today": 16/20 at 500.
    kicker: { size: 16, line: 20, weight: 'regular', tracking: 0, case: 'none', color: 'onSurfaceVariant' },
    segment: {
      height: 56,
      well: 'surfaceContainer',
      wellBorder: null,
      radius: 28,
      pad: 4,
      selected: 'stepsContainer',
      onSelected: 'onStepsContainer',
      selectedBorder: null,
      selectedRadius: 24,
      idle: '#3D403A',
      divider: null,
      check: true,
      label: { size: 16, weight: 'semibold', selectedWeight: 'bold' },
    },
    nav: {
      height: 80,
      background: 'surface',
      border: 'surfaceVariant',
      pill: 'tone',
      onPill: 'tone',
      pillWidth: 64,
      active: 'onSurface',
      idle: 'onSurfaceVariant',
      label: { size: 13, line: 16, weight: 'regular', activeWeight: 'bold' },
    },
  },
  // The mockup's map: pale sage land, white streets, a leaf park, the green route;
  // the end dot is forest with a white centre (white fill, forest ring).
  map: {
    base: 'light',
    land: '#EEF1EA',
    road: '#FFFFFF',
    minorRoad: '#FFFFFF',
    park: '#DCEAD4',
    water: '#D6E7F5',
    building: '#E4E8DF',
    label: '#565A53',
    border: null,
    radius: 28,
    height: 168,
    route: '#2C6E36',
    routeWidth: 6,
    casing: null,
    start: '#FFFFFF',
    startRing: '#2C6E36',
    end: '#FFFFFF',
    endRing: '#12361A',
  },
};

export default theme;
