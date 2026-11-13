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
  /** Doppler speed and its accuracy (m/s), and height (m), when the fix has them. */
  speed?: number | null;
  speedAcc?: number | null;
  alt?: number | null;
}

/** The walk's own step counter: cumulative steps since the walk started, a row at least every 5 s while walking. */
export interface NativeStepSample {
  t: number;
  steps: number;
}

/** Mean air pressure over 5 s, hPa. */
export interface NativePressureSample {
  t: number;
  hpa: number;
}

/** One Activity Recognition activity (confidence >= 30) of a result at time t. */
export interface NativeActivitySample {
  t: number;
  /** vehicle, bicycle, foot, walking, running, still, tilting or unknown. */
  type: string;
  conf: number;
}

/** The recording's mode as the native side keeps it, so a resumed screen shows the right title. */
export interface NativeWalkMode {
  /** "walk" or "ride". */
  activity: string;
  indoor: boolean;
  /** The pin as JSON ({id, name, lat, lon, radiusM}), or null. */
  place: string | null;
  /** Indoor rides: "easy", "steady" or "hard". */
  effort: string | null;
  /** Last time the service wrote a sample (epoch ms), for when an interrupted walk ended. */
  lastAliveAt: number | null;
  /** Switches between indoor and outdoor, the start included. */
  changes: { t: number; indoor: boolean }[];
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

  /**
   * Starts (or resumes, keeping the stored mode) recording; resolves its start
   * time. Rejects without location permission, except an indoor ride, which
   * runs no service at all.
   */
  startWalk(activity: string, indoor: boolean, place: string | null, effort: string | null): Promise<number>;
  stopWalk(): Promise<void>;
  /** Start time of a walk recorded but not yet cleared, or null. */
  activeWalk(): number | null;
  isWalkRecording(): boolean;
  getWalkPoints(walkId: number, afterT: number): Promise<NativeWalkPoint[]>;
  clearWalk(walkId: number): Promise<void>;
  /** "I'm outside now" / "I'm back inside". */
  setWalkIndoor(indoor: boolean): Promise<void>;
  walkMode(): Promise<NativeWalkMode | null>;
  getWalkSteps(walkId: number, afterT: number): Promise<NativeStepSample[]>;
  getWalkPressure(walkId: number, afterT: number): Promise<NativePressureSample[]>;
  getWalkActivity(walkId: number, afterT: number): Promise<NativeActivitySample[]>;
  hasBarometer(): boolean;
}

/** Android only; null on iOS and web. */
export const StepCounter = requireOptionalNativeModule<StepCounterNative>('StepCounter');
