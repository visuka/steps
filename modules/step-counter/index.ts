import { requireOptionalNativeModule } from 'expo';

export interface MinuteBucket {
  /** Epoch ms of the minute's start. */
  start: number;
  steps: number;
}

/** Steps the counter knows were taken between `from` and `to` (epoch ms), but not when. */
export interface UntimedSteps {
  from: number;
  to: number;
  steps: number;
  /** "counting paused", "phone restarted" or "too many steps for one reading". */
  reason: string;
}

export interface CounterLogEntry {
  t: number;
  kind: string;
  detail: string;
}

/** "ready", "update-needed" (Google Play services too old) or "unavailable". */
export type RecorderStatus = 'ready' | 'update-needed' | 'unavailable';

export interface NativeWalkPoint {
  t: number;
  lat: number;
  lon: number;
  acc: number | null;
}

interface StepCounterNative {
  isSupported(): boolean;
  isRunning(): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  /** The app's own counter: minute buckets overlapping [startMs, endMs), the minute in progress included. */
  getBuckets(startMs: number, endMs: number): Promise<MinuteBucket[]>;
  /** The app's own counter: untimed stretches overlapping [startMs, endMs). */
  getUntimed(startMs: number, endMs: number): Promise<UntimedSteps[]>;
  /** What the counter and recorder did lately, newest first (for the Step check screen). */
  getLog(limit: number): Promise<CounterLogEntry[]>;
  clear(): Promise<void>;

  /** Google's step recorder (Google Play services Recording API). */
  recorderStatus(): RecorderStatus;
  /** When the recorder first started recording for this app (epoch ms), or null. */
  recorderSince(): number | null;
  /** Subscribes; resolves the recording start time, or null when the recorder isn't available. */
  startRecorder(): Promise<number | null>;
  stopRecorder(): Promise<void>;
  /** The recorder's steps per minute in [startMs, endMs); minutes without steps are left out. */
  getRecorderBuckets(startMs: number, endMs: number): Promise<MinuteBucket[]>;

  /** Starts (or resumes) recording a walk; resolves its start time. Rejects without location permission. */
  startWalk(): Promise<number>;
  stopWalk(): Promise<void>;
  /** Start time of a walk recorded but not yet cleared, or null. */
  activeWalk(): number | null;
  isWalkRecording(): boolean;
  getWalkPoints(walkId: number, afterT: number): Promise<NativeWalkPoint[]>;
  clearWalk(walkId: number): Promise<void>;
}

/** Android only; null on iOS and web. */
export const StepCounter = requireOptionalNativeModule<StepCounterNative>('StepCounter');
