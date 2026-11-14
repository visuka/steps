import { describe, expect, it } from '@jest/globals';

import { DETAIL_ROUTES_LIVE, detailRoute, type DetailKind, walkingLine, walkingSpoken } from '../today-actions';

const KINDS: DetailKind[] = ['steps', 'food', 'water', 'sleep', 'walk'];

describe('detailRoute', () => {
  it('opens /detail/<kind> for steps, food, water and sleep once the detail screens are live', () => {
    for (const kind of KINDS.filter((k) => k !== 'walk')) {
      expect(detailRoute(kind, 'w1', true)).toEqual({ pathname: `/detail/${kind}` });
    }
  });

  it('keeps the old targets when not live', () => {
    expect(detailRoute('steps', null, false)).toEqual({ pathname: '/activity' });
    expect(detailRoute('food', null, false)).toEqual({ pathname: '/food' });
    expect(detailRoute('water', null, false)).toBeNull();
    expect(detailRoute('sleep', null, false)).toEqual({ pathname: '/journal', params: { section: 'sleep' } });
  });

  it('sends the Walk tile to its walk or Activity, never to /detail/walk', () => {
    for (const live of [true, false]) {
      expect(detailRoute('walk', 'w1', live)).toEqual({ pathname: '/walk/[id]', params: { id: 'w1' } });
      expect(detailRoute('walk', null, live)).toEqual({ pathname: '/activity' });
    }
  });

  it('is live by default', () => {
    expect(DETAIL_ROUTES_LIVE).toBe(true);
    expect(detailRoute('water')).toEqual({ pathname: '/detail/water' });
  });

  it('follows the constant by default', () => {
    for (const kind of KINDS) expect(detailRoute(kind, 'w1')).toEqual(detailRoute(kind, 'w1', DETAIL_ROUTES_LIVE));
  });
});

describe('walkingLine', () => {
  it('reads minutes and distance', () => {
    expect(walkingLine(12 * 60 + 40, 1100, 'metric')).toBe('12 min · 1.1 km');
  });

  it('rounds minutes down: a walk just begun is 0 min', () => {
    expect(walkingLine(40, 0, 'metric')).toBe('0 min · 0.0 km');
  });

  it('uses miles for imperial', () => {
    expect(walkingLine(600, 1609, 'imperial')).toBe('10 min · 1.0 mi');
  });

  it('shows only the time without a route', () => {
    expect(walkingLine(300, null, 'metric')).toBe('5 min');
  });

  it('never goes negative', () => {
    expect(walkingLine(-5, null, 'metric')).toBe('0 min');
  });
});

describe('walkingSpoken', () => {
  it('names the card', () => {
    expect(walkingSpoken('12 min · 1.1 km')).toBe('Walk in progress, 12 min · 1.1 km');
  });
});
