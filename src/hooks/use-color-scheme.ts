import { ThemeMode } from '@/constants/theme';

/** The theme's scheme: every look keeps one (Clean+ and A, C to F are light, Night is dark), whatever the phone says. */
export function useColorScheme() {
  return ThemeMode;
}
