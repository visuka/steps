import type { Achievement } from '@/lib/achievements';
import type { Units } from '@/lib/format';
import type { ReminderSettings } from '@/lib/reminders';
import type { WalkPoint } from '@/lib/walk';

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
  /** Daily "how was today?" notification. */
  moodCheckIn: { enabled: boolean; hour: number };
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

export type Mood = 1 | 2 | 3 | 4 | 5;

export interface MoodEntry {
  /** Day key. One mood per day; logging again replaces it. */
  date: string;
  mood: Mood;
  note: string | null;
  loggedAt: number;
}

export type WeatherCondition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow';

export interface HourWeather {
  tempC: number;
  /** Rain or snow in the hour, mm; null where the forecast has no hourly figure. */
  precipMm: number | null;
  /** MET Norway symbol code, e.g. "partlycloudy_day". */
  symbol: string | null;
}

/** The weather where the phone was on a day, from the forecast fetched while the app was open. */
export interface DayWeather {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipMm: number;
  condition: WeatherCondition;
  /** Area name, e.g. "Koramangala". */
  place: string | null;
  /** Local hour (0–23) → that hour's forecast. */
  hours: Record<number, HourWeather>;
  updatedAt: number;
}

/** Something eaten, at the time it was eaten. No meal labels: people snack through the day. */
export interface FoodEntry {
  id: string;
  /** When it was eaten (epoch ms). */
  loggedAt: number;
  name: string;
  kcal: number;
  healthSampleId: string | null;
}

export interface RecentFood {
  name: string;
  kcal: number;
}

export interface Walk {
  id: string;
  startedAt: number;
  endedAt: number;
  distanceM: number;
  movingS: number;
  /** From the step source over the walk's time; null when it couldn't be read. */
  steps: number | null;
  activeKcal: number;
  startPlace: string | null;
  weather: { tempC: number; condition: WeatherCondition } | null;
  updatedAt: number;
}

export interface Repository {
  getKv<T>(key: string): Promise<T | null>;
  setKv<T>(key: string, value: T): Promise<void>;

  upsertDay(day: DaySummary, hourly?: number[]): Promise<void>;
  getDay(date: string): Promise<DaySummary | null>;
  /** Inclusive range, oldest first. */
  getDays(from: string, to: string): Promise<DaySummary[]>;
  getHourly(date: string): Promise<number[]>;
  /** Day key → 24 hourly counts, for days that have hourly detail. */
  getHourlyRange(from: string, to: string): Promise<Map<string, number[]>>;
  lifetimeSteps(): Promise<number>;

  setMood(entry: MoodEntry): Promise<void>;
  /** Inclusive range, oldest first. */
  getMoods(from: string, to: string): Promise<MoodEntry[]>;

  upsertWeather(weather: DayWeather): Promise<void>;
  getWeather(date: string): Promise<DayWeather | null>;
  getWeatherRange(from: string, to: string): Promise<DayWeather[]>;

  addFood(entry: FoodEntry): Promise<void>;
  deleteFood(id: string): Promise<void>;
  /** Logged between the two epoch-ms times, newest first. */
  getFoods(fromMs: number, toMs: number): Promise<FoodEntry[]>;
  /** Distinct foods, most often logged first, with their latest calories. */
  recentFoods(limit: number): Promise<RecentFood[]>;

  /** Inserts or replaces the walk; replaces its route when points are given. */
  saveWalk(walk: Walk, points?: WalkPoint[]): Promise<void>;
  /** Newest first. */
  getWalks(limit: number): Promise<Walk[]>;
  getWalk(id: string): Promise<{ walk: Walk; points: WalkPoint[] } | null>;
  deleteWalk(id: string): Promise<void>;

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
