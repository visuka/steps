import { describe, expect, it } from '@jest/globals';

import { backAtPlace, canPin, isOutside, matchPlace, type Place, suggestStart } from '@/lib/places';

import { T0, toLatLon } from './walk-fixtures';

const place = (id: string, x: number, y: number, radiusM = 100, lastMode: Place['lastMode'] = null): Place => ({
  id,
  name: id,
  ...toLatLon(x, y),
  radiusM,
  lastMode,
  updatedAt: 1,
});
const fix = (x: number, y: number, acc: number | null) => ({ ...toLatLon(x, y), acc });

const home = place('Home', 0, 0);
const gym = place('Gym', 600, 0, 50);

describe('matching a fix to a pin', () => {
  it('finds the pin a fix is inside', () => {
    expect(matchPlace(fix(30, 40, 10), [home, gym])?.place.id).toBe('Home');
    expect(matchPlace(fix(300, 0, 10), [home, gym])).toBeNull();
  });

  it('gives up to 50 m of slack for the fix’s accuracy', () => {
    expect(matchPlace(fix(140, 0, 45), [home])?.place.id).toBe('Home');
    expect(matchPlace(fix(145, 0, 200), [home])?.place.id).toBe('Home');
    expect(matchPlace(fix(160, 0, 200), [home])).toBeNull();
    expect(matchPlace(fix(160, 0, 45), [home])).toBeNull();
  });

  it('picks the nearest of two pins', () => {
    const office = place('Office', 120, 0);
    expect(matchPlace(fix(80, 0, 10), [home, office])?.place.id).toBe('Office');
    expect(matchPlace(fix(40, 0, 10), [home, office])?.place.id).toBe('Home');
  });

  it('is unsure with a 200 m fix', () => {
    expect(matchPlace(fix(10, 0, 200), [home])).toMatchObject({ sure: false });
    expect(matchPlace(fix(10, 0, 120), [home])).toMatchObject({ sure: true });
  });
});

describe('leaving a pin', () => {
  it('needs the distance past radius + slack, or past the whole accuracy', () => {
    expect(isOutside(fix(60, 0, 15), home)).toBe(false);
    expect(isOutside(fix(170, 0, 80), home)).toBe(true);
    expect(isOutside(fix(5000, 0, 300), home)).toBe(true);
    expect(isOutside(fix(250, 0, 300), home)).toBe(false);
  });

  it('asks "Back at Home?" only after 2 minutes inside', () => {
    const now = T0 + 600_000;
    const inside = Array.from({ length: 10 }, (_, i) => ({ t: now - 130_000 + i * 14_000, ...fix(20, 10, 12) }));
    expect(backAtPlace(inside, home, now)).toBe(true);
    const justArrived = inside.slice(-4);
    expect(backAtPlace(justArrived, home, now)).toBe(false);
    const leftAgain = [...inside.slice(0, -1), { t: now, ...fix(400, 0, 10) }];
    expect(backAtPlace(leftAgain, home, now)).toBe(false);
  });
});

describe('starting at a pin', () => {
  it('offers indoor and outside at a pin with a good, precise fix, the last choice first', () => {
    expect(suggestStart(fix(10, 0, 12), [home], true)).toEqual({ kind: 'at', place: home, first: 'indoor' });
    const remembered = place('Home', 0, 0, 100, 'outside');
    expect(suggestStart(fix(10, 0, 12), [remembered], true)).toMatchObject({ kind: 'at', first: 'outside' });
  });

  it('asks when the fix is rough, and never suggests indoor on an approximate location', () => {
    expect(suggestStart(fix(10, 0, 90), [home], true)).toMatchObject({ kind: 'unsure' });
    expect(suggestStart(fix(10, 0, 12), [home], false)).toEqual({ kind: 'none' });
    expect(suggestStart(fix(10, 0, 400), [home], true)).toEqual({ kind: 'none' });
    expect(suggestStart(null, [home], true)).toEqual({ kind: 'none' });
    expect(suggestStart(fix(10, 0, 12), [], true)).toEqual({ kind: 'no-pins' });
  });

  it('pins only with a precise fix within 50 m', () => {
    expect(canPin(fix(0, 0, 20), true)).toBe(true);
    expect(canPin(fix(0, 0, 80), true)).toBe(false);
    expect(canPin(fix(0, 0, 20), false)).toBe(false);
  });
});
