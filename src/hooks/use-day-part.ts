import { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { DAY_PALETTES, type DayPalette, type DayPart, dayPartOf } from '@/constants/day-part';
import { timeNow } from '@/lib/when';

/**
 * A part of the day that wins over the clock: only the design preview sets it
 * (`&part=dawn|noon|dusk`), so CI can photograph each one.
 */
export const DayPartOverride = createContext<DayPart | null>(null);

/** The bottom bar's colours on Today: round buttons on the screen's ground. */
export function barColorsOf(p: DayPalette): { fill: string; hairline: string; active: string; activeFill: string; idle: string; idleFill: string } {
  return { fill: p.bg, hairline: p.bg, active: p.text, activeFill: p.card, idle: p.text, idleFill: p.edge };
}

function partNow(): DayPart {
  return dayPartOf(new Date(timeNow()));
}

/**
 * The part of the day and its colours for Today and the bar. Checked on
 * mount, when the app comes back to the front, and once a minute.
 */
export function useDayPart(): { part: DayPart; palette: DayPalette } {
  const forced = useContext(DayPartOverride);
  const [now, setNow] = useState<DayPart>(partNow);
  useEffect(() => {
    if (forced) return undefined;
    const check = () => setNow(partNow());
    check();
    const id = setInterval(check, 60_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [forced]);
  const part = forced ?? now;
  return { part, palette: DAY_PALETTES[part] };
}
