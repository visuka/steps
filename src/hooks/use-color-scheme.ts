import { useColorScheme as usePhoneScheme } from 'react-native';

import { ThemeMode } from '@/constants/theme';

/** The phone's light or dark setting, unless the theme keeps one scheme always (Night is dark). */
export function useColorScheme() {
  const phone = usePhoneScheme();
  return ThemeMode === 'system' ? phone : ThemeMode;
}
