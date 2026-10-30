/**
 * Reads MET Norway's Locationforecast (compact) into the day's weather. The
 * forecast only covers now onwards, so hours already past are kept from
 * earlier fetches that day; the day's figures fill in as the app is opened.
 */
import type { DayWeather, HourWeather, WeatherCondition } from '@/data/types';
import { dayKey } from '@/lib/dates';

export interface MetForecast {
  properties: {
    timeseries: {
      time: string;
      data: {
        instant: { details: { air_temperature?: number } };
        next_1_hours?: { summary: { symbol_code: string }; details?: { precipitation_amount?: number } };
        next_6_hours?: { summary: { symbol_code: string }; details?: { precipitation_amount?: number } };
      };
    }[];
  };
}

export function conditionFromSymbol(symbol: string): WeatherCondition {
  const s = symbol.replace(/_(day|night|polartwilight)$/, '');
  if (s.includes('thunder')) return 'storm';
  if (s.includes('snow')) return 'snow';
  if (s.includes('rain') || s.includes('sleet')) return 'rain';
  if (s === 'fog') return 'fog';
  if (s === 'cloudy') return 'cloudy';
  if (s === 'partlycloudy') return 'partly';
  return 'clear';
}

export const CONDITION_LABEL: Record<WeatherCondition, string> = {
  clear: 'Clear',
  partly: 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Fog',
  rain: 'Rain',
  storm: 'Thunderstorms',
  snow: 'Snow',
};

export const CONDITION_ICON: Record<WeatherCondition, string> = {
  clear: '☀️',
  partly: '⛅',
  cloudy: '☁️',
  fog: '🌫️',
  rain: '🌧️',
  storm: '⛈️',
  snow: '❄️',
};

/** The forecast's hours on local day `date`, layered over hours kept from earlier fetches. */
export function hoursForDay(
  forecast: MetForecast,
  date: string,
  previous: Record<number, HourWeather>,
): Record<number, HourWeather> {
  const hours: Record<number, HourWeather> = { ...previous };
  for (const entry of forecast.properties.timeseries) {
    const t = new Date(entry.time);
    if (dayKey(t) !== date) continue;
    const temp = entry.data.instant.details.air_temperature;
    if (temp === undefined) continue;
    const next = entry.data.next_1_hours;
    hours[t.getHours()] = {
      tempC: temp,
      precipMm: next?.details?.precipitation_amount ?? null,
      symbol: next?.summary.symbol_code ?? entry.data.next_6_hours?.summary.symbol_code ?? null,
    };
  }
  return hours;
}

const DAYTIME = (h: number) => h >= 6 && h <= 19;

export function summarizeDay(
  date: string,
  hours: Record<number, HourWeather>,
  place: string | null,
  now: number,
): DayWeather | null {
  const entries = Object.entries(hours).map(([h, w]) => ({ hour: Number(h), ...w }));
  if (!entries.length) return null;
  const temps = entries.map((e) => e.tempC);
  const precipMm = Math.round(entries.reduce((s, e) => s + (e.precipMm ?? 0), 0) * 10) / 10;

  const daytime = entries.filter((e) => DAYTIME(e.hour) && e.symbol);
  const conditions = (daytime.length ? daytime : entries.filter((e) => e.symbol)).map((e) =>
    conditionFromSymbol(e.symbol!),
  );
  let condition: WeatherCondition;
  if (conditions.includes('storm')) condition = 'storm';
  else if (precipMm >= 1 || conditions.filter((c) => c === 'rain').length >= 2) condition = 'rain';
  else {
    const counts = new Map<WeatherCondition, number>();
    for (const c of conditions) counts.set(c, (counts.get(c) ?? 0) + 1);
    condition = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'clear';
  }

  return {
    date,
    tempMaxC: Math.round(Math.max(...temps)),
    tempMinC: Math.round(Math.min(...temps)),
    precipMm,
    condition,
    place,
    hours,
    updatedAt: now,
  };
}

/** The weather at a moment, from that day's hours. */
export function weatherAt(day: DayWeather | null, at: number): { tempC: number; condition: WeatherCondition } | null {
  if (!day) return null;
  const hour = new Date(at).getHours();
  const w = day.hours[hour];
  if (!w) return { tempC: Math.round((day.tempMaxC + day.tempMinC) / 2), condition: day.condition };
  return { tempC: Math.round(w.tempC), condition: w.symbol ? conditionFromSymbol(w.symbol) : day.condition };
}
