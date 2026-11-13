/**
 * Floors climbed by stairs or lift, from the barometer. Air pressure falls
 * about 0.12 hPa per metre near the ground, so a floor (about 3 m) is about
 * 0.36 hPa, while the weather moves pressure at most about 0.004 m/s worth.
 * Doors and air conditioning cause short spikes; a median of 3 removes them.
 *
 * A climb starts when the height has moved 1.6 m (0.2 hPa, HotMobile 2014)
 * at 0.08 m/s or more, and ends after 20 s below 0.05 m/s. It counts from
 * 2 m: floors = round(height / 3). Stairs when there were 2 or more steps per
 * metre while it moved, otherwise a lift. Outdoors, a climb that also went
 * more than 3 times as far sideways is a hill ("Climb"), not stairs.
 */
import { type StepTimeline, stepsIn } from '@/lib/motion';
import type { PressureSample } from '@/lib/walk';

/** The same formula as Android's SensorManager.getAltitude. */
export function heightM(hpa: number): number {
  return 44330 * (1 - Math.pow(hpa / 1013.25, 1 / 5.255));
}

export const STAIRS = {
  START_M: 1.6,
  START_MS: 0.08,
  QUIET_MS: 0.05,
  END_S: 20,
  MIN_M: 2,
  FLOOR_M: 3,
  STAIRS_STEPS_PER_M: 2,
  /** A gap in the readings longer than this, with 2 m of change and no steps, was a lift. */
  GAP_S: 10,
  /** ...if it was short (weather moves under 1 m in this time) or the height moved fast enough across it. */
  GAP_MAX_S: 180,
  GAP_LIFT_MS: 0.1,
  HILL_RATIO: 3,
  /** Without steps: a lift moves at least this fast. */
  LIFT_MS: 0.5,
  SMOOTH_S: 15,
  RATE_S: 10,
} as const;

export type ClimbKind = 'stairs' | 'lift' | 'hill';

export interface Climb {
  startT: number;
  endT: number;
  /** Positive up. */
  deltaM: number;
  kind: ClimbKind;
  floors: number;
}

export interface StairsCount {
  floorsUp: number;
  floorsDown: number;
  liftUp: number;
  liftDown: number;
  /** Uphill on foot outdoors, m. */
  hillUpM: number;
  climbs: Climb[];
}

export interface StairsOptions {
  /** The walk counter, to tell stairs from a lift. */
  steps?: StepTimeline | null;
  /** Time ranges to leave out (vehicle and cycling parts). */
  exclude?: [number, number][];
  /** Sideways distance moved between two times, m; null indoors (no route). */
  horizontalM?: (a: number, b: number) => number | null;
}

const median3 = (a: number, b: number, c: number) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));

interface Row {
  t: number;
  h: number;
}

interface Run {
  /** Median of 3, then a moving average: for finding climbs. */
  smooth: Row[];
  /** Median of 3 only: for when exactly the height moved. */
  med: Row[];
}

/** Splits rows where they jump over an excluded range or a gap; median of 3, then a moving average, within each run. */
function runsOf(samples: PressureSample[], exclude: [number, number][]): Run[] {
  const rows = [...samples]
    .sort((a, b) => a.t - b.t)
    .filter((s) => !exclude.some(([a, b]) => s.t >= a && s.t <= b))
    .map((s) => ({ t: s.t, h: heightM(s.hpa) }));
  const runs: Row[][] = [];
  let run: Row[] = [];
  for (const r of rows) {
    const prev = run[run.length - 1];
    const crossesExcluded = prev && exclude.some(([a, b]) => a > prev.t && b < r.t);
    if (prev && (r.t - prev.t > STAIRS.GAP_S * 1000 || crossesExcluded)) {
      runs.push(run);
      run = [];
    }
    run.push(r);
  }
  if (run.length) runs.push(run);
  return runs.map((rs) => {
    const med = rs.map((r, i) =>
      i === 0 || i === rs.length - 1 ? r : { t: r.t, h: median3(rs[i - 1].h, r.h, rs[i + 1].h) },
    );
    const half = (STAIRS.SMOOTH_S * 1000) / 2;
    const smooth = med.map((r) => {
      let sum = 0;
      let n = 0;
      for (const q of med) {
        if (q.t < r.t - half) continue;
        if (q.t > r.t + half) break;
        sum += q.h;
        n += 1;
      }
      return { t: r.t, h: sum / n };
    });
    return { smooth, med };
  });
}

/**
 * When the height really moved within a climb: from 10% to 90% of the
 * change, on the unaveraged heights. Steps walking into and out of a lift
 * fall outside it, so they don't make the lift look like stairs.
 */
function movingSpan(med: Row[], startT: number, endT: number): [number, number] {
  const rows = med.filter((r) => r.t >= startT && r.t <= endT);
  if (rows.length < 2) return [startT, endT];
  const h0 = rows[0].h;
  const dh = rows[rows.length - 1].h - h0;
  if (dh === 0) return [startT, endT];
  const crossing = (share: number) => {
    const target = h0 + share * dh;
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1];
      const b = rows[i];
      if ((b.h - target) * Math.sign(dh) >= 0 && (a.h - target) * Math.sign(dh) < 0) {
        const f = (target - a.h) / (b.h - a.h);
        return a.t + f * (b.t - a.t);
      }
    }
    return null;
  };
  const a = crossing(0.1) ?? startT;
  const b = crossing(0.9) ?? endT;
  return b > a ? [a, b] : [startT, endT];
}

/** Vertical speed at row i over about RATE_S seconds, m/s. */
function rateAt(rows: Row[], i: number): number {
  let j = i;
  while (j > 0 && rows[i].t - rows[j].t < STAIRS.RATE_S * 1000) j--;
  const dt = (rows[i].t - rows[j].t) / 1000;
  return dt > 0 ? (rows[i].h - rows[j].h) / dt : 0;
}

export function countStairs(samples: PressureSample[] | null | undefined, opts: StairsOptions = {}): StairsCount | null {
  if (!samples?.length) return null;
  const exclude = opts.exclude ?? [];
  const runs = runsOf(samples, exclude);
  const climbs: Climb[] = [];

  const judge = (run: Run, startT: number, endT: number, deltaM: number, peakMs: number) => {
    if (Math.abs(deltaM) < STAIRS.MIN_M) return;
    const sideways = opts.horizontalM?.(startT, endT) ?? null;
    let kind: ClimbKind;
    if (sideways !== null && sideways > STAIRS.HILL_RATIO * Math.abs(deltaM)) kind = 'hill';
    else if (opts.steps) {
      // Steps per metre only while it moved (10-90% of the change).
      const [a, b] = movingSpan(run.med, startT, endT);
      const steps = stepsIn(opts.steps, a, b);
      kind = steps / (0.8 * Math.abs(deltaM)) >= STAIRS.STAIRS_STEPS_PER_M ? 'stairs' : 'lift';
    } else kind = peakMs >= STAIRS.LIFT_MS ? 'lift' : 'stairs';
    climbs.push({ startT, endT, deltaM, kind, floors: Math.round(Math.abs(deltaM) / STAIRS.FLOOR_M) });
  };

  for (let r = 0; r < runs.length; r++) {
    const run = runs[r];
    const rows = run.smooth;
    // A gap before this run (the phone slept, typically in a lift).
    if (r > 0) {
      const before = runs[r - 1].smooth;
      const prev = before[before.length - 1];
      const first = rows[0];
      const excluded = exclude.some(([a, b]) => b >= prev.t && a <= first.t);
      const gapSteps = opts.steps ? stepsIn(opts.steps, prev.t, first.t) : 0;
      const gapS = (first.t - prev.t) / 1000;
      const dh = Math.abs(first.h - prev.h);
      // A long sleep (sitting still) drifts with the weather: only a quick enough change is a lift.
      const liftLike = gapS <= STAIRS.GAP_MAX_S || dh / gapS >= STAIRS.GAP_LIFT_MS;
      if (!excluded && gapS > STAIRS.GAP_S && gapSteps < 3 && dh >= STAIRS.MIN_M && liftLike) {
        climbs.push({
          startT: prev.t,
          endT: first.t,
          deltaM: first.h - prev.h,
          kind: 'lift',
          floors: Math.round(Math.abs(first.h - prev.h) / STAIRS.FLOOR_M),
        });
      }
    }

    let base = 0;
    let climbing = false;
    let startIdx = 0;
    let lastMoving = 0;
    let peak = 0;
    for (let i = 1; i < rows.length; i++) {
      const v = rateAt(rows, i);
      if (!climbing) {
        if (Math.abs(v) < STAIRS.QUIET_MS) {
          base = i;
          continue;
        }
        if (Math.abs(rows[i].h - rows[base].h) >= STAIRS.START_M && Math.abs(v) >= STAIRS.START_MS) {
          climbing = true;
          startIdx = base;
          lastMoving = i;
          peak = Math.abs(v);
        }
        continue;
      }
      if (Math.abs(v) >= STAIRS.QUIET_MS) {
        lastMoving = i;
        peak = Math.max(peak, Math.abs(v));
      } else if ((rows[i].t - rows[lastMoving].t) / 1000 >= STAIRS.END_S) {
        judge(run, rows[startIdx].t, rows[i].t, rows[i].h - rows[startIdx].h, peak);
        climbing = false;
        base = i;
      }
    }
    if (climbing) {
      const end = rows.length - 1;
      judge(run, rows[startIdx].t, rows[end].t, rows[end].h - rows[startIdx].h, peak);
    }
  }

  const result: StairsCount = { floorsUp: 0, floorsDown: 0, liftUp: 0, liftDown: 0, hillUpM: 0, climbs };
  for (const c of climbs) {
    if (c.kind === 'hill') {
      if (c.deltaM > 0) result.hillUpM += c.deltaM;
    } else if (c.kind === 'stairs') {
      if (c.deltaM > 0) result.floorsUp += c.floors;
      else result.floorsDown += c.floors;
    } else if (c.deltaM > 0) result.liftUp += c.floors;
    else result.liftDown += c.floors;
  }
  result.hillUpM = Math.round(result.hillUpM);
  return result;
}

/**
 * Height gained on a ride, m: pressure smoothed over 60 s (wind on the phone
 * at 30 km/h is worth about 0.4 hPa), counting only rises of 3 m or more.
 */
export function climbGain(samples: PressureSample[] | null | undefined, hysteresisM = 3, smoothS = 60): number | null {
  if (!samples?.length) return null;
  const rows = [...samples].sort((a, b) => a.t - b.t).map((s) => ({ t: s.t, h: heightM(s.hpa) }));
  const half = (smoothS * 1000) / 2;
  const heights: number[] = [];
  let lo = 0;
  let hi = 0;
  let sum = 0;
  for (let i = 0; i < rows.length; i++) {
    while (hi < rows.length && rows[hi].t <= rows[i].t + half) sum += rows[hi++].h;
    while (rows[lo].t < rows[i].t - half) sum -= rows[lo++].h;
    heights.push(sum / (hi - lo));
  }
  let gain = 0;
  let low = heights[0];
  let high = heights[0];
  let rising = false;
  for (const h of heights) {
    if (rising) {
      if (h > high) {
        gain += h - high;
        high = h;
      } else if (high - h >= hysteresisM) {
        rising = false;
        low = h;
      }
    } else if (h < low) {
      low = h;
    } else if (h - low >= hysteresisM) {
      rising = true;
      gain += h - low;
      high = h;
    }
  }
  return Math.round(gain);
}
