import { describe, expect, it } from '@jest/globals';

import { type FoodRow, readSnapshotFood, toFood } from '@/data/food-rows';
import { MIGRATIONS } from '@/data/migrations';

/** Node's own SQLite (Node 22.5+), so the real migrations run; skipped where it's missing. */
interface Db {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
}
const sqlite = ((process as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule?.('node:sqlite') ?? null) as {
  DatabaseSync: new (path: string) => Db;
} | null;
const withSqlite = sqlite ? it : it.skip;

const row = (over: Partial<FoodRow> = {}): FoodRow => ({
  id: 'e1',
  logged_at: 1000,
  name: 'Chicken biryani',
  food_id: 'chicken-biryani',
  unit: 'plate',
  quantity: 1,
  kcal: 480,
  health_sample_id: null,
  place: 'home',
  restaurant: null,
  ...over,
});

describe('food log place migration', () => {
  withSqlite('reads entries logged before it as home-made, with no restaurant', () => {
    const db = new sqlite!.DatabaseSync(':memory:');
    const last = MIGRATIONS.length - 1;
    for (const sql of MIGRATIONS.slice(0, last)) db.exec(sql);
    db.prepare(
      'INSERT INTO food_log (id, logged_at, name, food_id, unit, quantity, kcal, health_sample_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run('old', 1000, 'Idli', 'idli', 'piece', 3, 117, null);

    db.exec(MIGRATIONS[last]);
    const [old] = db.prepare('SELECT * FROM food_log').all() as FoodRow[];
    expect(old.place).toBe('home');
    expect(old.restaurant).toBeNull();
    expect(toFood(old)).toMatchObject({ id: 'old', place: 'home', restaurant: null });

    // New rows keep what they're given.
    db.prepare(
      'INSERT INTO food_log (id, logged_at, name, kcal, place, restaurant) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('new', 2000, 'Biryani', 600, 'dine-in', 'Paradise');
    const [fresh] = db.prepare("SELECT * FROM food_log WHERE id = 'new'").all() as FoodRow[];
    expect(toFood(fresh)).toMatchObject({ place: 'dine-in', restaurant: 'Paradise' });
  });

  it('reads a bad or missing place as home-made, and never keeps a restaurant on home food', () => {
    expect(toFood(row({ place: null }))).toMatchObject({ place: 'home', restaurant: null });
    expect(toFood(row({ place: 'cafe' }))).toMatchObject({ place: 'home', restaurant: null });
    expect(toFood(row({ place: 'home', restaurant: 'Paradise' })).restaurant).toBeNull();
    expect(toFood(row({ place: 'delivery', restaurant: '  <b>Dominos</b>  ' }))).toMatchObject({
      place: 'delivery',
      restaurant: 'b Dominos /b',
    });
  });

  it('gives web preview entries saved before places the same defaults', () => {
    const { place, restaurant, ...old } = toFood(row());
    expect(place).toBe('home');
    expect(restaurant).toBeNull();
    expect(readSnapshotFood(old)).toMatchObject({ id: 'e1', place: 'home', restaurant: null });
    expect(readSnapshotFood({ ...old, place: 'dine-in', restaurant: 'Paradise' })).toMatchObject({
      place: 'dine-in',
      restaurant: 'Paradise',
    });
  });
});
