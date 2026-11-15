import { describe, expect, it, jest } from '@jest/globals';

import { COOKING_KEY, ensureTables, forgetTables, keptTables, type TablesDeps } from '../store';
import { FAKE_TABLES } from './fake-tables';

const memory = (start: Record<string, unknown> = {}) => {
  const kv = new Map<string, unknown>(Object.entries(start));
  const repo: TablesDeps['repo'] = {
    getKv: async <T>(key: string) => (kv.has(key) ? (kv.get(key) as T) : null),
    setKv: async <T>(key: string, value: T) => void kv.set(key, value),
  };
  return { kv, repo };
};
const answer = { calc: 'c1', tables: FAKE_TABLES };

describe('the cooking tables on the phone', () => {
  it('are downloaded when none are kept, and kept', async () => {
    const { kv, repo } = memory();
    const fetch = jest.fn(async () => answer as unknown);
    const tables = await ensureTables({ repo, fetch });
    expect(tables?.calc).toBe('c1');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(kv.has(COOKING_KEY)).toBe(true);
    expect(await keptTables(repo)).toEqual(tables);
  });

  it('are forgotten on sign-out, and asked for again after the next sign-in', async () => {
    const { repo } = memory({ [COOKING_KEY]: FAKE_TABLES });
    await forgetTables(repo);
    expect(await keptTables(repo)).toBeNull();
    const fetch = jest.fn(async () => answer as unknown);
    expect((await ensureTables({ repo, fetch }))?.calc).toBe('c1');
    expect(fetch).toHaveBeenCalledTimes(1);
    // A repo that cannot write does not break signing out.
    await expect(forgetTables({ ...repo, setKv: async () => Promise.reject(new Error('disk')) })).resolves.toBeUndefined();
  });

  it('are not asked for again while the version is the same', async () => {
    const { repo } = memory({ [COOKING_KEY]: FAKE_TABLES });
    const fetch = jest.fn(async () => answer as unknown);
    expect(await ensureTables({ repo, fetch })).toEqual(FAKE_TABLES);
    expect(await ensureTables({ repo, fetch }, 'c1')).toEqual(FAKE_TABLES);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('are asked for again when a profile of another version is seen, and the kept ones stay if that fails', async () => {
    const { repo } = memory({ [COOKING_KEY]: FAKE_TABLES });
    const fetch = jest.fn(async () => Promise.reject(new Error('offline')));
    expect(await ensureTables({ repo, fetch }, 'c2')).toEqual(FAKE_TABLES);
    expect(fetch).toHaveBeenCalledTimes(1);
    // A version this build does not know reads as no tables: the kept ones stay.
    expect(await ensureTables({ repo, fetch: async () => ({ calc: 'c2', tables: {} }) }, 'c2')).toEqual(FAKE_TABLES);
  });

  it('are nothing when none are kept and the download fails or is unreadable', async () => {
    const { kv, repo } = memory();
    expect(await ensureTables({ repo, fetch: async () => Promise.reject(new Error('x')) })).toBeNull();
    expect(await ensureTables({ repo, fetch: async () => ({ calc: 'c1', tables: { calc: 'c1' } }) })).toBeNull();
    expect(kv.size).toBe(0);
  });

  it('are used for now when they cannot be kept', async () => {
    const { repo } = memory();
    const failing = { ...repo, setKv: async () => Promise.reject(new Error('disk')) };
    expect((await ensureTables({ repo: failing, fetch: async () => answer }))?.calc).toBe('c1');
  });

  it('read as none when what is kept is damaged', async () => {
    expect(await keptTables(memory({ [COOKING_KEY]: { calc: 'c1' } }).repo)).toBeNull();
    expect(await keptTables({ getKv: async () => Promise.reject(new Error('x')), setKv: async () => undefined })).toBeNull();
  });
});
