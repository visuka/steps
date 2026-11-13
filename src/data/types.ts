import type { Achievement } from '@/lib/achievements';
import type { Units } from '@/lib/format';
import type { ReminderSettings } from '@/lib/reminders';
import type { PartKind } from '@/lib/parts';
import type { Place } from '@/lib/places';
import type { RideEffort, WalkActivity, WalkPoint } from '@/lib/walk';
import type { FoodItem, OwnFood } from '@/nutrition/types';

export type SourceId = 'healthkit' | 'health-connect' | 'device-sensor' | 'demo';

export type Sex = 'female' | 'male' | 'unspecified';

/** veg ⊂ egg ⊂ nonveg: what food sources may be suggested. */
export type Diet = 'veg' | 'egg' | 'nonveg';

export type GlassMl = 200 | 250 | 300;

export interface WaterSettings {
  /** Null until the person saves one; screens then work against the suggestion. */
  targetMl: number | null;
  /** Add more on hot or active days. */
  extras: boolean;
  glassMl: GlassMl;
  /** "Remind me if I'm behind". */
  remind: boolean;
  /** Reminder window, local hours: from fromHour + 1 until untilHour. */
  fromHour: number;
  untilHour: number;
  /** "My doctor limits how much I drink": the target is a ceiling; no suggestion, extras or reminders. */
  doctorLimit: boolean;
}

export interface NutritionSettings {
  /** Null = not asked yet; counts as veg for food sources. */
  diet: Diet | null;
  /** Nutrient tips as notifications. Off until the person turns it on. */
  tips: boolean;
  /** Weekly summary notification. Off until the person turns it on. */
  weekly: boolean;
  hideCalories: boolean;
  /**
   * "My needs are different": pregnancy, breastfeeding, a doctor-guided diet.
   * Numbers only: no Low / Too much, gap notes, sources or water suggestion.
   * Anyone under 18 by birth year is treated the same (nutrition/targets.ts).
   */
  differentNeeds: boolean;
}

export interface Profile {
  heightCm: number;
  weightKg: number;
  /** True once the person typed a weight (onboarding field changed, Settings); the default 65 kg is not theirs. */
  weightSet: boolean;
  sex: Sex;
  birthYear: number | null;
  units: Units;
  /** Null = estimate from height. */
  strideM: number | null;
  dailyGoal: number;
  reminders: ReminderSettings;
  /** Daily "how was today?" notification. */
  moodCheckIn: { enabled: boolean; hour: number };
  water: WaterSettings;
  nutrition: NutritionSettings;
  onboarded: boolean;
}

export interface DaySummary {
  date: string;
  /** All steps, untimedSteps included. */
  steps: number;
  /**
   * Steps known to belong to this day but not when (the phone's counter was
   * stopped, or another app synced one record covering hours). They're in the
   * total but not in the hourly bars, the minutes below or pace-based calories.
   */
  untimedSteps: number;
  distanceM: number;
  activeKcal: number;
  /** Minutes at 100+ steps a minute (brisk walking and running). Null for older history where only a daily total exists. */
  activeMin: number | null;
  /** Minutes walking (60–99 steps a minute), brisk walking (100–139) and running (140+); null where only a total exists. */
  walkMin: number | null;
  briskMin: number | null;
  runMin: number | null;
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

/**
 * Where a food came from. Restaurant cooking usually has more oil, ghee,
 * butter, cream and salt, and bigger portions, so a restaurant dish is a
 * different food from the home one. 'delivery' is ordered in or takeaway.
 */
export type FoodPlace = 'home' | 'dine-in' | 'delivery';

/** Something eaten, at the time it was eaten. No meal labels: people snack through the day. */
export interface FoodEntry {
  id: string;
  /** When it was eaten (epoch ms). */
  loggedAt: number;
  name: string;
  /**
   * Catalog or own food, with the portion. Nutrients are worked out from these
   * when shown, so a corrected portion size updates past entries too. Null for
   * calorie-only entries.
   */
  foodId: string | null;
  unit: string | null;
  quantity: number | null;
  /** Calories when logged; the figure for calorie-only entries. */
  kcal: number;
  healthSampleId: string | null;
  /** 'home' for entries logged before this was asked. */
  place: FoodPlace;
  /** The restaurant, when the person named one; always null for home-made food. */
  restaurant: string | null;
}

export interface RecentFood {
  name: string;
  kcal: number;
  foodId: string | null;
  unit: string | null;
  quantity: number | null;
  /** Where it was from last time, so logging it again keeps that. */
  place: FoodPlace;
  restaurant: string | null;
}

export type { PartKind, Place, RideEffort, WalkActivity };

/** Where a walk's distance came from: the GPS route, steps x stride (indoors, or where GPS was poor), both, or nothing (an indoor ride). */
export type DistanceSource = 'route' | 'steps' | 'mixed' | 'none';
/** Where its steps came from: the walk's own counter, the day's minute buckets, or none (rides). */
export type StepsSource = 'walk' | 'day' | 'none';

/**
 * The weather for a walk's own hours. Always from the forecast fetched while
 * the app was open (no observations), so screens label it "Forecast".
 */
export interface WalkWeather {
  tempC: number;
  condition: WeatherCondition;
  /** True for the forecast; walks saved before this was added have no flag and were a forecast too. */
  forecast?: boolean;
}

/** Time ranges (epoch ms) on a walk, for the map and the distance note. */
export interface WalkStretches {
  /** Recorded indoors: steps only, no route. */
  indoor?: [number, number][];
  /** "GPS was weak here". */
  weak?: [number, number][];
  /** "Estimated from steps". */
  fromSteps?: [number, number][];
  /** Top speed of the main route without its parts (m/s), so a keep/remove can recompute topSpeedMs. Only on walks with parts. */
  mainTopSpeedMs?: number | null;
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
  weather: WalkWeather | null;
  updatedAt: number;
  // The fields below are optional: walks saved before them read with the defaults in brackets.
  /** ['walk'] */
  activity?: WalkActivity;
  /** Started as an indoor walk or an indoor bike ride. [false] */
  indoor?: boolean;
  /** The pin it started at; null once that pin is deleted. */
  placeId?: string | null;
  /** [null: an older walk; route if it has one, else steps] */
  distanceFrom?: DistanceSource | null;
  /** [null: an older walk, from the day's buckets] */
  stepsFrom?: StepsSource | null;
  /** Floors by stairs and lift; null without a barometer. */
  floorsUp?: number | null;
  floorsDown?: number | null;
  liftUp?: number | null;
  liftDown?: number | null;
  /** Rides: height gained; walks: uphill outdoors. Null without a barometer. */
  climbM?: number | null;
  /** Best 10 s, m/s. */
  topSpeedMs?: number | null;
  /** Indoor rides. */
  effort?: RideEffort | null;
  stretches?: WalkStretches | null;
}

/** keep = on foot (adds distance, time, steps, walking kcal); cycle = cycling (distance, time, ride kcal); remove = left out. */
export type PartChoice = 'keep' | 'cycle' | 'remove';

/** A stretch of a recording that looked like a vehicle or a bicycle. */
export interface WalkPart {
  walkId: string;
  /** 0, 1, 2… in time order. */
  ord: number;
  startT: number;
  endT: number;
  kind: PartKind;
  /** Steps counted during it; null without step data. */
  steps: number | null;
  distanceM: number;
  movingS: number;
  topSpeedMs: number | null;
  /** What it adds as walking (from its steps) or as cycling (from its speed). */
  kcalWalk: number;
  kcalRide: number;
  /** Null until the person answers; then it can be undone back to null. */
  choice: PartChoice | null;
  /** Whether it counts while unanswered. */
  defaultKeep: boolean;
}

/** 'manual' = typed in this app; 'health' = read from Apple Health / Health Connect. */
export type VitalSource = 'manual' | 'health';

/** Minutes in each stage, when a watch reports stages. */
export interface SleepStages {
  awake: number;
  light: number;
  deep: number;
  rem: number;
}

export interface SleepEntry {
  id: string;
  /** Day key of the morning it ended on: a night's sleep counts toward the day after it. */
  date: string;
  startAt: number;
  endAt: number;
  /** Time asleep; less than end − start when a watch saw time awake. */
  asleepMin: number;
  /** How rested the person felt, for nights they logged themselves. */
  rested: Mood | null;
  source: VitalSource;
  /** The record's id in Apple Health / Health Connect, for nights read from there. */
  healthId: string | null;
  stages: SleepStages | null;
  updatedAt: number;
}

/** Heart rate for a day, from a watch or band via Apple Health / Health Connect. */
export interface HeartDay {
  date: string;
  restingBpm: number | null;
  avgBpm: number | null;
  minBpm: number | null;
  maxBpm: number | null;
  updatedAt: number;
}

export interface BloodPressureEntry {
  id: string;
  loggedAt: number;
  /** mmHg. */
  systolic: number;
  diastolic: number;
  /** Beats per minute, if the monitor showed it. */
  pulse: number | null;
  source: VitalSource;
  /** Apple Health / Health Connect id: the copy written there, or the original for readings read from there. */
  healthId: string | null;
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
  deleteMood(date: string): Promise<void>;
  /** Inclusive range, oldest first. */
  getMoods(from: string, to: string): Promise<MoodEntry[]>;

  upsertWeather(weather: DayWeather): Promise<void>;
  getWeather(date: string): Promise<DayWeather | null>;
  getWeatherRange(from: string, to: string): Promise<DayWeather[]>;

  addFood(entry: FoodEntry): Promise<void>;
  /** Saves a corrected entry (portion, place, time, Health Connect copy) over the one with its id. */
  updateFood(entry: FoodEntry): Promise<void>;
  deleteFood(id: string): Promise<void>;
  /** Logged between the two epoch-ms times, newest first. */
  getFoods(fromMs: number, toMs: number): Promise<FoodEntry[]>;
  /** Distinct foods, most often logged first, with their latest portion and place. */
  recentFoods(limit: number): Promise<RecentFood[]>;
  /** Restaurants named in past entries, latest first, each once. */
  recentRestaurants(limit: number): Promise<string[]>;

  getOwnFoods(): Promise<OwnFood[]>;
  saveOwnFood(food: OwnFood): Promise<void>;
  deleteOwnFood(id: string): Promise<void>;

  /** Foods from the food API ('ai:' estimates, 'recipe:' recipes) the person used, so they work offline. */
  getSavedFoods(): Promise<FoodItem[]>;
  /** Inserts or replaces by id. */
  saveSavedFood(food: FoodItem): Promise<void>;
  deleteSavedFood(id: string): Promise<void>;

  /**
   * Inserts or replaces the walk with every column; replaces its route when
   * points are given and its parts when parts are given (left out, they stay).
   */
  saveWalk(walk: Walk, points?: WalkPoint[], parts?: WalkPart[]): Promise<void>;
  /** Newest first. */
  getWalks(limit: number): Promise<Walk[]>;
  /** The walk and every fix, each with its `part` (null on the main route). */
  getWalk(id: string): Promise<{ walk: Walk; points: WalkPoint[] } | null>;
  /** In time order. */
  getWalkParts(walkId: string): Promise<WalkPart[]>;
  /**
   * Sets a part's choice (null = undo) and recounts the walk, reading the
   * current row and parts inside one transaction. Resolves the updated walk.
   */
  setPartChoice(walkId: string, ord: number, choice: PartChoice | null): Promise<Walk | null>;
  /**
   * Read-modify-write of a walk and its parts in one transaction; `change`
   * gets the current row and returns the new one (and parts), or null to
   * leave it. Resolves the walk as saved.
   */
  updateWalk(
    id: string,
    change: (walk: Walk, parts: WalkPart[]) => { walk: Walk; parts?: WalkPart[] } | null,
  ): Promise<Walk | null>;
  /** Removes the walk, its route and its parts. */
  deleteWalk(id: string): Promise<void>;

  /** Pinned places, by name. */
  getPlaces(): Promise<Place[]>;
  /** Inserts or replaces by id. */
  savePlace(place: Place): Promise<void>;
  /** Past walks keep their start_place text; their place_id becomes null. */
  deletePlace(id: string): Promise<void>;

  /** Inserts or replaces by id. */
  saveSleep(entry: SleepEntry): Promise<void>;
  deleteSleep(id: string): Promise<void>;
  /** Nights whose morning falls in the inclusive range, oldest first. */
  getSleep(from: string, to: string): Promise<SleepEntry[]>;
  /** Swaps the nights read from health in the range for a fresh read; manual nights stay. */
  replaceHealthSleep(from: string, to: string, entries: SleepEntry[]): Promise<void>;

  upsertHeartDays(days: HeartDay[]): Promise<void>;
  /** Inclusive range, oldest first. */
  getHeartDays(from: string, to: string): Promise<HeartDay[]>;

  saveBloodPressure(entry: BloodPressureEntry): Promise<void>;
  deleteBloodPressure(id: string): Promise<void>;
  /** Taken between the two epoch-ms times, newest first. */
  getBloodPressure(fromMs: number, toMs: number): Promise<BloodPressureEntry[]>;
  /** Swaps the readings read from health in the range for a fresh read; manual readings stay. */
  replaceHealthBloodPressure(fromMs: number, toMs: number, entries: BloodPressureEntry[]): Promise<void>;

  addLog(kind: LogKind, entry: LogEntry): Promise<void>;
  /** Saves a corrected entry over the one with its id. */
  updateLog(kind: LogKind, entry: LogEntry): Promise<void>;
  deleteLog(kind: LogKind, id: string): Promise<void>;
  /** Newest first. */
  getLogs(kind: LogKind, limit: number): Promise<LogEntry[]>;

  getAchievements(): Promise<Achievement[]>;
  addAchievements(list: Achievement[]): Promise<void>;

  /** Everything, walks, parts and pinned places included. */
  clearAll(): Promise<void>;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
