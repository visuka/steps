import { ThemeMode } from '@/constants/theme';

/** The theme's scheme: every look keeps one, whatever the browser says. */
export function useColorScheme() {
  return ThemeMode;
}
