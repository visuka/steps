import type { WalkPoint } from '@/lib/walk';

/**
 * Records the route of a walk. A walk is identified by its start time and
 * stays "active" from start until the app has saved it and called discard(),
 * so a walk interrupted by the app closing can still be saved.
 */
export interface WalkRecorder {
  /** False where recording stops when the app leaves the screen (iOS for now, web). */
  recordsInBackground: boolean;
  /** Asks for location if needed; resolves the walk's start time, or null if location was refused. */
  start(): Promise<number | null>;
  stop(): Promise<void>;
  active(): Promise<number | null>;
  isRecording(): Promise<boolean>;
  /** Fixes after `afterT` (epoch ms), oldest first. */
  points(walkId: number, afterT: number): Promise<WalkPoint[]>;
  discard(walkId: number): Promise<void>;
}
