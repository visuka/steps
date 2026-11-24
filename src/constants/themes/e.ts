/**
 * The app's one look: the plain sage-and-sand look of mock d38 (owner approved
 * 18 Nov 2026), for every screen. Light only.
 *
 * Every colour and face comes from plain.ts, the same tokens the three parts
 * (Nutrition, Activity, Buddies) draw with, so a screen built from the shared
 * pieces (Screen, Card, Button, Segmented, ThemedText) looks like those parts
 * without knowing about them. Change the look in plain.ts, never per screen.
 *
 * Words: Figtree, charcoal and one grey. Figures: Outfit, light. Colour sits
 * on surfaces only: sage for main buttons and progress, sand for chips and
 * second tiles. Red stays for warnings (over a limit) only.
 */

import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';

import { type RadiusScale, schemeFromRoles, type SchemeRoles, type TypeScaleShape } from '../tokens';
import { PLAIN, PLAIN_FONT, PLAIN_SIZE } from './plain';
import type { ColorRef, ThemeDef } from './types';

/** A plain.ts colour where the theme takes a hex. */
const hex = (c: string) => c as ColorRef;

const light: SchemeRoles = {
  // Main buttons, the selected day, links: sage.
  primary: PLAIN.main,
  onPrimary: PLAIN.onMain,
  // Icon plates and the top tile's tint.
  primaryContainer: PLAIN.hero,
  onPrimaryContainer: PLAIN.text,
  secondary: PLAIN.muted,
  onSecondary: '#FFFFFF',
  // Chips, the stepper's round buttons: sand.
  secondaryContainer: PLAIN.chip,
  onSecondaryContainer: PLAIN.text,
  tertiary: PLAIN.sand,
  onTertiary: '#FFFFFF',
  tertiaryContainer: PLAIN.second,
  onTertiaryContainer: PLAIN.text,
  // The "High" sodium badge and over-the-limit marks.
  error: PLAIN.warn,
  onError: '#FFFFFF',
  errorContainer: '#FBE9E7',
  onErrorContainer: '#8C1D18',
  background: PLAIN.ground.top,
  onBackground: PLAIN.text,
  surface: PLAIN.ground.top,
  onSurface: PLAIN.text,
  surfaceVariant: PLAIN.hairline,
  onSurfaceVariant: PLAIN.muted,
  surfaceDim: PLAIN.ground.shade,
  surfaceBright: PLAIN.tileEdge,
  // Cards are the frosted tile (tile: 'plain').
  surfaceContainerLowest: PLAIN.tile,
  surfaceContainerLow: PLAIN.ground.bottom,
  surfaceContainer: PLAIN.ground.mid,
  surfaceContainerHigh: PLAIN.fieldEdge,
  surfaceContainerHighest: PLAIN.hairline,
  inverseSurface: PLAIN.text,
  inverseOnSurface: PLAIN.ground.top,
  inversePrimary: PLAIN.hero,
  // A field's edge shows 3:1; dividers are the hairline.
  outline: '#7A7A80',
  outlineVariant: PLAIN.hairline,
  surfaceTint: PLAIN.main,
  shadow: '#000000',
  scrim: '#000000',

  steps: PLAIN.main,
  onSteps: PLAIN.onMain,
  stepsContainer: PLAIN.hero,
  onStepsContainer: PLAIN.text,
  food: PLAIN.sand,
  onFood: '#FFFFFF',
  foodContainer: PLAIN.second,
  onFoodContainer: PLAIN.text,
  food2: PLAIN.muted,
  food3: PLAIN.main,
  water: PLAIN.main,
  onWater: PLAIN.onMain,
  // The "+ 1 glass" button.
  waterContainer: PLAIN.chip,
  onWaterContainer: PLAIN.text,
  sleep: PLAIN.sand,
  onSleep: '#FFFFFF',
  sleepContainer: PLAIN.second,
  onSleepContainer: PLAIN.text,
  near: PLAIN.muted,
  onNear: '#FFFFFF',
  nearContainer: PLAIN.ground.mid,
  onNearContainer: PLAIN.text,
  over: PLAIN.warn,
  onOver: '#FFFFFF',

  // A track's empty part: shows on the tiles and on the grey ground.
  lane: '#D2D2D7',
  tick: '#FFFFFF',
  laneTick: PLAIN.muted,
  warnSoft: PLAIN.warnSoft,
};

/**
 * The plain sizes (docs/design.md): words 14 to 16, card names 16 semibold,
 * screen titles 22, buttons 14 semibold; figures in Outfit 300 (the bold
 * weight names pick the light figure file, as on the three parts) and 400.
 */
const type: TypeScaleShape = {
  displayLarge: { size: 48, line: 54, weight: 'semibold', tracking: -0.5 },
  displayMedium: { size: 40, line: 46, weight: 'semibold', tracking: -0.5 },
  displaySmall: { size: 32, line: 38, weight: 'semibold', tracking: 0 },
  headlineLarge: { size: 28, line: 34, weight: 'semibold', tracking: 0 },
  headlineMedium: { size: 24, line: 30, weight: 'semibold', tracking: 0 },
  /** Screen titles: "Settings", "Steps". */
  headlineSmall: { size: 22, line: 28, weight: 'semibold', tracking: 0 },
  /** The typed dish. */
  titleLarge: { size: 17, line: 23, weight: 'semibold', tracking: 0 },
  /** Card titles: "Ingredients", "Profile". */
  titleMedium: { size: 16, line: 22, weight: 'semibold', tracking: 0 },
  /** List row names. */
  titleSmall: { size: 15, line: 20, weight: 'medium', tracking: 0 },
  bodyLarge: { size: 16, line: 22, weight: 'regular', tracking: 0 },
  bodyMedium: { size: 15, line: 20, weight: 'regular', tracking: 0 },
  /** Notes and second lines, as the tiles' notes. */
  bodySmall: { size: 14, line: 19, weight: 'regular', tracking: 0 },
  /** Buttons. */
  labelLarge: { size: 14, line: 18, weight: 'semibold', tracking: 0 },
  labelMedium: { size: 13, line: 17, weight: 'medium', tracking: 0 },
  /** Chips and badges. */
  labelSmall: { size: 12, line: 16, weight: 'regular', tracking: 0 },
  /** A screen's one big figure. */
  numeralHero: { size: 64, line: 68, weight: 'bold', tracking: -2, numeral: true },
  /** "6,240 of 8,000", a walk's distance. */
  numeralLarge: { size: 38, line: 44, weight: 'bold', tracking: -0.5, numeral: true },
  /** Tile figures. */
  numeralMedium: { size: 28, line: 32, weight: 'bold', tracking: 0, numeral: true },
  /** A macro, a list row's value. */
  numeralSmall: { size: 17, line: 24, weight: 'medium', tracking: 0, numeral: true },
};

/** Tiles 24, fields and chips 16, sheets 32. */
const radius: RadiusScale = {
  none: 0,
  xs: 12,
  sm: 16,
  md: PLAIN_SIZE.radius,
  lg: PLAIN_SIZE.radius,
  xl: 32,
  full: 999,
};

const scheme = schemeFromRoles(light);

const theme: ThemeDef = {
  id: 'e',
  name: 'Plain',
  description: 'Frosted tiles on soft grey, sage and sand.',
  mode: 'light',
  colors: { light: scheme, dark: scheme },
  fonts: {
    regular: { family: PLAIN_FONT.regular, source: Figtree_400Regular },
    medium: { family: PLAIN_FONT.medium, source: Figtree_500Medium },
    semibold: { family: PLAIN_FONT.semibold, source: Figtree_600SemiBold },
    bold: { family: PLAIN_FONT.semibold, source: Figtree_600SemiBold },
    numeralMedium: { family: PLAIN_FONT.mid, source: require('@/assets/fonts/Outfit_400Regular.ttf') },
    numeral: { family: PLAIN_FONT.figure, source: require('@/assets/fonts/Outfit_300Light.ttf') },
  },
  type,
  radius,
  style: {
    tile: 'plain',
    hero: 'bar',
    bar: 'solid',
    navIndicator: 'neutral',
    numeralTabular: true,
    // Pill buttons 48 high, 14 semibold labels, flat.
    buttonRadius: radius.full,
    buttonHeight: 48,
    buttonCase: 'none',
    chipCase: 'none',
    fabRadius: radius.full,
    fabShadow: false,
    actionHeight: 48,
    compactLabel: { size: 14, line: 18, weight: 'semibold' },
    filledRole: 'primary',
    // White round buttons with a grey hairline, as the top row's.
    outlined: { border: hex(PLAIN.fieldEdge), fill: hex(PLAIN.field), ink: 'onSurface' },
    overline: { size: 11.5, line: 15, weight: 'medium', tracking: 2, case: 'upper', color: hex(PLAIN.label) },
    segment: {
      height: PLAIN_SIZE.switchH,
      well: hex(PLAIN.tile),
      wellBorder: hex(PLAIN.tileEdge),
      radius: PLAIN_SIZE.switchH / 2,
      pad: 3,
      selected: hex(PLAIN.quietOn),
      onSelected: 'onSurface',
      selectedBorder: null,
      selectedRadius: PLAIN_SIZE.switchH / 2 - 3,
      idle: hex(PLAIN.muted),
      divider: null,
      check: false,
      label: { size: 13, weight: 'medium', selectedWeight: 'semibold' },
    },
    nav: {
      height: 64,
      background: hex(PLAIN.tile),
      border: 'outlineVariant',
      pill: 'secondaryContainer',
      onPill: 'onSurface',
      pillWidth: 56,
      active: 'onSurface',
      idle: 'onSurfaceVariant',
      label: { size: 12, line: 16, weight: 'medium', activeWeight: 'semibold' },
    },
  },
  // The walk map: soft grey land, white streets, the route in sage.
  map: {
    base: 'light',
    land: PLAIN.ground.mid,
    road: '#FFFFFF',
    minorRoad: PLAIN.hairline,
    park: PLAIN.hero,
    water: '#DCE6EE',
    building: PLAIN.fieldEdge,
    label: PLAIN.muted,
    border: PLAIN.tileEdge,
    radius: PLAIN_SIZE.radius,
    height: 160,
    route: PLAIN.main,
    routeWidth: 5,
    casing: null,
    start: '#FFFFFF',
    startRing: PLAIN.main,
    end: PLAIN.main,
    endRing: '#FFFFFF',
  },
};

export default theme;
