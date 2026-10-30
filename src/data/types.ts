import type { Achievement } from '@/lib/achievements';
import type { Units } from '@/lib/format';
import type { ReminderSettings } from '@/lib/reminders';

export type SourceId = 'healthkit' | 'health-connect' | 'device-sensor' | 'demo';

export type Sex = 'female' | 'male' | 'unspecified';

export interface Profile {
  heightCm: number;
  weightKg: number;
  sex: Sex;
  birthYear: number | null;
  units: Units;
  /** Null = estimate from height. */
  strideM: number | null;
  dailyGoal: number;
  reminders: ReminderSettings;
  onboarded: boolean;
}

export interface DaySummary {
  date: string;
  steps: number;
  distanceM: number;
  activeKcal: number;
  /** Null for older history where only a daily total exists. */
  activeMin: number | null;
  /** Null when the device reports no floor data. */
  floors: number | null;
  goal: number;
  source: SourceId;
  updatedAt: number;
}

export type LogKind = 'weight' | 'water';

export interface LogEntry {
  id: string;
  loggedAt: number;
  /** kg for weight, ml for water. */
  value: number;
  /** Id of the copy written to Apple Health / Health Connect, if any. */
  healthSampleId: string | null;
}

export interface Repository {
  getKv<T>(key: string): Promise<T | null>;
  setKv<T>(key: string, value: T): Promise<void>;

  upsertDay(day: DaySummary, hourly?: number[]): Promise<void>;
  getDay(date: string): Promise<DaySummary | null>;
  /** Inclusive range, oldest first. */
  getDays(from: string, to: string): Promise<DaySummary[]>;
  getHourly(date: string): Promise<number[]>;
  lifetimeSteps(): Promise<number>;

  addLog(kind: LogKind, entry: LogEntry): Promise<void>;
  deleteLog(kind: LogKind, id: string): Promise<void>;
  /** Newest first. */
  getLogs(kind: LogKind, limit: number): Promise<LogEntry[]>;

  getAchievements(): Promise<Achievement[]>;
  addAchievements(list: Achievement[]): Promise<void>;

  clearAll(): Promise<void>;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
