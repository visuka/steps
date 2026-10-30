import type { Repository } from '@/data/types';

const OWNER_KEY = 'accountId';

/**
 * Ties the data on this phone to the account that signed in. Data from
 * before sign-in existed goes to the first account; if a different account
 * signs in later, the previous person's data is wiped first.
 */
export async function claimLocalData(
  repo: Pick<Repository, 'getKv' | 'setKv'>,
  userId: string,
  wipe: () => Promise<void>,
): Promise<void> {
  const owner = await repo.getKv<string>(OWNER_KEY);
  if (owner === userId) return;
  if (owner) await wipe();
  await repo.setKv(OWNER_KEY, userId);
}
