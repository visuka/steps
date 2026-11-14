import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { HOUR_CHART, hourBars, hourBarsLabel, hourRange } from '../hour-bars-geometry';

// Mockup heights for hours 6..15 (spec 5.4) with the tallest hour at 1,430 steps
// and goal 8,000 (goalPerHour 500, 1.5x = 750 < 1,430, so scaleMax = 1,430):
// steps = height / 60 x 1430, e.g. 7 -> 166.8, 37 -> 881.8, 21 -> 500.5.
const MOCKUP = [7, 60, 37, 21, 29, 22, 25, 18, 25, 13];
function mockupHours(): number[] {
  const hours = new Array<number>(24).fill(0);
  MOCKUP.forEach((h, i) => {
    hours[6 + i] = Math.round((h / 60) * 1430);
  });
  return hours;
}

describe('hour bars geometry', () => {
  const hours = mockupHours();
  const g = hourBars({ hours, goal: 8000, width: 294 });

  it('uses the spec numbers', () => {
    expect(HOUR_CHART.height).toBe(CLEAN_SPEC.sizes.hero.chartHeight);
    expect(HOUR_CHART.barWidth).toBe(6);
    expect(HOUR_CHART.tallest).toBe(60);
    expect(HOUR_CHART.quietHeight).toBe(3);
    expect(HOUR_CHART.labelBaseline).toBe(37);
    expect(HOUR_CHART.goalDash).toEqual([3, 4]);
  });

  it('places 24 bars at x = 3 + hour x pitch', () => {
    expect(g.bars).toHaveLength(24);
    expect(g.pitch).toBeCloseTo(12.25, 5);
    expect(g.bars[23].x).toBeCloseTo(284.75, 5);
    expect(g.bars[23].x + g.bars[23].width).toBeCloseTo(290.75, 5);
  });

  it('reproduces the mockup bar heights within 1 dp', () => {
    MOCKUP.forEach((h, i) => expect(Math.abs(g.bars[6 + i].height - h)).toBeLessThan(1));
    expect(g.scaleMax).toBe(1430);
  });

  it('draws empty hours as 3 dp quiet bars with radius 1.5, others with radius 3', () => {
    expect(g.bars[0]).toMatchObject({ height: 3, rx: 1.5, quiet: true, y: 61 });
    expect(g.bars[7]).toMatchObject({ rx: 3, quiet: false, y: 4 });
  });

  it('puts the goal line at y 43', () => {
    expect(Math.round(g.goalLineY as number)).toBe(43);
  });

  it('never lifts the goal line above y 24 and gives bars at least 4 dp', () => {
    const low = hourBars({ hours: [1, ...new Array<number>(23).fill(0)], goal: 100000, width: 294 });
    expect(low.goalLineY).toBe(24);
    const tiny = hourBars({ hours: [1, 5000, ...new Array<number>(22).fill(0)], goal: 8000, width: 294 });
    expect(tiny.bars[0].height).toBe(4);
  });

  it('with no goal there is no line', () => {
    expect(hourBars({ hours, goal: 0, width: 294 }).goalLineY).toBeNull();
  });

  it('draws hours after now as quiet', () => {
    const t = hourBars({ hours, goal: 8000, width: 294, now: 8 });
    expect(t.bars[8].quiet).toBe(false);
    expect(t.bars[9].quiet).toBe(true);
  });

  it('grows the pitch with the width (411 phone)', () => {
    expect(hourBars({ hours, goal: 8000, width: 315 }).pitch).toBeCloseTo(315 / 24, 5);
  });
});

describe('hour bars label', () => {
  it('states a total equal to the sum of the data', () => {
    const hours = new Array<number>(24).fill(0);
    hours[7] = 1430;
    hours[8] = 4810;
    expect(hourBarsLabel(hours, 8000)).toContain('6,240 steps in total');
    expect(hourBarsLabel(hours, 8000)).toContain('busiest hour 8 to 9 am with 4,810');
    const m = mockupHours();
    const sum = m.reduce((a, b) => a + b, 0);
    expect(hourBarsLabel(m, 8000)).toContain(`${String(sum).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} steps in total`);
  });

  it('names hour ranges', () => {
    expect(hourRange(7)).toBe('7 to 8 am');
    expect(hourRange(11)).toBe('11 am to 12 pm');
    expect(hourRange(12)).toBe('12 to 1 pm');
    expect(hourRange(23)).toBe('11 pm to 12 am');
    expect(hourRange(0)).toBe('12 to 1 am');
  });

  it('handles no steps', () => {
    expect(hourBarsLabel(new Array<number>(24).fill(0), 8000)).toBe('Steps by hour: no steps yet');
  });
});
