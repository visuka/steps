import { describe, expect, it } from '@jest/globals';

import { MIGRATIONS } from '@/data/migrations';
import { type PlaceRow, toPart, toPlace, toWalk, type WalkPartRow, type WalkRow } from '@/data/walk-rows';

/** Node's own SQLite (Node 22.5+), so the real migrations run; skipped where it's missing. */
interface Db {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
}
const node = process as unknown as { getBuiltinModule?: (id: string) => unknown; cwd(): string };
const sqlite = (node.getBuiltinModule?.('node:sqlite') ?? null) as { DatabaseSync: new (path: string) => Db } | null;
const fs = (node.getBuiltinModule?.('node:fs') ?? null) as { readFileSync(path: string, encoding: 'utf8'): string } | null;
const withSqlite = sqlite && fs ? it : it.skip;

/** The walks migration: the first one after the food place migration (6). */
const WALKS = 7;

const columns = (db: Db, table: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

describe('walks migration', () => {
  withSqlite('reads a walk saved before it as an outdoor walk, worked out as before', () => {
    const db = new sqlite!.DatabaseSync(':memory:');
    for (const sql of MIGRATIONS.slice(0, WALKS)) db.exec(sql);
    db.prepare(
      `INSERT INTO walk (id, started_at, ended_at, distance_m, moving_s, steps, active_kcal, start_place, weather, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('old', 1000, 2000, 820, 600, 1100, 40, 'Indiranagar', JSON.stringify({ tempC: 28, condition: 'rain' }), 3000);
    db.prepare('INSERT INTO walk_point (walk_id, t, lat, lon, accuracy) VALUES (?, ?, ?, ?, ?)').run('old', 1000, 12.9, 77.6, 5);

    for (const sql of MIGRATIONS.slice(WALKS)) db.exec(sql);
    const [row] = db.prepare('SELECT * FROM walk').all() as WalkRow[];
    expect(toWalk(row)).toMatchObject({
      id: 'old',
      activity: 'walk',
      indoor: false,
      placeId: null,
      distanceFrom: null,
      stepsFrom: null,
      floorsUp: null,
      climbM: null,
      stretches: null,
      weather: { tempC: 28, condition: 'rain' },
    });
    const [point] = db.prepare('SELECT * FROM walk_point').all() as { part: number | null; speed: number | null }[];
    expect(point.part).toBeNull();
    expect(point.speed).toBeNull();
  });

  withSqlite('saveWalk writes every walk column (one left out would fall back to its default)', () => {
    const db = new sqlite!.DatabaseSync(':memory:');
    for (const sql of MIGRATIONS) db.exec(sql);
    // Jest runs from the project root.
    const source = fs!.readFileSync(`${node.cwd()}/src/data/db.ts`, 'utf8');
    const insert = /INSERT OR REPLACE INTO walk\s*\(([^)]*)\)/.exec(source)?.[1] ?? '';
    const written = insert.split(',').map((c) => c.trim());
    expect(written.sort()).toEqual(columns(db, 'walk').sort());
    const part = /INSERT OR REPLACE INTO walk_part\s*\(([^)]*)\)/.exec(source)?.[1] ?? '';
    expect(part.split(',').map((c) => c.trim()).sort()).toEqual(columns(db, 'walk_part').sort());
  });

  withSqlite('needs a pin’s position and keeps parts through a REPLACE of the walk', () => {
    const db = new sqlite!.DatabaseSync(':memory:');
    for (const sql of MIGRATIONS) db.exec(sql);
    expect(() => db.prepare('INSERT INTO place (id, name, lat, lon, updated_at) VALUES (?, ?, ?, ?, ?)').run('p', 'Home', null, 77.6, 1)).toThrow();
    db.prepare('INSERT INTO place (id, name, lat, lon, updated_at) VALUES (?, ?, ?, ?, ?)').run('p', 'Home', 12.9, 77.6, 1);
    const [place] = db.prepare('SELECT * FROM place').all() as PlaceRow[];
    expect(toPlace(place)).toEqual({ id: 'p', name: 'Home', lat: 12.9, lon: 77.6, radiusM: 100, lastMode: null, updatedAt: 1 });

    const insertWalk = () =>
      db
        .prepare(
          `INSERT OR REPLACE INTO walk (id, started_at, ended_at, distance_m, moving_s, steps, active_kcal, updated_at, activity, indoor)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run('w', 1, 2, 3, 4, 5, 6, 7, 'ride', 1);
    insertWalk();
    db.prepare(
      `INSERT INTO walk_part (walk_id, ord, start_t, end_t, kind, steps, distance_m, moving_s, top_speed_ms, kcal_walk, kcal_ride, choice, default_keep)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('w', 0, 10, 20, 'vehicle', 3, 400, 60, 9, 1, 8, 'keep', 1);
    insertWalk();
    const [part] = db.prepare('SELECT * FROM walk_part').all() as WalkPartRow[];
    expect(toPart(part)).toMatchObject({ walkId: 'w', kind: 'vehicle', choice: 'keep', defaultKeep: true });
    const [walk] = db.prepare('SELECT * FROM walk').all() as WalkRow[];
    expect(toWalk(walk)).toMatchObject({ activity: 'ride', indoor: true });
  });

  it('reads bad values as safe defaults', () => {
    const row: WalkRow = {
      id: 'x',
      started_at: 1,
      ended_at: 2,
      distance_m: 0,
      moving_s: 0,
      steps: null,
      active_kcal: 0,
      start_place: null,
      weather: '{not json',
      updated_at: 1,
      activity: 'motorbike',
      distance_from: 'guess',
      stretches: '[',
    };
    expect(toWalk(row)).toMatchObject({ activity: 'walk', distanceFrom: null, weather: null, stretches: null });
  });
});
