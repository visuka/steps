import { describe, expect, it } from '@jest/globals';

import { chartSummary, hourName } from '../bar-chart-speech';

describe('hourName', () => {
  it('says hours the way people do', () => {
    expect(hourName(0)).toBe('12 am');
    expect(hourName(1)).toBe('1 am');
    expect(hourName(12)).toBe('12 pm');
    expect(hourName(18)).toBe('6 pm');
    expect(hourName(23)).toBe('11 pm');
  });
});

describe('chartSummary', () => {
  const describeBar = (b: { key: string; value: number }) => `${hourName(Number(b.key))}, ${b.value} steps`;

  it('names the biggest bar with its unit', () => {
    const bars = [
      { key: '6', value: 300, label: '6a' },
      { key: '18', value: 2140, label: '6p' },
      { key: '19', value: 900, label: '' },
    ];
    expect(chartSummary('Steps by hour', bars, describeBar)).toBe('Steps by hour. Most at 6 pm, 2140 steps.');
  });

  it('says so when there is nothing yet', () => {
    expect(chartSummary('Steps by hour', [{ key: '0', value: 0, label: '' }], describeBar)).toBe('Steps by hour. Nothing yet.');
  });
});
