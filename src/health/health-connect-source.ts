import Constants from 'expo-constants';
import {
  aggregateGroupByDuration,
  aggregateRecord,
  deleteRecordsByUuids,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  insertRecords,
  MealType,
  type Permission,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

import { addDays, dayKey, parseDayKey } from '@/lib/dates';
import type { StepBucket } from '@/lib/metrics';
import type { Nutrients } from '@/nutrition/types';

import { healthConnectWindow, isPhoneOrigin, type StepRecord } from './coarse-records';
import type { DayTotals, SampleKind, StepSource } from './types';

const OWN_PACKAGE = Constants.expoConfig?.android?.package ?? 'com.neutcrafts.steps';

let initPromise: Promise<boolean> | null = null;
const ready = () => (initPromise ??= initialize());

const between = (start: Date, end: Date) => ({
  operator: 'between' as const,
  startTime: start.toISOString(),
  endTime: end.toISOString(),
});

const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'write', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'FloorsClimbed' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'write', recordType: 'Weight' },
  { accessType: 'write', recordType: 'Hydration' },
  { accessType: 'write', recordType: 'Nutrition' },
];

const RECORD_TYPES = { weight: 'Weight', water: 'Hydration', food: 'Nutrition' } as const satisfies Record<
  SampleKind,
  string
>;

/** Health Connect's nutrition fields for the nutrients the app tracks. */
function nutritionFields(n: Nutrients) {
  const mass = (value: number | undefined, unit: 'grams' | 'milligrams' | 'micrograms') =>
    value === undefined ? undefined : { unit, value };
  return {
    energy: { unit: 'kilocalories' as const, value: n.kcal ?? 0 },
    protein: mass(n.protein, 'grams'),
    totalCarbohydrate: mass(n.carbs, 'grams'),
    totalFat: mass(n.fat, 'grams'),
    dietaryFiber: mass(n.fiber, 'grams'),
    vitaminA: mass(n.vitA, 'micrograms'),
    vitaminC: mass(n.vitC, 'milligrams'),
    vitaminD: mass(n.vitD, 'micrograms'),
    vitaminB12: mass(n.vitB12, 'micrograms'),
    folate: mass(n.folate, 'micrograms'),
    calcium: mass(n.calcium, 'milligrams'),
    iron: mass(n.iron, 'milligrams'),
    potassium: mass(n.potassium, 'milligrams'),
    magnesium: mass(n.magnesium, 'milligrams'),
    zinc: mass(n.zinc, 'milligrams'),
  };
}

/** Asks for one permission if it wasn't granted at onboarding (older installs predate food logging). */
async function ensurePermission(permission: Permission) {
  const granted = await getGrantedPermissions();
  const has = granted.some(
    (p) => 'recordType' in p && p.recordType === permission.recordType && p.accessType === permission.accessType,
  );
  if (!has) await requestPermission([permission]);
}

export async function healthConnectAvailable(): Promise<boolean> {
  try {
    return (await getSdkStatus()) === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

/**
 * True when another app (Samsung Health, Fitbit, Google Fit, a watch's app…)
 * recorded steps in the last week. Not this app's own copies, and not Health
 * Connect counting the phone itself: the phone's steps come from Google's
 * step recorder, which has the same steps and is read the same way everywhere.
 */
export async function hasStepsFromOtherApps(now = new Date()): Promise<boolean> {
  await ready();
  const { dataOrigins } = await aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter: between(addDays(now, -7), now),
  });
  return (dataOrigins ?? []).some((o) => o !== OWN_PACKAGE && !isPhoneOrigin(o));
}

/** Apps whose steps are read: everyone but this app, whose copies are only for other apps to see. */
async function stepOrigins(start: Date, end: Date): Promise<string[]> {
  const { dataOrigins } = await aggregateRecord({ recordType: 'Steps', timeRangeFilter: between(start, end) });
  return (dataOrigins ?? []).filter((o) => o !== OWN_PACKAGE);
}

/** Step records around [start, end), from the given apps. */
async function stepRecords(start: Date, end: Date, origins: string[]): Promise<StepRecord[]> {
  const records: StepRecord[] = [];
  let pageToken: string | undefined;
  do {
    // A day either side, so a record crossing midnight is found whichever way the filter matches it.
    const page = await readRecords('Steps', {
      timeRangeFilter: between(addDays(start, -1), addDays(end, 1)),
      dataOriginFilter: origins,
      pageSize: 1000,
      pageToken,
    });
    for (const r of page.records) {
      const from = Date.parse(r.startTime);
      const to = Date.parse(r.endTime);
      if (to > start.getTime() && from < end.getTime()) {
        records.push({ from, to, count: r.count, origin: r.metadata?.dataOrigin ?? '' });
      }
    }
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return records;
}

/**
 * Publishes steps the app counted itself so other apps can see them. One
 * record per finished hour; the client id makes re-sends replace the earlier
 * copy (the version is the send time, so a lower corrected count still
 * replaces it), and an hour that's now empty is removed.
 */
export async function publishHourlySteps(day: string, hourly: number[], now = new Date()) {
  await ready();
  const base = parseDayKey(day);
  const empty: string[] = [];
  const records = hourly.flatMap((steps, hour) => {
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour);
    const end = new Date(start.getTime() + 3_600_000);
    if (end > now) return [];
    const clientRecordId = `steps-${start.getTime()}`;
    if (steps <= 0) {
      empty.push(clientRecordId);
      return [];
    }
    return [
      {
        recordType: 'Steps' as const,
        count: steps,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        metadata: { clientRecordId, clientRecordVersion: now.getTime() },
      },
    ];
  });
  if (records.length) await insertRecords(records);
  if (empty.length) await deleteRecordsByUuids('Steps', [], empty);
}

async function dailyGroups(
  recordType: 'Steps' | 'Distance' | 'FloorsClimbed',
  start: Date,
  end: Date,
  dataOriginFilter?: string[],
): Promise<Map<string, number>> {
  const groups = await aggregateGroupByDuration({
    recordType,
    timeRangeFilter: between(start, end),
    timeRangeSlicer: { duration: 'DAYS', length: 1 },
    dataOriginFilter,
  });
  const byDay = new Map<string, number>();
  for (const g of groups) {
    // Day slices are 24h long, so near a daylight-saving change they drift by an hour; key by the slice's middle.
    const key = dayKey(new Date(Date.parse(g.startTime) + 12 * 3_600_000));
    const r = g.result as Record<string, unknown>;
    const value =
      recordType === 'Steps'
        ? (r.COUNT_TOTAL as number)
        : recordType === 'Distance'
          ? (r.DISTANCE as { inMeters: number } | undefined)?.inMeters
          : (r.FLOORS_CLIMBED_TOTAL as number);
    if (value) byDay.set(key, value);
  }
  return byDay;
}

type WindowSteps = { buckets: StepBucket[]; untimed: number; lastRecordAt: number | null };

/** Timed buckets and untimed steps from one read; a sync asks for both, so the second ask reuses the first. */
let lastRead: { key: string; at: number; result: Promise<WindowSteps> } | null = null;

function stepsIn(start: Date, end: Date, bucketMinutes: number) {
  const key = `${start.getTime()}|${end.getTime()}|${bucketMinutes}`;
  if (lastRead?.key === key && Date.now() - lastRead.at < 10_000) return lastRead.result;
  const result = readSteps(start, end, bucketMinutes);
  lastRead = { key, at: Date.now(), result };
  result.catch(() => {
    if (lastRead?.result === result) lastRead = null;
  });
  return result;
}

async function readSteps(start: Date, end: Date, bucketMinutes: number): Promise<WindowSteps> {
  await ready();
  const origins = await stepOrigins(start, end);
  // An empty filter would mean "every app", this one included.
  if (!origins.length) return { buckets: [], untimed: 0, lastRecordAt: null };
  const [total, groups, records] = await Promise.all([
    aggregateRecord({ recordType: 'Steps', timeRangeFilter: between(start, end), dataOriginFilter: origins }),
    aggregateGroupByDuration({
      recordType: 'Steps',
      timeRangeFilter: between(start, end),
      timeRangeSlicer: { duration: 'MINUTES', length: bucketMinutes },
      dataOriginFilter: origins,
    }),
    stepRecords(start, end, origins),
  ]);
  const buckets = groups.flatMap((g): StepBucket[] =>
    g.result.COUNT_TOTAL > 0
      ? [{ start: Date.parse(g.startTime), end: Date.parse(g.endTime), steps: g.result.COUNT_TOTAL }]
      : [],
  );
  return healthConnectWindow({ buckets, total: total.COUNT_TOTAL, records, start: start.getTime(), end: end.getTime() });
}

export const healthConnectSource: StepSource = {
  id: 'health-connect',
  label: 'Health Connect',

  isAvailable: healthConnectAvailable,

  async requestPermissions() {
    await ready();
    const granted = await requestPermission([
      ...PERMISSIONS,
      { accessType: 'read', recordType: 'BackgroundAccessPermission' },
      { accessType: 'read', recordType: 'ReadHealthDataHistory' },
    ]);
    return granted.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
  },

  async getStepBuckets(start, end, bucketMinutes) {
    return (await stepsIn(start, end, bucketMinutes)).buckets;
  },

  async getUntimedSteps(start, end) {
    return (await stepsIn(start, end, 1)).untimed;
  },

  async lastRecordedAt(start, end) {
    return (await stepsIn(start, end, 1)).lastRecordAt;
  },

  async getDistanceM(start, end) {
    await ready();
    const r = await aggregateRecord({ recordType: 'Distance', timeRangeFilter: between(start, end) });
    return r.DISTANCE?.inMeters || null;
  },

  async getFloors(start, end) {
    await ready();
    const r = await aggregateRecord({ recordType: 'FloorsClimbed', timeRangeFilter: between(start, end) });
    // Most Android phones never record floors, so zero means "no data" here.
    return r.FLOORS_CLIMBED_TOTAL ? Math.round(r.FLOORS_CLIMBED_TOTAL) : null;
  },

  async getDailyTotals(startDay, endDay) {
    await ready();
    const start = parseDayKey(startDay);
    const end = addDays(parseDayKey(endDay), 1);
    const origins = await stepOrigins(start, end);
    if (!origins.length) return [];
    const [steps, distance, floors] = await Promise.all([
      dailyGroups('Steps', start, end, origins),
      dailyGroups('Distance', start, end),
      dailyGroups('FloorsClimbed', start, end),
    ]);
    const totals: DayTotals[] = [];
    for (const [date, count] of steps) {
      const f = floors.get(date);
      totals.push({
        date,
        steps: Math.round(count),
        distanceM: distance.get(date) ?? null,
        floors: f === undefined ? null : Math.round(f),
      });
    }
    return totals;
  },

  async writeWeight(kg, at) {
    await ready();
    const [id] = await insertRecords([
      { recordType: 'Weight', weight: { unit: 'kilograms', value: kg }, time: at.toISOString() },
    ]);
    return id ?? null;
  },

  async writeWater(ml, at) {
    await ready();
    const [id] = await insertRecords([
      {
        recordType: 'Hydration',
        volume: { unit: 'milliliters', value: ml },
        startTime: at.toISOString(),
        endTime: new Date(at.getTime() + 60_000).toISOString(),
      },
    ]);
    return id ?? null;
  },

  async writeFood(name, nutrients, at) {
    await ready();
    await ensurePermission({ accessType: 'write', recordType: 'Nutrition' });
    const [id] = await insertRecords([
      {
        recordType: 'Nutrition',
        ...nutritionFields(nutrients),
        name,
        // The app doesn't label meals; people eat whenever.
        mealType: MealType.UNKNOWN,
        startTime: at.toISOString(),
        endTime: new Date(at.getTime() + 60_000).toISOString(),
      },
    ]);
    return id ?? null;
  },

  async deleteSample(kind, sampleId) {
    await ready();
    await deleteRecordsByUuids(RECORD_TYPES[kind], [sampleId], []);
  },
};
