/**
 * How the phone's steps are put together from its two counters: Google's
 * step recorder (in Google Play services), which has the true time of every
 * step from the minute after it started recording for this app, and the
 * app's own counter for anything before that (installs that counted before
 * the recorder existed) or on phones without Play services.
 */
import type { StepBucket } from '@/lib/metrics';
import { DEFAULT_HOUR_WEIGHTS, untimedForDay, untimedShare } from '@/lib/untimed';

import type { ActivityTransition, MinuteBucket, MinuteFeature } from '../../modules/step-counter';
import { ACTIVITY_LOOKBACK_MS, filterRiding, type RemovedMinute } from './step-filter';

const MINUTE = 60_000;

/** The native calls this needs; a fake in tests. */
export interface PhoneCounter {
  getBuckets(startMs: number, endMs: number): Promise<MinuteBucket[]>;
  getUntimed(startMs: number, endMs: number): Promise<{ from: number; to: number; steps: number }[]>;
  recorderSince(): number | null;
  getRecorderBuckets(startMs: number, endMs: number): Promise<MinuteBucket[]>;
  /** What the riding filter reads (step-filter.ts); without them nothing is filtered (an older build). */
  getMinuteFeatures?(startMs: number, endMs: number): Promise<MinuteFeature[]>;
  getActivityTransitions?(startMs: number, endMs: number): Promise<ActivityTransition[]>;
}

/** Groups minute buckets into `bucketMinutes`-long buckets aligned to `start`. */
export function rebucket(minutes: { start: number; steps: number }[], start: Date, bucketMinutes: number): StepBucket[] {
  const size = bucketMinutes * MINUTE;
  const out: StepBucket[] = [];
  for (const m of [...minutes].sort((a, b) => a.start - b.start)) {
    const bucketStart = start.getTime() + Math.floor((m.start - start.getTime()) / size) * size;
    const last = out.at(-1);
    if (last && last.start === bucketStart) last.steps += m.steps;
    else out.push({ start: bucketStart, end: bucketStart + size, steps: m.steps });
  }
  return out;
}

/** The recorder keeps 10 days; a day's margin, so a range it has half forgotten isn't read from it. */
const RECORDER_KEEPS_MS = 9 * 24 * 60 * MINUTE;

/**
 * Where the recorder takes over: the end of the minute it started in, or
 * never. Times it no longer keeps come from the counter, which keeps everything.
 */
export function phoneSplit(counter: PhoneCounter, now: number): number {
  const since = counter.recorderSince();
  if (!since) return Infinity;
  return Math.max(Math.ceil(since / MINUTE) * MINUTE, Math.ceil((now - RECORDER_KEEPS_MS) / MINUTE) * MINUTE);
}

export interface PhoneWindow {
  /** Minute buckets in the window, from whichever counter covers each stretch. */
  minutes: MinuteBucket[];
  /** Steps with no known time that count for the window (stretches that began in it). */
  untimed: number;
  /** Minutes taken out as riding, not walking (step-filter.ts); not in `minutes`. */
  removed: RemovedMinute[];
  /** Minutes in [recorderFrom, recorderUntil) came from Google's recorder; the rest from the app's counter. */
  recorderFrom: number;
  recorderUntil: number;
}

/**
 * The phone's steps in [startMs, endMs). Untimed steps come only from the
 * app's counter, for the time the counter covers: of a stretch that runs into
 * the recorder's time, the part after it is in the recorder, with its times.
 */
export async function phoneWindow(counter: PhoneCounter, startMs: number, endMs: number, now: number): Promise<PhoneWindow> {
  const split = phoneSplit(counter, now);
  const minutes: MinuteBucket[] = [];
  let counterUntil = Math.min(endMs, split);
  let recorderFrom = endMs;
  let recorderUntil = endMs;
  if (startMs < split) {
    const counted = await counter.getBuckets(startMs, counterUntil);
    // The counter rounds its range out to whole minutes; the minute from the split on is the recorder's.
    minutes.push(...counted.filter((m) => m.start < split));
  }
  if (endMs > split) {
    const from = Math.max(startMs, split);
    try {
      const recorded = await counter.getRecorderBuckets(from, endMs);
      minutes.push(...recorded);
      // Google's recorder saves late, sometimes hours late (owner's phone, 15 Nov 2026: nothing after
      // 11:00 while the counter had 1,500 steps). The counter stands in after the recorder's last saved
      // minute; once the recorder catches up, those minutes are its again, so nothing counts twice.
      const lastSaved = recorded.reduce((last, m) => Math.max(last, m.start), -Infinity);
      const tailFrom = lastSaved === -Infinity ? from : lastSaved + MINUTE;
      recorderFrom = from;
      recorderUntil = Math.min(tailFrom, endMs);
      if (tailFrom < endMs) {
        minutes.push(...(await counter.getBuckets(tailFrom, endMs)).filter((m) => m.start >= tailFrom));
      }
    } catch {
      // Play services refused this time (updating, say): the counter stands in until it answers.
      minutes.push(...(await counter.getBuckets(from, endMs)).filter((m) => m.start >= from));
      counterUntil = endMs;
    }
  }
  const { kept, removed } = await withoutRiding(counter, minutes, startMs, endMs);
  const untimed = await counterUntimed(counter, startMs, endMs, counterUntil);
  return { minutes: kept, untimed, removed, recorderFrom, recorderUntil };
}

/** Takes out the minutes that came from riding. A failed read removes nothing: steps are never lost to an error. */
async function withoutRiding(counter: PhoneCounter, minutes: MinuteBucket[], startMs: number, endMs: number) {
  if (!minutes.length || !counter.getMinuteFeatures || !counter.getActivityTransitions) return { kept: minutes, removed: [] };
  try {
    const [features, transitions] = await Promise.all([
      counter.getMinuteFeatures(startMs, endMs),
      counter.getActivityTransitions(startMs - ACTIVITY_LOOKBACK_MS, endMs),
    ]);
    return filterRiding(minutes, features, transitions);
  } catch {
    return { kept: minutes, removed: [] };
  }
}

async function counterUntimed(counter: PhoneCounter, dayStart: number, dayEnd: number, until: number): Promise<number> {
  if (until <= dayStart) return 0;
  const spans = (await counter.getUntimed(dayStart, until)).map((s) =>
    s.to <= until ? s : { from: s.from, to: until, steps: untimedShare([s], s.from, until, DEFAULT_HOUR_WEIGHTS) },
  );
  return untimedForDay(spans, dayStart, dayEnd);
}
