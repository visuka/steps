import {
  CategoryValueSleepAnalysis,
  deleteObjects,
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryCorrelationSamples,
  queryStatisticsCollectionForQuantity,
  requestAuthorization,
  saveCorrelationSample,
} from '@kingstinct/react-native-healthkit';

import type { BloodPressureEntry, HeartDay } from '@/data/types';
import { dayKey } from '@/lib/dates';
import { type SleepSegment, type SleepStage, sleepSessions, toSleepEntries } from '@/lib/sleep';

import type { VitalsSource } from './vitals.types';

const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
const HEART_RATE = 'HKQuantityTypeIdentifierHeartRate';
const RESTING = 'HKQuantityTypeIdentifierRestingHeartRate';
const SYSTOLIC = 'HKQuantityTypeIdentifierBloodPressureSystolic';
const DIASTOLIC = 'HKQuantityTypeIdentifierBloodPressureDiastolic';
const BLOOD_PRESSURE = 'HKCorrelationTypeIdentifierBloodPressure';

const STAGES: Record<number, SleepStage> = {
  [CategoryValueSleepAnalysis.inBed]: 'inBed',
  [CategoryValueSleepAnalysis.asleepUnspecified]: 'asleep',
  [CategoryValueSleepAnalysis.awake]: 'awake',
  [CategoryValueSleepAnalysis.asleepCore]: 'light',
  [CategoryValueSleepAnalysis.asleepDeep]: 'deep',
  [CategoryValueSleepAnalysis.asleepREM]: 'rem',
};

const between = (startDate: Date, endDate: Date) => ({ date: { startDate, endDate } });

async function dailyHeart(id: typeof HEART_RATE | typeof RESTING, start: Date, end: Date) {
  return queryStatisticsCollectionForQuantity(id, ['discreteAverage', 'discreteMin', 'discreteMax'], start, { day: 1 }, {
    filter: between(start, end),
    unit: 'count/min',
  });
}

export const vitalsSource: VitalsSource = {
  label: 'Apple Health',

  isAvailable: () => isHealthDataAvailableAsync(),

  async requestAccess() {
    // Blood pressure is read through its two quantity types; HealthKit refuses requests for the correlation itself.
    await requestAuthorization({
      toRead: [SLEEP, HEART_RATE, RESTING, SYSTOLIC, DIASTOLIC],
      toShare: [SYSTOLIC, DIASTOLIC],
    });
    // HealthKit never says whether reading was allowed; a refusal just returns nothing.
    return true;
  },

  async readSleep(start, end) {
    const samples = await queryCategorySamples(SLEEP, { limit: 0, filter: between(start, end) });
    const segments = samples.map(
      (s): SleepSegment => ({
        id: s.uuid,
        source: s.sourceRevision?.source.bundleIdentifier ?? 'unknown',
        stage: STAGES[s.value] ?? 'asleep',
        start: s.startDate.getTime(),
        end: s.endDate.getTime(),
      }),
    );
    return toSleepEntries(sleepSessions(segments), Date.now());
  },

  async readHeartDays(start, end) {
    const [all, resting] = await Promise.all([dailyHeart(HEART_RATE, start, end), dailyHeart(RESTING, start, end)]);
    const now = Date.now();
    const byDate = new Map<string, HeartDay>();
    const day = (date: string) => {
      let d = byDate.get(date);
      if (!d) byDate.set(date, (d = { date, restingBpm: null, avgBpm: null, minBpm: null, maxBpm: null, updatedAt: now }));
      return d;
    };
    for (const r of all) {
      if (!r.startDate || !r.averageQuantity) continue;
      const d = day(dayKey(r.startDate));
      d.avgBpm = Math.round(r.averageQuantity.quantity);
      d.minBpm = r.minimumQuantity ? Math.round(r.minimumQuantity.quantity) : null;
      d.maxBpm = r.maximumQuantity ? Math.round(r.maximumQuantity.quantity) : null;
    }
    for (const r of resting) {
      if (r.startDate && r.averageQuantity) day(dayKey(r.startDate)).restingBpm = Math.round(r.averageQuantity.quantity);
    }
    return [...byDate.values()];
  },

  async readBloodPressure(start, end) {
    const correlations = await queryCorrelationSamples(BLOOD_PRESSURE, { limit: 0, filter: between(start, end) });
    const now = Date.now();
    return correlations.flatMap((c): BloodPressureEntry[] => {
      const value = (type: string) => {
        const o = c.objects.find((x) => 'quantityType' in x && x.quantityType === type);
        return o && 'quantity' in o ? Math.round(o.quantity) : null;
      };
      const systolic = value(SYSTOLIC);
      const diastolic = value(DIASTOLIC);
      if (systolic === null || diastolic === null) return [];
      return [
        {
          id: `health:${c.uuid}`,
          loggedAt: c.startDate.getTime(),
          systolic,
          diastolic,
          pulse: null,
          source: 'health',
          healthId: c.uuid,
          updatedAt: now,
        },
      ];
    });
  },

  async writeBloodPressure(systolic, diastolic, at) {
    const sample = await saveCorrelationSample(
      BLOOD_PRESSURE,
      [
        { startDate: at, endDate: at, quantityType: SYSTOLIC, quantity: systolic, unit: 'mmHg' },
        { startDate: at, endDate: at, quantityType: DIASTOLIC, quantity: diastolic, unit: 'mmHg' },
      ],
      at,
      at,
    );
    return sample?.uuid ?? null;
  },

  async deleteBloodPressure(entry) {
    if (!entry.healthId) return;
    await deleteObjects(BLOOD_PRESSURE, { uuid: entry.healthId });
    // The two numbers are samples of their own; HealthKit only lets an app delete what it saved.
    const at = new Date(entry.loggedAt);
    const filter = between(at, new Date(entry.loggedAt + 1000));
    await Promise.all([deleteObjects(SYSTOLIC, filter), deleteObjects(DIASTOLIC, filter)]);
  },
};
