import { requireOptionalNativeModule } from 'expo';

export interface MinuteBucket {
  /** Epoch ms of the minute's start. */
  start: number;
  steps: number;
}

interface StepCounterNative {
  isSupported(): boolean;
  isRunning(): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  getBuckets(startMs: number, endMs: number): Promise<MinuteBucket[]>;
  clear(): Promise<void>;
}

/** Android only; null on iOS and web. */
export const StepCounter = requireOptionalNativeModule<StepCounterNative>('StepCounter');
