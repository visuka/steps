import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { gateDatabase, TRANSACTION_WAIT_MS } from '../sql-gate';

/** A connection like expo-sqlite's: one call at a time, in the order sent; `FAIL` in an exec makes it fail. */
function fakeConnection() {
  const log: string[] = [];
  let queue: Promise<unknown> = Promise.resolve();
  let inTransaction = false;
  const send = (what: string) => {
    const run = queue.then(async () => {
      await new Promise<void>((r) => setImmediate(r));
      log.push(what);
      if (what.includes('FAIL')) throw new Error('constraint failed');
    });
    queue = run.catch(() => undefined);
    return run;
  };
  const raw = {
    execAsync: (sql: string) => send(sql),
    runAsync: (sql: string) => send(sql),
    async withTransactionAsync(task: () => Promise<void>) {
      await send('BEGIN');
      inTransaction = true;
      try {
        await task();
        await send('COMMIT');
      } catch (e) {
        await send('ROLLBACK');
        throw e;
      } finally {
        inTransaction = false;
      }
    },
    isInTransactionSync: () => inTransaction,
  };
  return { raw, log };
}

/** A failed paused write as src/data/db.ts runs it: the exec, then its rollback in a separate call. */
const failedWrite = (raw: ReturnType<typeof fakeConnection>['raw']) => async () => {
  try {
    await raw.execAsync('SAVEPOINT p; INSERT FAIL');
  } catch {
    await raw.execAsync('ROLLBACK TO p; RELEASE p;');
  }
};

afterEach(() => {
  jest.useRealTimers();
});

describe('sql gate', () => {
  it('without it, a write sent while a failed exec rolls back lands inside the savepoint', async () => {
    const c = fakeConnection();
    await Promise.all([failedWrite(c.raw)(), c.raw.runAsync('INSERT app')]);
    expect(c.log).toEqual(['SAVEPOINT p; INSERT FAIL', 'INSERT app', 'ROLLBACK TO p; RELEASE p;']);
  });

  it('a write sent during an exclusive task runs after its rollback, never inside it', async () => {
    const c = fakeConnection();
    const { db, exclusive } = gateDatabase(c.raw);
    const task = exclusive(failedWrite(c.raw));
    const other = db.runAsync('INSERT app');
    await Promise.all([task, other]);
    expect(c.log).toEqual(['SAVEPOINT p; INSERT FAIL', 'ROLLBACK TO p; RELEASE p;', 'INSERT app']);
  });

  it('a write sent before the task starts goes first', async () => {
    const c = fakeConnection();
    const { db, exclusive } = gateDatabase(c.raw);
    const other = db.runAsync('INSERT app');
    await Promise.all([other, exclusive(() => c.raw.execAsync('paused'))]);
    expect(c.log).toEqual(['INSERT app', 'paused']);
  });

  it("waits for the app's open transaction to end before it starts", async () => {
    const c = fakeConnection();
    const { db, exclusive } = gateDatabase(c.raw, c.raw.isInTransactionSync);
    let finish: () => void = () => undefined;
    let begun: () => void = () => undefined;
    const started = new Promise<void>((r) => (begun = r));
    const tx = db.withTransactionAsync(async () => {
      await db.runAsync('tx step 1');
      begun();
      await new Promise<void>((r) => (finish = r));
      await db.runAsync('tx step 2');
    });
    await started;
    const task = exclusive(() => c.raw.execAsync('paused'));
    await new Promise((r) => setTimeout(r, 100));
    expect(c.log).toEqual(['BEGIN', 'tx step 1']);
    finish();
    await Promise.all([tx, task]);
    expect(c.log).toEqual(['BEGIN', 'tx step 1', 'tx step 2', 'COMMIT', 'paused']);
  });

  it('goes ahead after a few seconds if a transaction never ends', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
    const c = fakeConnection();
    const { db, exclusive } = gateDatabase(c.raw);
    void db.withTransactionAsync(() => new Promise<void>(() => undefined));
    let done = false;
    const task = exclusive(() => c.raw.execAsync('paused')).then(() => (done = true));
    await jest.advanceTimersByTimeAsync(TRANSACTION_WAIT_MS - 100);
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(200);
    for (let i = 0; i < 10 && !done; i++) await new Promise<void>((r) => setImmediate(r));
    await task;
    expect(c.log).toEqual(['BEGIN', 'paused']);
  });
});
