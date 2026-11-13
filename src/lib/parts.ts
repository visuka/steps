/**
 * Finds the stretches of a recording that weren't on foot (a walk) or
 * weren't pedalled (a ride): an auto or a car in a walk, a motorbike lift
 * in a ride. Works on the raw fixes, before any cleaning, because cleaning
 * for walking speeds would throw a car's fixes away as jumps.
 *
 * 1. 10 s slots, each judged over 30 s around it: flagged, on foot or stopped.
 * 2. Flagged runs merge across stops and gaps (traffic; Zheng 2010) until
 *    there is real walking: 30 s of 60+ steps a minute with steps no longer
 *    than 1.3 m (bumps in an auto count false steps, but long ones).
 * 3. Stopped slots are trimmed from both ends.
 * 4. A part lasts 60 s and covers 150 m, or has 60 s of AR IN_VEHICLE >= 75
 *    (indoors, AR is the only signal).
 * 5. Kind: vehicle, cycle or unsure, and whether it counts until answered.
 */
import {
  arResults,
  confOf,
  hasDoppler,
  looksMotorised,
  type MotionData,
  RIDE_AR_MIN_MS,
  RIDE_AR_VEHICLE_S,
  RIDE_FAST_MS,
  RIDE_FAST_S,
  RIDE_VERY_FAST_MS,
  speedBetween,
  type StepTimeline,
  stepsIn,
  windowAt,
} from '@/lib/motion';
import {
  type ActivitySample,
  cleanPoints,
  type ModeChange,
  VEHICLE_MAX_SPEED_MS,
  type WalkActivity,
  type WalkPoint,
  walkStats,
} from '@/lib/walk';

export type PartKind = 'vehicle' | 'cycle' | 'unsure';

/** A stretch found in a recording, before its stats are worked out. */
export interface FoundPart {
  ord: number;
  startT: number;
  endT: number;
  kind: PartKind;
  /**
   * Counted in the walk until the person answers. Walks leave a part out only
   * when it was fast (2.5 m/s and up) or AR confirmed a vehicle, so pushing a
   * stroller or a phone that miscounts in the hand isn't removed. Rides keep
   * every part until the person removes it (a fast downhill, an e-bike).
   */
  defaultKeep: boolean;
  /** Typical moving speed (m/s) and the best 10 s, for the card. */
  medianSpeedMs: number | null;
  topSpeedMs: number | null;
}

export const PARTS = {
  SLOT_S: 10,
  WINDOW_S: 30,
  MERGE_GAP_S: 120,
  MERGE_STEPS: 20,
  WALKING_RUN_S: 30,
  WALKING_CADENCE: 60,
  WALKING_STEP_M: 1.3,
  MIN_S: 60,
  MIN_M: 150,
  AR_MIN_S: 60,
  /** Walks: a part is left out by default from this typical speed. */
  LEAVE_OUT_MS: 2.5,
  /** Kind: a motor vehicle from these speeds, or this hard an acceleration. */
  VEHICLE_TOP_MS: 15.3,
  VEHICLE_P85_MS: 10,
  BIKE_P85_MS: 25 / 3.6,
  VEHICLE_ACCEL: 1.5,
} as const;

interface Slot {
  t0: number;
  t1: number;
  flagged: boolean;
  stopped: boolean;
  /** 30 s of these in a row ends a vehicle run. */
  walking: boolean;
  steps: number | null;
  /** Steps no longer than a walker's (bumps in an auto at speed make long "steps"). */
  footSteps: number | null;
  speed10: number | null;
  arVehicle75: boolean;
}

const percentile = (values: number[], p: number) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

/** 90th percentile of positive accelerations (m/s^2) over 4-6 s, from Doppler speeds. */
export function accelP90(points: WalkPoint[]): number | null {
  const withSpeed = points.filter(hasDoppler);
  const accels: number[] = [];
  let j = 0;
  for (let i = 0; i < withSpeed.length; i++) {
    while (j < withSpeed.length && withSpeed[j].t - withSpeed[i].t < 4000) j++;
    if (j >= withSpeed.length) break;
    const dt = (withSpeed[j].t - withSpeed[i].t) / 1000;
    if (dt > 6) continue;
    const a = (withSpeed[j].speed! - withSpeed[i].speed!) / dt;
    if (a > 0) accels.push(a);
  }
  return accels.length >= 5 ? percentile(accels, 0.9) : null;
}

export interface FindPartsInput {
  points: WalkPoint[];
  /** The walk counter, when usable (see stepDataUsable); null means speed rules only. */
  steps: StepTimeline | null;
  activities: ActivitySample[];
  modes: ModeChange[];
  initialIndoor: boolean;
  activity: WalkActivity;
  startedAt: number;
  endedAt: number;
}

export function findParts(input: FindPartsInput): FoundPart[] {
  const points = [...input.points].sort((a, b) => a.t - b.t);
  const acts = [...input.activities].sort((a, b) => a.t - b.t);
  const data: MotionData = {
    points,
    steps: input.steps,
    activities: acts,
    modes: input.modes,
    initialIndoor: input.initialIndoor,
  };
  const results = arResults(acts);
  const ride = input.activity === 'ride';

  const slots: Slot[] = [];
  for (let t0 = input.startedAt; t0 < input.endedAt; t0 += PARTS.SLOT_S * 1000) {
    const t1 = Math.min(input.endedAt, t0 + PARTS.SLOT_S * 1000);
    const w = windowAt(data, (t0 + t1) / 2, PARTS.WINDOW_S, 'center', undefined, ride);
    const speed10 = w.indoor ? null : speedBetween(points, t0, t1).speed;
    const steps = input.steps ? stepsIn(input.steps, t0, t1) : null;
    const stepLength = w.speed !== null && w.cadence ? (w.speed * 60) / w.cadence : null;
    slots.push({
      t0,
      t1,
      flagged: ride ? false : looksMotorised(w),
      // Only with a speed to go on: indoors, an AR-only part has none.
      stopped: w.speed !== null && w.speed < 0.5 && (w.cadence === null || w.cadence < 20),
      walking:
        w.cadence !== null &&
        w.cadence >= PARTS.WALKING_CADENCE &&
        (stepLength === null || stepLength <= PARTS.WALKING_STEP_M),
      steps,
      footSteps: steps === null ? null : stepLength !== null && stepLength > PARTS.WALKING_STEP_M ? 0 : steps,
      speed10,
      arVehicle75: w.ar?.type === 'vehicle' && w.ar.conf >= 75,
    });
  }
  if (ride) flagRide(slots, data);

  const runs = mergeRuns(slots, ride, input.steps !== null);
  const parts: FoundPart[] = [];
  for (const [i, j] of runs) {
    const startT = slots[i].t0;
    const endT = slots[j].t1;
    const durationS = (endT - startT) / 1000;
    if (durationS < PARTS.MIN_S) continue;
    const fixes = points.filter((p) => p.t >= startT && p.t <= endT);
    const metres = walkStats(cleanPoints(fixes, VEHICLE_MAX_SPEED_MS), 1).distanceM;
    const inPart = results.filter((r) => r.t >= startT && r.t <= endT);
    const arVehicleS = inPart.filter((r) => confOf(r, 'vehicle') >= 75).length * 10;
    if (!(metres >= PARTS.MIN_M || arVehicleS >= PARTS.AR_MIN_S)) continue;

    const speeds = slots
      .slice(i, j + 1)
      .map((s) => s.speed10)
      .filter((v): v is number => v !== null);
    const moving = speeds.filter((v) => v >= 0.5);
    const top = speeds.length ? Math.max(...speeds) : null;
    const p85 = percentile(moving.length ? moving : speeds, 0.85);
    const medianSpeed = percentile(moving.length ? moving : speeds, 0.5);
    const accel = accelP90(fixes);

    // Mostly: more than half of the results that name a way of moving.
    const tops = inPart
      .map((r) => r.rows.reduce((b, x) => (x.conf > b.conf ? x : b), { type: 'unknown' as string, conf: 0 }))
      .filter((x) => x.conf >= 50 && x.type !== 'still' && x.type !== 'tilting' && x.type !== 'unknown');
    const share = (type: string) => (tops.length ? tops.filter((x) => x.type === type).length / tops.length : 0);
    const arVehicle = share('vehicle') > 0.5;
    const arBike = share('bicycle') > 0.5;

    let kind: PartKind;
    if (ride) kind = 'vehicle';
    else if ((top ?? 0) >= PARTS.VEHICLE_TOP_MS || (p85 ?? 0) >= PARTS.VEHICLE_P85_MS || (accel ?? 0) > PARTS.VEHICLE_ACCEL) {
      kind = 'vehicle';
    } else if (arVehicle) {
      // AR often calls cycling a vehicle; at bike speeds with gentle starts, ask.
      kind = p85 !== null && p85 <= PARTS.BIKE_P85_MS ? 'unsure' : 'vehicle';
    } else if (arBike) kind = 'cycle';
    else kind = 'unsure';

    const confirmedVehicle = arVehicleS >= PARTS.AR_MIN_S;
    const defaultKeep = ride || !((medianSpeed ?? 0) >= PARTS.LEAVE_OUT_MS || confirmedVehicle);

    parts.push({
      ord: parts.length,
      startT,
      endT,
      kind,
      defaultKeep,
      medianSpeedMs: medianSpeed,
      topSpeedMs: top,
    });
  }
  return parts;
}

/** Rides: a vehicle only at speeds no cyclist holds (45 km/h for a minute, 55 km/h for 10 s, or AR plus 35 km/h for 2 min). */
function flagRide(slots: Slot[], data: MotionData) {
  const n = slots.length;
  const fastNeeded = RIDE_FAST_S / PARTS.SLOT_S;
  for (let i = 0; i < n; ) {
    if ((slots[i].speed10 ?? 0) < RIDE_FAST_MS) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < n && (slots[j + 1].speed10 ?? 0) >= RIDE_FAST_MS) j++;
    if (j - i + 1 >= fastNeeded) for (let k = i; k <= j; k++) slots[k].flagged = true;
    i = j + 1;
  }
  for (const s of slots) if ((s.speed10 ?? 0) >= RIDE_VERY_FAST_MS) s.flagged = true;
  const arNeeded = RIDE_AR_VEHICLE_S / PARTS.SLOT_S;
  for (let i = 0; i < n; ) {
    if (!slots[i].arVehicle75) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < n && slots[j + 1].arVehicle75) j++;
    if (j - i + 1 >= arNeeded) {
      for (let k = i; k <= j; k++) {
        const v = speedBetween(data.points, slots[k].t0 - 10_000, slots[k].t1 + 10_000).speed;
        if ((v ?? 0) > RIDE_AR_MIN_MS) slots[k].flagged = true;
      }
    }
    i = j + 1;
  }
}

/** Flagged runs as [first slot, last slot], merged across stops and short gaps. */
function mergeRuns(slots: Slot[], ride: boolean, haveSteps: boolean): [number, number][] {
  const runs: [number, number][] = [];
  const walkingSlotsNeeded = PARTS.WALKING_RUN_S / PARTS.SLOT_S;
  let i = 0;
  while (i < slots.length) {
    if (!slots[i].flagged) {
      i++;
      continue;
    }
    let end = i;
    let j = i + 1;
    while (j < slots.length) {
      if (slots[j].flagged) {
        end = j;
        j++;
        continue;
      }
      let k = j;
      while (k < slots.length && !slots[k].flagged) k++;
      if (k >= slots.length) break;
      const gap = slots.slice(j, k);
      const gapS = gap.length * PARTS.SLOT_S;
      let realWalking = false;
      let inRow = 0;
      for (const s of gap) {
        inRow = s.walking ? inRow + 1 : 0;
        if (inRow >= walkingSlotsNeeded) realWalking = true;
      }
      const gapSteps = haveSteps ? gap.reduce((sum, s) => sum + (s.footSteps ?? 0), 0) : null;
      const merge = ride
        ? gapS <= PARTS.MERGE_GAP_S
        : !realWalking && ((gapSteps !== null && gapSteps < PARTS.MERGE_STEPS) || gapS <= PARTS.MERGE_GAP_S);
      if (!merge) break;
      end = k;
      j = k + 1;
    }
    // Trim stopped slots at both ends (the ends are flagged, but can be standing at the kerb).
    let a = i;
    let b = end;
    while (a < b && slots[a].stopped) a++;
    while (b > a && slots[b].stopped) b--;
    runs.push([a, b]);
    i = end + 1;
  }
  return runs;
}
