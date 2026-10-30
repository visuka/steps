/**
 * Believable, repeatable walking data for the web preview and for screenshots.
 * The same day always produces the same steps.
 */
import { addDays, dayKey, parseDayKey } from '@/lib/dates';
import type { StepBucket } from '@/lib/metrics';

import type { DayTotals, StepSource } from './types';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Steps for each minute of the day (1440 entries). */
function minutesForDay(key: string): number[] {
  const rand = mulberry32(hash(key));
  const minutes = new Array<number>(1440).fill(0);
  const weekend = [0, 6].includes(parseDayKey(key).getDay());

  const bout = (startMin: number, length: number, cadence: number) => {
    for (let m = startMin; m < Math.min(1440, startMin + length); m++) {
      minutes[m] = Math.round(cadence + (rand() - 0.5) * 12);
    }
  };

  if (!weekend) bout(7 * 60 + 40 + Math.floor(rand() * 30), 12 + Math.floor(rand() * 15), 98 + rand() * 18);
  if (rand() < 0.75) bout(12 * 60 + 30 + Math.floor(rand() * 40), 10 + Math.floor(rand() * 20), 100 + rand() * 15);
  if (rand() < (weekend ? 0.9 : 0.65)) {
    bout(17 * 60 + 30 + Math.floor(rand() * 120), 20 + Math.floor(rand() * 35), 104 + rand() * 22);
  }
  // Pottering around: short bursts through the waking day.
  for (let h = 7; h < 23; h++) {
    const bursts = Math.floor(rand() * 7);
    for (let i = 0; i < bursts; i++) {
      const m = h * 60 + Math.floor(rand() * 60);
      if (minutes[m] === 0) minutes[m] = 8 + Math.floor(rand() * 45);
    }
  }
  return minutes;
}

export const demoSource: StepSource = {
  id: 'demo',
  label: 'Demo data',
  async isAvailable() {
    return true;
  },
  async requestPermissions() {
    return true;
  },
  async getStepBuckets(start, end, bucketMinutes) {
    const buckets: StepBucket[] = [];
    const bucketMs = bucketMinutes * 60_000;
    let current: StepBucket | null = null;
    for (let day = new Date(start.getFullYear(), start.getMonth(), start.getDate()); day < end; day = addDays(day, 1)) {
      const minutes = minutesForDay(dayKey(day));
      for (let m = 0; m < 1440; m++) {
        const t = day.getTime() + m * 60_000;
        if (t < start.getTime() || t + 60_000 > end.getTime() || minutes[m] === 0) continue;
        const bucketStart = start.getTime() + Math.floor((t - start.getTime()) / bucketMs) * bucketMs;
        if (!current || current.start !== bucketStart) {
          current = { start: bucketStart, end: bucketStart + bucketMs, steps: 0 };
          buckets.push(current);
        }
        current.steps += minutes[m];
      }
    }
    return buckets;
  },
  async getDistanceM() {
    return null;
  },
  async getFloors(start, end) {
    const rand = mulberry32(hash(`floors-${dayKey(start)}`));
    const fraction = Math.min(1, (end.getTime() - start.getTime()) / 86_400_000);
    return Math.round((2 + rand() * 12) * fraction);
  },
  async getDailyTotals(startDay, endDay) {
    const totals: DayTotals[] = [];
    for (let d = parseDayKey(startDay); dayKey(d) <= endDay; d = addDays(d, 1)) {
      const key = dayKey(d);
      const steps = minutesForDay(key).reduce((a, b) => a + b, 0);
      totals.push({ date: key, steps, distanceM: null, floors: await demoSource.getFloors(d, addDays(d, 1)) });
    }
    return totals;
  },
};
