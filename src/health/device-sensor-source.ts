import { PermissionsAndroid, Platform } from 'react-native';

import { addDays, dayKey, parseDayKey } from '@/lib/dates';

import { StepCounter } from '../../modules/step-counter';
import { type PhoneWindow, phoneWindow, rebucket } from './phone-steps';
import type { DayTotals, StepSource } from './types';

const MINUTE = 60_000;

/** One read for a window's minutes and untimed steps; a sync asks for both at once. */
let lastRead: { key: string; at: number; result: Promise<PhoneWindow> } | null = null;

function windowSteps(startMs: number, endMs: number): Promise<PhoneWindow> {
  if (!StepCounter) return Promise.resolve({ minutes: [], untimed: 0 });
  const key = `${startMs}|${endMs}`;
  const now = Date.now();
  if (lastRead?.key === key && now - lastRead.at < 10_000) return lastRead.result;
  const result = phoneWindow(StepCounter, startMs, endMs, now);
  lastRead = { key, at: now, result };
  result.catch(() => {
    if (lastRead?.result === result) lastRead = null;
  });
  return result;
}

async function requestAndroidPermission(permission: (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS], minApi: number) {
  if (Platform.OS !== 'android' || (Platform.Version as number) < minApi) return true;
  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * The phone itself (Android only), used when no other app records steps into
 * Health Connect. Google's step recorder (in Google Play services) keeps every
 * step with its time even while this app is stopped; the app's own counter
 * keeps running for the notification, and is the source on phones without
 * Play services.
 */
export const deviceSensorSource: StepSource = {
  id: 'device-sensor',
  label: 'This phone',

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
    await StepCounter.startRecorder().catch(() => null);
    return true;
  },

  async getStepBuckets(start, end, bucketMinutes) {
    const { minutes } = await windowSteps(start.getTime(), end.getTime());
    // Minutes keep their own times, so a walk starting mid-minute can take the part it covers.
    if (bucketMinutes === 1) {
      return minutes.map((m) => ({ start: m.start, end: m.start + MINUTE, steps: m.steps })).sort((a, b) => a.start - b.start);
    }
    return rebucket(minutes, start, bucketMinutes);
  },

  async getUntimedSteps(start, end) {
    return (await windowSteps(start.getTime(), end.getTime())).untimed;
  },

  async getDistanceM() {
    return null;
  },

  async getFloors() {
    return null;
  },

  async getDailyTotals(startDay, endDay) {
    if (!StepCounter) return [];
    const totals: DayTotals[] = [];
    for (let day = parseDayKey(startDay); dayKey(day) <= endDay; day = addDays(day, 1)) {
      const start = day.getTime();
      const end = addDays(day, 1).getTime();
      const { minutes, untimed } = await phoneWindow(StepCounter, start, end, Date.now());
      const steps = minutes.reduce((s, m) => s + m.steps, 0) + untimed;
      if (steps > 0) totals.push({ date: dayKey(day), steps: Math.round(steps), distanceM: null, floors: null });
    }
    return totals;
  },
};

/**
 * Keeps counting going after app updates or if Android stopped it, and makes
 * sure Google's recorder is subscribed (a no-op when it already is).
 */
export async function ensureCounterRunning() {
  if (!StepCounter) return;
  if (!StepCounter.isRunning()) await StepCounter.start();
  if (StepCounter.recorderStatus() === 'ready') await StepCounter.startRecorder().catch(() => null);
}
