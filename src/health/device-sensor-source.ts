import { PermissionsAndroid, Platform } from 'react-native';

import { addDays, dayKey, parseDayKey } from '@/lib/dates';
import type { StepBucket } from '@/lib/metrics';

import { StepCounter } from '../../modules/step-counter';
import type { DayTotals, StepSource } from './types';

/** Groups the native module's minute buckets into `bucketMinutes`-long buckets aligned to `start`. */
export function rebucket(minutes: { start: number; steps: number }[], start: Date, bucketMinutes: number): StepBucket[] {
  const size = bucketMinutes * 60_000;
  const out: StepBucket[] = [];
  for (const m of minutes) {
    const bucketStart = start.getTime() + Math.floor((m.start - start.getTime()) / size) * size;
    const last = out.at(-1);
    if (last && last.start === bucketStart) last.steps += m.steps;
    else out.push({ start: bucketStart, end: bucketStart + size, steps: m.steps });
  }
  return out;
}

async function requestAndroidPermission(permission: (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS], minApi: number) {
  if (Platform.OS !== 'android' || (Platform.Version as number) < minApi) return true;
  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * The app's own counter (Android only), used when no other app records steps
 * into Health Connect. Counts only from the moment it is turned on.
 */
export const deviceSensorSource: StepSource = {
  id: 'device-sensor',
  label: "This phone's step sensor",

  async isAvailable() {
    return StepCounter?.isSupported() ?? false;
  },

  async requestPermissions() {
    if (!StepCounter) return false;
    const activity = await requestAndroidPermission(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION, 29);
    if (!activity) return false;
    // Without this the counter still runs, but its ongoing notification is hidden.
    await requestAndroidPermission(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS, 33);
    await StepCounter.start();
    return true;
  },

  async getStepBuckets(start, end, bucketMinutes) {
    if (!StepCounter) return [];
    return rebucket(await StepCounter.getBuckets(start.getTime(), end.getTime()), start, bucketMinutes);
  },

  async getDistanceM() {
    return null;
  },

  async getFloors() {
    return null;
  },

  async getDailyTotals(startDay, endDay) {
    if (!StepCounter) return [];
    const start = parseDayKey(startDay);
    const minutes = await StepCounter.getBuckets(start.getTime(), addDays(parseDayKey(endDay), 1).getTime());
    const byDay = new Map<string, number>();
    for (const m of minutes) {
      const key = dayKey(new Date(m.start));
      byDay.set(key, (byDay.get(key) ?? 0) + m.steps);
    }
    return [...byDay].map(([date, steps]): DayTotals => ({ date, steps, distanceM: null, floors: null }));
  },
};

/** Keeps the foreground service alive after app updates or if Android stopped it. */
export async function ensureCounterRunning() {
  if (StepCounter && !StepCounter.isRunning()) await StepCounter.start();
}
