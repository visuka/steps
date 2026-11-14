/**
 * The design preview's sample day: the figures on the approved mockups
 * (Sat 14 Nov; 6,240 of 8,000 steps; food 1,280 of 1,900 kcal; water 5 of 8;
 * 6 h 50 m of sleep; a 2.3 km morning walk at 7:10 am; the "endu chepala
 * with egg curry" look-up). Plain data, no React Native, so jest checks it.
 *
 * Times are local: 14 Nov 2026 on whatever time zone the phone is in, so the
 * day key, "7:10 am" and "Sat, 14 Nov" read the same everywhere.
 */

import type { Snapshot } from '@/data/db.web';
import { DEFAULT_PROFILE } from '@/data/profile';
import type { DaySummary, DayWeather, FoodEntry, LogEntry, Profile, SleepEntry, Walk, WalkPart } from '@/data/types';
import { dayKey } from '@/lib/dates';
import type { StepBucket } from '@/lib/metrics';
import type { WalkPoint } from '@/lib/walk';
import type { FoodItem, Nutrients, NutrientKey } from '@/nutrition/types';

/** Local time on the sample day (14 Nov 2026, a Saturday); `dayOffset` -1 is the night before. */
export function sampleTime(hour: number, minute = 0, dayOffset = 0): number {
  return new Date(2026, 10, 14 + dayOffset, hour, minute).getTime();
}

/** "Now" in the preview: 3:45 pm, so the hour chart runs to 3 pm as on the mockup. */
export const SAMPLE_NOW = sampleTime(15, 45);
export const SAMPLE_DAY = dayKey(new Date(SAMPLE_NOW));

export const SAMPLE_GOAL = 8000;
export const SAMPLE_STEPS = 6240;
/** The day's food target the mockups show; the sample profile's maths gives it (resting 1,583 × 1.2). */
export const SAMPLE_KCAL_TARGET = 1900;
export const SAMPLE_WALK_ID = 'sample-walk';

/**
 * A male, 172 cm, 67.8 kg, born 1991 (35 in 2026): resting energy 1,583 kcal, so both the
 * full-day target (× 1.2) and today's target (resting plus a fifth, as the
 * walking burn is under it) come to 1,900. Water: 8 glasses of 250 ml.
 */
export const SAMPLE_PROFILE: Profile = {
  ...DEFAULT_PROFILE,
  heightCm: 172,
  weightKg: 67.8,
  weightSet: true,
  sex: 'male',
  birthYear: 1991,
  name: 'Ravi',
  units: 'metric',
  dailyGoal: SAMPLE_GOAL,
  moodCheckIn: { enabled: false, hour: 20 },
  water: { ...DEFAULT_PROFILE.water, targetMl: 2000, glassMl: 250, extras: false, remind: false },
  nutrition: { ...DEFAULT_PROFILE.nutrition, diet: 'nonveg' },
  country: 'IN',
  onboarded: true,
};

/**
 * Steps by hour; 6,240 in all, hours 6 to 15 as the mockup's chart (bar heights 7, 60,
 * 37, 21, 29, 22, 25, 18, 25, 13), the walk's hour the tallest. With a goal of 8,000
 * the goal line falls at y 43.4 (spec 10.1: y 43 is a largest hour of about 1,430; 1,455
 * keeps every height within half a dp of the mockup's and the day at 6,240).
 */
export const SAMPLE_HOURLY: number[] = [0, 0, 0, 0, 0, 0, 170, 1455, 905, 509, 703, 534, 606, 437, 606, 315, 0, 0, 0, 0, 0, 0, 0, 0];

/**
 * Brisk minutes in each hour of SAMPLE_HOURLY (100 steps a minute, the app's
 * active cadence), 52 in all: the day's active minutes. Hour 7 is the morning
 * walk. The rest of the hour's steps are spread at a slow pace.
 */
const SAMPLE_ACTIVE_MIN: Record<number, number> = { 6: 1, 7: 12, 8: 8, 9: 4, 10: 6, 11: 4, 12: 5, 13: 3, 14: 6, 15: 3 };
const SAMPLE_ACTIVE_START_MIN = 10;

/**
 * The sample day's steps as the step source gives them (the detail screen's
 * 15-minute bars and active minutes): SAMPLE_HOURLY split by minute, each hour
 * adding up to its figure. Only the sample day has any; other windows get none.
 */
export function sampleStepBuckets(start: Date, end: Date, bucketMinutes: number): StepBucket[] {
  const step = Math.max(1, Math.round(bucketMinutes)) * 60_000;
  const out = new Map<number, StepBucket>();
  const origin = sampleTime(0);
  SAMPLE_HOURLY.forEach((steps, hour) => {
    if (steps <= 0) return;
    const active = SAMPLE_ACTIVE_MIN[hour] ?? 0;
    const slow = steps - active * 100;
    const quiet = 60 - active;
    let slowSeen = 0; // the slow minutes so far: the first slow % quiet of them get one step more
    for (let m = 0; m < 60; m++) {
      const isActive = m >= SAMPLE_ACTIVE_START_MIN && m < SAMPLE_ACTIVE_START_MIN + active;
      const n = isActive ? 100 : Math.floor(slow / quiet) + (slowSeen++ < slow % quiet ? 1 : 0);
      const at = sampleTime(hour, m);
      if (n <= 0 || at < start.getTime() || at >= end.getTime()) continue;
      const bucketStart = origin + Math.floor((at - origin) / step) * step;
      const b = out.get(bucketStart) ?? { start: bucketStart, end: bucketStart + step, steps: 0 };
      b.steps += n;
      out.set(bucketStart, b);
    }
  });
  return [...out.values()].sort((a, b) => a.start - b.start);
}

export const SAMPLE_TODAY: DaySummary = {
  date: SAMPLE_DAY,
  steps: SAMPLE_STEPS,
  untimedSteps: 0,
  distanceM: 4600,
  activeKcal: 240,
  activeMin: 52,
  walkMin: 64,
  briskMin: 49,
  runMin: 3,
  floors: 4,
  goal: SAMPLE_GOAL,
  source: 'demo',
  updatedAt: SAMPLE_NOW - 2 * 60_000,
};

/**
 * Monday to Friday of the sample week, for the week strip: 90, 100, 60, 85 and 100 % of the
 * 8,000 goal, as the mockup draws them (Sunday has not happened yet).
 */
export const SAMPLE_WEEK: DaySummary[] = [7200, 8000, 4800, 6800, 8000].map((steps, i) => {
  const at = sampleTime(21, 0, i - 5);
  return {
    date: dayKey(new Date(at)),
    steps,
    untimedSteps: 0,
    distanceM: Math.round(steps * 0.74),
    activeKcal: Math.round(steps * 0.04),
    activeMin: Math.round(steps / 120),
    walkMin: 0,
    briskMin: 0,
    runMin: 0,
    floors: 0,
    goal: SAMPLE_GOAL,
    source: 'demo',
    updatedAt: at,
  };
});

/** 1,280 kcal in four calorie-only entries, so the total never hangs on a food look-up. */
export const SAMPLE_FOODS: FoodEntry[] = [
  food('idli', sampleTime(8, 15), 'Idli with sambar', 340),
  food('coffee', sampleTime(8, 20), 'Filter coffee', 110),
  food('chai', sampleTime(11, 0), 'Masala chai with biscuits', 210),
  food('lunch', sampleTime(13, 5), 'Rice with dal and curd', 620),
];

function food(id: string, loggedAt: number, name: string, kcal: number): FoodEntry {
  return { id: `sample-${id}`, loggedAt, name, foodId: null, unit: null, quantity: null, kcal, healthSampleId: null, place: 'home', restaurant: null };
}

/** Five glasses of 250 ml. */
export const SAMPLE_WATER: LogEntry[] = [
  [7, 50],
  [9, 30],
  [10, 45],
  [12, 0],
  [13, 10],
].map(([h, m], i) => ({ id: `sample-water-${i + 1}`, loggedAt: sampleTime(h, m), value: 250, healthSampleId: null }));

/** Last night: 11:20 pm to 6:10 am, 6 h 50 m asleep. */
export const SAMPLE_SLEEP: SleepEntry = {
  id: 'sample-sleep',
  date: SAMPLE_DAY,
  startAt: sampleTime(23, 20, -1),
  endAt: sampleTime(6, 10),
  asleepMin: 410,
  rested: null,
  source: 'manual',
  healthId: null,
  stages: null,
  updatedAt: sampleTime(6, 30),
};

export const SAMPLE_WEATHER: DayWeather = {
  date: SAMPLE_DAY,
  tempMaxC: 29,
  tempMinC: 19,
  precipMm: 0,
  condition: 'clear',
  place: 'Gachibowli',
  hours: { 7: { tempC: 24, precipMm: 0, symbol: 'clearsky_day' } },
  updatedAt: sampleTime(7, 0),
};

// --- The morning walk -------------------------------------------------------
// 7:10 to 7:44 am: on foot to 7:30, 6 minutes in a car (removed), on foot
// again 7:36 to 7:44. 2.3 km and 32 min counted, 3,120 steps, 13:55 /km, 2
// floors up, 24 °C and clear. The route is the mockup's: up, east, down and back
// south-west; the car's stretch lies along it (a loop beside it would shrink
// the route in the map's frame). The pace goes up and down (PACE_WEIGHTS), as the
// mockup's sparkline does.

const ORIGIN = { lat: 17.44, lon: 78.3489 };
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);

type Metres = [east: number, north: number];

// The mockup's route (spec 6.2) at 6 m a mockup dp: a short rise to the north-east, north, a long run east
// (the car stretch is part of it), a short drop south, then south-west to the end.
const LEG_1: Metres[] = [
  [0, 0],
  [141, 114],
  [141, 534],
  [600, 534],
];
const CAR: Metres[] = [
  [600, 534],
  [900, 534],
];
const LEG_2: Metres[] = [
  [900, 534],
  [1371, 534],
  [1416, 294],
  [1284, 120],
];

/**
 * Relative walking speed in each ninth of the walk (the pace sparkline's nine
 * windows): fast, slow, fast, the slowest where the car is. Gives the mockup's wavy line.
 */
const PACE_WEIGHTS = [0.95, 1.45, 1.1, 1.65, 1.25, 1.25, 1.5, 1.35, 1.15];

function paceWeightAt(t: number): number {
  const k = Math.round(((t - WALK_START) / (WALK_END - WALK_START)) * (PACE_WEIGHTS.length - 1));
  return PACE_WEIGHTS[Math.min(PACE_WEIGHTS.length - 1, Math.max(0, k))];
}

/** Fixes every 10 s from `from` to `to` (ms), along the polyline: evenly, or at the PACE_WEIGHTS speed when `paced`. */
function along(path: Metres[], from: number, to: number, part: number | null, paced = false): WalkPoint[] {
  const lengths = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  const speed = total / ((to - from) / 1000);
  const out: WalkPoint[] = [];
  const times: number[] = [];
  for (let t = from; t <= to; t += 10_000) times.push(t);
  // Distance covered by each fix as a share of the stretch: the sum of the speeds so far.
  const cum = [0];
  for (let i = 1; i < times.length; i++) cum.push(cum[i - 1] + (paced ? paceWeightAt((times[i - 1] + times[i]) / 2) : 1));
  for (const [idx, t] of times.entries()) {
    let d = paced ? (total * cum[idx]) / cum[cum.length - 1] : (total * (t - from)) / (to - from);
    let i = 0;
    while (i < lengths.length - 1 && d > lengths[i]) d -= lengths[i++];
    const f = lengths[i] ? Math.min(1, d / lengths[i]) : 0;
    const e = path[i][0] + (path[i + 1][0] - path[i][0]) * f;
    const n = path[i][1] + (path[i + 1][1] - path[i][1]) * f;
    out.push({
      t,
      lat: ORIGIN.lat + n / M_PER_DEG_LAT,
      lon: ORIGIN.lon + e / M_PER_DEG_LON,
      acc: 5,
      speed,
      speedAcc: 0.5,
      alt: 540,
      part,
    });
  }
  return out;
}

const WALK_START = sampleTime(7, 10);
const CAR_START = sampleTime(7, 30);
const CAR_END = sampleTime(7, 36);
const WALK_END = sampleTime(7, 44);

export const SAMPLE_WALK_POINTS: WalkPoint[] = [
  ...along(LEG_1, WALK_START, CAR_START - 10_000, null, true),
  ...along(CAR, CAR_START, CAR_END, 0),
  ...along(LEG_2, CAR_END + 10_000, WALK_END, null, true),
];

export const SAMPLE_WALK_PARTS: WalkPart[] = [
  {
    walkId: SAMPLE_WALK_ID,
    ord: 0,
    startT: CAR_START,
    endT: CAR_END,
    kind: 'vehicle',
    steps: 0,
    distanceM: 1100,
    movingS: 360,
    topSpeedMs: 8.3,
    kcalWalk: 0,
    kcalRide: 0,
    choice: 'remove',
    defaultKeep: false,
  },
];

export const SAMPLE_WALK: Walk = {
  id: SAMPLE_WALK_ID,
  startedAt: WALK_START,
  endedAt: WALK_END,
  distanceM: 2300,
  movingS: 1920,
  steps: 3120,
  activeKcal: 118,
  startPlace: 'Home',
  weather: { tempC: 24, condition: 'clear', forecast: true },
  updatedAt: WALK_END,
  activity: 'walk',
  indoor: false,
  placeId: null,
  distanceFrom: 'route',
  stepsFrom: 'walk',
  floorsUp: 2,
  floorsDown: 0,
  liftUp: 0,
  liftDown: 0,
  climbM: 6,
  topSpeedMs: 1.8,
  effort: null,
  stretches: { mainTopSpeedMs: 1.8 },
};

// --- The food look-up -------------------------------------------------------

/** One bowl, as the ingredients add up: 260 g. */
const BOWL_G = 260;

/** Per bowl, as the mockups show it; the ≥ figures are partly known (an ingredient is still being added). */
const PER_BOWL: Nutrients = {
  kcal: 412,
  protein: 38,
  carbs: 14,
  fat: 22,
  sodium: 1850,
  calcium: 210,
  iron: 3.1,
  vitB12: 2.4,
  vitA: 180,
};

const PARTLY_KNOWN: NutrientKey[] = ['sodium', 'calcium', 'iron', 'vitB12', 'vitA'];

function per100g(perBowl: Nutrients): Nutrients {
  const out: Nutrients = {};
  for (const [key, value] of Object.entries(perBowl) as [NutrientKey, number][]) out[key] = (value * 100) / BOWL_G;
  return out;
}

export const SAMPLE_FOOD: FoodItem = {
  id: 'ai:endu chepala with egg curry',
  name: 'endu chepala with egg curry',
  aliases: ['ఎండు చేపల గుడ్డు కూర'],
  category: 'dish',
  per100g: per100g(PER_BOWL),
  units: [
    { key: 'bowl', label: 'bowl', grams: BOWL_G },
    { key: 'g', label: 'grams', grams: 1 },
  ],
  defaultUnit: 'bowl',
  source: 'ai',
  ingredients: [
    { name: 'Dried anchovy (methallu, fried)', grams: 40 },
    { name: 'Egg, boiled', grams: 100 },
    { name: 'Onion', grams: 60 },
    { name: 'Tomato', grams: 50 },
    { name: 'Oil', grams: 10 },
  ],
  style: 'home',
  missing: PARTLY_KNOWN,
  pending: true,
};

/** What the food result screen shows: what was typed, its own script, and the portion. */
export const SAMPLE_FOOD_RESULT = {
  query: 'endu chepala with egg curry',
  script: 'ఎండు చేపల గుడ్డు కూర',
  food: SAMPLE_FOOD,
  unit: 'bowl',
  quantity: 1,
  /** The meal the save button names: "Save to lunch". */
  meal: 'lunch',
} as const;

/** The whole sample day as a memory repository's starting snapshot (data/db.web.ts memoryRepository). */
export function sampleSnapshot(): Snapshot {
  return {
    kv: [['profile', JSON.stringify(SAMPLE_PROFILE)]],
    days: [...SAMPLE_WEEK, SAMPLE_TODAY].map((d): [string, DaySummary] => [d.date, d]),
    hours: [[SAMPLE_DAY, SAMPLE_HOURLY]],
    logs: { weight: [], water: [...SAMPLE_WATER].reverse() },
    achievements: [],
    moods: [],
    weather: [[SAMPLE_DAY, SAMPLE_WEATHER]],
    foods: [...SAMPLE_FOODS].reverse(),
    walks: [[SAMPLE_WALK_ID, { walk: SAMPLE_WALK, points: SAMPLE_WALK_POINTS, parts: SAMPLE_WALK_PARTS }]],
    places: [],
    ownFoods: [],
    savedFoods: [SAMPLE_FOOD],
    sleep: [SAMPLE_SLEEP],
    heart: [],
    bp: [],
  };
}
