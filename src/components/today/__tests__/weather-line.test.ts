import { describe, expect, it } from '@jest/globals';

import { SAMPLE_WEATHER } from '@/design-preview/sample';

import { todayWeather } from '../weather-line';

const at = (h: number) => new Date(2026, 10, 14, h, 0).getTime();

describe('todayWeather', () => {
  it('is null without a saved day', () => {
    expect(todayWeather(null, at(15), 'metric')).toBeNull();
  });

  it('reads the sample day as 24 degrees clear, with its spoken form', () => {
    expect(todayWeather(SAMPLE_WEATHER, at(15), 'metric')).toEqual({
      condition: 'clear',
      text: '24°C clear',
      spoken: 'Weather: 24 degrees, clear',
    });
  });

  it('uses the hour that is saved, with its own sky', () => {
    const day = { ...SAMPLE_WEATHER, hours: { 7: { tempC: 31, precipMm: 0, symbol: 'partlycloudy_day' } } };
    expect(todayWeather(day, at(7), 'metric')?.text).toBe('31°C partly cloudy');
  });

  it('converts for imperial units', () => {
    const w = todayWeather(SAMPLE_WEATHER, at(15), 'imperial');
    expect(w?.text).toBe('75°F clear');
    expect(w?.spoken).toBe('Weather: 75 degrees Fahrenheit, clear');
  });
});
