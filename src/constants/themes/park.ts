/**
 * Park: the park-track world (.impeccable/surfaces/src-app-tabs-index-tsx.md).
 * The app's first look, kept as a theme so nothing is lost.
 *
 * - Chrome is neutral: ink on lime-wash by day, lime-wash on night-park green-black by night.
 * - Colour lives only inside the data: steps (lawn green), food (red-oxide brick),
 *   water (morning-sky blue), sleep (dusk indigo), near (marigold, near the limit),
 *   over (Material error red, too much).
 * - Barlow for the UI, Barlow Condensed for the big numbers; the oval track on Today.
 */

import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { Barlow_700Bold } from '@expo-google-fonts/barlow/700Bold';
import { BarlowCondensed_500Medium } from '@expo-google-fonts/barlow-condensed/500Medium';
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';

import { type RadiusScale, schemeFromRoles, type SchemeRoles, type TypeScaleShape } from '../tokens';
import type { ThemeDef } from './types';

const light: SchemeRoles = {
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
  food2: '#6E2A17',
  food3: '#4A1A0D',
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

  // A step darker than surfaceVariant, so the lane reads on cards; every data colour still keeps 3:1 on it.
  lane: '#C9D2C5',
  tick: '#FFFFFF',
  laneTick: '#58635C',
};

const dark: SchemeRoles = {
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
  food2: '#FFD9CC',
  food3: '#C0603F',
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
  laneTick: '#95A096',
};

/** Material 3 type scale; the numerals sit on whole 8 dp modules. */
export const ParkType: TypeScaleShape = {
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
};

/** Material 3 shape scale, dp. */
export const ParkRadius: RadiusScale = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  full: 999,
};

const park: ThemeDef = {
  id: 'park',
  name: 'Park',
  description: 'The running track. Calm greens, the oval lap on Today.',
  mode: 'system',
  colors: { light: schemeFromRoles(light), dark: schemeFromRoles(dark) },
  fonts: {
    regular: { family: 'Barlow_400Regular', source: Barlow_400Regular },
    medium: { family: 'Barlow_500Medium', source: Barlow_500Medium },
    semibold: { family: 'Barlow_600SemiBold', source: Barlow_600SemiBold },
    bold: { family: 'Barlow_700Bold', source: Barlow_700Bold },
    numeralMedium: { family: 'BarlowCondensed_500Medium', source: BarlowCondensed_500Medium },
    numeral: { family: 'BarlowCondensed_600SemiBold', source: BarlowCondensed_600SemiBold },
  },
  type: ParkType,
  radius: ParkRadius,
  style: { tile: 'plain', hero: 'track', bar: 'ticked', navIndicator: 'neutral', numeralTabular: true },
};

export default park;
