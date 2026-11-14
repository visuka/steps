import { describe, expect, it } from '@jest/globals';

import type { SleepEntry, Walk } from '@/data/types';

import { clockOf, distanceOf, heroSpoken, percentOf, sleepOf, untimedNote, walkOf, weekOf } from '../model';

const at = (h: number, m: number, day = 14) => new Date(2025, 10, day, h, m).getTime();

function walk(id: string, startedAt: number, distanceM = 2300): Walk {
  return {
    id,
    startedAt,
    endedAt: startedAt + 32 * 60_000,
    distanceM,
    movingS: 1920,
    steps: 3120,
    activeKcal: 120,
    startPlace: null,
    weather: null,
    updatedAt: startedAt,
  };
}

function night(asleepMin: number): SleepEntry {
  return {
    id: `s${asleepMin}`,
    date: '2025-11-14',
    startAt: at(23, 20, 13),
    endAt: at(6, 10),
    asleepMin,
    rested: null,
    source: 'manual',
    healthId: null,
    stages: null,
    updatedAt: 0,
  };
}

describe('Today figures, as the mockups set them', () => {
  it('gives distance to one decimal, split from its unit', () => {
    expect(distanceOf(4600, 'metric')).toEqual({ value: '4.6', unit: 'km' });
    expect(distanceOf(4600, 'imperial')).toEqual({ value: '2.9', unit: 'mi' });
  });

  it('writes a walk time as 7:10 am', () => {
    expect(clockOf(at(7, 10))).toBe('7:10 am');
    expect(clockOf(at(0, 5))).toBe('12:05 am');
    expect(clockOf(at(13, 30))).toBe('1:30 pm');
  });

  it('gives last night as 6 h 50 m, and null when nothing is logged', () => {
    expect(sleepOf([night(410)])).toEqual({ h: 6, m: 50, spoken: '6 hours 50 minutes' });
    expect(sleepOf([])).toBeNull();
  });

  it('says sleep aloud with singular and plural, leaving out a zero part', () => {
    expect(sleepOf([night(61)])?.spoken).toBe('1 hour 1 minute');
    expect(sleepOf([night(45)])?.spoken).toBe('45 minutes');
    expect(sleepOf([night(60)])?.spoken).toBe('1 hour');
    expect(sleepOf([night(120)])?.spoken).toBe('2 hours');
    expect(sleepOf([night(0)])?.spoken).toBe('0 minutes');
  });

  it("shows today's latest walk only", () => {
    const w = walkOf([walk('old', at(18, 0, 13)), walk('a', at(7, 10)), walk('b', at(6, 0))], '2025-11-14', 'metric');
    expect(w).toEqual({
      id: 'a',
      title: 'Morning walk',
      time: '7:10 am',
      distance: { value: '2.3', unit: 'km' },
      durationMin: 32,
      steps: 3120,
    });
    expect(walkOf([walk('old', at(18, 0, 13))], '2025-11-14', 'metric')).toBeNull();
  });

  it('lays out the 7 days ending today, today live, missing days at 0', () => {
    const week = weekOf([{ date: '2025-11-10', steps: 5000 }, { date: '2025-11-14', steps: 100 }], '2025-11-14', 6240);
    expect(week.map((d) => d.letter).join('')).toBe('SSMTWTF');
    expect(week[6]).toMatchObject({ today: true, steps: 6240 });
    expect(week[2].steps).toBe(5000);
    expect(week[0].steps).toBe(0);
  });

  it('speaks the hero with distance and active minutes', () => {
    expect(heroSpoken(6240, 8000, { value: '4.6', unit: 'km' }, 52)).toBe(
      '6,240 of 8,000 steps, 78%, 1,760 to go. 4.6 kilometres, 52 minutes active.',
    );
    expect(heroSpoken(8400, 8000, { value: '1.0', unit: 'km' }, 1)).toBe(
      '8,400 of 8,000 steps, 105%, goal reached. 1.0 kilometre, 1 minute active.',
    );
    expect(heroSpoken(100, 8000, { value: '2.9', unit: 'mi' }, null)).toBe(
      '100 of 8,000 steps, 1%, 7,900 to go. 2.9 miles, 0 minutes active.',
    );
    expect(heroSpoken(0, 8000, null, null, 'mi')).toBe('0 of 8,000 steps, 0%, 8,000 to go. 0 miles, 0 minutes active.');
  });

  it('writes the untimed-steps note only when some steps have no time', () => {
    expect(untimedNote(0)).toBeNull();
    expect(untimedNote(undefined)).toBeNull();
    expect(untimedNote(1240)).toBe(
      "1,240 of today's steps came with no time, so they're in the total but in no hour. Settings → Step check shows why.",
    );
  });

  it('rounds the share of the goal', () => {
    expect(percentOf(6240, 8000)).toBe(78);
    expect(percentOf(100, 0)).toBe(0);
  });
});
