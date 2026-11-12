import * as SecureStore from 'expo-secure-store';

import type { PendingDelete } from '@/auth/account';
import { isAccountId } from '@/auth/auth-api';
import { CARRIED_OVER_KEY, moveOffSupabase, type SecureKv } from '@/auth/handover';
import type { CarriedOver } from '@/auth/owner';
import { parseStoredSession, type SessionStore } from '@/auth/session-core';

const KEY = 'steps.session';

// iOS Keychain: readable by background work once the phone has been unlocked
// after a restart, and never restored onto another phone from a backup.
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/**
 * The account id and refresh token live in the Android Keystore / iOS
 * Keychain, never in plain app storage. Both are small, so no chunking.
 * Android deletes them on uninstall, so a reinstall signs in again (one
 * fingerprint touch with the passkey).
 */
export const sessionStore: SessionStore = {
  async load() {
    // Not awaited: signing in doesn't wait for it. carriedOverAccount does.
    leaveSupabase();
    return parseStoredSession(await SecureStore.getItemAsync(KEY, OPTIONS));
  },
  save: (session) => SecureStore.setItemAsync(KEY, JSON.stringify(session), OPTIONS),
  clear: () => SecureStore.deleteItemAsync(KEY, OPTIONS),
};

// The old Supabase keys were written without options, so they're read and
// deleted without; the only thing written here is our own note, with ours.
const plainKv: SecureKv = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
  remove: (key) => SecureStore.deleteItemAsync(key),
};

let leaving: Promise<void> | null = null;

/** Once per start; a failure leaves the old keys for the next start to try again. */
function leaveSupabase(): Promise<void> {
  leaving ??= moveOffSupabase(plainKv).catch(() => undefined);
  return leaving;
}

/** The Supabase account still signed in when this phone moved to passkeys (src/auth/owner.ts). */
export const carriedOverAccount: CarriedOver = {
  async get() {
    await leaveSupabase();
    const id = await SecureStore.getItemAsync(CARRIED_OVER_KEY, OPTIONS);
    return isAccountId(id) ? id : null;
  },
  clear: () => SecureStore.deleteItemAsync(CARRIED_OVER_KEY, OPTIONS),
};

const DELETE_PENDING_KEY = 'steps.deletePending';

/** The account whose deletion the server left half done (src/auth/account.ts). */
export const pendingDelete: PendingDelete = {
  async get() {
    const id = await SecureStore.getItemAsync(DELETE_PENDING_KEY, OPTIONS);
    return isAccountId(id) ? id : null;
  },
  set: (userId) => SecureStore.setItemAsync(DELETE_PENDING_KEY, userId, OPTIONS),
  clear: () => SecureStore.deleteItemAsync(DELETE_PENDING_KEY, OPTIONS),
};
