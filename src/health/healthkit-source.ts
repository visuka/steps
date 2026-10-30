import {
  deleteObjects,
  isHealthDataAvailableAsync,
  queryStatisticsCollectionForQuantity,
  queryStatisticsForQuantity,
  requestAuthorization,
  saveQuantitySample,
} from '@kingstinct/react-native-healthkit';

import { addDays, dayKey, parseDayKey } from '@/lib/dates';

import type { DayTotals, StepSource } from './types';

const STEPS = 'HKQuantityTypeIdentifierStepCount';
const DISTANCE = 'HKQuantityTypeIdentifierDistanceWalkingRunning';
const FLIGHTS = 'HKQuantityTypeIdentifierFlightsClimbed';
const WEIGHT = 'HKQuantityTypeIdentifierBodyMass';
const WATER = 'HKQuantityTypeIdentifierDietaryWater';

const between = (startDate: Date, endDate: Date) => ({ date: { startDate, endDate } });

// Statistics queries merge iPhone and Apple Watch samples, so nothing is counted twice.
async function total(id: typeof STEPS | typeof DISTANCE | typeof FLIGHTS, unit: 'count' | 'm', start: Date, end: Date) {
  const res = await queryStatisticsForQuantity(id, ['cumulativeSum'], { filter: between(start, end), unit });
  return res.sumQuantity?.quantity ?? null;
}

async function dailySums(id: typeof STEPS | typeof DISTANCE | typeof FLIGHTS, unit: 'count' | 'm', start: Date, end: Date) {
  const rows = await queryStatisticsCollectionForQuantity(id, ['cumulativeSum'], start, { day: 1 }, {
    filter: between(start, end),
    unit,
  });
  const byDay = new Map<string, number>();
  for (const r of rows) {
    if (r.startDate && r.sumQuantity) byDay.set(dayKey(r.startDate), r.sumQuantity.quantity);
  }
  return byDay;
}

export const healthKitSource: StepSource = {
  id: 'healthkit',
  label: 'Apple Health',

  isAvailable: () => isHealthDataAvailableAsync(),

  async requestPermissions() {
    await requestAuthorization({
      toRead: [STEPS, DISTANCE, FLIGHTS, WEIGHT, WATER],
      toShare: [WEIGHT, WATER],
    });
    // HealthKit never says whether read access was granted; a denied read just returns no data.
    return true;
  },

  async getStepBuckets(start, end, bucketMinutes) {
    const rows = await queryStatisticsCollectionForQuantity(STEPS, ['cumulativeSum'], start, { minute: bucketMinutes }, {
      filter: between(start, end),
      unit: 'count',
    });
    return rows.flatMap((r) =>
      r.startDate && r.endDate && r.sumQuantity && r.sumQuantity.quantity > 0
        ? [{ start: r.startDate.getTime(), end: r.endDate.getTime(), steps: r.sumQuantity.quantity }]
        : [],
    );
  },

  getDistanceM: (start, end) => total(DISTANCE, 'm', start, end),

  async getFloors(start, end) {
    const floors = await total(FLIGHTS, 'count', start, end);
    return floors === null ? null : Math.round(floors);
  },

  async getDailyTotals(startDay, endDay) {
    const start = parseDayKey(startDay);
    const end = addDays(parseDayKey(endDay), 1);
    const [steps, distance, floors] = await Promise.all([
      dailySums(STEPS, 'count', start, end),
      dailySums(DISTANCE, 'm', start, end),
      dailySums(FLIGHTS, 'count', start, end),
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
    const sample = await saveQuantitySample(WEIGHT, 'kg', kg, at, at);
    return sample?.uuid ?? null;
  },

  async writeWater(ml, at) {
    const sample = await saveQuantitySample(WATER, 'mL', ml, at, at);
    return sample?.uuid ?? null;
  },

  async deleteSample(kind, sampleId) {
    await deleteObjects(kind === 'weight' ? WEIGHT : WATER, { uuid: sampleId });
  },
};
