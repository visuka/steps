/**
 * A gate in front of the phone's one SQLite connection, for writes that must
 * not have anything else land in the middle of them: the cloud backup's
 * paused writes and clearAll (src/data/db.ts, docs/backup.md).
 *
 * One exec holds the connection only while it runs. When it fails part way
 * its savepoint (and the sync_pause row) stay open until the ROLLBACK that
 * follows, a separate call: anything else sent meanwhile would run inside
 * the savepoint, unqueued, and then be rolled back with it. So while
 * `exclusive(task)` runs, every other call through the gated database waits,
 * and the task uses the connection itself. It first waits (a few seconds at
 * most) for the app's own transactions to end, so their steps can't be held
 * up mid-way and a rollback of one can't take the task's writes with it.
 */
export interface Gate<D> {
  /** The database for everyone else: calls wait while an exclusive task runs. */
  db: D;
  /** Runs `task` with nothing else on the connection until it has finished, its own rollback included. */
  exclusive<T>(task: () => Promise<T>): Promise<T>;
}

/** How long an exclusive task waits for the app's transactions to end, then goes ahead. */
export const TRANSACTION_WAIT_MS = 5_000;
const POLL_MS = 25;

/**
 * Wraps every `…Async` method of `raw` (and `withTransactionAsync`, which it
 * also counts). `inTransaction`: the connection's own view, for transactions
 * begun before the gate existed.
 */
export function gateDatabase<D extends object>(raw: D, inTransaction: () => boolean = () => false): Gate<D> {
  let held: Promise<void> | null = null;
  let transactions = 0;

  const call = (fn: (...args: unknown[]) => Promise<unknown>) =>
    async (...args: unknown[]) => {
      while (held) await held;
      // Nothing awaited since the check: this call is sent before any task that starts later.
      return fn.apply(raw, args);
    };

  const transaction = (fn: (task: () => Promise<unknown>) => Promise<unknown>) =>
    async (task: () => Promise<unknown>) => {
      while (held) await held;
      transactions++;
      try {
        return await fn.call(raw, task);
      } finally {
        transactions--;
      }
    };

  const db = new Proxy(raw, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== 'function' || typeof prop !== 'string') return value;
      if (prop === 'withTransactionAsync') return transaction(value as (task: () => Promise<unknown>) => Promise<unknown>);
      if (prop.endsWith('Async')) return call(value as (...args: unknown[]) => Promise<unknown>);
      return (value as (...args: unknown[]) => unknown).bind(target);
    },
  });

  async function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const giveUpAt = Date.now() + TRANSACTION_WAIT_MS;
    for (;;) {
      if (held) {
        await held;
        continue;
      }
      if ((transactions > 0 || inTransaction()) && Date.now() < giveUpAt) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        continue;
      }
      break;
    }
    let open!: () => void;
    held = new Promise<void>((r) => (open = r));
    try {
      return await task();
    } finally {
      held = null;
      open();
    }
  }

  return { db, exclusive };
}
