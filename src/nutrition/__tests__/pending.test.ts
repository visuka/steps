import { describe, expect, it } from '@jest/globals';

import {
  changed,
  dueForRefresh,
  FIRST_WAIT_MS,
  GIVE_UP_MS,
  matchRefreshed,
  MAX_PER_RUN,
  MAX_TRIES_PER_DAY,
  MAX_TRIES_PER_FOOD,
  MIN_GAP_MS,
  networkAllows,
  type PendingLog,
  recordTry,
  refreshedFood,
  refreshQuery,
  trackPending,
} from '@/nutrition/pending';
import type { FoodItem } from '@/nutrition/types';

const MIN = 60_000;
const HOUR = 60 * MIN;
const T0 = new Date(2026, 10, 13, 9).getTime();

const food = (id: string, over: Partial<FoodItem> = {}): FoodItem => ({
  id,
  name: `Dish ${id}`,
  aliases: [],
  category: 'dish',
  per100g: { kcal: 150, protein: 10, iron: 1 },
  units: [
    { key: 'bowl', label: 'bowl', grams: 200 },
    { key: 'g', label: 'grams', grams: 1 },
  ],
  defaultUnit: 'bowl',
  source: 'Worked out from its ingredients',
  missing: ['iron'],
  pending: true,
  ...over,
});

const ids = (foods: FoodItem[]) => foods.map((f) => f.id);

describe('which foods are tracked', () => {
  it('starts the wait when a food is first seen pending and drops foods no longer pending', () => {
    const log = trackPending({}, [food('ai:a'), food('ai:b', { pending: undefined })], T0);
    expect(log).toEqual({ 'ai:a': { since: T0, tries: [] } });
    const later = trackPending(log, [food('ai:a')], T0 + HOUR);
    expect(later['ai:a'].since).toBe(T0);
    expect(trackPending(later, [food('ai:a', { pending: undefined })], T0 + 2 * HOUR)).toEqual({});
  });

  it('forgets tries older than a day and malformed entries', () => {
    const stored = { 'ai:a': { since: T0, tries: [T0, T0 + 25 * HOUR, 'x'] } } as unknown as PendingLog;
    expect(trackPending(stored, [food('ai:a')], T0 + 26 * HOUR)['ai:a'].tries).toEqual([T0 + 25 * HOUR]);
    expect(trackPending({ 'ai:a': 5 } as unknown as PendingLog, [food('ai:a')], T0)['ai:a']).toEqual({ since: T0, tries: [] });
    expect(trackPending(null, [food('ai:a')], T0)['ai:a'].since).toBe(T0);
  });

  it('never tracks built-in foods', () => {
    expect(trackPending({}, [food('banana')], T0)).toEqual({});
  });
});

describe('when to look up again', () => {
  const saved = [food('ai:a')];
  const log = trackPending({}, saved, T0);

  it('waits 10 minutes, then the next app open looks it up', () => {
    expect(dueForRefresh(log, saved, T0 + FIRST_WAIT_MS - 1)).toEqual([]);
    expect(ids(dueForRefresh(log, saved, T0 + FIRST_WAIT_MS))).toEqual(['ai:a']);
  });

  it('keeps tries apart and to a few a day for a food', () => {
    let l = recordTry(log, 'ai:a', T0 + FIRST_WAIT_MS);
    expect(dueForRefresh(l, saved, T0 + FIRST_WAIT_MS + MIN_GAP_MS - 1)).toEqual([]);
    let t = T0 + FIRST_WAIT_MS + MIN_GAP_MS;
    expect(ids(dueForRefresh(l, saved, t))).toEqual(['ai:a']);
    for (let i = 1; i < MAX_TRIES_PER_FOOD; i++, t += MIN_GAP_MS) l = recordTry(l, 'ai:a', t);
    expect(dueForRefresh(l, saved, t + MIN_GAP_MS)).toEqual([]);
    // A day after the first try, there's room again.
    expect(ids(dueForRefresh(trackPending(l, saved, T0 + FIRST_WAIT_MS + 24 * HOUR), saved, T0 + FIRST_WAIT_MS + 24 * HOUR))).toEqual(['ai:a']);
  });

  it('caps a run and the whole day, oldest first', () => {
    const many = Array.from({ length: 8 }, (_, i) => food(`ai:${i}`));
    let l: PendingLog = {};
    many.forEach((f, i) => (l = { ...l, [f.id]: { since: T0 + (7 - i) * MIN, tries: [] } }));
    const due = dueForRefresh(l, many, T0 + HOUR);
    expect(due).toHaveLength(MAX_PER_RUN);
    expect(ids(due)).toEqual(['ai:7', 'ai:6', 'ai:5']);
    let used = l;
    for (let i = 0; i < MAX_TRIES_PER_DAY; i++) used = recordTry(used, `ai:${i}`, T0 + HOUR);
    expect(dueForRefresh(used, many, T0 + HOUR + MIN_GAP_MS)).toEqual([]);
    used = recordTry(l, 'ai:0', T0 + HOUR);
    expect(dueForRefresh(used, many, T0 + 2 * HOUR)).toHaveLength(MAX_PER_RUN);
  });

  it('stops asking after a week, and offline', () => {
    expect(dueForRefresh(log, saved, T0 + GIVE_UP_MS)).toEqual([]);
    expect(dueForRefresh(log, saved, T0 + HOUR, 'none')).toEqual([]);
    expect(networkAllows('wifi')).toBe(true);
    expect(networkAllows('cellular')).toBe(true);
    expect(networkAllows('unknown')).toBe(true);
  });

  it('skips foods it has no way to ask about again', () => {
    const recipe = food('recipe:x');
    expect(dueForRefresh(trackPending({}, [recipe], T0), [recipe], T0 + HOUR)).toEqual([]);
  });
});

describe('asking again', () => {
  it('asks by name, the way the food was worked out', () => {
    expect(refreshQuery(food('ai:a', { name: 'Dal (toor, home-style)', style: 'home' }))).toEqual({
      kind: 'estimate',
      text: 'Dal (toor)',
      where: { place: 'home', restaurant: null },
    });
    expect(refreshQuery(food('ai:b', { style: 'restaurant', restaurant: 'Paradise' }))).toEqual({
      kind: 'estimate',
      text: 'Dish ai:b',
      where: { place: 'dine-in', restaurant: 'Paradise' },
    });
    expect(refreshQuery(food('ai:c'))).toMatchObject({ kind: 'estimate', where: null });
    const request = { name: 'Pulusu', ingredients: '100 g dried anchovy', steps: 'Simmer' };
    expect(refreshQuery(food('recipe:r', { recipe: request }))).toEqual({ kind: 'recipe', request });
  });

  it('finds the same food in the answer by id, else by its one name', () => {
    const old = food('ai:a');
    const same = food('ai:a', { per100g: { kcal: 160 } });
    expect(matchRefreshed(old, [{ food: food('ai:z') }, { food: same }])).toBe(same);
    const renamed = food('ai:new', { name: 'dish AI:A ' });
    expect(matchRefreshed(old, [{ food: renamed }])).toBe(renamed);
    expect(matchRefreshed(old, [{ food: renamed }, { food: food('ai:new2', { name: 'Dish ai:a' }) }])).toBeNull();
    expect(matchRefreshed(old, [{ food: food('ai:rice', { name: 'Rice' }) }])).toBeNull();
  });
});

describe('saving the new values', () => {
  const old = food('ai:a', {
    style: 'restaurant',
    restaurant: 'Paradise',
    units: [{ key: 'plate', label: 'plate', grams: 350 }],
    defaultUnit: 'plate',
    recipe: undefined,
  });

  it('takes the values and keeps the id, units and the phone’s notes', () => {
    const fresh = food('ai:a', {
      per100g: { kcal: 170, protein: 12, iron: 2.4, calcium: 90 },
      units: [{ key: 'plate', label: 'plate', grams: 400 }],
      missing: undefined,
      pending: undefined,
      ingredients: [{ name: 'Dried anchovy', grams: 30 }],
    });
    const next = refreshedFood(old, fresh);
    expect(next.id).toBe('ai:a');
    expect(next.units).toEqual(old.units);
    expect(next.style).toBe('restaurant');
    expect(next.restaurant).toBe('Paradise');
    expect(next.per100g).toEqual(fresh.per100g);
    expect(next).not.toHaveProperty('missing');
    expect(next).not.toHaveProperty('pending');
    expect(next.ingredients).toEqual([{ name: 'Dried anchovy', grams: 30 }]);
    expect(changed(old, next)).toBe(true);
  });

  it('stays pending, with its recipe, while the server is still finding something', () => {
    const request = { name: 'Pulusu', ingredients: '100 g dried anchovy', steps: 'Simmer' };
    const r = food('recipe:r', { recipe: request });
    const next = refreshedFood(r, food('recipe:r', { missing: ['zinc'] }));
    expect(next.pending).toBe(true);
    expect(next.recipe).toEqual(request);
    expect(next.missing).toEqual(['zinc']);
    expect(changed(r, refreshedFood(r, food('recipe:r')))).toBe(false);
  });

  it('keeps when the pending answer first came while pending, and drops it once complete', () => {
    const r = food('ai:a', { pendingSince: T0 });
    expect(refreshedFood(r, food('ai:a', { pendingSince: T0 + HOUR })).pendingSince).toBe(T0);
    expect(refreshedFood(r, food('ai:a', { pending: undefined, missing: undefined }))).not.toHaveProperty('pendingSince');
  });
});

describe('the first wait counts from the answer', () => {
  it('starts from pendingSince, not from when the app first sees the food', () => {
    // Saved pending at T0, app next opened 20 minutes later: due at once.
    const saved = [food('ai:a', { pendingSince: T0 })];
    const log = trackPending({}, saved, T0 + 20 * MIN);
    expect(log['ai:a'].since).toBe(T0);
    expect(ids(dueForRefresh(log, saved, T0 + 20 * MIN))).toEqual(['ai:a']);
    // Opened 5 minutes after: still waiting until 10 minutes after the answer.
    const early = trackPending({}, saved, T0 + 5 * MIN);
    expect(dueForRefresh(early, saved, T0 + 5 * MIN)).toEqual([]);
    expect(ids(dueForRefresh(early, saved, T0 + FIRST_WAIT_MS))).toEqual(['ai:a']);
  });

  it('ignores a pendingSince in the future and keeps an earlier tracked time', () => {
    expect(trackPending({}, [food('ai:a', { pendingSince: T0 + HOUR })], T0)['ai:a'].since).toBe(T0);
    const log = { 'ai:a': { since: T0 - HOUR, tries: [] } };
    expect(trackPending(log, [food('ai:a', { pendingSince: T0 })], T0)['ai:a'].since).toBe(T0 - HOUR);
  });
});
