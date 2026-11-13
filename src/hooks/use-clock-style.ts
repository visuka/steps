import { useCalendars, useLocales } from 'expo-localization';
import { useMemo } from 'react';

import type { ClockStyle } from '@/lib/when';

/**
 * The phone's 12/24-hour setting and region, for showing times. Updates when
 * either changes in the phone's settings. Words stay English like the rest
 * of the app; the region sets the order of day and month.
 */
export function useClockStyle(): ClockStyle {
  const [calendar] = useCalendars();
  const [locale] = useLocales();
  const uses24h = calendar?.uses24hourClock ?? null;
  const region = locale?.regionCode ?? null;
  return useMemo(() => ({ uses24h, locale: region ? `en-${region}` : 'en-GB' }), [uses24h, region]);
}
