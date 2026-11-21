/**
 * What the cloud backup is doing, and the one line the account card shows
 * for it. Pure, so jest checks the words.
 */
import { minutesAgo } from '@/lib/format';

/**
 * `off`: signed out, web, or stopped by a 401. `waiting`: signed in, nothing
 * run yet. `done`: the last run finished.
 */
export type BackupPhase = 'off' | 'waiting' | 'restoring' | 'uploading' | 'offline' | 'failed' | 'done';

export interface BackupStatus {
  phase: BackupPhase;
  /** When the last upload run finished (epoch ms), or null. */
  lastAt: number | null;
  /** Records waiting to upload, as of the last look. */
  pending: number;
}

export const IDLE_STATUS: BackupStatus = { phase: 'off', lastAt: null, pending: 0 };

export const RESTORING_LINE = 'Bringing back your data…';

/** The account card's line; null when there is no backup to speak of (signed out, web). */
export function backupLine(s: BackupStatus, now = Date.now()): string | null {
  const backedUp = s.lastAt !== null ? `Backed up: ${minutesAgo(s.lastAt, now)}` : null;
  switch (s.phase) {
    case 'off':
      return null;
    case 'restoring':
      return RESTORING_LINE;
    case 'uploading':
      return 'Backing up…';
    case 'offline':
      return s.pending > 0 || !backedUp ? 'Not backed up yet: no connection' : backedUp;
    case 'failed':
      return s.pending > 0 || !backedUp ? 'Not backed up yet: trying again soon' : backedUp;
    case 'waiting':
      return backedUp ?? 'Not backed up yet';
    default:
      return backedUp ?? 'Backing up…';
  }
}
