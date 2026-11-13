import type { Place } from '@/lib/places';
import type {
  ActivitySample,
  ArType,
  ModeChange,
  PressureSample,
  RideEffort,
  StepSample,
  WalkActivity,
  WalkPoint,
} from '@/lib/walk';

/** The pin a recording starts at, as the recorder keeps it. */
export type RecordingPlace = Pick<Place, 'id' | 'name' | 'lat' | 'lon' | 'radiusM'>;

export interface WalkStartOptions {
  /** 'walk' (default) or 'ride'. */
  activity?: WalkActivity;
  /** Indoor walk: steps only, a low-power fix a minute to notice leaving the pin. Indoor ride: time only. */
  indoor?: boolean;
  /** The pin an indoor walk starts at. */
  place?: RecordingPlace | null;
  /** Indoor rides: Easy / Steady / Hard. */
  effort?: RideEffort | null;
}

/** What's being recorded, read back on resume (titles: "Indoor walk · Home", "Riding"…). */
export interface WalkMode {
  activity: WalkActivity;
  /** Started indoors. The current mode is the last of `changes`. */
  indoor: boolean;
  /** Indoors now. */
  indoorNow: boolean;
  place: RecordingPlace | null;
  effort: RideEffort | null;
  /** Last time the recorder was seen alive, for when an interrupted walk ended. */
  lastAliveAt: number | null;
  /** Switches between indoor and outdoor, the start included. */
  changes: ModeChange[];
}

/**
 * Records a walk or ride. A recording is identified by its start time and
 * stays "active" from start until the app has saved it and called discard(),
 * so one interrupted by the app closing can still be saved.
 */
export interface WalkRecorder {
  /** False where recording stops when the app leaves the screen (iOS for now, web). */
  recordsInBackground: boolean;
  /**
   * Asks for location if needed (not for an indoor ride); resolves the start
   * time, or null if location was refused. On "carry on" the stored mode wins.
   */
  start(options?: WalkStartOptions): Promise<number | null>;
  stop(): Promise<void>;
  active(): Promise<number | null>;
  isRecording(): Promise<boolean>;
  /** Fixes after `afterT` (epoch ms), oldest first. Indoor-mode fixes included; the maths leaves them out. */
  points(walkId: number, afterT: number): Promise<WalkPoint[]>;
  /** The walk counter's rows after `afterT`; empty without step data (no permission, iOS, web). */
  steps(walkId: number, afterT: number): Promise<StepSample[]>;
  /** Barometer rows after `afterT`; empty without a barometer. */
  pressure(walkId: number, afterT: number): Promise<PressureSample[]>;
  /** Activity Recognition rows after `afterT`. */
  activities(walkId: number, afterT: number): Promise<ActivitySample[]>;
  /** The current recording's mode, or null when none. */
  mode(): Promise<WalkMode | null>;
  /** "I'm outside now" (false) / "I'm back inside" (true). */
  setIndoor(indoor: boolean): Promise<void>;
  hasBarometer(): Promise<boolean>;
  discard(walkId: number): Promise<void>;
}

const AR_TYPES: ArType[] = ['vehicle', 'bicycle', 'foot', 'walking', 'running', 'still', 'tilting', 'unknown'];

export const toArType = (type: string): ArType => (AR_TYPES.includes(type as ArType) ? (type as ArType) : 'unknown');

/** The pin from the native side's JSON, or null if it's missing or malformed. */
export function parsePlace(json: string | null | undefined): RecordingPlace | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as Partial<RecordingPlace>;
    if (typeof p.id !== 'string' || typeof p.name !== 'string') return null;
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number' || typeof p.radiusM !== 'number') return null;
    return { id: p.id, name: p.name, lat: p.lat, lon: p.lon, radiusM: p.radiusM };
  } catch {
    return null;
  }
}
