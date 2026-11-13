/**
 * What someone is doing during a recording: walking, brisk walking, running,
 * standing still, or (in a walk) maybe riding in a vehicle or on a bicycle.
 * Built from GPS speed, the walk's own step counter (cadence) and Google's
 * Activity Recognition (AR), each of which can be missing.
 *
 * Sources: Tudor-Locke 2018 cadence bands (100 steps a minute is about
 * 3 METs, about 4 km/h); the walk-run transition at about 2 m/s; phones count
 * 0-200 false steps an hour in cars (J Occup Health 2017); walking steps are
 * 0.6-0.8 m and running steps rarely over 2 m.
 */
import { ACTIVE_CADENCE, RUN_CADENCE } from '@/lib/metrics';
import {
  type ActivitySample,
  type ArType,
  distanceM,
  type ModeChange,
  type StepSample,
  type WalkActivity,
  type WalkPoint,
} from '@/lib/walk';

// ---------------------------------------------------------------------------
// Step timeline: the walk counter's cumulative rows turned into "these steps
// happened between these times".

export interface StepInterval {
  start: number;
  end: number;
  steps: number;
}

export interface StepTimeline {
  /** Ordered and not overlapping. */
  intervals: StepInterval[];
  /** First and newest step events (epoch ms). Cadence is unknown before the first. */
  first: number;
  last: number;
  total: number;
}

/** Rows come about every 5 s while walking; a longer gap means the steps arrived late, in one batch. */
const REGULAR_ROW_S = 7;
/** A late batch is spread over the seconds just before it at 120 steps a minute, never over the whole gap. */
const BATCH_STEPS_PER_S = 2;

export function stepTimeline(samples: StepSample[] | null | undefined): StepTimeline | null {
  if (!samples?.length) return null;
  const rows = [...samples].sort((a, b) => a.t - b.t);
  const intervals: StepInterval[] = [];
  if (rows[0].steps > 0) {
    const spanS = Math.max(1, rows[0].steps / BATCH_STEPS_PER_S);
    intervals.push({ start: rows[0].t - spanS * 1000, end: rows[0].t, steps: rows[0].steps });
  }
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    const steps = cur.steps - prev.steps;
    const gapS = (cur.t - prev.t) / 1000;
    if (steps <= 0 || gapS <= 0) continue;
    const spanS = gapS <= REGULAR_ROW_S ? gapS : Math.min(gapS, Math.max(REGULAR_ROW_S, steps / BATCH_STEPS_PER_S));
    intervals.push({ start: cur.t - spanS * 1000, end: cur.t, steps });
  }
  const last = rows[rows.length - 1];
  return { intervals, first: rows[0].t, last: last.t, total: Math.max(0, last.steps) };
}

/** First interval ending after `t`. */
function firstEndingAfter(intervals: StepInterval[], t: number): number {
  let lo = 0;
  let hi = intervals.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (intervals[mid].end <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Steps between `a` and `b` (epoch ms), counting the part of each interval inside. */
export function stepsIn(timeline: StepTimeline, a: number, b: number): number {
  if (b <= a) return 0;
  let steps = 0;
  for (let i = firstEndingAfter(timeline.intervals, a); i < timeline.intervals.length; i++) {
    const s = timeline.intervals[i];
    if (s.start >= b) break;
    const overlap = Math.min(s.end, b) - Math.max(s.start, a);
    if (overlap > 0) steps += (s.steps * overlap) / Math.max(1, s.end - s.start);
  }
  return steps;
}

/** Seconds between `a` and `b` when steps were being taken: moving time where there's no route. */
export function stepSeconds(timeline: StepTimeline, a: number, b: number): number {
  let ms = 0;
  for (let i = firstEndingAfter(timeline.intervals, a); i < timeline.intervals.length; i++) {
    const s = timeline.intervals[i];
    if (s.start >= b) break;
    ms += Math.max(0, Math.min(s.end, b) - Math.max(s.start, a));
  }
  return ms / 1000;
}

// ---------------------------------------------------------------------------
// Speed from fixes.

/** Doppler speeds this accurate (m/s) are used before positions. */
export const DOPPLER_MAX_ACC_MS = 1.5;
/** Positions this accurate (m) are used for displacement speed. */
const DISPLACEMENT_MAX_ACC_M = 20;

/** Index of the first fix at or after `t`. */
export function firstFixAt(points: WalkPoint[], t: number): number {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export const hasDoppler = (p: WalkPoint) =>
  p.speed != null && p.speedAcc != null && p.speedAcc <= DOPPLER_MAX_ACC_MS && p.speed >= 0;

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export interface SpeedReading {
  speed: number | null;
  /** Net displacement between the first and last precise fix, m. */
  netM: number | null;
  from: 'doppler' | 'displacement' | null;
}

/** Speed over [a, b]: median Doppler speed when the fixes carry it, else displacement of precise fixes. */
export function speedBetween(points: WalkPoint[], a: number, b: number): SpeedReading {
  const doppler: number[] = [];
  let first: WalkPoint | null = null;
  let last: WalkPoint | null = null;
  let n = 0;
  for (let i = firstFixAt(points, a); i < points.length && points[i].t <= b; i++) {
    const p = points[i];
    n += 1;
    if (hasDoppler(p)) doppler.push(p.speed!);
    if (p.acc == null || p.acc <= DISPLACEMENT_MAX_ACC_M) {
      if (!first) first = p;
      last = p;
    }
  }
  const netM = first && last && first !== last ? distanceM(first, last) : null;
  if (doppler.length >= 3 && doppler.length >= n / 2) return { speed: median(doppler), netM, from: 'doppler' };
  if (first && last && netM !== null) {
    const spanS = (last.t - first.t) / 1000;
    if (spanS >= Math.min(10, (b - a) / 2000)) return { speed: netM / spanS, netM, from: 'displacement' };
  }
  return { speed: null, netM, from: null };
}

// ---------------------------------------------------------------------------
// Windows.

export interface MotionData {
  /** Raw fixes, oldest first. */
  points: WalkPoint[];
  /** Null when the walk counter has no usable steps: cadence is then unknown and speed rules apply. */
  steps: StepTimeline | null;
  /** Oldest first. */
  activities: ActivitySample[];
  modes?: ModeChange[];
  initialIndoor?: boolean;
  /**
   * While recording, the newest steps can still be on their way (the sensor
   * batches up to 5 s, plus the poll). Cadence windows then end at the newest
   * step event, and missing steps count as zero only this much later.
   */
  live?: boolean;
}

export interface MotionWindow {
  t: number;
  seconds: number;
  /** m/s; null when there are no usable fixes (or indoors). */
  speed: number | null;
  netM: number | null;
  /** Steps a minute; null when unknown (no step data, or before the first step event). */
  cadence: number | null;
  /** AR's top activity with confidence >= 50 in the last 60 s. */
  ar: { type: ArType; conf: number } | null;
  /** How long AR has said IN_VEHICLE >= 75 without a break, up to t (s). */
  arVehicleS: number;
  /** Rides: how long the speed has stayed >= 12.5 m/s, up to t (s), in 10 s steps. */
  fastS: number;
  /** Best 10 s speed inside the window. */
  max10: number | null;
  indoor: boolean;
}

/** Live: steps this much older than now are assumed delivered. */
export const STEP_LAG_S = 15;
const AR_RECENT_S = 60;

export function indoorAt(modes: ModeChange[] | undefined, initial: boolean, t: number): boolean {
  let indoor = initial;
  for (const m of modes ?? []) {
    if (m.t > t) break;
    indoor = m.indoor;
  }
  return indoor;
}

interface ArResult {
  t: number;
  rows: { type: ArType; conf: number }[];
}

/** AR rows grouped into results (one per time), oldest first. */
export function arResults(acts: ActivitySample[]): ArResult[] {
  const out: ArResult[] = [];
  for (const a of acts) {
    const last = out[out.length - 1];
    if (last && last.t === a.t) last.rows.push({ type: a.type, conf: a.conf });
    else out.push({ t: a.t, rows: [{ type: a.type, conf: a.conf }] });
  }
  return out;
}

export function confOf(r: ArResult, type: ArType): number {
  return r.rows.reduce((m, x) => (x.type === type ? Math.max(m, x.conf) : m), 0);
}

function topOf(r: ArResult): { type: ArType; conf: number } | null {
  let best: { type: ArType; conf: number } | null = null;
  for (const x of r.rows) if (!best || x.conf > best.conf) best = x;
  return best && best.conf >= 50 ? best : null;
}

/** Last result at or before t. */
function lastResultAt(results: ArResult[], t: number): number {
  let lo = 0;
  let hi = results.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (results[mid].t <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

const cache = new WeakMap<ActivitySample[], ArResult[]>();
function resultsOf(acts: ActivitySample[]): ArResult[] {
  let r = cache.get(acts);
  if (!r) {
    r = arResults([...acts].sort((a, b) => a.t - b.t));
    cache.set(acts, r);
  }
  return r;
}

/** Cadence over [a, b], or null when unknown. */
export function cadenceBetween(data: MotionData, a: number, b: number, now?: number): number | null {
  const tl = data.steps;
  if (!tl) return null;
  let end = b;
  if (data.live && b > tl.last) end = Math.max(tl.last, Math.min(b, (now ?? b) - STEP_LAG_S * 1000));
  const start = end - (b - a);
  if (end <= tl.first) return null;
  const from = Math.max(start, tl.first);
  if (end - from < 5000) return null;
  return (stepsIn(tl, from, end) * 60_000) / (end - from);
}

/**
 * The window of `seconds` ending at t (live) or centred on it (after the
 * walk, when what came next is known too).
 */
export function windowAt(
  data: MotionData,
  t: number,
  seconds = 30,
  align: 'end' | 'center' = 'end',
  now?: number,
  /** Rides need the best 10 s and how long it stayed fast; walks skip that work. */
  ride = true,
): MotionWindow {
  const a = align === 'end' ? t - seconds * 1000 : t - (seconds * 500);
  const b = align === 'end' ? t : t + seconds * 500;
  const indoor = indoorAt(data.modes, data.initialIndoor ?? false, t);
  const reading = indoor ? { speed: null, netM: null } : speedBetween(data.points, a, b);

  let max10: number | null = null;
  if (!indoor && ride) {
    for (let s = a; s + 10_000 <= b; s += 5000) {
      const v = speedBetween(data.points, s, s + 10_000).speed;
      if (v !== null && (max10 === null || v > max10)) max10 = v;
    }
  }
  let fastS = 0;
  if (!indoor && ride) {
    for (let k = 0; k < 12; k++) {
      const v = speedBetween(data.points, b - (k + 1) * 10_000, b - k * 10_000).speed;
      if (v === null || v < RIDE_FAST_MS) break;
      fastS += 10;
    }
  }

  const results = resultsOf(data.activities);
  let ar: MotionWindow['ar'] = null;
  let arVehicleS = 0;
  const i = lastResultAt(results, b);
  if (i >= 0 && results[i].t >= b - AR_RECENT_S * 1000) {
    ar = topOf(results[i]);
    let earliest: number | null = null;
    for (let j = i; j >= 0; j--) {
      if (confOf(results[j], 'vehicle') < 75) break;
      if (j < i && results[j + 1].t - results[j].t > 30_000) break;
      earliest = results[j].t;
    }
    if (earliest !== null) arVehicleS = (b - earliest) / 1000;
  }

  return {
    t,
    seconds,
    speed: reading.speed,
    netM: reading.netM,
    cadence: cadenceBetween(data, a, b, now),
    ar,
    arVehicleS,
    fastS,
    max10,
    indoor,
  };
}

// ---------------------------------------------------------------------------
// Labels.

export type MotionLabel = 'vehicle' | 'cycling' | 'running' | 'brisk' | 'walking' | 'still' | 'riding' | 'stopped';

/** Wording for the live chip. Questions where we're guessing. */
export const MOTION_LABEL_TEXT: Record<MotionLabel, string> = {
  vehicle: 'In a vehicle?',
  cycling: 'Cycling?',
  running: 'Running',
  brisk: 'Brisk walk',
  walking: 'Walking',
  still: 'Standing still',
  riding: 'Cycling',
  stopped: 'Stopped',
};

/** m/s thresholds, named for the tests and the parts finder. */
export const MOTION = {
  /** Walks without cadence: a vehicle only from 15 km/h. */
  NO_CADENCE_VEHICLE_MS: 4.2,
  /** Held for the whole window: never on foot. */
  NEVER_ON_FOOT_MS: 6,
  BRISK_NO_CADENCE_MS: 1.17,
  WALK_NO_CADENCE_MS: 0.5,
  RUN_NO_CADENCE_MS: 2,
  STILL_MS: 0.3,
  RIDE_MOVING_MS: 1.4,
  RIDE_STOPPED_MS: 0.5,
} as const;

/** Rides: 45 km/h for a minute, or any 10 s at 55 km/h, looks like a motor vehicle. */
export const RIDE_FAST_MS = 12.5;
export const RIDE_FAST_S = 60;
export const RIDE_VERY_FAST_MS = 15.3;
/** Rides: AR IN_VEHICLE >= 75 for 2 min counts only above 35 km/h (AR often calls cycling a vehicle). */
export const RIDE_AR_VEHICLE_S = 120;
export const RIDE_AR_MIN_MS = 35 / 3.6;

/** True when the window looks like a vehicle (or bicycle) rather than feet, on a walk. */
export function looksMotorised(w: MotionWindow): boolean {
  if (w.ar?.type === 'vehicle' && w.ar.conf >= 75) return true;
  const speed = w.indoor ? null : w.speed;
  if (speed === null) return false;
  if (speed >= MOTION.NEVER_ON_FOOT_MS) return true;
  const cadence = w.cadence;
  if (cadence === null) return speed >= MOTION.NO_CADENCE_VEHICLE_MS;
  const stepLength = cadence > 0 ? (speed * 60) / cadence : Infinity;
  return (
    (speed >= 0.7 && cadence < 30 && (w.netM ?? 0) >= 40) ||
    (speed >= 2.5 && cadence < 130) ||
    (speed >= 2 && stepLength > 2.3) ||
    (speed >= 3 && stepLength > 1.9)
  );
}

/** Rides: a motor vehicle only at speeds no cyclist holds. */
export function rideLooksMotorised(w: MotionWindow): boolean {
  if (w.indoor) return false;
  if (w.fastS >= RIDE_FAST_S) return true;
  if (w.max10 !== null && w.max10 >= RIDE_VERY_FAST_MS) return true;
  return w.arVehicleS >= RIDE_AR_VEHICLE_S && (w.speed ?? 0) > RIDE_AR_MIN_MS;
}

/**
 * The label a window suggests. Every combination gives one: where the table
 * has a gap (say 25 steps a minute at 0.4 m/s), the previous label stays.
 */
export function classify(w: MotionWindow, activity: WalkActivity, prev: MotionLabel | null = null): MotionLabel {
  if (activity === 'ride') {
    if (w.indoor) return 'riding';
    if (rideLooksMotorised(w)) return 'vehicle';
    if (w.speed === null) return prev ?? 'riding';
    if (w.speed >= MOTION.RIDE_MOVING_MS) return 'riding';
    if (w.speed < MOTION.RIDE_STOPPED_MS) return 'stopped';
    return prev === 'vehicle' ? 'riding' : (prev ?? 'riding');
  }

  if (looksMotorised(w)) return w.ar?.type === 'bicycle' && w.ar.conf >= 60 ? 'cycling' : 'vehicle';
  if (w.ar?.type === 'bicycle' && w.ar.conf >= 60 && w.cadence === null && w.indoor) return 'cycling';

  const speed = w.indoor ? null : w.speed;
  const cadence = w.cadence;
  if (cadence !== null) {
    if (cadence >= RUN_CADENCE || (cadence >= 120 && (speed ?? 0) >= 2)) return 'running';
    if (cadence >= ACTIVE_CADENCE) return 'brisk';
    if (cadence >= 40) return 'walking';
    if (cadence < 20 && (speed === null || speed < MOTION.STILL_MS)) return 'still';
    return keep(prev);
  }
  if (speed !== null) {
    if (speed >= MOTION.RUN_NO_CADENCE_MS) return 'running';
    if (speed >= MOTION.BRISK_NO_CADENCE_MS) return 'brisk';
    if (speed >= MOTION.WALK_NO_CADENCE_MS) return 'walking';
    if (speed < MOTION.STILL_MS) return 'still';
    return keep(prev);
  }
  // Indoors without cadence: Activity Recognition is all there is.
  switch (w.ar?.type) {
    case 'running':
      return 'running';
    case 'walking':
    case 'foot':
      return 'walking';
    case 'still':
      return 'still';
    default:
      return keep(prev);
  }
}

/** In a gap of the table: the previous walk label, or "Walking". */
function keep(prev: MotionLabel | null): MotionLabel {
  return prev && prev !== 'riding' && prev !== 'stopped' ? prev : 'walking';
}

export interface LabelState {
  label: MotionLabel | null;
  /** A different label seen once; it takes over if the next check agrees. */
  pending: MotionLabel | null;
}

/** The label changes only after two checks in a row agree, so one odd window doesn't flip it. */
export function nextLabel(state: LabelState, candidate: MotionLabel): LabelState {
  if (state.label === null) return { label: candidate, pending: null };
  if (candidate === state.label) return { label: state.label, pending: null };
  if (candidate === state.pending) return { label: candidate, pending: null };
  return { label: state.label, pending: candidate };
}

export const LABEL_CHECK_S = 15;

/**
 * The live label: a check every 15 s from the start, each over the 30 s
 * before it. Pure, so it can be recomputed from the recorded data at every
 * poll and always gives the same answer.
 */
export function liveLabel(data: MotionData, activity: WalkActivity, startedAt: number, now: number): MotionLabel | null {
  let state: LabelState = { label: null, pending: null };
  const live = { ...data, live: true };
  for (let t = startedAt + LABEL_CHECK_S * 1000; t <= now; t += LABEL_CHECK_S * 1000) {
    state = nextLabel(state, classify(windowAt(live, t, 30, 'end', now, activity === 'ride'), activity, state.label));
  }
  return state.label;
}

/**
 * Whether the walk counter can be trusted for cadence. A sensor can exist
 * and send nothing (a battery saver holds it, or it reports late in bursts);
 * then cadence would read 0 and every stretch would look like a car. Below
 * about 30% of the steps the distance at walking speeds needs, the walk
 * falls back to the speed rules.
 */
export function stepDataUsable(timeline: StepTimeline | null, points: WalkPoint[], strideM: number): boolean {
  if (!timeline || timeline.total <= 0) return false;
  if (!points.length) return true;
  let footM = 0;
  let steps = 0;
  const start = points[0].t;
  const end = points[points.length - 1].t;
  for (let a = start; a + 30_000 <= end; a += 30_000) {
    const v = speedBetween(points, a, a + 30_000).speed;
    if (v === null || v < 0.5 || v >= 2.5) continue;
    footM += v * 30;
    steps += stepsIn(timeline, a, a + 30_000);
  }
  if (footM < 100) return true;
  return steps >= (0.3 * footM) / strideM;
}
