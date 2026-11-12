import type { SourceId } from '@/data/types';
import type { Nutrients } from '@/nutrition/types';
import type { StepBucket } from '@/lib/metrics';

export type SampleKind = 'weight' | 'water' | 'food';

export interface DayTotals {
  date: string;
  steps: number;
  distanceM: number | null;
  floors: number | null;
}

/**
 * One place steps come from. Implementations return totals that are already
 * de-duplicated (phone + watch), so the sync engine can simply add buckets up.
 */
export interface StepSource {
  id: SourceId;
  /** Shown in Settings, e.g. "Apple Health". */
  label: string;
  isAvailable(): Promise<boolean>;
  /** Asks for whatever the source needs; resolves true when step reads are allowed. */
  requestPermissions(): Promise<boolean>;
  /** Steps per `bucketMinutes`-long bucket between start and end. Empty buckets may be omitted. */
  getStepBuckets(start: Date, end: Date, bucketMinutes: number): Promise<StepBucket[]>;
  /**
   * Steps that belong to the day from start to end but whose time isn't known,
   * not included in getStepBuckets. Kept out of hourly bars and pace-based figures.
   */
  getUntimedSteps?(start: Date, end: Date): Promise<number>;
  /**
   * End of the latest record the source has in the window, when it has records
   * longer than a minute (another app's "today so far" record, say): live
   * steps before it are already counted.
   */
  lastRecordedAt?(start: Date, end: Date): Promise<number | null>;
  /** Platform-measured distance; null when the platform has none (the app then uses stride). */
  getDistanceM(start: Date, end: Date): Promise<number | null>;
  getFloors(start: Date, end: Date): Promise<number | null>;
  /** One entry per local day, for history backfill. */
  getDailyTotals(startDay: string, endDay: string): Promise<DayTotals[]>;
  /** Copies a log entry into the health platform; resolves to the platform's sample id. */
  writeWeight?(kg: number, at: Date): Promise<string | null>;
  writeWater?(ml: number, at: Date): Promise<string | null>;
  writeFood?(name: string, nutrients: Nutrients, at: Date): Promise<string | null>;
  deleteSample?(kind: SampleKind, sampleId: string): Promise<void>;
}
