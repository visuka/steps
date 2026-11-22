/**
 * One hour of today minute by minute, for the Step check screen (T18a):
 * the steps each counter saw, what the accelerometer burst of that minute
 * gave (movement-features.ts) and what Android said the person was doing.
 * Each minute also says whether the riding filter (step-filter.ts) took it
 * out of the day. Plain functions over the native calls, so tests can pass a
 * fake; the hook is use-hour-minutes.ts.
 */
import type { ActivityTransition, MinuteBucket, MinuteFeature, RecorderStatus } from '../../modules/step-counter';
import { ACTIVITY_LOOKBACK_MS, activityAt, filterRiding, type RemovedMinute, RIDE_TEXT, type RideKind } from './step-filter';

export { activityAt };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** The native calls this needs; a fake in tests. */
export interface HourSource {
  recorderStatus(): RecorderStatus;
  getBuckets(startMs: number, endMs: number): Promise<MinuteBucket[]>;
  getRecorderBuckets(startMs: number, endMs: number): Promise<MinuteBucket[]>;
  getMinuteFeatures(startMs: number, endMs: number): Promise<MinuteFeature[]>;
  getActivityTransitions(startMs: number, endMs: number): Promise<ActivityTransition[]>;
}

export interface MinuteRow {
  /** Epoch ms of the minute's start. */
  start: number;
  /** Google's recorder; null when this phone has none. */
  recorder: number | null;
  /** The app's own counter. */
  counter: number;
  /** Null when no burst was read in this minute. */
  features: MinuteFeature | null;
  /** What Android said (walking, running, bicycle, vehicle, still), or null when it said nothing yet. */
  activity: string | null;
  /** Taken out of the day as riding, and which kind; null when the steps count. */
  removed: RideKind | null;
}

/** Start (epoch ms) of an hour of the day on the day of `day`. */
export function hourStart(hour: number, day: Date = new Date()): number {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour).getTime();
}

const ACTIVITY_TEXT: Record<string, string> = {
  walking: 'Walking',
  running: 'Running',
  bicycle: 'Bicycle',
  vehicle: 'Vehicle',
  still: 'Still',
};

export function activityLabel(activity: string | null): string {
  if (!activity) return 'No signal';
  return ACTIVITY_TEXT[activity] ?? activity;
}

/** The minutes of the hour that have steps or a burst, in time order. */
export function buildMinuteRows(
  hourStartMs: number,
  counted: MinuteBucket[],
  recorded: MinuteBucket[] | null,
  features: MinuteFeature[],
  transitions: ActivityTransition[],
  /** What the day's filter took out (phoneWindow over the whole day); without it the hour is filtered on its own. */
  dayRemoved?: RemovedMinute[],
): MinuteRow[] {
  const end = hourStartMs + HOUR;
  const inHour = (ms: number) => ms >= hourStartMs && ms < end;
  const starts = new Set<number>();
  const counter = new Map<number, number>();
  const recorder = new Map<number, number>();
  const burst = new Map<number, MinuteFeature>();
  for (const m of counted) {
    if (!inHour(m.start) || m.steps <= 0) continue;
    counter.set(m.start, (counter.get(m.start) ?? 0) + m.steps);
    starts.add(m.start);
  }
  for (const m of recorded ?? []) {
    if (!inHour(m.start) || m.steps <= 0) continue;
    recorder.set(m.start, (recorder.get(m.start) ?? 0) + m.steps);
    starts.add(m.start);
  }
  for (const f of features) {
    if (!inHour(f.start)) continue;
    burst.set(f.start, f);
    starts.add(f.start);
  }
  const sorted = [...starts].sort((a, b) => a - b);
  // The day counts the recorder's steps where it has them, as phone-steps.ts does.
  const dayMinutes = sorted.map((start) => ({ start, steps: recorded ? (recorder.get(start) ?? counter.get(start) ?? 0) : (counter.get(start) ?? 0) }));
  const out = new Map((dayRemoved ?? filterRiding(dayMinutes, features, transitions).removed).map((m) => [m.start, m.kind]));
  return sorted.map((start) => ({
    start,
    recorder: recorded ? (recorder.get(start) ?? 0) : null,
    counter: counter.get(start) ?? 0,
    features: burst.get(start) ?? null,
    activity: activityAt(transitions, start + MINUTE / 2),
    removed: out.get(start) ?? null,
  }));
}

/** "Taken out: in a vehicle", or null when the minute counts. */
export function removedText(removed: RideKind | null): string | null {
  return removed ? `Taken out: ${RIDE_TEXT[removed].toLowerCase()}` : null;
}

/** A call that may be missing (an older build) or fail: no rows then, never an error. */
async function orEmpty<T>(call: () => Promise<T[]>): Promise<T[]> {
  try {
    return await call();
  } catch {
    return [];
  }
}

/** Reads one hour from the native counters; `dayRemoved` gives what the day's filter took out, when it can be read. */
export async function loadHourMinutes(
  source: HourSource,
  hourStartMs: number,
  dayRemoved?: () => Promise<RemovedMinute[]>,
): Promise<MinuteRow[]> {
  const end = hourStartMs + HOUR;
  const hasRecorder = source.recorderStatus() === 'ready';
  const [counted, recorded, features, transitions, removed] = await Promise.all([
    orEmpty(() => source.getBuckets(hourStartMs, end)),
    hasRecorder ? orEmpty(() => source.getRecorderBuckets(hourStartMs, end)) : Promise.resolve(null),
    orEmpty(() => source.getMinuteFeatures(hourStartMs, end)),
    orEmpty(() => source.getActivityTransitions(hourStartMs - ACTIVITY_LOOKBACK_MS, end)),
    dayRemoved ? dayRemoved().catch(() => undefined) : Promise.resolve(undefined),
  ]);
  return buildMinuteRows(hourStartMs, counted, recorded, features, transitions, removed);
}

// ── words for the rows ──────────────────────────────────────────────────

/** "8:05" in the phone's clock style. */
export function minuteTime(start: number): string {
  return new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "112 / 108" or "108" without a recorder: recorder steps first, then the counter's. */
export function stepsText(row: Pick<MinuteRow, 'recorder' | 'counter'>): string {
  return row.recorder === null ? `${row.counter}` : `${row.recorder} / ${row.counter}`;
}

/** The accelerometer figures of a minute on one line, or why there are none. */
export function featuresText(features: MinuteFeature | null): string {
  if (!features) return 'No movement reading';
  const one = (n: number) => n.toFixed(1);
  return [
    `Rhythm ${features.rhythm.toFixed(2)}`,
    `Push ${one(features.push)}`,
    `Braking ${one(features.brake)}`,
    `Speed gained ${one(features.speedGained)} m/s`,
    `Buzz ${features.buzz.toFixed(2)}`,
  ].join(' · ');
}
