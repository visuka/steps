import type { Repository } from '@/data/types';

const OWNER_KEY = 'accountId';

/** The account whose data may pass to the next sign-in on this phone (src/auth/handover.ts). */
export interface CarriedOver {
  get(): Promise<string | null>;
  clear(): Promise<void>;
}

async function carriedOverId(carriedOver: CarriedOver | undefined): Promise<string | null> {
  try {
    return (await carriedOver?.get()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Ties the data on this phone to the account that signed in. Data from
 * before sign-in existed goes to the first account; if a different account
 * signs in later, the previous person's data is wiped first.
 *
 * One exception, once: moving to passkeys gives everyone a new account id.
 * If the old Supabase account was still signed in on this phone, its data
 * goes to the first passkey account. Whoever signs in now passed the phone's
 * own screen lock, which is all the old app asked to open it.
 */
export async function claimLocalData(
  repo: Pick<Repository, 'getKv' | 'setKv'>,
  userId: string,
  wipe: () => Promise<void>,
  carriedOver?: CarriedOver,
): Promise<void> {
  const owner = await repo.getKv<string>(OWNER_KEY);
  if (owner === userId) return;
  if (owner && owner !== (await carriedOverId(carriedOver))) await wipe();
  await repo.setKv(OWNER_KEY, userId);
  // Whoever signed in first has it now; nobody else may take it later.
  await carriedOver?.clear().catch(() => undefined);
}

/** True when a new account made on this phone would wipe another account's data (see claimLocalData). */
export async function newAccountWipesData(
  repo: Pick<Repository, 'getKv'>,
  carriedOver?: CarriedOver,
): Promise<boolean> {
  const owner = await repo.getKv<string>(OWNER_KEY);
  return !!owner && owner !== (await carriedOverId(carriedOver));
}
