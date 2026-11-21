/**
 * Test helpers for the cloud backup: the real migrations on Node's own SQLite
 * (Node 22.5+; the tests skip where it's missing), a SqlStore over it that
 * pauses the way src/data/db.ts does, and a server that keeps records the way
 * docs/backup.md says steps-data does.
 */
import { it } from '@jest/globals';

import { MIGRATIONS } from '@/data/migrations';
import type { SqlStore, SqlValue } from '@/data/types';
import { type BackupRecord, syncKvAllowList } from '@/sync/backup-core';

export interface Db {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
}

const node = process as unknown as { getBuiltinModule?: (id: string) => unknown; cwd(): string };
const sqlite = (node.getBuiltinModule?.('node:sqlite') ?? null) as { DatabaseSync: new (path: string) => Db } | null;
export const fs = (node.getBuiltinModule?.('node:fs') ?? null) as {
  readFileSync(path: string, encoding: 'utf8'): string;
  readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
} | null;
export const root = node.cwd();
export const withSqlite = sqlite && fs ? it : it.skip;

export interface Phone {
  db: Db;
  sql: SqlStore;
  /** clearAll as src/data/db.ts runs it (its SQL read from there). */
  clearAll(): void;
  /** Writes with the backup paused (a row that isn't waiting to upload). */
  paused(statement: string): void;
  all<T>(statement: string, ...params: SqlValue[]): T[];
  queue(): { t: string; k: string; seq: number }[];
}

/** The SQL clearAll runs in src/data/db.ts. */
export function clearAllSql(): string {
  const source = fs!.readFileSync(`${root}/src/data/db.ts`, 'utf8');
  const sql = /`(SAVEPOINT clear_all;[\s\S]*?RELEASE clear_all;)`/.exec(source)?.[1];
  if (!sql) throw new Error('clearAll SQL not found in src/data/db.ts');
  return sql;
}

export async function newPhone(): Promise<Phone> {
  const db = new sqlite!.DatabaseSync(':memory:');
  for (const m of MIGRATIONS) db.exec(m);
  let clears = 0;
  const all = <T>(statement: string, ...params: SqlValue[]) => db.prepare(statement).all(...params) as T[];
  const sql: SqlStore = {
    async all<T>(statement: string, ...params: SqlValue[]) {
      return all<T>(statement, ...params);
    },
    async run(statement, ...params) {
      db.prepare(statement).run(...params);
    },
    async pausedExec(statements) {
      try {
        db.exec(
          `SAVEPOINT backup_paused; INSERT OR REPLACE INTO sync_pause (id) VALUES (1);\n${statements.join(';\n')};\nDELETE FROM sync_pause; RELEASE backup_paused;`,
        );
      } catch (e) {
        try {
          db.exec('ROLLBACK TO backup_paused; RELEASE backup_paused;');
        } catch {
          // Nothing was open.
        }
        db.exec('DELETE FROM sync_pause');
        throw e;
      }
    },
    clears: () => clears,
  };
  await syncKvAllowList(sql);
  const clearSql = clearAllSql();
  return {
    db,
    sql,
    clearAll() {
      clears++;
      try {
        db.exec(clearSql);
      } finally {
        clears++;
      }
    },
    paused(statement) {
      db.exec(`INSERT INTO sync_pause (id) VALUES (1); ${statement}; DELETE FROM sync_pause;`);
    },
    all,
    queue: () => all<{ t: string; k: string; seq: number }>('SELECT t, k, seq FROM sync_queue ORDER BY t, k'),
  };
}

interface Column {
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
}

/** An INSERT of a row with `values`, any other required column filled with a plain value of its type. */
export function rowInsert(db: Db, table: string, values: Record<string, SqlValue>, verb = 'INSERT'): string {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Column[];
  const row: Record<string, SqlValue> = {};
  for (const c of columns) {
    if (c.name in values) row[c.name] = values[c.name];
    else if (c.notnull && c.dflt_value === null) row[c.name] = /INT/.test(c.type) ? 1 : c.type === 'REAL' ? 1.5 : 'x';
  }
  const lit = (v: SqlValue) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);
  const names = Object.keys(row);
  return `${verb} INTO ${table} (${names.join(', ')}) VALUES (${names.map((n) => lit(row[n])).join(', ')})`;
}

/** steps-data's POST and GET /v1/backup as docs/backup.md describes them, in memory. */
export function fakeServer(pageSize = 50) {
  const stored = new Map<string, BackupRecord>();
  const id = (t: string, k: string) => `${t}\u0000${k}`;
  const calls: BackupRecord[][] = [];
  const write = (r: BackupRecord) => {
    const have = stored.get(id(r.t, r.k));
    if (!have || have.u <= r.u) stored.set(id(r.t, r.k), r);
  };
  return {
    stored,
    calls,
    async post(records: BackupRecord[]) {
      calls.push(records);
      if (records.length > 200) throw new Error('400: over 200 records');
      if (JSON.stringify({ records }).length > 1_000_000) throw new Error('413');
      const prefixDeletes = records.filter((r) => r.d === null && r.k.endsWith('#*'));
      for (const del of prefixDeletes) {
        const prefix = del.k.slice(0, -1);
        const sameCall = new Set(records.filter((r) => r !== del && r.u >= del.u).map((r) => id(r.t, r.k)));
        for (const [key, r] of stored) {
          if (r.t === del.t && r.k.startsWith(prefix) && r.u <= del.u && !sameCall.has(key)) {
            stored.set(key, { t: r.t, k: r.k, u: del.u, d: null });
          }
        }
      }
      for (const r of records) if (!prefixDeletes.includes(r)) write(r);
      return { rejected: [] as { t: string; k: string; error: string }[] };
    },
    async get(cursor: string | null) {
      const all = [...stored.values()];
      const from = cursor ? Number(cursor) : 0;
      const records = all.slice(from, from + pageSize);
      return { records: records as unknown[], next: from + pageSize < all.length ? String(from + pageSize) : null };
    },
  };
}
