/**
 * Step records in Health Connect that cover too long a time to say when
 * their steps were taken: an app writing one catch-up record after a battery
 * saver stopped it, or keeping one record for a whole day. Health Connect
 * spreads such a record evenly over its time when asked for minutes, which
 * would put steps in the night; they're kept as untimed instead, and count
 * for the day they began (like the phone's own untimed steps).
 */
import type { StepBucket } from '@/lib/metrics';
import { untimedShare, type UntimedSpan } from '@/lib/untimed';

const COARSE_MIN_MS = 30 * 60_000;
const COARSE_MAX_CADENCE = 40;
/** Faster than anyone keeps up for a minute: a catch-up written as a short record. */
const MAX_MINUTE_STEPS = 250;

export interface StepRecord {
  from: number;
  to: number;
  count: number;
  origin: string;
}

/**
 * Health Connect's own counting of the phone's steps (Android 14+): records
 * from "android", or since June 2026 from a per-phone package name.
 */
export function isPhoneOrigin(origin: string): boolean {
  return origin === 'android' || origin.startsWith('com.android.healthconnect.phone');
}

/** Longer than half an hour, at under 40 steps a minute on average. */
export function isCoarseRecord(startMs: number, endMs: number, count: number): boolean {
  const duration = endMs - startMs;
  return duration > COARSE_MIN_MS && count / (duration / 60_000) < COARSE_MAX_CADENCE;
}

/**
 * Takes coarse records' share out of each bucket and returns what was taken
 * out, which belongs to the window but to no minute in it.
 */
export function splitCoarse(buckets: StepBucket[], coarse: UntimedSpan[]): { buckets: StepBucket[]; untimed: number } {
  let untimed = 0;
  const timed = buckets.flatMap((b) => {
    const share = Math.min(b.steps, untimedShare(coarse, b.start, b.end));
    const steps = b.steps - share;
    if (steps > 0.5) {
      untimed += share;
      return [{ ...b, steps }];
    }
    untimed += b.steps;
    return [];
  });
  return { buckets: timed, untimed };
}

/**
 * One window's steps from Health Connect's figures. `buckets` are its minute
 * slices and `total` its total for the window (both after its own
 * deduplication); `records` are the raw records around the window.
 *
 * - Coarse records come out of the minutes. Each counts in full for the day
 *   it began, unless another app recorded the same time in detail: then both
 *   apps counted the same walk, and the detailed one has it.
 * - Minutes faster than anyone walks are a catch-up written as a short
 *   record: their steps stay in the day, untimed.
 * - What's left of the total (whole-number slices drift) is untimed too.
 */
export function healthConnectWindow(opts: {
  buckets: StepBucket[];
  total: number;
  records: StepRecord[];
  start: number;
  end: number;
}): { buckets: StepBucket[]; untimed: number; lastRecordAt: number | null } {
  const { start, end } = opts;
  const coarse = opts.records.filter((r) => isCoarseRecord(r.from, r.to, r.count));
  const fine = opts.records.filter((r) => !isCoarseRecord(r.from, r.to, r.count));
  const spans = coarse.map((r) => ({ from: r.from, to: r.to, steps: r.count }));

  const split = splitCoarse(opts.buckets, spans);
  let fast = 0;
  const buckets = split.buckets.filter((b) => {
    if (b.steps / Math.max(1, (b.end - b.start) / 60_000) <= MAX_MINUTE_STEPS) return true;
    fast += b.steps;
    return false;
  });
  const timed = buckets.reduce((s, b) => s + b.steps, 0);
  const drift = Math.max(0, opts.total - timed - fast - split.untimed);

  const repeated = (c: StepRecord) => fine.some((f) => f.origin !== c.origin && f.to > c.from && f.from < c.to);
  const ownDay = coarse.filter((c) => c.from >= start && c.from < end && !repeated(c)).reduce((s, c) => s + c.count, 0);

  const ends = opts.records.filter((r) => r.to > start && r.from < end).map((r) => Math.min(r.to, end));
  return { buckets, untimed: drift + fast + ownDay, lastRecordAt: ends.length ? Math.max(...ends) : null };
}
