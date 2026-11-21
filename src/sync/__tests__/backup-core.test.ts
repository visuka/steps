import { describe, expect, jest } from '@jest/globals';

import { MIGRATIONS } from '@/data/migrations';
import {
  BACKUP_TABLES,
  BackupClockOff,
  type BackupRecord,
  BackupCleared,
  MAX_BATCH_BYTES,
  MAX_RECORDS,
  POINTS_PER_CHUNK,
  PROFILE_EDITS_KEY,
  restoreBackup,
  type RowGroup,
  sqlLiteral,
  uploadQueue,
  utf8Bytes,
} from '@/sync/backup-core';

import { fakeServer, newPhone, type Phone, rowInsert, withSqlite } from './backup-sqlite';

const TODAY = '2026-11-21';

/** One plain row in every backed-up table, keyed `key` (kv: the profile). */
function fillEveryTable(phone: Phone, key: string) {
  for (const spec of BACKUP_TABLES) {
    if (spec.t === 'kv') {
      phone.db.exec(rowInsert(phone.db, 'kv', { key: 'profile', value: JSON.stringify({ name: 'A', onboarded: true }) }));
    } else {
      phone.db.exec(rowInsert(phone.db, spec.table, { [spec.key]: key }));
    }
  }
}

const keyOf = (spec: (typeof BACKUP_TABLES)[number], key: string) => (spec.t === 'kv' ? 'profile' : key);

describe('change tracking (backup migration)', () => {
  withSqlite('queues one record for a change in every backed-up table', async () => {
    const phone = await newPhone();
    fillEveryTable(phone, 'k1');
    expect(phone.queue().map((q) => `${q.t}/${q.k}`)).toEqual(
      BACKUP_TABLES.map((s) => `${s.t}/${keyOf(s, 'k1')}`).sort(),
    );
  });

  withSqlite('a later change, an update or a delete, moves the record up (a higher seq)', async () => {
    const phone = await newPhone();
    phone.db.exec(rowInsert(phone.db, 'weight_log', { id: 'w1', value: 70 }));
    const [first] = phone.queue();
    phone.db.exec("UPDATE weight_log SET value = 71 WHERE id = 'w1'");
    const [second] = phone.queue();
    phone.db.exec("DELETE FROM weight_log WHERE id = 'w1'");
    const [third] = phone.queue();
    expect(phone.queue()).toHaveLength(1);
    expect(second.seq).toBeGreaterThan(first.seq);
    expect(third.seq).toBeGreaterThan(second.seq);
  });

  withSqlite('a row added by INSERT OR IGNORE still moves its record up (the trigger replaces, never ignores)', async () => {
    const phone = await newPhone();
    phone.db.exec(rowInsert(phone.db, 'walk_point', { walk_id: 'w', t: 1 }));
    const [first] = phone.queue();
    phone.db.exec(rowInsert(phone.db, 'walk_point', { walk_id: 'w', t: 2 }, 'INSERT OR IGNORE'));
    expect(phone.queue()[0].seq).toBeGreaterThan(first.seq);
  });

  withSqlite('changing a key queues the old key too (so its delete goes up)', async () => {
    const phone = await newPhone();
    phone.paused(rowInsert(phone.db, 'mood_log', { date: '2026-11-01' }));
    phone.db.exec("UPDATE mood_log SET date = '2026-11-02'");
    expect(phone.queue().map((q) => q.k)).toEqual(['2026-11-01', '2026-11-02']);
  });

  withSqlite('nothing is queued while sync_pause has a row', async () => {
    const phone = await newPhone();
    phone.db.exec('INSERT INTO sync_pause (id) VALUES (1)');
    fillEveryTable(phone, 'k1');
    phone.db.exec("UPDATE day_summary SET steps = 5; DELETE FROM walk_point; DELETE FROM kv WHERE key = 'profile'");
    expect(phone.queue()).toEqual([]);
  });

  withSqlite('kv keys off the allow list are never queued', async () => {
    const phone = await newPhone();
    phone.db.exec("INSERT INTO kv (key, value) VALUES ('lastSyncAt', '1'), ('accountId', '\"a\"'), ('walkStride', '0.7')");
    phone.db.exec("UPDATE kv SET value = '2'");
    phone.db.exec('DELETE FROM kv');
    expect(phone.queue().map((q) => `${q.t}/${q.k}`)).toEqual(['kv/walkStride']);
  });

  withSqlite('the migration queues the rows that were there before it (the first backup)', async () => {
    const phone = await newPhone();
    // A fresh database at the migration before the backup one, with data in it.
    const { db } = phone;
    db.exec(
      'DROP TABLE sync_queue; DROP TABLE sync_pause; DROP TABLE sync_seq; DROP TABLE sync_kv_allow; DROP TABLE sync_chunks;',
    );
    for (const row of db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all() as { name: string }[]) {
      db.exec(`DROP TRIGGER ${row.name}`);
    }
    db.exec(rowInsert(db, 'day_summary', { date: '2026-10-01' }));
    db.exec(rowInsert(db, 'walk_point', { walk_id: 'w', t: 1 }));
    db.exec(rowInsert(db, 'walk_point', { walk_id: 'w', t: 2 }));
    db.exec(MIGRATIONS[MIGRATIONS.length - 1]);
    expect(phone.queue().map((q) => `${q.t}/${q.k}/${q.seq}`)).toEqual(['day_summary/2026-10-01/0', 'walk_point/w/0']);
  });

  withSqlite("the first backup's rows carry when they last changed, not when the migration ran", async () => {
    const phone = await newPhone();
    const { db } = phone;
    db.exec(
      'DROP TABLE sync_queue; DROP TABLE sync_pause; DROP TABLE sync_seq; DROP TABLE sync_kv_allow; DROP TABLE sync_chunks;',
    );
    for (const row of db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all() as { name: string }[]) {
      db.exec(`DROP TRIGGER ${row.name}`);
    }
    db.exec(rowInsert(db, 'day_summary', { date: '2026-10-01', updated_at: 5000 }));
    db.exec(rowInsert(db, 'hour_steps', { date: '2026-10-01', hour: 9 }));
    db.exec(rowInsert(db, 'walk', { id: 'w', updated_at: 7000 }));
    db.exec(rowInsert(db, 'walk_point', { walk_id: 'w', t: 1 }));
    db.exec(rowInsert(db, 'walk_point', { walk_id: 'gone', t: 1 }));
    db.exec(rowInsert(db, 'mood_log', { date: '2026-10-01' }));
    db.exec(MIGRATIONS[MIGRATIONS.length - 1]);
    expect(phone.all('SELECT t, k, changed_ms FROM sync_queue ORDER BY t, k')).toEqual([
      { t: 'day_summary', k: '2026-10-01', changed_ms: 5000 },
      { t: 'hour_steps', k: '2026-10-01', changed_ms: 5000 },
      { t: 'mood_log', k: '2026-10-01', changed_ms: 0 },
      { t: 'walk', k: 'w', changed_ms: 7000 },
      { t: 'walk_point', k: 'gone', changed_ms: 0 },
      { t: 'walk_point', k: 'w', changed_ms: 7000 },
    ]);
  });

  withSqlite('a change is stamped after the last one, even when the clock was put back meanwhile', async () => {
    const phone = await newPhone();
    // Stamps taken while the clock was 6 hours fast.
    const ahead = Date.now() + 6 * 3600_000;
    phone.db.exec(`UPDATE sync_seq SET ms = ${ahead}`);
    phone.db.exec(rowInsert(phone.db, 'mood_log', { date: '2026-11-20', mood: 3 }));
    phone.db.exec(rowInsert(phone.db, 'weight_log', { id: 'w1' }));
    const [mood, weight] = phone.all<{ changed_ms: number }>('SELECT changed_ms FROM sync_queue ORDER BY seq');
    expect(mood.changed_ms).toBeGreaterThan(ahead);
    expect(weight.changed_ms).toBeGreaterThan(mood.changed_ms);
    // And so the server, which keeps the newest u, takes the later edit.
    const server = fakeServer();
    await uploadQueue(phone.sql, { post: server.post });
    phone.db.exec("UPDATE mood_log SET mood = 5 WHERE date = '2026-11-20'");
    await uploadQueue(phone.sql, { post: server.post });
    expect([...server.stored.values()].find((r) => r.t === 'mood_log')?.d).toMatchObject({ mood: 5 });
  });
});

describe('upload', () => {
  withSqlite('sends each row whole, grouped tables as { cols, rows }, and empties the queue', async () => {
    const phone = await newPhone();
    phone.db.exec(rowInsert(phone.db, 'day_summary', { date: '2026-11-20', steps: 4200 }));
    phone.db.exec(rowInsert(phone.db, 'hour_steps', { date: '2026-11-20', hour: 9, steps: 3000 }));
    phone.db.exec(rowInsert(phone.db, 'hour_steps', { date: '2026-11-20', hour: 8, steps: 1200 }));
    const server = fakeServer();
    const result = await uploadQueue(phone.sql, { post: server.post });
    expect(result.rows).toBe(2);
    const sent = server.calls.flat();
    expect(sent.find((r) => r.t === 'day_summary')).toMatchObject({ k: '2026-11-20', d: { date: '2026-11-20', steps: 4200 } });
    expect(sent.find((r) => r.t === 'hour_steps')?.d).toEqual({ cols: ['hour', 'steps'], rows: [[8, 1200], [9, 3000]] });
    for (const r of sent) expect(Number.isInteger(r.u)).toBe(true);
    expect(phone.queue()).toEqual([]);
  });

  withSqlite('a deleted row goes up as d null', async () => {
    const phone = await newPhone();
    phone.paused(rowInsert(phone.db, 'water_log', { id: 'g1' }));
    phone.db.exec("DELETE FROM water_log WHERE id = 'g1'");
    const server = fakeServer();
    await uploadQueue(phone.sql, { post: server.post });
    expect(server.calls.flat()).toEqual([expect.objectContaining({ t: 'water_log', k: 'g1', d: null })]);
  });

  withSqlite('batches stay within 200 records and the byte limit', async () => {
    const phone = await newPhone();
    const big = 'x'.repeat(20_000);
    for (let i = 0; i < 450; i++) phone.db.exec(rowInsert(phone.db, 'food_log', { id: `f${i}`, name: i < 100 ? big : 'rice' }));
    const server = fakeServer();
    await uploadQueue(phone.sql, { post: server.post });
    expect(server.calls.flat()).toHaveLength(450);
    for (const batch of server.calls) {
      expect(batch.length).toBeLessThanOrEqual(MAX_RECORDS);
      expect(utf8Bytes(JSON.stringify({ records: batch }))).toBeLessThanOrEqual(MAX_BATCH_BYTES);
    }
    expect(server.calls.length).toBeGreaterThan(3);
    expect(phone.queue()).toEqual([]);
  });

  withSqlite('a row that changed while it was being sent stays queued (seq)', async () => {
    const phone = await newPhone();
    phone.db.exec(rowInsert(phone.db, 'weight_log', { id: 'w1', value: 70 }));
    phone.db.exec(rowInsert(phone.db, 'weight_log', { id: 'w2', value: 70 }));
    const server = fakeServer();
    await uploadQueue(phone.sql, {
      post: async (records) => {
        phone.db.exec("UPDATE weight_log SET value = 72 WHERE id = 'w1'");
        return server.post(records);
      },
    });
    expect(phone.queue().map((q) => q.k)).toEqual(['w1']);
    await uploadQueue(phone.sql, { post: server.post });
    expect(phone.queue()).toEqual([]);
    expect([...server.stored.values()].find((r) => r.k === 'w1')?.d).toMatchObject({ value: 72 });
  });

  withSqlite('a failed call keeps everything queued', async () => {
    const phone = await newPhone();
    phone.db.exec(rowInsert(phone.db, 'weight_log', { id: 'w1' }));
    await expect(uploadQueue(phone.sql, { post: () => Promise.reject(new Error('offline')) })).rejects.toThrow('offline');
    expect(phone.queue()).toHaveLength(1);
  });

  withSqlite('batches stay within the byte cap the caller gives (a slow link)', async () => {
    const phone = await newPhone();
    for (let i = 0; i < 30; i++) phone.db.exec(rowInsert(phone.db, 'food_log', { id: `f${i}`, name: 'x'.repeat(10_000) }));
    const server = fakeServer();
    await uploadQueue(phone.sql, { post: server.post, maxBytes: () => 50_000 });
    expect(server.calls.flat()).toHaveLength(30);
    for (const batch of server.calls) expect(utf8Bytes(JSON.stringify({ records: batch }))).toBeLessThanOrEqual(50_000);
    // A record bigger than the cap still goes, on its own.
    phone.db.exec(rowInsert(phone.db, 'own_food', { id: 'o1', nutrients: 'y'.repeat(80_000) }));
    await uploadQueue(phone.sql, { post: server.post, maxBytes: () => 50_000 });
    expect(server.calls.at(-1)?.map((r) => r.k)).toEqual(['o1']);
    expect(phone.queue()).toEqual([]);
  });

  withSqlite('"too_many" is sent again until it is done; the row stays if it never is', async () => {
    const phone = await newPhone();
    phone.db.exec(rowInsert(phone.db, 'weight_log', { id: 'w1' }));
    phone.db.exec(rowInsert(phone.db, 'weight_log', { id: 'w2' }));
    let turnAway = 2;
    const calls: string[][] = [];
    const post = async (records: BackupRecord[]) => {
      calls.push(records.map((r) => r.k));
      const rejected = records.filter((r) => r.k === 'w1' && turnAway-- > 0).map((r) => ({ t: r.t, k: r.k, error: 'too_many' }));
      return { rejected };
    };
    await uploadQueue(phone.sql, { post });
    expect(calls).toEqual([['w1', 'w2'], ['w1'], ['w1']]);
    expect(phone.queue()).toEqual([]);

    phone.db.exec("UPDATE weight_log SET value = 3 WHERE id = 'w1'");
    turnAway = Number.POSITIVE_INFINITY;
    await uploadQueue(phone.sql, { post });
    expect(phone.queue().map((q) => q.k)).toEqual(['w1']);
  });

  withSqlite('"bad u": stamped while the clock was ahead, it goes again with now; with the clock still ahead it waits', async () => {
    const phone = await newPhone();
    phone.db.exec(rowInsert(phone.db, 'mood_log', { date: '2026-11-20' }));
    // Queued while the phone's clock was two days fast; the clock is right again now.
    const ahead = Date.now() + 2 * 86_400_000;
    phone.db.exec(`UPDATE sync_queue SET changed_ms = ${ahead}; UPDATE sync_seq SET ms = ${ahead}`);
    const server = fakeServer();
    // steps-data turns away a u more than a day past its own clock.
    const post = async (records: BackupRecord[]) => {
      const bad = records.filter((r) => r.u > Date.now() + 86_400_000);
      await server.post(records.filter((r) => !bad.includes(r)));
      return { rejected: bad.map((r) => ({ t: r.t, k: r.k, error: 'bad u' })) };
    };
    await uploadQueue(phone.sql, { post });
    expect(phone.queue()).toEqual([]);
    const stored = [...server.stored.values()].find((r) => r.t === 'mood_log');
    expect(stored?.u).toBeLessThanOrEqual(Date.now());
    // Later changes are stamped from now again, not from the fast clock's time.
    expect(phone.all<{ ms: number }>('SELECT ms FROM sync_seq')[0].ms).toBeLessThanOrEqual(Date.now());

    // The clock still ahead (the server says so for every u): the row stays and the run fails, to wait and try again.
    phone.db.exec("UPDATE mood_log SET mood = 1 WHERE date = '2026-11-20'");
    const alwaysBad = async (records: BackupRecord[]) => ({ rejected: records.map((r) => ({ t: r.t, k: r.k, error: 'bad u' })) });
    await expect(uploadQueue(phone.sql, { post: alwaysBad })).rejects.toBeInstanceOf(BackupClockOff);
    expect(phone.queue().map((q) => q.k)).toEqual(['2026-11-20']);
  });

  withSqlite("the profile goes up without the person's name", async () => {
    const phone = await newPhone();
    phone.db.exec(`INSERT INTO kv (key, value) VALUES ('profile', '${JSON.stringify({ name: 'Ravi', dailyGoal: 9000, onboarded: true })}')`);
    const server = fakeServer();
    await uploadQueue(phone.sql, { post: server.post });
    const sent = server.calls.flat().find((r) => r.k === 'profile');
    expect(JSON.parse(String(sent?.d?.value))).toEqual({ dailyGoal: 9000, onboarded: true });
    expect(JSON.stringify(server.calls)).not.toContain('Ravi');
  });

  withSqlite('records the server turned away are not sent again, and the log names types only', async () => {
    const phone = await newPhone();
    phone.db.exec(rowInsert(phone.db, 'bp_log', { id: 'b1', systolic: 142, diastolic: 91 }));
    const warn = jest.fn<(m: string) => void>();
    await uploadQueue(phone.sql, {
      post: async (records) => ({ rejected: records.map((r) => ({ t: r.t, k: r.k, error: 'bad d' })) }),
      warn,
    });
    expect(phone.queue()).toEqual([]);
    expect(warn).toHaveBeenCalledWith('Backup: the server turned away 1 bp_log (bad d)');
    expect(warn.mock.calls.join(' ')).not.toMatch(/142|91|b1/);
  });

  withSqlite('a record over 300 KB is left out, with a warning that has no values', async () => {
    const phone = await newPhone();
    phone.db.exec(rowInsert(phone.db, 'own_food', { id: 'o1', nutrients: 'y'.repeat(310_000) }));
    phone.db.exec(rowInsert(phone.db, 'own_food', { id: 'o2' }));
    const warn = jest.fn<(m: string) => void>();
    const server = fakeServer();
    await uploadQueue(phone.sql, { post: server.post, warn });
    expect(server.calls.flat().map((r) => r.k)).toEqual(['o2']);
    expect(warn).toHaveBeenCalledWith('Backup: a own_food record is too big to back up');
    expect(phone.queue()).toEqual([]);
  });

  withSqlite('stops when clearAll ran meanwhile, so cleared rows never go up as deletes', async () => {
    const phone = await newPhone();
    for (let i = 0; i < 250; i++) phone.db.exec(rowInsert(phone.db, 'weight_log', { id: `w${i}` }));
    const server = fakeServer();
    const run = uploadQueue(phone.sql, {
      post: async (records) => {
        if (!server.calls.length) phone.clearAll();
        return server.post(records);
      },
    });
    // The first batch was already on its way; nothing after the clear is sent.
    await expect(run).rejects.toBeInstanceOf(BackupCleared);
    expect(server.calls).toHaveLength(1);
    expect(server.calls.flat().every((r) => r.d !== null)).toBe(true);
    expect(phone.queue()).toEqual([]);
  });

  withSqlite('throws BackupCleared when a clear is under way', async () => {
    const phone = await newPhone();
    const clears = jest.spyOn(phone.sql, 'clears').mockReturnValue(1);
    await expect(uploadQueue(phone.sql, { post: fakeServer().post })).rejects.toBeInstanceOf(BackupCleared);
    clears.mockRestore();
  });

  withSqlite('a walk goes up in chunks of 2,000 points; fewer chunks later delete the rest with "#*"', async () => {
    const phone = await newPhone();
    phone.db.exec(rowInsert(phone.db, 'walk', { id: 'w1' }));
    const points = Array.from({ length: 4500 }, (_, i) => `('w1', ${i}, 12.9, 77.6)`).join(', ');
    phone.db.exec(`INSERT INTO walk_point (walk_id, t, lat, lon) VALUES ${points}`);
    const server = fakeServer();
    await uploadQueue(phone.sql, { post: server.post });
    const first = server.calls.flat().filter((r) => r.t === 'walk_point');
    expect(first.map((r) => r.k)).toEqual(['w1#0', 'w1#1', 'w1#2']);
    expect((first[2].d as unknown as RowGroup).rows).toHaveLength(4500 - 2 * POINTS_PER_CHUNK);
    expect((first[0].d as unknown as RowGroup).cols).not.toContain('walk_id');
    expect(phone.all('SELECT n FROM sync_chunks')).toEqual([{ n: 3 }]);

    // Trimmed to one chunk: "#*" a moment older than the chunk left, so it stays.
    server.calls.length = 0;
    phone.db.exec('DELETE FROM walk_point WHERE t >= 1000');
    await uploadQueue(phone.sql, { post: server.post });
    const [del, chunk] = server.calls.flat();
    expect(del).toMatchObject({ k: 'w1#*', d: null });
    expect(chunk).toMatchObject({ k: 'w1#0' });
    expect(del.u).toBe(chunk.u - 1);
    const live = [...server.stored.values()].filter((r) => r.t === 'walk_point' && r.d !== null).map((r) => r.k);
    expect(live).toEqual(['w1#0']);

    // The walk deleted: "#*" alone, and nothing is remembered for it.
    server.calls.length = 0;
    phone.db.exec("DELETE FROM walk_point; DELETE FROM walk WHERE id = 'w1'");
    await uploadQueue(phone.sql, { post: server.post });
    expect(server.calls.flat().filter((r) => r.t === 'walk_point')).toEqual([
      expect.objectContaining({ k: 'w1#*', d: null }),
    ]);
    expect([...server.stored.values()].filter((r) => r.t === 'walk_point' && r.d !== null)).toEqual([]);
    expect(phone.all('SELECT n FROM sync_chunks')).toEqual([]);
  });
});

describe('restore', () => {
  /** A phone with a bit of everything, uploaded. */
  async function backedUp() {
    const a = await newPhone();
    fillEveryTable(a, 'k1');
    a.db.exec(rowInsert(a.db, 'hour_steps', { date: 'k1', hour: 7, steps: 900 }));
    a.db.exec(rowInsert(a.db, 'walk_part', { walk_id: 'k1', ord: 2 }));
    a.db.exec("INSERT INTO kv (key, value) VALUES ('lastSyncAt', '5'), ('myDishes', '[\"dal\"]')");
    const points = Array.from({ length: 4100 }, (_, i) => `('wx', ${i}, 12.9, 77.6)`).join(', ');
    a.db.exec(`INSERT INTO walk_point (walk_id, t, lat, lon) VALUES ${points}`);
    const server = fakeServer(7);
    await uploadQueue(a.sql, { post: server.post });
    return { a, server };
  }

  const dump = (phone: Phone, table: string) => phone.all(`SELECT * FROM ${table} ORDER BY 1, 2`);

  withSqlite('brings every table back on a new phone, walks reassembled, without queueing any of it', async () => {
    const { a, server } = await backedUp();
    const b = await newPhone();
    const result = await restoreBackup(b.sql, { get: server.get, today: TODAY });
    expect(result.pages).toBeGreaterThan(1);
    for (const spec of BACKUP_TABLES) {
      if (spec.t === 'kv') continue;
      expect([spec.table, dump(b, spec.table)]).toEqual([spec.table, dump(a, spec.table)]);
    }
    expect(b.all('SELECT COUNT(*) AS n FROM walk_point WHERE walk_id = ?', 'wx')).toEqual([{ n: 4100 }]);
    expect(b.all("SELECT key FROM kv ORDER BY key")).toEqual([{ key: 'myDishes' }, { key: 'profile' }]);
    expect(b.queue()).toEqual([]);
    expect(b.all('SELECT n FROM sync_chunks WHERE walk_id = ?', 'wx')).toEqual([{ n: 3 }]);
  });

  const profileOf = (phone: Phone) =>
    JSON.parse(phone.all<{ value: string }>("SELECT value FROM kv WHERE key = 'profile'")[0].value) as Record<string, unknown>;

  withSqlite("the profile comes back with this phone's own onboarded value and name (the name never goes up)", async () => {
    const { server } = await backedUp();
    const b = await newPhone();
    await restoreBackup(b.sql, { get: server.get, today: TODAY });
    expect(profileOf(b)).toEqual({ name: null, onboarded: false });
    const c = await newPhone();
    c.paused(`INSERT INTO kv (key, value) VALUES ('profile', '${JSON.stringify({ name: 'Ravi', onboarded: true })}')`);
    await restoreBackup(c.sql, { get: server.get, today: TODAY });
    expect(profileOf(c)).toEqual({ name: 'Ravi', onboarded: true });
  });

  withSqlite('profile fields changed here before the backup came are laid over it, and the result goes up', async () => {
    const backed = { dailyGoal: 7000, heightCm: 180, units: 'imperial', water: { targetMl: 2500, remind: true }, onboarded: true };
    const server = fakeServer();
    await server.post([{ t: 'kv', k: 'profile', u: 5000, d: { key: 'profile', value: JSON.stringify(backed) } }]);
    const b = await newPhone();
    // Onboarding finished first: defaults plus the two answers, waiting to upload, and the answers kept.
    const local = { dailyGoal: 12000, heightCm: 165, units: 'metric', water: { targetMl: 3000, remind: false }, onboarded: true };
    b.db.exec(`INSERT INTO kv (key, value) VALUES ('profile', '${JSON.stringify(local)}')`);
    b.db.exec(`INSERT INTO kv (key, value) VALUES ('${PROFILE_EDITS_KEY}', '${JSON.stringify({ dailyGoal: 12000, water: { targetMl: 3000 } })}')`);
    b.db.exec('UPDATE sync_queue SET changed_ms = 10');
    await restoreBackup(b.sql, { get: server.get, today: TODAY });
    expect(profileOf(b)).toEqual({
      dailyGoal: 12000,
      heightCm: 180,
      units: 'imperial',
      water: { targetMl: 3000, remind: true },
      onboarded: true,
      name: null,
    });
    // Still waiting to upload, now stamped after the backup's copy, so the server takes it.
    const [queued] = b.all<{ changed_ms: number }>("SELECT changed_ms FROM sync_queue WHERE t = 'kv' AND k = 'profile'");
    expect(queued.changed_ms).toBeGreaterThan(5000);
    await uploadQueue(b.sql, { post: server.post });
    expect(JSON.parse(String([...server.stored.values()][0].d?.value))).toMatchObject({ dailyGoal: 12000, heightCm: 180 });
  });

  withSqlite("rows only the first backup queued make way for the backup's copy, unless newer here", async () => {
    const server = fakeServer();
    const rec = (t: string, k: string, u: number, d: Record<string, unknown>): BackupRecord => ({ t, k, u, d });
    await server.post([
      rec('weight_log', 'w1', 9000, { id: 'w1', logged_at: 1, value: 60 }),
      rec('heart_day', '2026-11-01', 9000, { date: '2026-11-01', resting_bpm: 60, updated_at: 9000 }),
      rec('heart_day', '2026-11-02', 9000, { date: '2026-11-02', resting_bpm: 60, updated_at: 9000 }),
      rec('kv', 'myDishes', 9000, { key: 'myDishes', value: '["new"]' }),
      rec('kv', 'profile', 9000, { key: 'profile', value: JSON.stringify({ dailyGoal: 9000, onboarded: true }) }),
      rec('walk_point', 'w#0', 9000, { cols: ['t', 'lat', 'lon'], rows: [[5, 1, 1]] }),
    ]);
    // A second phone with older copies, all queued by the first backup (seq 0), one newer here.
    const b = await newPhone();
    b.paused(rowInsert(b.db, 'weight_log', { id: 'w1', value: 71 }));
    b.paused(rowInsert(b.db, 'heart_day', { date: '2026-11-01', resting_bpm: 55, updated_at: 5000 }));
    b.paused(rowInsert(b.db, 'heart_day', { date: '2026-11-02', resting_bpm: 55, updated_at: 9500 }));
    b.paused(`INSERT INTO kv (key, value) VALUES ('myDishes', '["old"]'), ('profile', '${JSON.stringify({ dailyGoal: 5000, onboarded: true })}')`);
    b.paused(rowInsert(b.db, 'walk_point', { walk_id: 'w', t: 1 }));
    b.db.exec(`INSERT INTO sync_queue (t, k, changed_ms, seq) VALUES ('weight_log', 'w1', 0, 0), ('heart_day', '2026-11-01', 5000, 0),
      ('heart_day', '2026-11-02', 9500, 0), ('kv', 'myDishes', 0, 0), ('kv', 'profile', 0, 0), ('walk_point', 'w', 0, 0)`);
    await restoreBackup(b.sql, { get: server.get, today: TODAY });
    expect(b.all('SELECT value FROM weight_log')).toEqual([{ value: 60 }]);
    expect(b.all('SELECT date, resting_bpm FROM heart_day ORDER BY date')).toEqual([
      { date: '2026-11-01', resting_bpm: 60 },
      { date: '2026-11-02', resting_bpm: 55 },
    ]);
    expect(b.all("SELECT value FROM kv WHERE key = 'myDishes'")).toEqual([{ value: '["new"]' }]);
    expect(profileOf(b)).toMatchObject({ dailyGoal: 9000, onboarded: true });
    expect(b.all('SELECT t FROM walk_point')).toEqual([{ t: 5 }]);
    // Only the row that is newer here still goes up.
    expect(b.queue().map((q) => `${q.t}/${q.k}`)).toEqual(['heart_day/2026-11-02']);
  });

  withSqlite('after a restore the phone stamps its changes later than anything in the backup', async () => {
    const later = Date.now() + 3600_000;
    const server = fakeServer();
    await server.post([{ t: 'weight_log', k: 'w1', u: later, d: { id: 'w1', logged_at: 1, value: 60 } }]);
    const b = await newPhone();
    await restoreBackup(b.sql, { get: server.get, today: TODAY });
    b.db.exec("UPDATE weight_log SET value = 61 WHERE id = 'w1'");
    expect(b.all<{ changed_ms: number }>('SELECT changed_ms FROM sync_queue')[0].changed_ms).toBeGreaterThan(later);
    await uploadQueue(b.sql, { post: server.post });
    expect([...server.stored.values()][0].d).toMatchObject({ value: 61 });
  });

  withSqlite('tells the caller which types each written page held', async () => {
    const { server } = await backedUp();
    const b = await newPhone();
    const pages: string[][] = [];
    await restoreBackup(b.sql, { get: server.get, today: TODAY, pageWritten: (types) => pages.push([...types].sort()) });
    expect(pages.flat()).toContain('kv');
    expect(pages.flat()).toContain('walk_point');
  });

  withSqlite("keeps the phone's own row when it waits to upload, is newer, or is today's steps", async () => {
    const server = fakeServer();
    const rec = (t: string, k: string, u: number, d: Record<string, unknown>): BackupRecord => ({ t, k, u, d });
    await server.post([
      rec('weight_log', 'w1', 1000, { id: 'w1', logged_at: 1, value: 60 }),
      rec('heart_day', '2026-11-01', 1000, { date: '2026-11-01', resting_bpm: 60, updated_at: 1000 }),
      rec('heart_day', '2026-11-02', 9000, { date: '2026-11-02', resting_bpm: 60, updated_at: 9000 }),
      rec('day_summary', TODAY, 9000, { date: TODAY, steps: 9999, distance_m: 1, active_kcal: 1, goal: 1, source: 'x', updated_at: 9000 }),
      rec('hour_steps', TODAY, 9000, { cols: ['hour', 'steps'], rows: [[3, 9999]] }),
      rec('day_summary', '2026-11-20', 9000, { date: '2026-11-20', steps: 8000, distance_m: 1, active_kcal: 1, goal: 1, source: 'x', updated_at: 9000 }),
    ]);
    const b = await newPhone();
    b.db.exec(rowInsert(b.db, 'weight_log', { id: 'w1', value: 71 })); // waits to upload
    b.paused(rowInsert(b.db, 'heart_day', { date: '2026-11-01', resting_bpm: 55, updated_at: 5000 })); // newer here
    b.paused(rowInsert(b.db, 'heart_day', { date: '2026-11-02', resting_bpm: 55, updated_at: 5000 })); // older here
    b.paused(rowInsert(b.db, 'day_summary', { date: TODAY, steps: 300 }));
    b.paused(rowInsert(b.db, 'hour_steps', { date: TODAY, hour: 9, steps: 300 }));
    b.paused(rowInsert(b.db, 'day_summary', { date: '2026-11-20', steps: 10, updated_at: 1 }));
    await restoreBackup(b.sql, { get: server.get, today: TODAY });
    expect(b.all('SELECT value FROM weight_log')).toEqual([{ value: 71 }]);
    expect(b.all('SELECT date, resting_bpm FROM heart_day ORDER BY date')).toEqual([
      { date: '2026-11-01', resting_bpm: 55 },
      { date: '2026-11-02', resting_bpm: 60 },
    ]);
    expect(b.all('SELECT date, steps FROM day_summary ORDER BY date')).toEqual([
      { date: '2026-11-20', steps: 8000 },
      { date: TODAY, steps: 300 },
    ]);
    expect(b.all('SELECT hour, steps FROM hour_steps')).toEqual([{ hour: 9, steps: 300 }]);
    expect(b.queue().map((q) => q.k)).toEqual(['w1']);
  });

  withSqlite('a health app reading is never there twice: beside the own entry, or as two copies', async () => {
    const server = fakeServer();
    const bp = (id: string, source: string, healthId: string | null) => ({
      t: 'bp_log',
      k: id,
      u: 1000,
      d: { id, logged_at: 1, systolic: 120, diastolic: 80, source, health_id: healthId, updated_at: 1000 },
    });
    await server.post([bp('health:h1', 'health', 'h1'), bp('own2', 'manual', 'h2'), bp('health:h3', 'health', 'h3')]);
    const b = await newPhone();
    b.paused(rowInsert(b.db, 'bp_log', { id: 'mine1', source: 'manual', health_id: 'h1', updated_at: 1 }));
    b.paused(rowInsert(b.db, 'bp_log', { id: 'health:h2', source: 'health', health_id: 'h2', updated_at: 1 }));
    await restoreBackup(b.sql, { get: server.get, today: TODAY });
    expect(b.all('SELECT id FROM bp_log ORDER BY id')).toEqual([{ id: 'health:h3' }, { id: 'mine1' }, { id: 'own2' }]);
  });

  withSqlite('skips tombstones, unknown types, kv keys off the list and records it cannot read', async () => {
    const b = await newPhone();
    b.paused(rowInsert(b.db, 'weight_log', { id: 'w1' }));
    const records: unknown[] = [
      { t: 'weight_log', k: 'w1', u: 1, d: null },
      { t: 'secret', k: 'x', u: 1, d: { a: 1 } },
      { t: 'kv', k: 'accountId', u: 1, d: { key: 'accountId', value: '"other"' } },
      { t: 'weight_log', k: 'w2', u: 'soon', d: {} },
      'junk',
      { t: 'weight_log', k: 'w3', u: 1, d: { id: 'w3' } }, // a required column missing
    ];
    const result = await restoreBackup(b.sql, { get: async () => ({ records, next: null }), today: TODAY });
    expect(result).toEqual({ pages: 1, applied: 0, skipped: records.length });
    expect(b.all('SELECT id FROM weight_log')).toEqual([{ id: 'w1' }]);
    expect(b.all('SELECT key FROM kv')).toEqual([]);
  });

  withSqlite('one bad record does not hold back the rest of its page', async () => {
    const b = await newPhone();
    const records: unknown[] = [
      { t: 'weight_log', k: 'w1', u: 1, d: { id: 'w1', logged_at: 1, value: 'not a number but fine in SQLite' } },
      { t: 'hour_steps', k: '2026-11-01', u: 1, d: { cols: ['hour', 'steps'], rows: [[1, 5], [1, 6]] } }, // same hour twice
      { t: 'weight_log', k: 'w2', u: 1, d: { id: 'w2', logged_at: 1, value: 70 } },
    ];
    const warn = jest.fn<(m: string) => void>();
    const result = await restoreBackup(b.sql, { get: async () => ({ records, next: null }), today: TODAY, warn });
    expect(result).toMatchObject({ applied: 2, skipped: 1 });
    expect(b.all('SELECT id FROM weight_log ORDER BY id')).toEqual([{ id: 'w1' }, { id: 'w2' }]);
    expect(b.all('SELECT * FROM hour_steps')).toEqual([]);
    expect(b.all('SELECT * FROM sync_pause')).toEqual([]);
    expect(warn).toHaveBeenCalledWith('Backup: some records could not be restored');
  });

  withSqlite('quotes are safe: values are written as literals', async () => {
    expect(sqlLiteral("it's")).toBe("'it''s'");
    expect(sqlLiteral('a\0b')).toBe("'ab'");
    expect(sqlLiteral(Number.NaN)).toBe('NULL');
    const b = await newPhone();
    const name = "Ma's dal'); DROP TABLE food_log; --";
    await restoreBackup(b.sql, {
      get: async () => ({ records: [{ t: 'food_log', k: 'f1', u: 1, d: { id: 'f1', logged_at: 1, name, kcal: 200 } }], next: null }),
      today: TODAY,
    });
    expect(b.all('SELECT name FROM food_log')).toEqual([{ name }]);
  });
});

describe('clearAll', () => {
  withSqlite('never queues a delete, and empties the queue', async () => {
    const phone = await newPhone();
    fillEveryTable(phone, 'k1');
    expect(phone.queue().length).toBeGreaterThan(0);
    phone.clearAll();
    expect(phone.queue()).toEqual([]);
    expect(phone.all('SELECT * FROM sync_pause')).toEqual([]);
    const server = fakeServer();
    await uploadQueue(phone.sql, { post: server.post });
    expect(server.calls).toEqual([]);
    // Tracking works again afterwards.
    phone.db.exec(rowInsert(phone.db, 'weight_log', { id: 'w9' }));
    expect(phone.queue().map((q) => q.k)).toEqual(['w9']);
  });

  withSqlite('clears every backed-up table', async () => {
    const phone = await newPhone();
    fillEveryTable(phone, 'k1');
    phone.clearAll();
    for (const spec of BACKUP_TABLES) expect([spec.table, phone.all(`SELECT * FROM ${spec.table}`)]).toEqual([spec.table, []]);
  });
});
