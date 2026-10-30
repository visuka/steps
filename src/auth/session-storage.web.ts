import type { SessionStorage } from '@/auth/chunked-storage';

/** The web preview has no secure store; Supabase falls back to localStorage. */
export const sessionStorage: SessionStorage | undefined = undefined;
