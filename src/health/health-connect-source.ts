import Constants from 'expo-constants';
import {
  aggregateGroupByDuration,
  aggregateRecord,
  deleteRecordsByUuids,
  getSdkStatus,
  initialize,
  insertRecords,
  type Permission,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

import { addDays, dayKey, parseDayKey } from '@/lib/dates';
import type { StepBucket } from '@/lib/metrics';

import type { DayTotals, StepSource } from './types';

const OWN_PACKAGE = Constants.expoConfig?.android?.package;

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
];

export async function healthConnectAvailable(): Promise<boolean> {
  try {
    return (await getSdkStatus()) === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

/** True when another app (Samsung Health, Fitbit, Google…) recorded steps in the last week. */
export async function hasStepsFromOtherApps(now = new Date()): Promise<boolean> {
  await ready();
  const { records } = await readRecords('Steps', {
    timeRangeFilter: between(addDays(now, -7), now),
    pageSize: 50,
  });
  return records.some((r) => r.metadata?.dataOrigin && r.metadata.dataOrigin !== OWN_PACKAGE);
}

/**
 * Publishes steps the app counted itself so other apps can see them. One
 * record per hour; the client id makes re-sends replace the earlier copy.
 */
export async function publishHourlySteps(day: string, hourly: number[], now = new Date()) {
  await ready();
  const base = parseDayKey(day);
  const records = hourly.flatMap((steps, hour) => {
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour);
    const end = new Date(start.getTime() + 3_600_000);
    if (steps <= 0 || end > now) return [];
    return [
      {
        recordType: 'Steps' as const,
        count: steps,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        metadata: { clientRecordId: `steps-${start.getTime()}`, clientRecordVersion: steps },
      },
    ];
  });
  if (records.length) await insertRecords(records);
}

async function dailyGroups(
  recordType: 'Steps' | 'Distance' | 'FloorsClimbed',
  start: Date,
  end: Date,
): Promise<Map<string, number>> {
  const groups = await aggregateGroupByDuration({
    recordType,
    timeRangeFilter: between(start, end),
    timeRangeSlicer: { duration: 'DAYS', length: 1 },
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
    await ready();
    const groups = await aggregateGroupByDuration({
      recordType: 'Steps',
      timeRangeFilter: between(start, end),
      timeRangeSlicer: { duration: 'MINUTES', length: bucketMinutes },
    });
    return groups.flatMap((g): StepBucket[] =>
      g.result.COUNT_TOTAL > 0
        ? [{ start: Date.parse(g.startTime), end: Date.parse(g.endTime), steps: g.result.COUNT_TOTAL }]
        : [],
    );
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
    const [steps, distance, floors] = await Promise.all([
      dailyGroups('Steps', start, end),
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

  async deleteSample(kind, sampleId) {
    await ready();
    await deleteRecordsByUuids(kind === 'weight' ? 'Weight' : 'Hydration', [sampleId], []);
  },
};
