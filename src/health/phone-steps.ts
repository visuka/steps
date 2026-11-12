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

/** Where the recorder takes over: the end of the minute it started in, or never. */
export function phoneSplit(counter: PhoneCounter): number {
  const since = counter.recorderSince();
  return since ? Math.ceil(since / MINUTE) * MINUTE : Infinity;
}

/** Minute buckets in [startMs, endMs) from whichever counter covers each stretch. */
export async function phoneMinutes(counter: PhoneCounter, startMs: number, endMs: number): Promise<MinuteBucket[]> {
  const split = phoneSplit(counter);
  const parts: MinuteBucket[] = [];
  if (startMs < split) {
    const counted = await counter.getBuckets(startMs, Math.min(endMs, split));
    // The counter rounds its range out to whole minutes; the minute from the split on is the recorder's.
    parts.push(...counted.filter((m) => m.start < split));
  }
  if (endMs > split) {
    const from = Math.max(startMs, split);
    try {
      parts.push(...(await counter.getRecorderBuckets(from, endMs)));
    } catch {
      // Play services refused this time (updating, say): the counter stands in until it answers.
      parts.push(...(await counter.getBuckets(from, endMs)).filter((m) => m.start >= from));
    }
  }
  return parts;
}

/**
 * Untimed steps for the day [dayStart, dayEnd): stretches that began in it.
 * Only the counter has them, and only before the recorder took over: of a
 * stretch that runs past that point, the part after it is in the recorder.
 */
export async function phoneUntimed(counter: PhoneCounter, dayStart: number, dayEnd: number): Promise<number> {
  const split = phoneSplit(counter);
  if (dayStart >= split) return 0;
  const spans = (await counter.getUntimed(dayStart, Math.min(dayEnd, split))).map((s) =>
    s.to <= split ? s : { from: s.from, to: split, steps: untimedShare([s], s.from, split, DEFAULT_HOUR_WEIGHTS) },
  );
  return untimedForDay(spans, dayStart, dayEnd);
}
