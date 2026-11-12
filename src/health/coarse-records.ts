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
 *   it began. When another app recorded the same time in detail, both apps
 *   counted the same walk: the record adds only what the detailed minutes
 *   don't already have. When two apps each wrote a long record for the same
 *   time, only the bigger one counts (as in Health Connect's own total).
 * - Minutes faster than anyone walks are a catch-up written as a short
 *   record: their steps stay in the day, untimed.
 * - What's left of the total beyond the minutes and the long records' share
 *   of the window is untimed too.
 */
export function healthConnectWindow(opts: {
  buckets: StepBucket[];
  total: number;
  records: StepRecord[];
  start: number;
  end: number;
}): { buckets: StepBucket[]; untimed: number; lastRecordAt: number | null } {
  const { start, end } = opts;
  const all = opts.records.filter((r) => isCoarseRecord(r.from, r.to, r.count));
  const fine = opts.records.filter((r) => !isCoarseRecord(r.from, r.to, r.count));
  const overlap = (a: StepRecord, b: StepRecord) => Math.min(a.to, b.to) - Math.max(a.from, b.from);
  // Mostly covered by a bigger long record from another app: the same steps, counted by both.
  const shadowed = (c: StepRecord) =>
    all.some(
      (o) =>
        o !== c &&
        o.origin !== c.origin &&
        overlap(o, c) >= 0.5 * (c.to - c.from) &&
        (o.count > c.count || (o.count === c.count && o.origin < c.origin)),
    );
  const coarse = all.filter((c) => !shadowed(c));
  const spans = coarse.map((r) => ({ from: r.from, to: r.to, steps: r.count }));

  const split = splitCoarse(opts.buckets, spans);
  let fast = 0;
  const buckets = split.buckets.filter((b) => {
    if (b.steps / Math.max(1, (b.end - b.start) / 60_000) <= MAX_MINUTE_STEPS) return true;
    fast += b.steps;
    return false;
  });
  const timed = buckets.reduce((s, b) => s + b.steps, 0);
  // Health Connect's slices are whole numbers, so what was taken out of them
  // falls short of the long records' real share; their share is counted
  // below, so only the rest of the total is drift.
  const drift = Math.max(0, opts.total - timed - fast - untimedShare(spans, start, end));

  const repeated = (c: StepRecord) => fine.some((f) => f.origin !== c.origin && f.to > c.from && f.from < c.to);
  const timedIn = (c: StepRecord) =>
    buckets.filter((b) => b.start < c.to && b.end > c.from).reduce((s, b) => s + b.steps, 0);
  const ownDay = coarse
    .filter((c) => c.from >= start && c.from < end)
    .reduce((s, c) => s + (repeated(c) ? Math.max(0, c.count - timedIn(c)) : c.count), 0);

  const ends = opts.records.filter((r) => r.to > start && r.from < end).map((r) => Math.min(r.to, end));
  return { buckets, untimed: drift + fast + ownDay, lastRecordAt: ends.length ? Math.max(...ends) : null };
}
