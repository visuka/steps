import {
  aggregateGroupByDuration,
  BloodPressureBodyPosition,
  BloodPressureMeasurementLocation,
  deleteRecordsByUuids,
  initialize,
  insertRecords,
  readRecords,
  requestPermission,
  SleepStageType,
} from 'react-native-health-connect';

import type { BloodPressureEntry, HeartDay } from '@/data/types';
import { dayKey } from '@/lib/dates';
import { type SleepSegment, type SleepStage, sleepSessions, toSleepEntries } from '@/lib/sleep';

import { healthConnectAvailable } from './health-connect-source';
import type { VitalsSource } from './vitals.types';

let initPromise: Promise<boolean> | null = null;
const ready = () => (initPromise ??= initialize());

const between = (start: Date, end: Date) => ({
  operator: 'between' as const,
  startTime: start.toISOString(),
  endTime: end.toISOString(),
});

const READS = ['SleepSession', 'HeartRate', 'RestingHeartRate', 'BloodPressure'] as const;

const PERMISSIONS: Parameters<typeof requestPermission>[0] = [
  ...READS.map((recordType) => ({ accessType: 'read' as const, recordType })),
  { accessType: 'write', recordType: 'BloodPressure' },
  // Without this, Health Connect only shares the 30 days before access was given.
  { accessType: 'read', recordType: 'ReadHealthDataHistory' },
];

const STAGES: Record<number, SleepStage> = {
  [SleepStageType.UNKNOWN]: 'inBed',
  [SleepStageType.AWAKE]: 'awake',
  [SleepStageType.SLEEPING]: 'asleep',
  [SleepStageType.OUT_OF_BED]: 'awake',
  [SleepStageType.LIGHT]: 'light',
  [SleepStageType.DEEP]: 'deep',
  [SleepStageType.REM]: 'rem',
};

async function readAll<T extends 'SleepSession' | 'RestingHeartRate' | 'BloodPressure'>(type: T, start: Date, end: Date) {
  const records = [];
  let pageToken: string | undefined;
  do {
    const page = await readRecords(type, { timeRangeFilter: between(start, end), pageSize: 1000, pageToken });
    records.push(...page.records);
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return records;
}

const average = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export const vitalsSource: VitalsSource = {
  label: 'Health Connect',

  isAvailable: healthConnectAvailable,

  async requestAccess() {
    await ready();
    const granted = await requestPermission(PERMISSIONS);
    return granted.some((p) => p.accessType === 'read' && (READS as readonly string[]).includes(p.recordType));
  },

  async readSleep(start, end) {
    await ready();
    const sessions = await readAll('SleepSession', start, end);
    const segments = sessions.flatMap((r): SleepSegment[] => {
      const id = r.metadata?.id ?? `${r.startTime}`;
      const source = r.metadata?.dataOrigin ?? 'unknown';
      // A session without stages means asleep for all of it.
      if (!r.stages?.length) {
        return [{ id, source, stage: 'asleep', start: Date.parse(r.startTime), end: Date.parse(r.endTime) }];
      }
      return r.stages.map((s) => ({
        id,
        source,
        stage: STAGES[s.stage] ?? 'asleep',
        start: Date.parse(s.startTime),
        end: Date.parse(s.endTime),
      }));
    });
    return toSleepEntries(sleepSessions(segments), Date.now());
  },

  async readHeartDays(start, end) {
    await ready();
    const [groups, resting] = await Promise.all([
      aggregateGroupByDuration({
        recordType: 'HeartRate',
        timeRangeFilter: between(start, end),
        timeRangeSlicer: { duration: 'DAYS', length: 1 },
      }),
      readAll('RestingHeartRate', start, end),
    ]);
    const now = Date.now();
    const byDate = new Map<string, HeartDay>();
    const day = (date: string) => {
      let d = byDate.get(date);
      if (!d) byDate.set(date, (d = { date, restingBpm: null, avgBpm: null, minBpm: null, maxBpm: null, updatedAt: now }));
      return d;
    };
    for (const g of groups) {
      if (!g.result.MEASUREMENTS_COUNT) continue;
      // Day slices are 24 h long and drift across daylight-saving changes; key by the middle.
      const d = day(dayKey(new Date(Date.parse(g.startTime) + 12 * 3_600_000)));
      d.avgBpm = Math.round(g.result.BPM_AVG);
      d.minBpm = g.result.BPM_MIN;
      d.maxBpm = g.result.BPM_MAX;
    }
    const restingByDate = new Map<string, number[]>();
    for (const r of resting) {
      const date = dayKey(new Date(r.time));
      restingByDate.set(date, [...(restingByDate.get(date) ?? []), r.beatsPerMinute]);
    }
    for (const [date, values] of restingByDate) day(date).restingBpm = Math.round(average(values));
    return [...byDate.values()];
  },

  async readBloodPressure(start, end) {
    await ready();
    const records = await readAll('BloodPressure', start, end);
    const now = Date.now();
    return records.flatMap((r): BloodPressureEntry[] => {
      const id = r.metadata?.id;
      if (!id) return [];
      return [
        {
          id: `health:${id}`,
          loggedAt: Date.parse(r.time),
          systolic: Math.round(r.systolic.inMillimetersOfMercury),
          diastolic: Math.round(r.diastolic.inMillimetersOfMercury),
          pulse: null,
          source: 'health',
          healthId: id,
          updatedAt: now,
        },
      ];
    });
  },

  async writeBloodPressure(systolic, diastolic, at) {
    await ready();
    const [id] = await insertRecords([
      {
        recordType: 'BloodPressure',
        systolic: { unit: 'millimetersOfMercury', value: systolic },
        diastolic: { unit: 'millimetersOfMercury', value: diastolic },
        bodyPosition: BloodPressureBodyPosition.UNKNOWN,
        measurementLocation: BloodPressureMeasurementLocation.UNKNOWN,
        time: at.toISOString(),
      },
    ]);
    return id ?? null;
  },

  async deleteBloodPressure(entry) {
    if (!entry.healthId) return;
    await ready();
    await deleteRecordsByUuids('BloodPressure', [entry.healthId], []);
  },
};
