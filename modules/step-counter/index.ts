import { requireOptionalNativeModule } from 'expo';

export interface MinuteBucket {
  /** Epoch ms of the minute's start. */
  start: number;
  steps: number;
}

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
  getBuckets(startMs: number, endMs: number): Promise<MinuteBucket[]>;
  clear(): Promise<void>;

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
