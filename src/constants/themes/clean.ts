/**
 * Clean+ blue (docs/design/clean-plus.html, docs/design/spec.md). The default theme. Light only.
 *
 * Poppins 300/400/500 on white; one blue accent, one warm colour for food, a
 * muted indigo for sleep. Soft cards with shadows, no gradients. Every
 * colour and size here comes from clean-spec.ts (checked by
 * __tests__/themes.test.ts).
 *
 * Role mapping (the app asks for roles, the spec names colours):
 * steps and water = accent, food = warm, sleep = indigo, near and over = warn.
 * Every colour is a CLEAN_SPEC colour except these (Opus, 14 Nov 2026;
 * CLEAN_OFF_SPEC below, checked by __tests__/themes.test.ts):
 * - onFood #000000: text on a warm fill, which the mockup never draws; the
 *   warm colour is 4.08:1 against white, under 4.5.
 * - onFoodContainer #8F3F0A: text on warmTint; the spec's warm is 3.9:1 there.
 * - scrim #000000: the dim behind sheets (the mockup draws none).
 * The lane is the spec's hair, as the mockup's bars (tokens.test.ts allows
 * Clean+ under the 1.25:1 lane rule). food2/food3 feed the old split bar
 * only; the food result's donut (T7) uses warm/carbs/accent from CLEAN_SPEC.
 */

import { Poppins_300Light } from '@expo-google-fonts/poppins/300Light';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';

import { type RadiusScale, schemeFromRoles, type SchemeRoles, type TypeScaleShape } from '../tokens';
import { CLEAN_SPEC } from './clean-spec';
import type { ThemeDef } from './types';

const c = CLEAN_SPEC.colors;

const light: SchemeRoles = {
  primary: c.accent,
  onPrimary: c.white,
  primaryContainer: c.accentTint,
  onPrimaryContainer: c.accent,
  secondary: c.muted,
  onSecondary: c.white,
  // Tonal buttons and the selected segment.
  secondaryContainer: c.accentMid,
  onSecondaryContainer: c.ink,
  tertiary: c.indigo,
  onTertiary: c.white,
  tertiaryContainer: c.indigoTint,
  onTertiaryContainer: c.ink,
  error: c.warn,
  onError: c.white,
  errorContainer: c.warnTint,
  onErrorContainer: c.warn,
  background: c.white,
  onBackground: c.ink,
  surface: c.white,
  onSurface: c.ink,
  surfaceVariant: c.soft,
  onSurfaceVariant: c.muted,
  surfaceDim: c.mapBlock,
  surfaceBright: c.white,
  surfaceContainerLowest: c.white,
  surfaceContainerLow: c.soft,
  surfaceContainer: c.soft,
  surfaceContainerHigh: c.hair,
  surfaceContainerHighest: c.mapBlock,
  inverseSurface: c.ink,
  inverseOnSurface: c.soft,
  inversePrimary: c.heroGoalLine,
  outline: c.muted,
  outlineVariant: c.hair,
  surfaceTint: c.accent,
  shadow: c.ink,
  scrim: '#000000',

  steps: c.accent,
  onSteps: c.white,
  stepsContainer: c.accentTint,
  onStepsContainer: c.accent,
  food: c.warm,
  onFood: '#000000',
  foodContainer: c.warmTint,
  onFoodContainer: '#8F3F0A',
  food2: c.ink,
  food3: c.accent,
  water: c.accent,
  onWater: c.white,
  waterContainer: c.accentTint,
  onWaterContainer: c.accent,
  sleep: c.indigo,
  onSleep: c.white,
  sleepContainer: c.indigoTint,
  onSleepContainer: c.indigo,
  near: c.warn,
  onNear: c.white,
  nearContainer: c.warnTint,
  onNearContainer: c.warn,
  over: c.warn,
  onOver: c.white,

  // The empty part of a bar: hair, as spec 5.6b (water pips and the week track use accentMid, drawn by the components).
  lane: c.hair,
  tick: c.white,
  laneTick: c.muted,
};

/**
 * Only the spec's five steps (Opus, 14 Nov 2026: no other sizes): caption
 * 13/18, body 15/22, value 18/24 at 500, title 22/30 at 500, display 52/56 at
 * 300. Every role is one of these. Weight names map to files in `fonts`
 * below: regular 400, medium/semibold/bold 500 (Poppins is loaded at
 * 300/400/500 only). The display roles are numeral roles at 'semibold', which
 * picks the numeral face, Poppins 300.
 */
const T = CLEAN_SPEC.type;
const caption = { size: T.caption.size, line: T.caption.lineHeight, weight: 'regular', tracking: 0 } as const;
const body = { size: T.body.size, line: T.body.lineHeight, weight: 'regular', tracking: 0 } as const;
const bodyMedium = { ...body, weight: 'medium' } as const;
const value = { size: T.value.size, line: T.value.lineHeight, weight: 'medium', tracking: 0 } as const;
const title = { size: T.title.size, line: T.title.lineHeight, weight: 'medium', tracking: 0 } as const;
const display = { size: T.display.size, line: T.display.lineHeight, weight: 'semibold', tracking: T.display.letterSpacing, numeral: true } as const;

const type: TypeScaleShape = {
  displayLarge: display,
  displayMedium: title,
  displaySmall: title,
  headlineLarge: title,
  headlineMedium: title,
  /** "Today", "Morning walk". */
  headlineSmall: title,
  titleLarge: title,
  /** A card's value line. */
  titleMedium: value,
  titleSmall: bodyMedium,
  bodyLarge: body,
  bodyMedium: body,
  bodySmall: caption,
  /** Buttons. */
  labelLarge: bodyMedium,
  labelMedium: caption,
  labelSmall: caption,
  /** Today's steps: 52/56 light. */
  numeralHero: display,
  /** The kcal on the food result. */
  numeralLarge: display,
  /** Card values ("1,280", "5"): the spec's 18/24 value. */
  numeralMedium: { ...value, numeral: true },
  /** Distance, minutes, a macro. */
  numeralSmall: { ...value, numeral: true },
};

/**
 * The roles as tokens.ts defines them: md = cards, tiles, the hero (24);
 * lg = the FAB (28); sm = chips and snackbars (12, the spec's pill; T5 sets
 * the spec's 20 chip and 16 snackbar per component); xl = sheets (28).
 * Buttons take style.buttonRadius (16).
 */
const R = CLEAN_SPEC.radius;
const radius: RadiusScale = {
  none: 0,
  xs: R.dot,
  sm: R.pill,
  md: R.card,
  lg: R.fab,
  xl: R.fab,
  full: 999,
};

/** The colours that are not CLEAN_SPEC colours, each approved by Opus (see the header). */
export const CLEAN_OFF_SPEC: readonly string[] = ['#000000', '#8F3F0A'];

const scheme = schemeFromRoles(light);

const theme: ThemeDef = {
  id: 'clean',
  name: 'Clean+',
  description: 'Calm and light. White cards, one blue, thin type.',
  mode: 'light',
  colors: { light: scheme, dark: scheme },
  fonts: {
    regular: { family: 'Poppins_400Regular', source: Poppins_400Regular },
    medium: { family: 'Poppins_500Medium', source: Poppins_500Medium },
    semibold: { family: 'Poppins_500Medium', source: Poppins_500Medium },
    bold: { family: 'Poppins_500Medium', source: Poppins_500Medium },
    numeralMedium: { family: 'Poppins_500Medium', source: Poppins_500Medium },
    numeral: { family: 'Poppins_300Light', source: Poppins_300Light },
  },
  type,
  radius,
  /** The shared pieces are rebuilt to the spec in T5; these switches keep them close until then. */
  style: {
    tile: 'plain',
    hero: 'block',
    bar: 'solid',
    navIndicator: 'neutral',
    numeralTabular: false,
    buttonRadius: CLEAN_SPEC.radius.button,
    buttonHeight: CLEAN_SPEC.sizes.button.height,
    buttonCase: 'none',
    chipCase: 'none',
    fabRadius: CLEAN_SPEC.radius.fab,
    fabShadow: true,
    actionHeight: CLEAN_SPEC.sizes.button.height,
    compactLabel: { size: 15, line: 22, weight: 'medium' },
    filledRole: 'primary',
    outlined: { border: c.hair, fill: c.white, ink: 'onSurface' },
    nav: {
      height: CLEAN_SPEC.sizes.nav.height,
      background: 'surface',
      border: c.hair,
      pill: 'surface',
      onPill: 'primary',
      pillWidth: CLEAN_SPEC.sizes.nav.slot,
      active: 'primary',
      idle: 'onSurfaceVariant',
      label: { size: 13, line: 18, weight: 'regular', activeWeight: 'regular' },
    },
  },
  // The mockup's map: pale grey land, blue-tinted water, white streets, the blue route;
  // the start dot is white with a blue ring, the end dot blue with a white ring.
  map: {
    base: 'light',
    land: c.mapLand,
    road: c.white,
    minorRoad: c.white,
    park: c.mapBlock,
    water: c.mapWater,
    building: c.mapBlock,
    label: c.muted,
    border: null,
    radius: CLEAN_SPEC.radius.map,
    height: CLEAN_SPEC.sizes.map.height,
    route: c.accent,
    routeWidth: 3,
    casing: null,
    start: c.white,
    startRing: c.accent,
    end: c.accent,
    endRing: c.white,
  },
};

export default theme;
