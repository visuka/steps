import { describe, expect } from '@jest/globals';

import { BACKED_UP_KV, LOCAL_ONLY_KV } from '@/sync/kv-keys';

import { fs, root, withSqlite } from './backup-sqlite';

/** Every .ts/.tsx file under src/, tests left out. */
function sources(dir = `${root}/src`): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const entry of fs!.readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') out.push(...sources(path));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push({ file: path.slice(root.length + 1), text: fs!.readFileSync(path, 'utf8') });
    }
  }
  return out;
}

/**
 * The kv keys the app reads or writes: the first argument of every getKv /
 * setKv call, a string or a constant holding one. `key` is a wrapper's own
 * parameter (the repository itself, a small helper), whose callers are
 * scanned in turn.
 */
function kvKeysInUse(): { keys: Map<string, string[]>; unknown: string[] } {
  const files = sources();
  const constRe = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]| ]+)?=\s*(['"`])([^'"`]+)\2/g;
  const defs = new Map<string, { file: string; value: string }[]>();
  for (const { file, text } of files) {
    for (const m of text.matchAll(constRe)) defs.set(m[1], [...(defs.get(m[1]) ?? []), { file, value: m[3] }]);
  }
  const callRe = /\b(?:getKv|setKv)\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\s*\(\s*([^,)]+)/g;
  const keys = new Map<string, string[]>();
  const unknown: string[] = [];
  for (const { file, text } of files) {
    for (const m of text.matchAll(callRe)) {
      const arg = m[1].trim();
      if (arg === 'key' || arg === 'key: string') continue;
      const literal = /^(['"`])([^'"`]+)\1$/.exec(arg)?.[2];
      let value: string | undefined;
      if (literal !== undefined) value = literal;
      else {
        const found = defs.get(arg) ?? [];
        const values = new Set((found.some((d) => d.file === file) ? found.filter((d) => d.file === file) : found).map((d) => d.value));
        if (values.size === 1) value = [...values][0];
      }
      if (value === undefined || value.includes('${')) unknown.push(`${file}: ${arg}`);
      else keys.set(value, [...(keys.get(value) ?? []), file]);
    }
  }
  return { keys, unknown };
}

describe('kv keys and the cloud backup', () => {
  withSqlite('every kv key the app uses is either backed up or local only, with a reason', () => {
    const { keys, unknown } = kvKeysInUse();
    // A key the scan can't read: give it a constant, or teach this test about it.
    expect(unknown).toEqual([]);
    const listed = new Set([...Object.keys(BACKED_UP_KV), ...Object.keys(LOCAL_ONLY_KV)]);
    const missing = [...keys].filter(([key]) => !listed.has(key)).map(([key, files]) => `${key} (${files.join(', ')})`);
    // Add each to BACKED_UP_KV or LOCAL_ONLY_KV in src/sync/kv-keys.ts.
    expect(missing).toEqual([]);
    expect(keys.size).toBeGreaterThan(30);
  });

  withSqlite('no key is on both lists, and every reason says something', () => {
    for (const key of Object.keys(BACKED_UP_KV)) expect([key, key in LOCAL_ONLY_KV]).toEqual([key, false]);
    for (const reason of [...Object.values(BACKED_UP_KV), ...Object.values(LOCAL_ONLY_KV)]) {
      expect(reason.length).toBeGreaterThan(8);
    }
  });

  withSqlite('sign-in, sync state and caches are never backed up', () => {
    for (const key of ['accountId', 'lastSyncAt', 'backfilledAt', 'backupRestoredFor', 'backupLastAt', 'premium', 'buddies.me', 'sourceId']) {
      expect([key, key in BACKED_UP_KV]).toEqual([key, false]);
    }
  });
});

describe('what the app tells people about their data', () => {
  // Since the cloud backup (docs/backup.md) a copy of what is recorded goes to the account on our server:
  // nothing on screen may still say it stays on the phone.
  withSqlite('no text still says the data never leaves the phone', () => {
    const stale = [
      'Nothing leaves your phone',
      'Everything else stays on this phone',
      'walking data stays on',
      'Your location stays on this phone',
      'nothing is sent to our server',
      'title="Kept on this phone"',
    ];
    const found = sources().flatMap(({ file, text }) => stale.filter((s) => text.includes(s)).map((s) => `${file}: ${s}`));
    expect(found).toEqual([]);
  });

  withSqlite('the privacy note says what is backed up, and that the name is not', () => {
    const settings = sources().find((s) => s.file === 'src/app/settings.tsx')!.text;
    expect(settings).toContain('A copy of what you record is kept in your account on our server');
    expect(settings).toContain('Your name stays on this phone.');
  });
});
