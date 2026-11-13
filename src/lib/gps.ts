/**
 * From raw GPS fixes to a route people can trust. Phones under trees and
 * between buildings report fixes 10-40 m off, sometimes zig-zagging across a
 * road, and keep "moving" while someone stands still. In order:
 *
 * 1. Warm-up: the route starts after two fixes in a row within 20 m (or after
 *    45 s, from the best fix so far). Earlier fixes are kept, not counted.
 * 2. Gate: fixes over 25 m are dropped (30 m only when nothing better came
 *    for 20 s), and so are jumps faster than the activity allows.
 * 3. Standing still: no steps for 10 s and under 0.5 m/s freezes the position.
 * 4. Smoothing: a 2-D Kalman filter (each fix's accuracy as its noise, the
 *    speed as the process noise), run forwards and back, so it doesn't lag.
 * 5. Cross-check: minute by minute, where GPS was poor and its distance is
 *    more than 35% away from steps x stride, the steps decide.
 *
 * Every step is a pure function, so tests can feed recorded-style tracks.
 */
import type { Profile } from '@/data/types';
import { firstFixAt, hasDoppler, stepSeconds, stepsIn, type StepTimeline } from '@/lib/motion';
import { distanceM, type WalkPoint, type WalkSegment } from '@/lib/walk';

export type GpsClass = 'walk' | 'ride' | 'vehicle';

export const GPS = {
  WARMUP_ACC_M: 20,
  WARMUP_MAX_S: 45,
  GATE_ACC_M: 25,
  FALLBACK_ACC_M: 30,
  FALLBACK_AFTER_S: 20,
  /** Jump limits between fixes, m/s. */
  WALK_MS: 3.5,
  RUN_MS: 7,
  RIDE_MS: 20,
  VEHICLE_MS: 60,
  STILL_NO_STEPS_S: 10,
  STILL_MS: 0.5,
  /** "Good" GPS: the median accuracy of a stretch at or under this. */
  GOOD_ACC_M: 10,
  CROSS_CHECK: 0.35,
  WINDOW_S: 60,
} as const;

const MOVING_MS: Record<GpsClass, number> = { walk: 0.5, ride: 1, vehicle: 1 };
/** Process noise (m/s) when a fix carries no Doppler speed, and the least it can be. */
const PROCESS_MS: Record<GpsClass, number> = { walk: 1.75, ride: 5, vehicle: 12 };
const MIN_PROCESS_MS: Record<GpsClass, number> = { walk: 0.8, ride: 1.5, vehicle: 3 };

const median = (values: number[]) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---------------------------------------------------------------------------
// 1. Warm-up.

/** Index of the fix the route starts at, or null while still finding GPS. */
export function warmUpIndex(points: WalkPoint[]): number | null {
  if (!points.length) return null;
  const t0 = points[0].t;
  const good = (p: WalkPoint) => p.acc == null || p.acc <= GPS.WARMUP_ACC_M;
  let best = -1;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.t - t0 > GPS.WARMUP_MAX_S * 1000) {
      // 45 s without two good fixes in a row: start from the best one so far,
      // or the first usable one after it.
      if (best >= 0 && (points[best].acc ?? 0) <= GPS.FALLBACK_ACC_M) return best;
      for (let j = i; j < points.length; j++) if ((points[j].acc ?? 0) <= GPS.FALLBACK_ACC_M) return j;
      return null;
    }
    if (good(p) && i + 1 < points.length && good(points[i + 1]) && points[i + 1].t - t0 <= GPS.WARMUP_MAX_S * 1000) {
      return i;
    }
    if (best < 0 || (p.acc ?? 0) < (points[best].acc ?? 0)) best = i;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 2. Gate.

/**
 * Drops imprecise fixes and jumps, oldest first. A jump is measured from the
 * last kept fix, with half the two accuracies as slack. If the fixes keep
 * disagreeing with it for 20 s (or are clearly more precise), it was the
 * kept fix that was wrong, and the route carries on from them.
 */
export function gateFixes(points: WalkPoint[], limitAt: (t: number) => number): WalkPoint[] {
  const kept: WalkPoint[] = [];
  let chain: WalkPoint[] = [];
  let lastPreciseT = points.length ? points[0].t : 0;
  const fits = (a: WalkPoint, b: WalkPoint) => {
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) return false;
    const slack = ((a.acc ?? 10) + (b.acc ?? 10)) / 2;
    return distanceM(a, b) <= limitAt(b.t) * dt + slack;
  };
  for (const p of points) {
    if (p.acc != null && p.acc > GPS.FALLBACK_ACC_M) continue;
    if (p.acc != null && p.acc > GPS.GATE_ACC_M) {
      if (p.t - lastPreciseT < GPS.FALLBACK_AFTER_S * 1000) continue;
    } else {
      lastPreciseT = p.t;
    }
    const last = kept[kept.length - 1];
    if (!last || fits(last, p)) {
      kept.push(p);
      chain = [];
      continue;
    }
    if (chain.length && fits(chain[chain.length - 1], p)) chain.push(p);
    else chain = [p];
    const chainS = (chain[chain.length - 1].t - chain[0].t) / 1000;
    const chainAcc = median(chain.map((c) => c.acc ?? 10)) ?? 10;
    const anchorBad = chain.length >= 3 && (last.acc ?? 10) >= 2 * chainAcc;
    if (chainS >= 20 || anchorBad) {
      kept.push(...chain);
      chain = [];
    }
  }
  return kept;
}

/** Jump limit at a time: walking pace unless the steps say running (or there are no steps to tell). */
export function speedLimitFor(cls: GpsClass, steps: StepTimeline | null): (t: number) => number {
  if (cls === 'ride') return () => GPS.RIDE_MS;
  if (cls === 'vehicle') return () => GPS.VEHICLE_MS;
  if (!steps) return () => GPS.RUN_MS;
  return (t) => {
    if (t < steps.first) return GPS.RUN_MS;
    const cadence = stepsIn(steps, t - 15_000, t + 15_000) * 2;
    return cadence < 120 ? GPS.WALK_MS : GPS.RUN_MS;
  };
}

// ---------------------------------------------------------------------------
// 3. Standing still.

function dopplerIn(points: WalkPoint[], a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = firstFixAt(points, a); i < points.length && points[i].t <= b; i++) {
    if (hasDoppler(points[i])) out.push(points[i].speed!);
  }
  return out;
}

/** Displacement speed over [a, b] beyond what the two fixes' accuracy explains, or null with too little to go on. */
function slowSpeed(points: WalkPoint[], a: number, b: number): number | null {
  const i = firstFixAt(points, a);
  let j = i;
  while (j + 1 < points.length && points[j + 1].t <= b) j += 1;
  if (i >= points.length || j <= i) return null;
  const spanS = (points[j].t - points[i].t) / 1000;
  if (spanS < 8) return null;
  const slack = ((points[i].acc ?? 10) + (points[j].acc ?? 10)) / 2;
  return Math.max(0, distanceM(points[i], points[j]) - slack) / spanS;
}

/** Whether the person is standing still at fix i (looking only at the past, so it works live too). */
export function stillAt(points: WalkPoint[], i: number, cls: GpsClass, steps: StepTimeline | null): boolean {
  const t = points[i].t;
  const doppler = dopplerIn(points, t - GPS.STILL_NO_STEPS_S * 1000, t);
  const dopplerKnown = doppler.length >= 3;
  if (cls === 'walk' && steps) {
    if (stepsIn(steps, t - GPS.STILL_NO_STEPS_S * 1000, t) >= 1) return false;
    if (dopplerKnown) return (median(doppler) ?? 0) < GPS.STILL_MS;
    const v = slowSpeed(points, t - 20_000, t);
    return v !== null && v < GPS.STILL_MS;
  }
  if (dopplerKnown) return (median(doppler) ?? 0) < (cls === 'walk' ? 0.3 : GPS.STILL_MS);
  if (cls === 'walk') return false;
  const v = slowSpeed(points, t - 20_000, t);
  return v !== null && v < GPS.STILL_MS;
}

/** Stays without steps to tell: every fix for 45 s or more within 20 m of the first (anyone walking leaves it). */
export const STAY = { RADIUS_M: 20, MIN_S: 45 } as const;

/** Index ranges [first, last] of the fixes that stayed in one spot. */
export function stayRanges(points: WalkPoint[]): [number, number][] {
  const ranges: [number, number][] = [];
  let i = 0;
  while (i < points.length) {
    let j = i + 1;
    while (j < points.length && distanceM(points[i], points[j]) <= STAY.RADIUS_M) j++;
    if (points[j - 1].t - points[i].t >= STAY.MIN_S * 1000) {
      ranges.push([i, j - 1]);
      i = j;
    } else {
      i++;
    }
  }
  return ranges;
}

/**
 * Keeps the first fix of each stop and drops the rest, so standing still
 * adds no distance and draws nothing. With a step counter: no steps for 10 s
 * and under 0.5 m/s. Without one: the Doppler speed, or for walks, staying
 * within 20 m for 45 s.
 */
export function dropStill(points: WalkPoint[], cls: GpsClass, steps: StepTimeline | null): WalkPoint[] {
  const stay = new Uint8Array(points.length);
  if (cls === 'walk' && !steps) {
    for (const [a, b] of stayRanges(points)) for (let k = a + 1; k <= b; k++) stay[k] = 1;
  }
  const out: WalkPoint[] = [];
  let wasStill = false;
  for (let i = 0; i < points.length; i++) {
    if (stay[i]) {
      wasStill = true;
      continue;
    }
    const still = stillAt(points, i, cls, steps);
    if (!still || !wasStill) out.push(points[i]);
    wasStill = still;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. Smoothing.

const EARTH_RADIUS_M = 6_371_000;

/**
 * Kalman filter on position (east, north metres), forwards then backwards
 * (Rauch-Tung-Striebel), so the smoothed track doesn't lag behind corners.
 * Measurement noise: the fix's accuracy (a 68% radius, so sigma = acc / 1.51).
 * Process noise: how far the person could have gone since the last fix.
 */
export function smoothTrack(points: WalkPoint[], cls: GpsClass): WalkPoint[] {
  const n = points.length;
  if (n < 3) return points.map((p) => ({ ...p }));
  const lat0 = points[0].lat;
  const lon0 = points[0].lon;
  const ky = (Math.PI / 180) * EARTH_RADIUS_M;
  const kx = ky * Math.cos((lat0 * Math.PI) / 180);
  const zx = points.map((p) => (p.lon - lon0) * kx);
  const zy = points.map((p) => (p.lat - lat0) * ky);
  const r = points.map((p) => (Math.max(3, p.acc ?? 10) / 1.51) ** 2);

  const xf = new Float64Array(n);
  const yf = new Float64Array(n);
  const pf = new Float64Array(n);
  const pp = new Float64Array(n);
  xf[0] = zx[0];
  yf[0] = zy[0];
  pf[0] = r[0];
  pp[0] = r[0];
  for (let k = 1; k < n; k++) {
    const dt = Math.max(0.1, (points[k].t - points[k - 1].t) / 1000);
    const p = points[k];
    const v = hasDoppler(p) ? Math.max(MIN_PROCESS_MS[cls], p.speed! + 0.5) : PROCESS_MS[cls];
    pp[k] = pf[k - 1] + (v * dt) ** 2;
    const gain = pp[k] / (pp[k] + r[k]);
    xf[k] = xf[k - 1] + gain * (zx[k] - xf[k - 1]);
    yf[k] = yf[k - 1] + gain * (zy[k] - yf[k - 1]);
    pf[k] = (1 - gain) * pp[k];
  }
  const xs = Float64Array.from(xf);
  const ys = Float64Array.from(yf);
  for (let k = n - 2; k >= 0; k--) {
    const c = pf[k] / pp[k + 1];
    xs[k] = xf[k] + c * (xs[k + 1] - xf[k]);
    ys[k] = yf[k] + c * (ys[k + 1] - yf[k]);
  }
  return points.map((p, k) => ({ ...p, lat: lat0 + ys[k] / ky, lon: lon0 + xs[k] / kx }));
}

// ---------------------------------------------------------------------------
// Measuring.

export interface TimedSegment {
  t0: number;
  t1: number;
  distanceM: number;
}

/** Path length of a smoothed track, adding only moves larger than what's left of the noise. */
export function measureTrack(points: WalkPoint[]): TimedSegment[] {
  const segments: TimedSegment[] = [];
  let anchor = points[0];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const d = distanceM(anchor, p);
    const threshold = Math.max(3, ((anchor.acc ?? 10) + (p.acc ?? 10)) / 6);
    if (d < threshold) continue;
    segments.push({ t0: anchor.t, t1: p.t, distanceM: d });
    anchor = p;
  }
  return segments;
}

/**
 * Distance and moving seconds of the segments inside [a, b], counting a
 * straddling segment by its share of time. Segments are in time order and
 * windows come in order, so `from` lets each call start where the last left off.
 */
function segmentsIn(segments: TimedSegment[], a: number, b: number, movingMs: number, from = 0) {
  let metres = 0;
  let moving = 0;
  let next = from;
  for (let i = from; i < segments.length; i++) {
    const s = segments[i];
    if (s.t0 >= b) break;
    if (s.t1 <= a) {
      next = i + 1;
      continue;
    }
    const span = s.t1 - s.t0;
    const share = span > 0 ? (Math.min(s.t1, b) - Math.max(s.t0, a)) / span : 1;
    const d = s.distanceM * share;
    const secs = (span / 1000) * share;
    metres += d;
    moving += secs > 0 && d / secs >= movingMs ? secs : d / (movingMs > 0.5 ? 4 : 1.3);
  }
  return { metres, moving, next };
}

const mergeRange = (ranges: [number, number][], a: number, b: number) => {
  const last = ranges[ranges.length - 1];
  if (last && last[1] >= a) last[1] = Math.max(last[1], b);
  else ranges.push([a, b]);
};

// ---------------------------------------------------------------------------
// 5. A stretch of route, cross-checked with steps.

export interface TrackOptions {
  cls: GpsClass;
  from: number;
  to: number;
  /** A usable walk step counter: freezes standing still, sets the jump limit and cross-checks distance. */
  steps?: StepTimeline | null;
  strideM?: number;
  /** The stretch starts with a GPS warm-up (start of the walk, or just outside after indoors). Default true. */
  warmUp?: boolean;
}

export interface TrackResult {
  /** Smoothed, standing-still removed: what the map draws. */
  points: WalkPoint[];
  distanceM: number;
  movingS: number;
  /** One per minute, for calories by pace. */
  segments: WalkSegment[];
  /** When the route started (after the warm-up); null if GPS never settled. */
  routeFrom: number | null;
  gpsM: number;
  stepM: number;
  /** Where the distance came from steps instead ("estimated from steps"). */
  fromSteps: [number, number][];
  /** Where GPS was weak ("GPS was weak here"). */
  weak: [number, number][];
  /** Good GPS walking for learning the person's stride: metres and steps. */
  stride: { metres: number; steps: number } | null;
}

export function trackStretch(raw: WalkPoint[], opts: TrackOptions): TrackResult {
  const { cls, from, to } = opts;
  const steps = cls === 'walk' ? (opts.steps ?? null) : null;
  const stride = opts.strideM ?? 0.7;
  const fixes = raw.filter((p) => p.t >= from && p.t <= to).sort((a, b) => a.t - b.t);
  const start = opts.warmUp === false ? (fixes.length ? 0 : null) : warmUpIndex(fixes);
  const routeFrom = start === null ? null : fixes[start].t;
  const considered = start === null ? [] : fixes.slice(start);
  const gated = gateFixes(considered, speedLimitFor(cls, steps));
  const moving = dropStill(gated, cls, steps);
  const smoothed = smoothTrack(moving, cls);
  const timed = smoothed.length >= 2 ? measureTrack(smoothed) : [];

  const fromSteps: [number, number][] = [];
  const weak: [number, number][] = [];
  const segments: WalkSegment[] = [];
  let gpsM = 0;
  let stepM = 0;
  let movingS = 0;
  let strideMetres = 0;
  let strideSteps = 0;

  // Before the route starts ("Finding GPS…"): steps, when there are steps.
  const routeStart = routeFrom ?? to;
  if (steps && routeStart - from >= 1000) {
    const m = stepsIn(steps, from, routeStart) * stride;
    const s = stepSeconds(steps, from, routeStart);
    if (m > 0) {
      stepM += m;
      movingS += s;
      segments.push({ distanceM: m, seconds: s });
      mergeRange(fromSteps, from, routeStart);
    }
  }

  let cursor = 0;
  for (let a = routeStart; a < to; ) {
    let b = Math.min(to, a + GPS.WINDOW_S * 1000);
    if (to - b < (GPS.WINDOW_S * 1000) / 2) b = to;
    const { metres, moving: movingW, next } = segmentsIn(timed, a, b, MOVING_MS[cls], cursor);
    cursor = next;

    const rawIn = considered.slice(firstFixAt(considered, a), firstFixAt(considered, b));
    const keptIn = gated.slice(firstFixAt(gated, a), firstFixAt(gated, b));
    const accs = rawIn.map((p) => p.acc).filter((x): x is number => x != null);
    const medianAcc = median(accs) ?? 5;
    const withDoppler = keptIn.filter(hasDoppler);
    let dopplerM = 0;
    for (let i = 0; i < keptIn.length; i++) {
      const p = keptIn[i];
      if (!hasDoppler(p)) continue;
      const next = keptIn[i + 1];
      dopplerM += p.speed! * Math.min(5, next ? (next.t - p.t) / 1000 : 2);
    }
    const dopplerKnown = keptIn.length >= 5 && withDoppler.length >= 0.7 * keptIn.length;
    const minutes = (b - a) / 60_000;
    const stepsW = steps ? stepsIn(steps, a, b) : null;
    const stepMW = stepsW !== null ? stepsW * stride : 0;
    const cadence = stepsW !== null && minutes > 0 ? stepsW / minutes : null;

    const dropped = rawIn.length >= 5 ? 1 - keptIn.length / rawIn.length : 0;
    const poor =
      keptIn.length === 0 ||
      medianAcc > GPS.GOOD_ACC_M ||
      dropped > 0.25 ||
      (dopplerKnown && metres > 1.4 * dopplerM + 10) ||
      (stepsW !== null && stepsW > 10 && (cadence ?? 0) < 140 && metres > 1.6 * stepMW) ||
      // Walking steadily but GPS barely moved: loops too small for its accuracy, or stuck fixes.
      (cadence !== null && cadence >= 60 && metres < 0.3 * stepMW);
    const substitute =
      stepsW !== null &&
      poor &&
      (cadence ?? 0) < 140 &&
      Math.max(metres, stepMW) >= 20 &&
      Math.abs(metres - stepMW) > GPS.CROSS_CHECK * Math.max(stepMW, 1);

    if (substitute) {
      const s = stepSeconds(steps!, a, b);
      stepM += stepMW;
      movingS += s;
      segments.push({ distanceM: stepMW, seconds: s });
      mergeRange(fromSteps, a, b);
      mergeRange(weak, a, b);
    } else {
      gpsM += metres;
      movingS += movingW;
      if (metres > 0) segments.push({ distanceM: metres, seconds: movingW });
      if (keptIn.length === 0 || medianAcc > 20 || dropped > 0.4) mergeRange(weak, a, b);
      if (stepsW !== null && !poor && medianAcc <= GPS.GOOD_ACC_M && cadence !== null && cadence >= 90 && cadence <= 130) {
        strideMetres += metres;
        strideSteps += stepsW;
      }
    }
    a = b;
  }

  return {
    points: smoothed,
    distanceM: Math.round(gpsM + stepM),
    movingS: Math.round(movingS),
    segments,
    routeFrom,
    gpsM: Math.round(gpsM),
    stepM: Math.round(stepM),
    fromSteps,
    weak,
    stride: strideMetres >= 200 && strideSteps > 0 ? { metres: strideMetres, steps: strideSteps } : null,
  };
}

// ---------------------------------------------------------------------------
// The person's stride, learned from good GPS walking.

export interface LearnedStride {
  strideM: number;
  /** Metres of good walking it was learned from. */
  metres: number;
}

/** Folds a walk's good stretches into the learned stride; recent walks count as much as up to 5 km of older ones. */
export function learnStride(prev: LearnedStride | null, sample: { metres: number; steps: number } | null): LearnedStride | null {
  if (!sample || sample.metres < 200 || sample.steps <= 0) return prev;
  const s = sample.metres / sample.steps;
  // Outside walking strides: something else was going on.
  if (s < 0.4 || s > 1.1) return prev;
  if (!prev) return { strideM: s, metres: sample.metres };
  const weight = Math.min(prev.metres, 5000);
  return {
    strideM: (prev.strideM * weight + s * sample.metres) / (weight + sample.metres),
    metres: prev.metres + sample.metres,
  };
}

/** The stride for step distance on walks: the person's own setting, else learned (from 400 m of good walking), else from height. */
export function walkStride(profile: Pick<Profile, 'strideM'>, heightStrideM: number, learned: LearnedStride | null): number {
  if (profile.strideM && profile.strideM > 0) return profile.strideM;
  if (learned && learned.metres >= 400) return Math.round(learned.strideM * 100) / 100;
  return heightStrideM;
}

/** "Finding GPS…" while the route hasn't started; "weak" when the newest minute was weak. */
export type GpsState = 'off' | 'finding' | 'ok' | 'weak';

export function gpsState(track: TrackResult | null, now: number, indoor: boolean): GpsState {
  if (indoor || !track) return 'off';
  if (track.routeFrom === null) return 'finding';
  const lastWeak = track.weak[track.weak.length - 1];
  return lastWeak && lastWeak[1] >= now - 5000 ? 'weak' : 'ok';
}
