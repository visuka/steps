/**
 * What can go wrong with Block Store:
 * - `unavailable`: no Google Play services, or too old to run Block Store.
 * - `too-big`: the value or the number of entries is over Block Store's limits.
 * - `failed`: anything else; `message` says what, for logs, never the value.
 */
export type BlockStoreErrorCode = 'unavailable' | 'too-big' | 'failed';

export class BlockStoreError extends Error {
  readonly code: BlockStoreErrorCode;

  constructor(code: BlockStoreErrorCode, message: string = code) {
    super(message);
    this.name = 'BlockStoreError';
    this.code = code;
  }
}

// Checked by name, not instanceof: subclassed Errors don't always survive transpiling.
export function isBlockStoreError(e: unknown): e is BlockStoreError {
  return e instanceof Error && e.name === 'BlockStoreError' && typeof (e as BlockStoreError).code === 'string';
}

/** The codes the Kotlin module rejects with (BlockStoreModule.kt). */
const NATIVE_CODES = new Map<unknown, BlockStoreErrorCode>([
  ['ERR_BLOCKSTORE_UNAVAILABLE', 'unavailable'],
  ['ERR_BLOCKSTORE_TOO_BIG', 'too-big'],
  ['ERR_BLOCKSTORE_FAILED', 'failed'],
]);

export function toBlockStoreError(e: unknown): BlockStoreError {
  if (isBlockStoreError(e)) return e;
  const native = (e ?? {}) as { code?: unknown; message?: unknown };
  const code = NATIVE_CODES.get(native.code) ?? 'failed';
  return new BlockStoreError(code, typeof native.message === 'string' ? native.message : code);
}

/** The native module's own calls (Android only). */
export interface BlockStoreNative {
  isSupported(): boolean;
  store(key: string, value: string): Promise<boolean>;
  retrieve(key: string): Promise<string | null>;
  delete(key: string): Promise<boolean>;
}

export interface BlockStoreApi {
  /** False without Google Play services, and on iOS and the web. */
  isSupported(): boolean;
  /**
   * Keeps a base64 (or base64url) value under `key`, backed up to the
   * person's Google account with the phone's backups. Resolves false where
   * there is no Block Store (iOS, web); rejects with a BlockStoreError.
   */
  store(key: string, value: string): Promise<boolean>;
  /** The value kept under `key`, or null when there is none (always null on iOS and web). */
  retrieve(key: string): Promise<string | null>;
  /** Resolves true when something was deleted; false where there is no Block Store. */
  delete(key: string): Promise<boolean>;
}

// Block Store's own rules: at most 1024 bytes for key and value together.
const KEY = /^[A-Za-z0-9._-]{1,64}$/;
const BASE64 = /^[A-Za-z0-9+/_-]+={0,2}$/;
const MAX_VALUE = 512;

const isValue = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_VALUE && BASE64.test(v);

/**
 * Wraps the native module so every failure is a BlockStoreError and only
 * base64 text goes in or comes out. A missing module (iOS, the web preview)
 * keeps nothing and finds nothing.
 */
export function makeBlockStore(native: BlockStoreNative | null): BlockStoreApi {
  const checkKey = (fn: string, key: string) => {
    if (typeof key !== 'string' || !KEY.test(key)) throw new BlockStoreError('failed', `${fn}: bad key`);
  };

  const call = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (e) {
      throw toBlockStoreError(e);
    }
  };

  return {
    isSupported: () => {
      try {
        return !!native?.isSupported();
      } catch {
        return false;
      }
    },
    async store(key, value) {
      checkKey('store', key);
      if (!isValue(value)) throw new BlockStoreError('failed', 'store: the value is not base64');
      if (!native) return false;
      return call(async () => (await native.store(key, value)) === true);
    },
    async retrieve(key) {
      checkKey('retrieve', key);
      if (!native) return null;
      const value = await call(() => native.retrieve(key));
      // Anything that isn't what store() lets in wasn't written by this app as it is now.
      return isValue(value) ? value : null;
    },
    async delete(key) {
      checkKey('delete', key);
      if (!native) return false;
      return call(async () => (await native.delete(key)) === true);
    },
  };
}
