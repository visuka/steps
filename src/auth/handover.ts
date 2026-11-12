import { isAccountId } from '@/auth/auth-api';

/** The few secure-store calls the move off Supabase needs. */
export interface SecureKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * The account that was still signed in with Supabase when this phone moved
 * to passkeys. Its data on the phone goes to the first passkey account
 * instead of being wiped (src/auth/owner.ts).
 */
export const CARRIED_OVER_KEY = 'steps.carriedOverAccount';

/**
 * Builds before passkeys kept a Supabase session in the secure store, split
 * into `<key>.n` and `<key>.0…`. Only the last project's session counts: it
 * is the one the build before this one signed in with. The older project's
 * keys are just removed. Safe to delete this file once no phone has a
 * Supabase build.
 */
export const SUPABASE_KEY = 'sb-iyzcablluxqadfrojgge-auth-token';
const OLD_SUPABASE_KEY = 'sb-hqzroexjsskwryylmccy-auth-token';

const MAX_PARTS = 64;

async function partCount(kv: SecureKv, key: string): Promise<number> {
  return Math.min(Number(await kv.get(`${key}.n`)) || 0, MAX_PARTS);
}

async function readParts(kv: SecureKv, key: string): Promise<string | null> {
  const n = await partCount(kv, key);
  if (n === 0) return null;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const part = await kv.get(`${key}.${i}`);
    // A half-written session never counted as signed in.
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function removeParts(kv: SecureKv, key: string): Promise<void> {
  const n = await partCount(kv, key);
  for (let i = 0; i < n; i++) await kv.remove(`${key}.${i}`);
  await kv.remove(`${key}.n`);
}

/** The account id in a saved Supabase session (`user.id`, what the old app used as the data owner). */
export function supabaseUserId(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const id = (JSON.parse(raw) as { user?: { id?: unknown } } | null)?.user?.id;
    return isAccountId(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Notes who was signed in, then deletes the Supabase sessions: their tokens
 * are of no use now and shouldn't lie around. The note is saved first, so if
 * that fails both stay for the next start.
 */
export async function moveOffSupabase(kv: SecureKv): Promise<void> {
  const id = supabaseUserId(await readParts(kv, SUPABASE_KEY));
  if (id) await kv.set(CARRIED_OVER_KEY, id);
  await removeParts(kv, SUPABASE_KEY);
  await removeParts(kv, OLD_SUPABASE_KEY);
}
