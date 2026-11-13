/**
 * Design tokens for the park-track world (.impeccable/surfaces/src-app-tabs-index-tsx.md).
 *
 * Plain data with no React Native, so jest can check the contrast. Screens
 * import these through '@/constants/theme' and read the colours with
 * useTheme(), which picks the light or dark scheme.
 *
 * Rules every screen keeps:
 * - Chrome is neutral: ink on lime-wash by day, lime-wash on night-park green-black by night.
 * - Colour lives only inside the data: steps (lawn green), food (red-oxide brick),
 *   water (morning-sky blue), sleep (dusk indigo), near (marigold, near the limit),
 *   over (Material error red, too much). Text stays ink; colour is never the only signal.
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
  /** Painted tick marks, every 10%. */
  tick: string;

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

const light = {
  primary: '#1D3024',
  onPrimary: '#F4F6F0',
  primaryContainer: '#D3E3D2',
  onPrimaryContainer: '#0F2416',
  secondary: '#4E5F54',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#CFE2CE',
  onSecondaryContainer: '#0F2416',
  tertiary: '#2B7A36',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#CFEACB',
  onTertiaryContainer: '#0D3313',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  background: '#F4F6F0',
  onBackground: '#142019',
  surface: '#F4F6F0',
  onSurface: '#142019',
  surfaceVariant: '#DCE2D8',
  onSurfaceVariant: '#434E47',
  surfaceDim: '#D4DAD0',
  surfaceBright: '#F4F6F0',
  surfaceContainerLowest: '#FBFCF8',
  surfaceContainerLow: '#EEF1EA',
  surfaceContainer: '#E8ECE4',
  surfaceContainerHigh: '#E2E7DE',
  surfaceContainerHighest: '#DCE2D8',
  inverseSurface: '#2A332D',
  inverseOnSurface: '#EDF1E9',
  inversePrimary: '#A9CDB0',
  outline: '#6F7A72',
  outlineVariant: '#C2CBC0',
  surfaceTint: '#1D3024',
  shadow: '#000000',
  scrim: '#000000',

  steps: '#2B7A36',
  onSteps: '#FFFFFF',
  stepsContainer: '#CFEACB',
  onStepsContainer: '#0D3313',
  food: '#A3462B',
  onFood: '#FFFFFF',
  foodContainer: '#F8DAD0',
  onFoodContainer: '#3D1206',
  water: '#2F6DAE',
  onWater: '#FFFFFF',
  waterContainer: '#D3E4F7',
  onWaterContainer: '#0A2D52',
  sleep: '#4A4EA3',
  onSleep: '#FFFFFF',
  sleepContainer: '#E0E0FA',
  onSleepContainer: '#15175A',
  near: '#9A5B00',
  onNear: '#FFFFFF',
  nearContainer: '#FBE3B5',
  onNearContainer: '#3A2400',
  over: '#BA1A1A',
  onOver: '#FFFFFF',

  lane: '#D3DBD0',
  tick: '#FFFFFF',
} as const;

const dark = {
  primary: '#D5E4D4',
  onPrimary: '#14251A',
  primaryContainer: '#2C3B30',
  onPrimaryContainer: '#D5E4D4',
  secondary: '#B7C9B9',
  onSecondary: '#233428',
  secondaryContainer: '#34483A',
  onSecondaryContainer: '#D2E6D3',
  tertiary: '#7CC77E',
  onTertiary: '#0A2E10',
  tertiaryContainer: '#1F4724',
  onTertiaryContainer: '#C3EFC1',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  background: '#0F1511',
  onBackground: '#E1E7DF',
  surface: '#0F1511',
  onSurface: '#E1E7DF',
  surfaceVariant: '#303832',
  onSurfaceVariant: '#BDC8BD',
  surfaceDim: '#0F1511',
  surfaceBright: '#353C36',
  surfaceContainerLowest: '#0A0F0C',
  surfaceContainerLow: '#171E19',
  surfaceContainer: '#1B231D',
  surfaceContainerHigh: '#252D27',
  surfaceContainerHighest: '#303832',
  inverseSurface: '#E1E7DF',
  inverseOnSurface: '#2A322C',
  inversePrimary: '#2F5A3A',
  outline: '#879288',
  outlineVariant: '#3F4842',
  surfaceTint: '#D5E4D4',
  shadow: '#000000',
  scrim: '#000000',

  steps: '#7CC77E',
  onSteps: '#0A2E10',
  stepsContainer: '#1F4724',
  onStepsContainer: '#C3EFC1',
  food: '#E58A6E',
  onFood: '#3D1206',
  foodContainer: '#5A2414',
  onFoodContainer: '#FFDBCF',
  water: '#8CBDF0',
  onWater: '#0A2D52',
  waterContainer: '#133B63',
  onWaterContainer: '#D3E4F7',
  sleep: '#A9ACF2',
  onSleep: '#15175A',
  sleepContainer: '#2E3170',
  onSleepContainer: '#E0E0FF',
  near: '#F2B33D',
  onNear: '#3A2400',
  nearContainer: '#5A3D00',
  onNearContainer: '#FFDEA6',
  over: '#FFB4AB',
  onOver: '#690005',

  lane: '#2C352F',
  tick: '#E1E7DF',
} as const;

type Roles = { [K in keyof typeof light]: string };

function withAliases(s: Roles): ColorScheme {
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

export const Colors: { light: ColorScheme; dark: ColorScheme } = {
  light: withAliases(light),
  dark: withAliases(dark),
};

export type ThemeColor = keyof ColorScheme;
export type SchemeName = keyof typeof Colors;

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

/** Material 3 shape scale, dp. */
export const Radius = {
  none: 0,
  /** Text fields, small marks. */
  xs: 4,
  /** Chips, tick bars, snackbars. */
  sm: 8,
  /** Cards and tiles. */
  md: 12,
  /** The FAB. */
  lg: 16,
  /** Sheets and dialogs. */
  xl: 28,
  /** Buttons, the navigation indicator. */
  full: 999,
} as const;

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
 * into the loaded font file, so Android never fakes a bold.
 */
export type FontWeightName = 'regular' | 'medium' | 'semibold' | 'bold';
export interface TypeSpec {
  size: number;
  line: number;
  weight: FontWeightName;
  tracking: number;
  /** Condensed numerals (track markers) instead of the UI face. */
  numeral?: true;
}

export const TypeScale = {
  displayLarge: { size: 57, line: 64, weight: 'medium', tracking: -0.25 },
  displayMedium: { size: 45, line: 52, weight: 'medium', tracking: 0 },
  displaySmall: { size: 36, line: 44, weight: 'medium', tracking: 0 },
  headlineLarge: { size: 32, line: 40, weight: 'semibold', tracking: 0 },
  headlineMedium: { size: 28, line: 36, weight: 'semibold', tracking: 0 },
  headlineSmall: { size: 24, line: 32, weight: 'semibold', tracking: 0 },
  titleLarge: { size: 22, line: 28, weight: 'semibold', tracking: 0 },
  titleMedium: { size: 16, line: 24, weight: 'semibold', tracking: 0.15 },
  titleSmall: { size: 14, line: 20, weight: 'semibold', tracking: 0.1 },
  bodyLarge: { size: 16, line: 24, weight: 'regular', tracking: 0.25 },
  bodyMedium: { size: 14, line: 20, weight: 'regular', tracking: 0.25 },
  bodySmall: { size: 12, line: 16, weight: 'regular', tracking: 0.4 },
  labelLarge: { size: 14, line: 20, weight: 'semibold', tracking: 0.1 },
  labelMedium: { size: 12, line: 16, weight: 'semibold', tracking: 0.5 },
  labelSmall: { size: 11, line: 16, weight: 'semibold', tracking: 0.5 },
  /** Today's steps in the track's infield. 9 modules on 10. */
  numeralHero: { size: 72, line: 80, weight: 'semibold', tracking: 0, numeral: true },
  /** 6 on 7 modules. */
  numeralLarge: { size: 48, line: 56, weight: 'semibold', tracking: 0, numeral: true },
  /** 4 on 5 modules: stat tiles. */
  numeralMedium: { size: 32, line: 40, weight: 'semibold', tracking: 0, numeral: true },
  /** 3 on 4 modules. */
  numeralSmall: { size: 24, line: 32, weight: 'medium', tracking: 0, numeral: true },
} as const satisfies Record<string, TypeSpec>;

export type TypeRole = keyof typeof TypeScale;

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
