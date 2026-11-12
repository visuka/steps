/**
 * How the phone's steps are put together from its two counters: Google's
 * step recorder (in Google Play services), which has the true time of every
 * step from the minute after it started recording for this app, and the
 * app's own counter for anything before that (installs that counted before
 * the recorder existed) or on phones without Play services.
 */
import type { StepBucket } from '@/lib/metrics';
import { DEFAULT_HOUR_WEIGHTS, untimedForDay, untimedShare } from '@/lib/untimed';

import type { MinuteBucket } from '../../modules/step-counter';

const MINUTE = 60_000;

/** The native calls this needs; a fake in tests. */
export interface PhoneCounter {
  getBuckets(startMs: number, endMs: number): Promise<MinuteBucket[]>;
  getUntimed(startMs: number, endMs: number): Promise<{ from: number; to: number; steps: number }[]>;
  recorderSince(): number | null;
  getRecorderBuckets(startMs: number, endMs: number): Promise<MinuteBucket[]>;
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
  if (startMs < split) {
    const counted = await counter.getBuckets(startMs, counterUntil);
    // The counter rounds its range out to whole minutes; the minute from the split on is the recorder's.
    minutes.push(...counted.filter((m) => m.start < split));
  }
  if (endMs > split) {
    const from = Math.max(startMs, split);
    try {
      minutes.push(...(await counter.getRecorderBuckets(from, endMs)));
    } catch {
      // Play services refused this time (updating, say): the counter stands in until it answers.
      minutes.push(...(await counter.getBuckets(from, endMs)).filter((m) => m.start >= from));
      counterUntil = endMs;
    }
  }
  return { minutes, untimed: await counterUntimed(counter, startMs, endMs, counterUntil) };
}

async function counterUntimed(counter: PhoneCounter, dayStart: number, dayEnd: number, until: number): Promise<number> {
  if (until <= dayStart) return 0;
  const spans = (await counter.getUntimed(dayStart, until)).map((s) =>
    s.to <= until ? s : { from: s.from, to: until, steps: untimedShare([s], s.from, until, DEFAULT_HOUR_WEIGHTS) },
  );
  return untimedForDay(spans, dayStart, dayEnd);
}
