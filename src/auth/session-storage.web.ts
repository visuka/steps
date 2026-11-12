import type { PendingDelete } from '@/auth/account';
import type { CarriedOver } from '@/auth/owner';
import type { SessionStore, StoredSession } from '@/auth/session-core';

let memory: StoredSession | null = null;

/**
 * The web preview has no secure store (and no passkeys), so a session is
 * kept in memory only and never written to the browser.
 */
export const sessionStore: SessionStore = {
  load: async () => memory,
  save: async (session) => {
    memory = session;
  },
  clear: async () => {
    memory = null;
  },
};

/** The web preview never had a Supabase session to carry over. */
export const carriedOverAccount: CarriedOver = {
  get: async () => null,
  clear: async () => undefined,
};

let deleting: string | null = null;

/** Memory only, like the session. */
export const pendingDelete: PendingDelete = {
  get: async () => deleting,
  set: async (userId) => {
    deleting = userId;
  },
  clear: async () => {
    deleting = null;
  },
};
