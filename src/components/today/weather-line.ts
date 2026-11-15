/** Today's weather line, next to the date (spec 5.1): the figure, what it says and what TalkBack says. */

import type { DayWeather, WeatherCondition } from '@/data/types';
import { formatTemp, type Units } from '@/lib/format';
import { CONDITION_LABEL, weatherAt } from '@/weather/met';

export interface TodayWeather {
  condition: WeatherCondition;
  /** "24°C clear". */
  text: string;
  /** "Weather: 24 degrees, clear". */
  spoken: string;
}

/** The weather now, from today's saved day; null when none is saved (nothing is drawn). */
export function todayWeather(day: DayWeather | null, at: number, units: Units): TodayWeather | null {
  const w = weatherAt(day, at);
  if (!w) return null;
  const label = CONDITION_LABEL[w.condition].toLowerCase();
  const degrees = units === 'metric' ? Math.round(w.tempC) : Math.round((w.tempC * 9) / 5 + 32);
  return {
    condition: w.condition,
    text: `${formatTemp(w.tempC, units)} ${label}`,
    spoken: `Weather: ${degrees} degrees${units === 'metric' ? '' : ' Fahrenheit'}, ${label}`,
  };
}
