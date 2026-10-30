import { describe, expect, it } from '@jest/globals';

import { conditionFromSymbol, hoursForDay, type MetForecast, summarizeDay, weatherAt } from '@/weather/met';

/** Local-time ISO string, so tests don't depend on the machine's time zone. */
const local = (h: number) => new Date(2026, 9, 30, h).toISOString();

function forecast(entries: { hour: number; temp: number; symbol: string; rain?: number }[]): MetForecast {
  return {
    properties: {
      timeseries: entries.map((e) => ({
        time: local(e.hour),
        data: {
          instant: { details: { air_temperature: e.temp } },
          next_1_hours: { summary: { symbol_code: e.symbol }, details: { precipitation_amount: e.rain ?? 0 } },
        },
      })),
    },
  };
}

describe('MET Norway forecast', () => {
  it('maps symbol codes to conditions', () => {
    expect(conditionFromSymbol('clearsky_day')).toBe('clear');
    expect(conditionFromSymbol('fair_night')).toBe('clear');
    expect(conditionFromSymbol('partlycloudy_day')).toBe('partly');
    expect(conditionFromSymbol('lightrainshowers_day')).toBe('rain');
    expect(conditionFromSymbol('heavyrainandthunder')).toBe('storm');
    expect(conditionFromSymbol('fog')).toBe('fog');
  });

  it("keeps hours from earlier fetches and updates the rest", () => {
    const morning = hoursForDay(
      forecast([
        { hour: 9, temp: 26, symbol: 'clearsky_day' },
        { hour: 15, temp: 33, symbol: 'clearsky_day' },
      ]),
      '2026-10-30',
      {},
    );
    const afternoon = hoursForDay(
      forecast([
        { hour: 15, temp: 31, symbol: 'rain', rain: 4 },
        { hour: 23, temp: 22, symbol: 'cloudy' },
        // Tomorrow: ignored.
        { hour: 25, temp: 20, symbol: 'cloudy' },
      ]),
      '2026-10-30',
      morning,
    );
    expect(Object.keys(afternoon).map(Number).sort((a, b) => a - b)).toEqual([9, 15, 23]);
    expect(afternoon[9].tempC).toBe(26);
    expect(afternoon[15]).toEqual({ tempC: 31, precipMm: 4, symbol: 'rain' });
  });

  it('summarizes a day', () => {
    const hours = hoursForDay(
      forecast([
        { hour: 7, temp: 24.4, symbol: 'partlycloudy_day' },
        { hour: 12, temp: 34.6, symbol: 'partlycloudy_day' },
        { hour: 16, temp: 33, symbol: 'clearsky_day' },
        { hour: 21, temp: 27, symbol: 'clearsky_night' },
      ]),
      '2026-10-30',
      {},
    );
    expect(summarizeDay('2026-10-30', hours, 'Indiranagar', 1)).toEqual(
      expect.objectContaining({ tempMaxC: 35, tempMinC: 24, precipMm: 0, condition: 'partly', place: 'Indiranagar' }),
    );
  });

  it('calls a day with real rain rainy', () => {
    const hours = hoursForDay(
      forecast([
        { hour: 10, temp: 28, symbol: 'cloudy' },
        { hour: 11, temp: 28, symbol: 'cloudy' },
        { hour: 17, temp: 25, symbol: 'heavyrain', rain: 6 },
      ]),
      '2026-10-30',
      {},
    );
    expect(summarizeDay('2026-10-30', hours, null, 1)?.condition).toBe('rain');
  });

  it('reads the weather at a time of day', () => {
    const hours = hoursForDay(forecast([{ hour: 18, temp: 29.4, symbol: 'rainshowers_day', rain: 1 }]), '2026-10-30', {});
    const summary = summarizeDay('2026-10-30', hours, null, 1);
    expect(weatherAt(summary, new Date(2026, 9, 30, 18, 40).getTime())).toEqual({ tempC: 29, condition: 'rain' });
  });
});
