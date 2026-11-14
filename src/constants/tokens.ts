/**
 * Design tokens shared by every theme: the shape of a colour scheme, the
 * type scale and the radius scale, plus the 8 dp grid, motion and contrast
 * helpers. Each theme's own values live in constants/themes/<id>.ts.
 *
 * Plain data with no React Native, so jest can check the contrast. Screens
 * import these through '@/constants/theme' (which picks the active theme)
 * and read the colours with useTheme(), which picks the light or dark scheme.
 *
 * Rules every theme and screen keeps:
 * - Colour belongs to the data: steps, food, water, sleep, near (near the limit),
 *   over (too much). A theme may paint whole tiles in a data colour's container
 *   (tile: 'filled'); text on it is that container's `on` colour.
 * - Colour is never the only signal: a number, a label or an icon says it too.
 * - Body text 4.5:1, large text and marks 3:1 (__tests__/tokens.test.ts, every theme and scheme).
 * - Flat colour only: no gradients, glass, glow or shimmer.
 * - Elevation is tonal: a raised thing sits on a higher surfaceContainer role, not a shadow.
 */

/** Every Material 3 colour role, plus the data colours and the track paint. */
export interface ColorScheme {
  // ── Material 3 roles ──
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  outline: string;
  outlineVariant: string;
  surfaceTint: string;
  shadow: string;
  scrim: string;

  // ── Data colours: marks (bars, the track, dots), never chrome or body text ──
  steps: string;
  onSteps: string;
  stepsContainer: string;
  onStepsContainer: string;
  food: string;
  onFood: string;
  foodContainer: string;
  onFoodContainer: string;
  /** Second and third marks of the food family, for a bar split three ways (carbs, protein, fat). 3:1 on the lane and cards. */
  food2: string;
  food3: string;
  water: string;
  onWater: string;
  waterContainer: string;
  onWaterContainer: string;
  sleep: string;
  onSleep: string;
  sleepContainer: string;
  onSleepContainer: string;
  /** Marigold: near the limit. Always with a label or icon too. */
  near: string;
  onNear: string;
  nearContainer: string;
  onNearContainer: string;
  /** Too much: the Material error red. Always with a label or icon too. */
  over: string;
  onOver: string;

  // ── Track paint ──
  /** The unfilled lane of a track or bar. */
  lane: string;
  /** Painted tick marks, every 10%. Kept for marks on neutral ground (route start dots). */
  tick: string;
  /**
   * Ticks on the part of a lane still to go: 3:1 against the lane, so the
   * remaining tenths and the end of the bar can be counted. Ticks over the
   * covered part use the tone's `on` colour (toneColors().on).
   */
  laneTick: string;

  // ── Older names, kept so every existing screen keeps working. New code uses the roles above. ──
  /** = onSurface */
  text: string;
  /** = onSurfaceVariant */
  textSecondary: string;
  /** = surfaceContainer (cards) */
  backgroundElement: string;
  /** = surfaceContainerHighest */
  backgroundSelected: string;
  /** = steps (progress green, for charts) */
  accent: string;
  /** = stepsContainer */
  accentSoft: string;
  /** = onSteps */
  onAccent: string;
  /** = lane */
  track: string;
  /** = error */
  danger: string;
  /** = near (marigold) */
  warning: string;
}

/** The colour roles a theme writes; the older alias names are filled in by schemeFromRoles. */
export type AliasRole =
  | 'text'
  | 'textSecondary'
  | 'backgroundElement'
  | 'backgroundSelected'
  | 'accent'
  | 'accentSoft'
  | 'onAccent'
  | 'track'
  | 'danger'
  | 'warning';
export type SchemeRoles = Omit<ColorScheme, AliasRole>;

/** A full ColorScheme from a theme's roles, with the older names pointing at the new roles. */
export function schemeFromRoles(s: SchemeRoles): ColorScheme {
  return {
    ...s,
    text: s.onSurface,
    textSecondary: s.onSurfaceVariant,
    backgroundElement: s.surfaceContainer,
    backgroundSelected: s.surfaceContainerHighest,
    accent: s.steps,
    accentSoft: s.stepsContainer,
    onAccent: s.onSteps,
    track: s.lane,
    danger: s.error,
    warning: s.near,
  };
}

export type ThemeColor = keyof ColorScheme;
export type SchemeName = 'light' | 'dark';

/** What a piece of data is about; picks its colour. */
export type DataTone = 'steps' | 'food' | 'water' | 'sleep' | 'near' | 'over';

/** A data tone's mark colour, the colour on top of it, and its quiet container pair. */
export function toneColors(c: ColorScheme, tone: DataTone) {
  switch (tone) {
    case 'steps':
      return { fill: c.steps, on: c.onSteps, container: c.stepsContainer, onContainer: c.onStepsContainer };
    case 'food':
      return { fill: c.food, on: c.onFood, container: c.foodContainer, onContainer: c.onFoodContainer };
    case 'water':
      return { fill: c.water, on: c.onWater, container: c.waterContainer, onContainer: c.onWaterContainer };
    case 'sleep':
      return { fill: c.sleep, on: c.onSleep, container: c.sleepContainer, onContainer: c.onSleepContainer };
    case 'near':
      return { fill: c.near, on: c.onNear, container: c.nearContainer, onContainer: c.onNearContainer };
    case 'over':
      return { fill: c.over, on: c.onOver, container: c.errorContainer, onContainer: c.onErrorContainer };
  }
}

/**
 * The 8 dp module. Spacing.two is one module; three, four, five and six are
 * 2, 3, 4 and 8 modules. Spacing.one (half a module) is only for the gap
 * between an icon and its label; Spacing.half is a hairline, kept for old code.
 */
export const Module = 8;
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Material 3 shape scale, dp. Each theme sets its own values (park: 4, 8, 12, 16, 28). */
export interface RadiusScale {
  none: number;
  /** Text fields, small marks. */
  xs: number;
  /** Chips, tick bars, snackbars. */
  sm: number;
  /** Cards and tiles. */
  md: number;
  /** The FAB. */
  lg: number;
  /** Sheets and dialogs. */
  xl: number;
  /** Buttons, the navigation indicator. */
  full: number;
}

/** Tonal elevation: which surface role a raised thing sits on. */
export const Elevation = {
  level0: 'surface',
  level1: 'surfaceContainerLow',
  level2: 'surfaceContainer',
  level3: 'surfaceContainerHigh',
  level4: 'surfaceContainerHighest',
} as const satisfies Record<string, ThemeColor>;

/** Minimum touch target, dp. */
export const TouchTarget = 48;
/** Material 3 navigation bar height, dp (plus the system bar inset). */
export const NavigationBarHeight = 80;
export const MaxContentWidth = 640;

/** Material 3 easing and durations. Reduce motion turns every move into a cut. */
export const Motion = {
  /** cubic-bezier(0.2, 0, 0, 1): Material standard. */
  standard: [0.2, 0, 0, 1] as const,
  standardDecelerate: [0, 0, 0, 1] as const,
  standardAccelerate: [0.3, 0, 1, 1] as const,
  duration: {
    short: 150,
    medium: 300,
    long: 450,
    /** The runner dot moving to the new step count. */
    runner: 600,
  },
} as const;

/**
 * Material 3 type scale in sp (React Native font sizes follow the phone's
 * text-size setting). Weights are named, not numbered: theme.ts turns each
 * into the theme's loaded font file, so Android never fakes a bold.
 */
export type FontWeightName = 'regular' | 'medium' | 'semibold' | 'bold';
export interface TypeSpec {
  size: number;
  line: number;
  weight: FontWeightName;
  tracking: number;
  /** The theme's numeral face (park: condensed) instead of the UI face. */
  numeral?: true;
  /**
   * Titles set in the numeral face, without tabular figures: C's Fraunces
   * headings, so its `bold` UI weight can stay Inter.
   */
  display?: true;
}

/** Every role of the type scale; each theme gives a TypeSpec for each. */
export const TYPE_ROLES = [
  'displayLarge',
  'displayMedium',
  'displaySmall',
  'headlineLarge',
  'headlineMedium',
  'headlineSmall',
  'titleLarge',
  'titleMedium',
  'titleSmall',
  'bodyLarge',
  'bodyMedium',
  'bodySmall',
  'labelLarge',
  'labelMedium',
  'labelSmall',
  /** Today's steps (the hero). */
  'numeralHero',
  'numeralLarge',
  /** Stat tiles. */
  'numeralMedium',
  'numeralSmall',
] as const;

export type TypeRole = (typeof TYPE_ROLES)[number];
export type TypeScaleShape = Record<TypeRole, TypeSpec>;

// ── contrast, for the tests and for anyone picking a pair ──

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #RRGGBB colour. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio of two #RRGGBB colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
