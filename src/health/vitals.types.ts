import type { BloodPressureEntry, HeartDay, SleepEntry } from '@/data/types';

/**
 * Sleep, heart rate and blood pressure from Apple Health / Health Connect.
 * Kept apart from the step source: plenty of people count steps with the
 * phone and wear a watch (or use a BP monitor app) for the rest.
 */
export interface VitalsSource {
  label: string;
  isAvailable(): Promise<boolean>;
  /** Shows the platform's permission screen. False when nothing was allowed (where the platform says). */
  requestAccess(): Promise<boolean>;
  readSleep(start: Date, end: Date): Promise<SleepEntry[]>;
  readHeartDays(start: Date, end: Date): Promise<HeartDay[]>;
  /** Readings from other apps and devices; copies this app wrote are left to the caller to skip. */
  readBloodPressure(start: Date, end: Date): Promise<BloodPressureEntry[]>;
  /** Saves a reading typed in the app; returns its id there. */
  writeBloodPressure(systolic: number, diastolic: number, at: Date): Promise<string | null>;
  deleteBloodPressure(entry: BloodPressureEntry): Promise<void>;
}
