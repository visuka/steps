import { describe, expect, it, jest } from '@jest/globals';

import {
  BlockStoreError,
  type BlockStoreNative,
  isBlockStoreError,
  makeBlockStore,
  toBlockStoreError,
} from '../../../modules/blockstore/blockstore';

const KEY = 'steps_restore_key';
const VALUE = 'q83vEjRWeJq83vEjRWeJq83vEjRWeJq83vEjRWeJq80';

/** What Expo hands JS when a Kotlin AsyncFunction rejects with a CodedException. */
const nativeError = (code: string, message = `Call to function 'BlockStore.store' has been rejected. ${code}`) =>
  Object.assign(new Error(message), { code });

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (isBlockStoreError(e)) return e.code;
    throw e;
  }
  throw new Error('expected a rejection');
}

/** A Block Store in memory, the way the Kotlin module behaves. */
function native(overrides: Partial<BlockStoreNative> = {}) {
  const entries = new Map<string, string>();
  const impl: BlockStoreNative = {
    isSupported: () => true,
    store: jest.fn(async (key: string, value: string) => {
      entries.set(key, value);
      return true;
    }),
    retrieve: jest.fn(async (key: string) => entries.get(key) ?? null),
    delete: jest.fn(async (key: string) => entries.delete(key)),
    ...overrides,
  };
  return { impl, entries };
}

describe('toBlockStoreError', () => {
  it('maps each native code', () => {
    expect(toBlockStoreError(nativeError('ERR_BLOCKSTORE_UNAVAILABLE')).code).toBe('unavailable');
    expect(toBlockStoreError(nativeError('ERR_BLOCKSTORE_TOO_BIG')).code).toBe('too-big');
    expect(toBlockStoreError(nativeError('ERR_BLOCKSTORE_FAILED')).code).toBe('failed');
  });

  it('calls anything unknown a failure, and leaves its own errors as they are', () => {
    expect(toBlockStoreError(new Error('boom')).code).toBe('failed');
    expect(toBlockStoreError(undefined).code).toBe('failed');
    const own = new BlockStoreError('too-big');
    expect(toBlockStoreError(own)).toBe(own);
  });
});

describe('makeBlockStore', () => {
  it('stores, finds and deletes a value under its key', async () => {
    const { impl, entries } = native();
    const store = makeBlockStore(impl);
    expect(store.isSupported()).toBe(true);
    expect(await store.retrieve(KEY)).toBeNull();
    expect(await store.store(KEY, VALUE)).toBe(true);
    expect(impl.store).toHaveBeenCalledWith(KEY, VALUE);
    expect(entries.get(KEY)).toBe(VALUE);
    expect(await store.retrieve(KEY)).toBe(VALUE);
    expect(await store.delete(KEY)).toBe(true);
    expect(await store.retrieve(KEY)).toBeNull();
    // Nothing left to delete.
    expect(await store.delete(KEY)).toBe(false);
  });

  it('takes base64 and base64url values only', async () => {
    const { impl } = native();
    const store = makeBlockStore(impl);
    expect(await store.store(KEY, 'aGVsbG8gd29ybGQ=')).toBe(true);
    expect(await store.store(KEY, 'a-b_c')).toBe(true);
    for (const bad of ['', 'not base64!', 'a\nb', 'x'.repeat(513), 'abc==='] as const) {
      expect(await codeOf(store.store(KEY, bad))).toBe('failed');
    }
    expect(impl.store).toHaveBeenCalledTimes(2);
  });

  it('refuses keys Block Store would not take', async () => {
    const { impl } = native();
    const store = makeBlockStore(impl);
    for (const bad of ['', 'has space', 'x'.repeat(65), 'ünïcode']) {
      expect(await codeOf(store.store(bad, VALUE))).toBe('failed');
      expect(await codeOf(store.retrieve(bad))).toBe('failed');
      expect(await codeOf(store.delete(bad))).toBe('failed');
    }
    expect(impl.store).not.toHaveBeenCalled();
    expect(impl.retrieve).not.toHaveBeenCalled();
    expect(impl.delete).not.toHaveBeenCalled();
  });

  it("finds nothing in an entry this app didn't write as base64", async () => {
    const store = makeBlockStore(native({ retrieve: async () => '{"not":"ours"}' }).impl);
    expect(await store.retrieve(KEY)).toBeNull();
    const odd = makeBlockStore(native({ retrieve: async () => 42 as unknown as string }).impl);
    expect(await odd.retrieve(KEY)).toBeNull();
  });

  it('turns native rejections into codes, without the value in the message', async () => {
    const store = makeBlockStore(
      native({
        store: async () => {
          throw nativeError('ERR_BLOCKSTORE_TOO_BIG', 'store: status 40000');
        },
        retrieve: async () => {
          throw nativeError('ERR_BLOCKSTORE_UNAVAILABLE', 'retrieve: status 17');
        },
        delete: async () => {
          throw new Error('Play services died');
        },
      }).impl,
    );
    expect(await codeOf(store.store(KEY, VALUE))).toBe('too-big');
    expect(await codeOf(store.retrieve(KEY))).toBe('unavailable');
    expect(await codeOf(store.delete(KEY))).toBe('failed');
    await store.store(KEY, VALUE).catch((e: Error) => expect(e.message).not.toContain(VALUE));
  });

  it('keeps nothing and finds nothing where there is no native module (iOS, web)', async () => {
    const store = makeBlockStore(null);
    expect(store.isSupported()).toBe(false);
    expect(await store.store(KEY, VALUE)).toBe(false);
    expect(await store.retrieve(KEY)).toBeNull();
    expect(await store.delete(KEY)).toBe(false);
  });

  it('says not supported when the native check throws', () => {
    const store = makeBlockStore(
      native({
        isSupported: () => {
          throw new Error('no Play services');
        },
      }).impl,
    );
    expect(store.isSupported()).toBe(false);
  });
});
