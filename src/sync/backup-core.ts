/**
 * The cloud backup's upload and restore (docs/backup.md), over plain SQL so
 * jest runs them against the real migrations. When they run is decided in
 * src/sync/backup.ts. Health values never go to a log: only record types and
 * counts do.
 */
import type { SqlStore } from '@/data/types';

import { BACKED_UP_KV_KEYS, isBackedUpKv } from './kv-keys';

/**
 * `row`: one record per row. `group`: every row with the same key in one
 * record, as { cols, rows } (the key column left out). `points`: a walk's
 * points, the same way, in chunks of at most POINTS_PER_CHUNK, keyed
 * "<walk id>#<n>".
 */
export type Shape = 'row' | 'group' | 'points';

export interface BackupTable {
  /** The record type `t` on the server. */
  t: string;
  table: string;
  /** The column that gives the record key `k`. */
  key: string;
  shape: Shape;
  /** Row order inside a group or chunk. */
  order?: string;
}

/** Every backed-up table (the contract's table in docs/backup.md). */
export const BACKUP_TABLES: readonly BackupTable[] = [
  { t: 'day_summary', table: 'day_summary', key: 'date', shape: 'row' },
  { t: 'hour_steps', table: 'hour_steps', key: 'date', shape: 'group', order: 'hour' },
  { t: 'weight_log', table: 'weight_log', key: 'id', shape: 'row' },
  { t: 'water_log', table: 'water_log', key: 'id', shape: 'row' },
  { t: 'food_log', table: 'food_log', key: 'id', shape: 'row' },
  { t: 'bp_log', table: 'bp_log', key: 'id', shape: 'row' },
  { t: 'sleep_log', table: 'sleep_log', key: 'id', shape: 'row' },
  { t: 'achievement', table: 'achievement', key: 'id', shape: 'row' },
  { t: 'mood_log', table: 'mood_log', key: 'date', shape: 'row' },
  { t: 'day_weather', table: 'day_weather', key: 'date', shape: 'row' },
  { t: 'heart_day', table: 'heart_day', key: 'date', shape: 'row' },
  { t: 'own_food', table: 'own_food', key: 'id', shape: 'row' },
  { t: 'saved_food', table: 'saved_food', key: 'id', shape: 'row' },
  { t: 'place', table: 'place', key: 'id', shape: 'row' },
  { t: 'walk', table: 'walk', key: 'id', shape: 'row' },
  { t: 'walk_part', table: 'walk_part', key: 'walk_id', shape: 'group', order: 'ord' },
  { t: 'walk_point', table: 'walk_point', key: 'walk_id', shape: 'points', order: 't' },
  { t: 'kv', table: 'kv', key: 'key', shape: 'row' },
];

const BY_T = new Map(BACKUP_TABLES.map((s) => [s.t, s]));

/** The server's limits (docs/backup.md), with room left for the envelope. */
export const MAX_RECORDS = 200;
export const MAX_BATCH_BYTES = 800_000;
export const MAX_RECORD_BYTES = 300_000;
export const MAX_KEY_CHARS = 200;
export const POINTS_PER_CHUNK = 2000;
/** Queue rows looked at in one upload run; the rest go on the next. */
const MAX_ROWS_PER_RUN = 5000;
const READ_PAGE = 50;
/** Rows of one INSERT in a restore. */
const INSERT_ROWS = 400;

/** kv: the person's profile (src/data/profile.ts). */
const PROFILE_KEY = 'profile';
/**
 * kv, this phone only: the profile fields changed here (onboarding, Settings)
 * before this account's backup came back. The restore lays them over the
 * backed-up profile instead of losing either (src/sync/backup.ts keeps it).
 */
export const PROFILE_EDITS_KEY = 'profileEdits';

export interface BackupRecord {
  t: string;
  k: string;
  /** When it changed, ms since 1970. */
  u: number;
  /** The row, or null when it's gone. */
  d: Record<string, unknown> | null;
}

/** A group or chunk: column names, then one array of values per row. */
export interface RowGroup {
  cols: string[];
  rows: unknown[][];
}

interface QueueRow {
  t: string;
  k: string;
  changed_ms: number;
  seq: number;
}

/** clearAll ran (or is running) meanwhile: stop, and let the next run start again. */
export class BackupCleared extends Error {
  constructor() {
    super('The data on this phone was cleared');
  }
}

/** UTF-8 size of a string, as the server counts it. */
export function utf8Bytes(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

const plain = (row: object): Record<string, unknown> => ({ ...(row as Record<string, unknown>) });

function toGroup(rows: Record<string, unknown>[], key: string): RowGroup {
  const cols = Object.keys(rows[0]).filter((c) => c !== key);
  return { cols, rows: rows.map((r) => cols.map((c) => r[c] ?? null)) };
}

/** Splits a walk's points into the chunks the server keeps. */
export function chunkPoints(rows: Record<string, unknown>[]): RowGroup[] {
  const chunks: RowGroup[] = [];
  for (let i = 0; i < rows.length; i += POINTS_PER_CHUNK) chunks.push(toGroup(rows.slice(i, i + POINTS_PER_CHUNK), 'walk_id'));
  return chunks;
}

/**
 * The allow list of src/sync/kv-keys.ts into sync_kv_allow, which the kv
 * triggers read; run on every open. A key new on the list has its value
 * queued now, like the first backup's rows (seq 0, u 0): it changed before
 * the triggers were watching it, and when isn't known.
 */
export async function syncKvAllowList(sql: Pick<SqlStore, 'all' | 'run'>): Promise<void> {
  const have = new Set((await sql.all<{ key: string }>('SELECT key FROM sync_kv_allow')).map((r) => r.key));
  const want = new Set(BACKED_UP_KV_KEYS);
  for (const key of have) if (!want.has(key)) await sql.run('DELETE FROM sync_kv_allow WHERE key = ?', key);
  for (const key of want) {
    if (have.has(key)) continue;
    await sql.run('INSERT INTO sync_kv_allow (key) VALUES (?)', key);
    await sql.run(
      `INSERT INTO sync_queue (t, k, changed_ms, seq) SELECT 'kv', key, 0, 0 FROM kv
       WHERE key = ? AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE t = 'kv' AND k = ?)`,
      key,
      key,
    );
  }
}

// ── upload ──────────────────────────────────────────────────────────────

export interface UploadDeps {
  /** POST /v1/backup; rejects (offline, signed out, server) when the call failed. */
  post(records: BackupRecord[]): Promise<{ rejected: { t: string; k: string; error: string }[] }>;
  /** A line for the log: record types and counts, never values. */
  warn?(message: string): void;
  /** The byte cap for batches from now on (at most MAX_BATCH_BYTES): smaller on a slow link. */
  maxBytes?(): number;
}

/**
 * The server turned records away for their `u`: this phone's clock is more
 * than a day ahead. Their queue rows stay; the run counts as failed, so it
 * waits and tries again.
 */
export class BackupClockOff extends Error {
  constructor() {
    super("The server turned records away for this phone's clock");
    this.name = 'BackupClockOff';
  }
}

/** Extra passes in one run over records the server asked to have again ("too_many": each send makes progress). */
const RETRY_PASSES = 5;

/** kv `profile` as it goes up: the name never leaves the phone (src/data/types.ts). Null when it can't be read. */
function profileForBackup(value: unknown): string | null {
  const profile = readObject(value);
  if (!profile) return null;
  const { name: _name, ...rest } = profile;
  return JSON.stringify(rest);
}

function readObject(json: unknown): Record<string, unknown> | null {
  try {
    const v = JSON.parse(String(json)) as unknown;
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Records for one queue row: what the server should now hold for it. `chunks`: a walk's point chunks sent. */
async function recordsFor(sql: SqlStore, q: QueueRow): Promise<{ records: BackupRecord[]; chunks?: number }> {
  const spec = BY_T.get(q.t);
  if (!spec) return { records: [] };
  const u = q.changed_ms;
  if (spec.shape === 'row') {
    if (spec.t === 'kv' && !isBackedUpKv(q.k)) return { records: [] };
    const [row] = await sql.all<Record<string, unknown>>(`SELECT * FROM ${spec.table} WHERE ${spec.key} = ?`, q.k);
    let d = row ? plain(row) : null;
    if (d && spec.t === 'kv' && q.k === PROFILE_KEY) {
      const value = profileForBackup(d.value);
      if (value === null) return { records: [] };
      d = { ...d, value };
    }
    return { records: [{ t: q.t, k: q.k, u, d }] };
  }
  const rows = (
    await sql.all<Record<string, unknown>>(`SELECT * FROM ${spec.table} WHERE ${spec.key} = ? ORDER BY ${spec.order}`, q.k)
  ).map(plain);
  if (spec.shape === 'group') {
    return { records: [{ t: q.t, k: q.k, u, d: rows.length ? { ...toGroup(rows, spec.key) } : null }] };
  }
  // A walk's points: "<id>#*" first when it's gone or now has fewer chunks than
  // the server holds, a moment older than the chunks so they stay.
  const chunks = chunkPoints(rows);
  const [sent] = await sql.all<{ n: number }>('SELECT n FROM sync_chunks WHERE walk_id = ?', q.k);
  const records: BackupRecord[] = [];
  if (chunks.length === 0) records.push({ t: q.t, k: `${q.k}#*`, u, d: null });
  else if (sent && sent.n > chunks.length) records.push({ t: q.t, k: `${q.k}#*`, u: Math.max(0, u - 1), d: null });
  chunks.forEach((c, i) => records.push({ t: q.t, k: `${q.k}#${i}`, u, d: { ...c } }));
  return { records, chunks: chunks.length };
}

interface Unit {
  q: QueueRow;
  chunks?: number;
  /** Records not posted yet. */
  left: number;
  /** "too_many" or "bad u" for any of its records: the row stays. */
  again: Set<string>;
}

const idOf = (t: string, k: string) => `${t}\u0000${k}`;

/**
 * Sends what sync_queue holds, oldest change first, in batches within the
 * server's limits. A queue row goes only once all its records are saved and
 * only if its seq is unchanged (it didn't change again meanwhile). A record
 * the server turns away for its shape goes too (it would be turned away
 * again); one turned away "too_many" is sent again (a few more passes in this
 * run, then the next run), and one turned away "bad u" is stamped again with
 * now when it was stamped while the clock was ahead, else kept and the run
 * fails with BackupClockOff. Rejects with the post's error, or BackupCleared
 * when clearAll ran meanwhile (then nothing more is sent: a cleared row
 * would otherwise go up as a delete).
 */
export async function uploadQueue(sql: SqlStore, deps: UploadDeps): Promise<{ sent: number; rows: number }> {
  const cleared = sql.clears();
  if (cleared % 2 === 1) throw new BackupCleared();
  const stillThere = () => {
    if (sql.clears() !== cleared) throw new BackupCleared();
  };
  const envelope = utf8Bytes('{"records":[]}');
  let batch: BackupRecord[] = [];
  let units: Unit[] = [];
  let bytes = envelope;
  let sent = 0;
  let seen = 0;
  /** Rows to send again in the next pass. */
  let retry: QueueRow[] = [];
  const restamped = new Set<string>();
  let clockOff = false;

  const done = async (unit: Unit) => {
    await sql.run('DELETE FROM sync_queue WHERE t = ? AND k = ? AND seq = ?', unit.q.t, unit.q.k, unit.q.seq);
    if (unit.chunks === undefined) return;
    if (unit.chunks > 0) {
      await sql.run('INSERT OR REPLACE INTO sync_chunks (walk_id, n) VALUES (?, ?)', unit.q.k, unit.chunks);
    } else {
      await sql.run('DELETE FROM sync_chunks WHERE walk_id = ?', unit.q.k);
    }
  };

  /** Every record of the unit has been posted: the row goes, or stays for another try. */
  const settle = async (unit: Unit) => {
    const { q } = unit;
    if (unit.again.has('bad u')) {
      const now = Date.now();
      if (q.changed_ms > now && !restamped.has(idOf(q.t, q.k))) {
        // Stamped while the clock was ahead, and it's right again now: now, and the stamps after it too.
        restamped.add(idOf(q.t, q.k));
        await sql.run('UPDATE sync_queue SET changed_ms = ? WHERE t = ? AND k = ? AND seq = ?', now, q.t, q.k, q.seq);
        await sql.run('UPDATE sync_seq SET ms = MIN(ms, ?)', now);
        retry.push({ ...q, changed_ms: now });
      } else {
        clockOff = true;
      }
      return;
    }
    if (unit.again.has('too_many')) {
      retry.push(q);
      return;
    }
    await done(unit);
  };

  const flush = async () => {
    if (!batch.length) return;
    stillThere();
    const { rejected } = await deps.post(batch);
    const why = new Map<string, string>();
    if (rejected.length) {
      const byType = new Map<string, number>();
      for (const r of rejected) {
        byType.set(`${r.t} (${r.error})`, (byType.get(`${r.t} (${r.error})`) ?? 0) + 1);
        if (typeof r.t === 'string' && typeof r.k === 'string') why.set(idOf(r.t, r.k), r.error);
      }
      deps.warn?.(`Backup: the server turned away ${[...byType].map(([what, n]) => `${n} ${what}`).join(', ')}`);
    }
    sent += batch.length;
    const posted = batch;
    const owners = units;
    batch = [];
    units = [];
    bytes = envelope;
    for (let i = 0; i < posted.length; i++) {
      const unit = owners[i];
      const error = why.get(idOf(posted[i].t, posted[i].k));
      if (error === 'too_many' || error === 'bad u') unit.again.add(error);
      if (--unit.left === 0) await settle(unit);
    }
  };

  const add = async (q: QueueRow) => {
    const { records, chunks } = await recordsFor(sql, q);
    const fit = records.filter((r) => {
      const ok = r.k.length >= 1 && r.k.length <= MAX_KEY_CHARS && (r.d === null || utf8Bytes(JSON.stringify(r.d)) <= MAX_RECORD_BYTES);
      if (!ok) deps.warn?.(`Backup: a ${r.t} record is too big to back up`);
      return ok;
    });
    const unit: Unit = { q, chunks, left: fit.length, again: new Set() };
    if (!fit.length) {
      await done(unit);
      return;
    }
    for (const record of fit) {
      const size = utf8Bytes(JSON.stringify(record)) + 1;
      const cap = Math.min(MAX_BATCH_BYTES, deps.maxBytes?.() ?? MAX_BATCH_BYTES);
      if (batch.length >= MAX_RECORDS || bytes + size > cap) await flush();
      batch.push(record);
      units.push(unit);
      bytes += size;
    }
  };

  let after: [number, string, string] = [-1, '', ''];
  while (seen < MAX_ROWS_PER_RUN) {
    stillThere();
    const rows = await sql.all<QueueRow>(
      'SELECT t, k, changed_ms, seq FROM sync_queue WHERE (seq, t, k) > (?, ?, ?) ORDER BY seq, t, k LIMIT ?',
      ...after,
      READ_PAGE,
    );
    if (!rows.length) break;
    for (const q of rows) {
      seen++;
      after = [q.seq, q.t, q.k];
      await add(q);
    }
  }
  await flush();
  for (let pass = 0; retry.length && pass < RETRY_PASSES; pass++) {
    const again = retry;
    retry = [];
    for (const q of again) {
      stillThere();
      // As it is now: changed again meanwhile, it goes on the next run instead.
      const [row] = await sql.all<QueueRow>(
        'SELECT t, k, changed_ms, seq FROM sync_queue WHERE t = ? AND k = ? AND seq = ?',
        q.t,
        q.k,
        q.seq,
      );
      if (row) await add(row);
    }
    await flush();
  }
  if (clockOff) throw new BackupClockOff();
  return { sent, rows: seen };
}

// ── restore ─────────────────────────────────────────────────────────────

export interface RestoreDeps {
  /** One page of GET /v1/backup; rejects when the call failed. */
  get(cursor: string | null): Promise<{ records: unknown[]; next: string | null }>;
  /** Today's date key on this phone: its live count is never replaced. */
  today: string;
  warn?(message: string): void;
  /** A page was written, with records of these types (the app re-reads the profile as soon as it's back). */
  pageWritten?(types: ReadonlySet<string>): void;
}

export interface RestoreResult {
  pages: number;
  /** Records written, unless the phone's own copy won (checked as they're written). */
  applied: number;
  /** Tombstones, unknown types, kv keys not on the list, and records that couldn't be read. */
  skipped: number;
}

interface Column {
  name: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}

/** A value written into SQL. NUL ends a statement there, so it's dropped (none of ours has one). */
export function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'string') return `'${v.replace(/\0/g, '').replace(/'/g, "''")}'`;
  return sqlLiteral(JSON.stringify(v));
}

function readRecord(raw: unknown): BackupRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { t, k, u, d } = raw as Partial<BackupRecord>;
  if (typeof t !== 'string' || typeof k !== 'string' || !k || typeof u !== 'number' || !Number.isFinite(u)) return null;
  if (d !== null && (typeof d !== 'object' || Array.isArray(d))) return null;
  return { t, k, u, d: d ?? null };
}

function readGroup(d: Record<string, unknown>): RowGroup | null {
  const { cols, rows } = d as Partial<RowGroup>;
  if (!Array.isArray(cols) || !cols.every((c) => typeof c === 'string') || !Array.isArray(rows)) return null;
  if (!rows.every((r) => Array.isArray(r) && r.length === cols.length)) return null;
  return { cols, rows };
}

/**
 * Brings the person's backup back into this phone (once per account and
 * install; src/sync/backup.ts keeps the flag). Each page is written in one
 * paused call, so none of it is queued for upload again. The phone's own row
 * wins when it has a change waiting to upload, when its updated_at is newer
 * than the record, or when it is today's steps; a row only the first backup
 * queued (seq 0, not an edit made here) makes way, unless its updated_at is
 * newer. The profile comes back under the fields changed here before it did
 * (kv PROFILE_EDITS_KEY). Tombstones are skipped. A health-app reading is not
 * brought back beside the phone's own entry of it (or another copy of it):
 * rows read from Health Connect / Apple Health have the id "health:<their
 * id>", the same on every phone, and the next read there replaces them in
 * place. Afterwards this phone stamps its changes later than any record read.
 */
export async function restoreBackup(sql: SqlStore, deps: RestoreDeps): Promise<RestoreResult> {
  const cleared = sql.clears();
  if (cleared % 2 === 1) throw new BackupCleared();
  const columns = new Map<string, Column[]>();
  const columnsOf = async (table: string) => {
    let cols = columns.get(table);
    if (!cols) {
      cols = await sql.all<Column>(`SELECT name, "notnull", dflt_value, pk FROM pragma_table_info('${table}')`);
      columns.set(table, cols);
    }
    return cols;
  };
  // Read once: a step sync meanwhile is queued, which the pending check catches.
  const [todayRow] = await sql.all<{ n: number }>('SELECT COUNT(*) AS n FROM day_summary WHERE date = ?', deps.today);
  const todayLocal = (todayRow?.n ?? 0) > 0;
  // Walks whose points were cleared for the backup's copy in this run, and their chunk count.
  const walkChunks = new Map<string, number>();
  const result: RestoreResult = { pages: 0, applied: 0, skipped: 0 };
  let newest = -1;

  let cursor: string | null = null;
  do {
    const page = await deps.get(cursor);
    if (sql.clears() !== cleared) throw new BackupCleared();
    const planned: { t: string; statements: string[] }[] = [];
    const walksHere = new Set<string>();
    let pageNewest = -1;
    for (const raw of page.records) {
      const r = readRecord(raw);
      if (r) pageNewest = Math.max(pageNewest, Math.floor(r.u));
      const spec = r && BY_T.get(r.t);
      if (!r || !spec || r.d === null) {
        result.skipped++;
        continue;
      }
      const statements = await planRecord(r, r.d, spec, { columnsOf, todayLocal, today: deps.today, walkChunks, walksHere });
      if (statements) planned.push({ t: r.t, statements });
      else result.skipped++;
    }
    // How many point chunks the server holds for each walk brought back (the uploader's shrink check).
    const chunkCounts = [...walksHere].map(
      (walk) =>
        `INSERT OR REPLACE INTO sync_chunks (walk_id, n) SELECT ${sqlLiteral(walk)}, ${walkChunks.get(walk)} WHERE ${pendingGuard('walk_point', walk)}`,
    );
    if (planned.length) {
      const written = new Set<string>();
      try {
        await sql.pausedExec([...planned.flatMap((p) => p.statements), ...chunkCounts]);
        result.applied += planned.length;
        for (const p of planned) written.add(p.t);
      } catch {
        // One record the phone can't take shouldn't hold back the rest: one at a time.
        for (const p of planned) {
          try {
            await sql.pausedExec(p.statements);
            result.applied++;
            written.add(p.t);
          } catch {
            result.skipped++;
          }
        }
        if (chunkCounts.length) await sql.pausedExec(chunkCounts).catch(() => undefined);
        deps.warn?.('Backup: some records could not be restored');
      }
      if (written.size) deps.pageWritten?.(written);
    }
    // This phone's next stamps come after anything the backup holds, so its later changes win there.
    if (pageNewest > newest) {
      newest = pageNewest;
      await sql.run('UPDATE sync_seq SET ms = MAX(ms, ?)', newest);
    }
    result.pages++;
    cursor = page.next;
  } while (cursor);
  return result;
}

const pendingGuard = (t: string, k: string) =>
  `NOT EXISTS (SELECT 1 FROM sync_queue WHERE t = ${sqlLiteral(t)} AND k = ${sqlLiteral(k)})`;

/**
 * Drops the queue row the first backup put there (seq 0: the row was on the
 * phone before the backup came, not changed here since) when `when` holds,
 * so the backup's copy is written over it instead of the phone's going up.
 */
const dropSeeded = (t: string, k: string, when = '') =>
  `DELETE FROM sync_queue WHERE t = ${sqlLiteral(t)} AND k = ${sqlLiteral(k)} AND seq = 0${when ? ` AND ${when}` : ''}`;

interface PlanContext {
  columnsOf(table: string): Promise<Column[]>;
  todayLocal: boolean;
  today: string;
  walkChunks: Map<string, number>;
  walksHere: Set<string>;
}

/** The statements that write one record, each guarded so the phone's own copy wins; null to skip it. */
async function planRecord(
  r: BackupRecord,
  d: Record<string, unknown>,
  spec: BackupTable,
  ctx: PlanContext,
): Promise<string[] | null> {
  const columns = await ctx.columnsOf(spec.table);
  const names = new Set(columns.map((c) => c.name));
  const table = spec.table;

  if (spec.shape === 'points') {
    const hash = r.k.lastIndexOf('#');
    const walk = r.k.slice(0, hash);
    const n = r.k.slice(hash + 1);
    const group = readGroup(d);
    if (hash <= 0 || !/^\d+$/.test(n) || !group) return null;
    const guard = pendingGuard('walk_point', walk);
    const statements: string[] = [];
    // The first chunk of a walk in this run: the phone's copy of its points makes way.
    if (!ctx.walkChunks.has(walk)) {
      statements.push(dropSeeded('walk_point', walk), `DELETE FROM walk_point WHERE walk_id = ${sqlLiteral(walk)} AND ${guard}`);
    }
    ctx.walkChunks.set(walk, Math.max(ctx.walkChunks.get(walk) ?? 0, Number(n) + 1));
    ctx.walksHere.add(walk);
    const insert = groupInsert(table, spec.key, walk, group, columns, guard, 'INSERT OR IGNORE');
    return insert ? [...statements, ...insert] : null;
  }

  if (spec.t === 'day_summary' || spec.t === 'hour_steps') {
    // Today's count on this phone is live; an older backup never replaces it.
    if (r.k === ctx.today && ctx.todayLocal) return null;
  }
  const pending = pendingGuard(r.t, r.k);
  if (spec.shape === 'group') {
    const group = readGroup(d);
    if (!group) return null;
    const insert = groupInsert(table, spec.key, r.k, group, columns, pending, 'INSERT');
    if (!insert) return null;
    return [dropSeeded(r.t, r.k), `DELETE FROM ${table} WHERE ${spec.key} = ${sqlLiteral(r.k)} AND ${pending}`, ...insert];
  }

  // One row.
  if (spec.t === 'kv' && !isBackedUpKv(r.k)) return null;
  if (spec.t === 'kv' && r.k === PROFILE_KEY) return profileStatements(r, d);
  const row: Record<string, unknown> = { ...d, [spec.key]: r.k };
  const cols = columns.filter((c) => c.name in row);
  if (columns.some((c) => c.notnull && c.dflt_value === null && (row[c.name] ?? null) === null)) return null;
  // What has to hold, a change waiting here aside, for the backup's copy to be written.
  const extra: string[] = [];
  if (names.has('updated_at')) {
    extra.push(`NOT EXISTS (SELECT 1 FROM ${table} WHERE ${spec.key} = ${sqlLiteral(r.k)} AND updated_at > ${sqlLiteral(r.u)})`);
  }
  const statements: string[] = [];
  const healthId = row.health_id;
  let ownEntry: string | null = null;
  if (names.has('health_id') && names.has('source') && typeof healthId === 'string' && healthId) {
    const sameReading = `${table} WHERE health_id = ${sqlLiteral(healthId)} AND id != ${sqlLiteral(r.k)}`;
    if (row.source === 'health') {
      // A copy read from the health app: not beside this phone's own entry of the same reading.
      extra.push(`NOT EXISTS (SELECT 1 FROM ${sameReading})`);
    } else {
      // The person's own entry: a copy of it read from the health app here makes way.
      ownEntry = `DELETE FROM ${sameReading} AND source = 'health'`;
    }
  }
  const guard = [pending, ...extra].join(' AND ');
  statements.push(dropSeeded(r.t, r.k, extra.join(' AND ')));
  if (ownEntry) statements.push(`${ownEntry} AND ${guard}`);
  statements.push(
    `INSERT OR REPLACE INTO ${table} (${cols.map((c) => c.name).join(', ')}) SELECT ${cols
      .map((c) => sqlLiteral(row[c.name]))
      .join(', ')} WHERE ${guard}`,
  );
  return statements;
}

/**
 * kv `profile`: the backup's copy, with the fields changed on this phone
 * before it came laid over it (kv PROFILE_EDITS_KEY, kept by
 * src/sync/backup.ts), and this phone's own `onboarded` (onboarding asks
 * for this phone's permissions) and name (never backed up). All worked out
 * as it's written, so onboarding or Settings finishing just before is taken
 * in. With such edits it's written even though the phone's profile waits to
 * upload, and that upload is stamped after the record, so it goes up whole.
 */
function profileStatements(r: BackupRecord, d: Record<string, unknown>): string[] | null {
  const backed = readObject(d.value);
  if (!backed) return null;
  const { name: _name, onboarded: _onboarded, ...rest } = backed;
  const here = (path: string) => `(SELECT json_extract(value, '${path}') FROM kv WHERE key = 'profile' AND json_valid(value))`;
  const edits = `(SELECT value FROM kv WHERE key = ${sqlLiteral(PROFILE_EDITS_KEY)} AND json_valid(value) AND json_type(value) = 'object')`;
  const value = `json_set(json_patch(${sqlLiteral(JSON.stringify(rest))}, COALESCE(${edits}, '{}')), '$.onboarded', json(CASE WHEN ${here('$.onboarded')} = 1 THEN 'true' ELSE 'false' END), '$.name', ${here('$.name')})`;
  return [
    dropSeeded('kv', PROFILE_KEY),
    `INSERT OR REPLACE INTO kv (key, value) SELECT 'profile', ${value} WHERE (${pendingGuard('kv', PROFILE_KEY)} OR EXISTS ${edits})`,
    `UPDATE sync_queue SET changed_ms = MAX(changed_ms, ${sqlLiteral(Math.floor(r.u) + 1)}) WHERE t = 'kv' AND k = 'profile' AND EXISTS ${edits}`,
  ];
}

/** INSERTs of a group's rows under `key`, only into columns this phone has; null when a needed one is missing. */
function groupInsert(
  table: string,
  key: string,
  keyValue: string,
  group: RowGroup,
  columns: Column[],
  guard: string,
  verb: 'INSERT' | 'INSERT OR IGNORE',
): string[] | null {
  const at = new Map(group.cols.map((c, i) => [c, i]));
  const cols = columns.filter((c) => c.name !== key && at.has(c.name));
  const missing = columns.some((c) => c.name !== key && c.notnull && c.dflt_value === null && !at.has(c.name));
  if (missing) return null;
  const statements: string[] = [];
  for (let i = 0; i < group.rows.length; i += INSERT_ROWS) {
    const values = group.rows
      .slice(i, i + INSERT_ROWS)
      .map((row) => `(${[sqlLiteral(keyValue), ...cols.map((c) => sqlLiteral(row[at.get(c.name)!]))].join(', ')})`);
    // Inserted from a VALUES list so the guard can stand after it.
    statements.push(
      `${verb} INTO ${table} (${[key, ...cols.map((c) => c.name)].join(', ')}) SELECT * FROM (VALUES ${values.join(', ')}) WHERE ${guard}`,
    );
  }
  return statements;
}

/** How many records wait to upload. */
export async function queueSize(sql: Pick<SqlStore, 'all'>): Promise<number> {
  const [row] = await sql.all<{ n: number }>('SELECT COUNT(*) AS n FROM sync_queue');
  return row?.n ?? 0;
}
