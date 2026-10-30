/** The few calls the chunker needs from a secure key-value store. */
export interface SecureKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** The storage shape Supabase's auth client expects. */
export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Some iOS releases refuse Keychain values over about 2 KB, and a Supabase
 * session is often bigger, so values are split into parts saved as
 * `key.0`, `key.1`… with the part count under `key.n`.
 */
export const CHUNK_SIZE = 1800;

export function chunkedStorage(kv: SecureKv, size = CHUNK_SIZE): SessionStorage {
  const countOf = async (key: string) => Number(await kv.get(`${key}.n`)) || 0;
  const removeParts = async (key: string, from: number, to: number) => {
    for (let i = from; i < to; i++) await kv.remove(`${key}.${i}`);
  };

  return {
    async getItem(key) {
      const n = await countOf(key);
      if (n === 0) return null;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const part = await kv.get(`${key}.${i}`);
        // A missing part means a half-finished write: treat it as signed out.
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(key, value) {
      const before = await countOf(key);
      const parts: string[] = [];
      for (let i = 0; i < value.length; i += size) parts.push(value.slice(i, i + size));
      if (parts.length === 0) parts.push('');
      for (let i = 0; i < parts.length; i++) await kv.set(`${key}.${i}`, parts[i]);
      await kv.set(`${key}.n`, String(parts.length));
      await removeParts(key, parts.length, before);
    },
    async removeItem(key) {
      const n = await countOf(key);
      await kv.remove(`${key}.n`);
      await removeParts(key, 0, n);
    },
  };
}
