import { describe, expect, it } from '@jest/globals';

import type { Walk, WalkPart } from '@/data/types';
import { SAMPLE_WALK, SAMPLE_WALK_PARTS } from '@/design-preview/sample';

import { distanceFigure, partsModel, partStatusShort, sparkline, speedSeries, SPARK, walkStats, weatherText } from '../walk-model';

describe('walk screen figures', () => {
  it('reads the mockup sample walk as the mockups print it', () => {
    const s = walkStats(SAMPLE_WALK, 'metric');
    expect(s.hero).toMatchObject({ value: '2.3', unit: 'km', label: 'Distance' });
    expect(s.stats.map((x) => [x.id, x.value, x.unit])).toEqual([
      ['time', '32', 'min'],
      ['steps', '3,120', undefined],
      ['pace', '13:55', '/km'],
      ['floors', '2', 'floors'],
    ]);
    expect(weatherText(SAMPLE_WALK.weather, 'metric')).toBe('24°C clear');
  });

  it('keeps every cell when data is missing', () => {
    const bare: Walk = { ...SAMPLE_WALK, steps: null, floorsUp: null, floorsDown: null, liftUp: null, liftDown: null, weather: null };
    const s = walkStats(bare, 'metric');
    expect(s.stats.map((x) => x.value)).toEqual(['32', '—', '13:55', '—']);
    expect(weatherText(null, 'metric')).toBeNull();
  });

  it('gives rides speeds and climb, indoor rides the time', () => {
    const ride: Walk = { ...SAMPLE_WALK, activity: 'ride', topSpeedMs: 8 };
    expect(walkStats(ride, 'metric').stats.map((x) => x.id)).toEqual(['time', 'avgSpeed', 'topSpeed', 'climb']);
    const indoor: Walk = { ...ride, distanceFrom: 'none', effort: 'hard' };
    const s = walkStats(indoor, 'metric');
    expect(s.hero.id).toBe('time');
    expect(s.stats.map((x) => x.value)).toEqual(['118', 'Hard']);
  });

  it('one decimal in miles too', () => {
    expect(distanceFigure(2300, 'imperial')).toEqual({ value: '1.4', unit: 'mi' });
  });
});

describe('parts list', () => {
  it('splits the sample into "Walk 28 min" and "Car 6 min removed" with Keep', () => {
    const m = partsModel(SAMPLE_WALK, SAMPLE_WALK_PARTS);
    expect(m.main).toEqual({ name: 'Walk', time: '28 min' });
    expect(m.parts).toEqual([
      { ord: 0, name: 'Car', time: '6 min', counted: false, status: 'removed', toggle: { choice: 'keep', label: 'Keep' } },
    ]);
  });

  it('offers Remove once a part counts, and says where an unanswered one stands', () => {
    const kept: WalkPart = { ...SAMPLE_WALK_PARTS[0], choice: 'keep' };
    expect(partsModel(SAMPLE_WALK, [kept]).parts[0].toggle).toEqual({ choice: 'remove', label: 'Remove' });
    expect(partStatusShort({ choice: null, defaultKeep: false }, 'walk')).toBe('removed for now');
    expect(partStatusShort({ choice: 'cycle', defaultKeep: false }, 'walk')).toBe('kept as cycling');
  });

  it('shows the walk row alone when there are no parts', () => {
    expect(partsModel(SAMPLE_WALK, [])).toMatchObject({ main: { name: 'Walk', time: '32 min' }, parts: [] });
  });
});

describe('stat cards (spec 5.11)', () => {
  it('words the fourth card "Climbed" and keeps the mockup order Time, Steps, Pace, Climbed', () => {
    const s = walkStats(SAMPLE_WALK, 'metric');
    expect(s.stats.map((x) => x.label)).toEqual(['Time', 'Steps', 'Pace', 'Climbed']);
  });
});

/** Points along a line at a steady speed (m/s), one a second, 111.32 m per 0.001 degree of latitude. */
function leg(n: number, speed: (i: number) => number, t0 = 0) {
  const pts = [];
  let lat = 17.44;
  for (let i = 0; i < n; i++) {
    pts.push({ t: t0 + i * 1000, lat, lon: 78.35, part: null });
    lat += speed(i) / 111_320;
  }
  return pts;
}

describe('pace sparkline (spec 6.1)', () => {
  it('has nine points 16 apart in a 128 x 32 box, faster higher', () => {
    const v = speedSeries(leg(81, (i) => (i < 40 ? 1 : 2)))!;
    expect(v).toHaveLength(SPARK.samples);
    expect(v[0]).toBeCloseTo(1, 1);
    expect(v[8]).toBeCloseTo(2, 1);
    const s = sparkline(v)!;
    const ys = s.line
      .slice(1)
      .split(' L')
      .map((p) => Number(p.split(' ')[1]));
    const xs = s.line
      .slice(1)
      .split(' L')
      .map((p) => Number(p.split(' ')[0]));
    expect(xs).toEqual([0, 16, 32, 48, 64, 80, 96, 112, 128]);
    expect(Math.min(...ys)).toBe(SPARK.top);
    expect(Math.max(...ys)).toBe(SPARK.bottom);
    expect(ys[0]).toBe(SPARK.bottom);
    expect(ys[8]).toBe(SPARK.top);
    expect(s.area).toBe(`${s.line} V32 H0Z`);
  });

  it('is flat in the middle of the range when the speed never changes', () => {
    const s = sparkline(speedSeries(leg(60, () => 1.5)))!;
    const ys = s.line
      .slice(1)
      .split(' L')
      .map((p) => Number(p.split(' ')[1]));
    expect(new Set(ys)).toEqual(new Set([16]));
  });

  it('draws nothing without a route, without time or without distance', () => {
    expect(speedSeries([])).toBeNull();
    expect(speedSeries(leg(1, () => 1))).toBeNull();
    expect(speedSeries(leg(30, () => 0))).toBeNull();
    expect(speedSeries([{ t: 5, lat: 1, lon: 1, part: null }, { t: 5, lat: 1.001, lon: 1, part: null }])).toBeNull();
    expect(sparkline(null)).toBeNull();
    expect(sparkline([3])).toBeNull();
  });

  it('leaves out the parts that are not the walk itself', () => {
    const route = leg(41, () => 1);
    const car = leg(41, () => 20, 41_000).map((p) => ({ ...p, part: 0 }));
    const v = speedSeries([...route, ...car])!;
    expect(Math.max(...v)).toBeLessThan(1.5);
  });
});
