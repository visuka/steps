import type { LockSupport, UnlockResult } from '@/auth/device-lock';

export type { LockSupport, UnlockResult } from '@/auth/device-lock';

/** Browsers have no fingerprint prompt the app can use; the lock is phone-only. */
export async function lockSupport(): Promise<LockSupport> {
  return 'unsupported';
}

export async function unlockWithDevice(): Promise<UnlockResult> {
  return 'ok';
}
