/**
 * Puts a recording together: finds the vehicle and cycling parts on the raw
 * fixes, works out the main route one stretch at a time (split at every part
 * and every indoor/outdoor switch, so a drive never joins two walking
 * stretches), adds steps, calories and stairs, and recounts the walk when the
 * person keeps or removes a part. Pure: the save code and the tests call it
 * with recorded data.
 */
import type { DistanceSource, PartChoice, StepsSource, Walk, WalkPart, WalkStretches } from '@/data/types';
import { trackStretch, type TrackResult } from '@/lib/gps';
import { estimateKcalFromSteps } from '@/lib/metrics';
import { indoorAt, liveLabel, type MotionLabel, stepDataUsable, stepSeconds, stepsIn, stepTimeline } from '@/lib/motion';
import { findParts } from '@/lib/parts';
import { climbGain, countStairs } from '@/lib/stairs';
import {
  type ActivitySample,
  distanceM,
  indoorRideKcal,
  type ModeChange,
  type PressureSample,
  type RideEffort,
  rideActiveKcal,
  type StepSample,
  stepsInWindow,
  topSpeed,
  type WalkActivity,
  walkActiveKcal,
  type WalkPoint,
  type WalkSegment,
} from '@/lib/walk';

export interface BuildInput {
  startedAt: number;
  endedAt: number;
  activity: WalkActivity;
  /** The mode the recording started in. */
  initialIndoor: boolean;
  placeId?: string | null;
  effort?: RideEffort | null;
  /** Raw fixes, as recorded. */
  points: WalkPoint[];
  /** The walk's own counter; null or empty when there's none (no permission, or iOS). */
  steps?: StepSample[] | null;
  /** Null or empty without a barometer. */
  pressure?: PressureSample[] | null;
  activities?: ActivitySample[];
  modes?: ModeChange[];
  /** The day's minute buckets over the walk, for steps when the walk counter has none. */
  buckets?: { start: number; end: number; steps: number }[] | null;
  weightKg: number;
  /** Stride for steps x stride (walkStride). */
  strideM: number;
}

/** The saved walk's own fields (id, place name, weather and updatedAt are added by the save code). */
export type BuiltWalkFields = Omit<Walk, 'id' | 'startPlace' | 'weather' | 'updatedAt'>;

export interface BuiltWalk {
  walk: BuiltWalkFields;
  parts: Omit<WalkPart, 'walkId'>[];
  /** Smoothed fixes to save and draw: main route (part null) and each part (part = its ord). */
  points: WalkPoint[];
  /** Good GPS walking, for learning the stride. */
  stride: { metres: number; steps: number } | null;
  /** The newest stretch, for "Finding GPS…" and "GPS weak" while recording. */
  last: { indoor: boolean; track: TrackResult | null } | null;
}

const byT = <T extends { t: number }>(a: T, b: T) => a.t - b.t;

/** [from, to] ranges where the mode was `indoor`. */
export function modeRanges(modes: ModeChange[], initial: boolean, from: number, to: number, indoor = true): [number, number][] {
  const ranges: [number, number][] = [];
  let current = initial;
  let since = from;
  for (const m of [...modes].sort(byT)) {
    if (m.t <= from) {
      current = m.indoor;
      continue;
    }
    if (m.t >= to) break;
    if (m.indoor !== current) {
      if (current === indoor) ranges.push([since, m.t]);
      current = m.indoor;
      since = m.t;
    }
  }
  if (current === indoor && to > since) ranges.push([since, to]);
  return ranges;
}

/** The walk minus its parts, split at every indoor/outdoor switch. */
export function mainStretches(
  startedAt: number,
  endedAt: number,
  parts: { startT: number; endT: number }[],
  modes: ModeChange[],
  initialIndoor: boolean,
): { from: number; to: number; indoor: boolean; afterPart: boolean }[] {
  const cuts = [...parts].sort((a, b) => a.startT - b.startT);
  const free: { from: number; to: number; afterPart: boolean }[] = [];
  let cursor = startedAt;
  let afterPart = false;
  for (const p of cuts) {
    if (p.startT > cursor) free.push({ from: cursor, to: p.startT, afterPart });
    cursor = Math.max(cursor, p.endT);
    afterPart = true;
  }
  if (endedAt > cursor) free.push({ from: cursor, to: endedAt, afterPart });

  const out: { from: number; to: number; indoor: boolean; afterPart: boolean }[] = [];
  for (const f of free) {
    const switches = modes.filter((m) => m.t > f.from && m.t < f.to).sort(byT);
    let a = f.from;
    let indoor = indoorAt(modes, initialIndoor, f.from);
    let first = true;
    for (const m of switches) {
      if (m.indoor === indoor) continue;
      if (m.t > a) out.push({ from: a, to: m.t, indoor, afterPart: first && f.afterPart });
      a = m.t;
      indoor = m.indoor;
      first = false;
    }
    if (f.to > a) out.push({ from: a, to: f.to, indoor, afterPart: first && f.afterPart });
  }
  return out;
}

const mergeInto = (ranges: [number, number][], add: [number, number][]) => {
  for (const r of add) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] >= r[0]) last[1] = Math.max(last[1], r[1]);
    else ranges.push([r[0], r[1]]);
  }
};

/** Walking calories for a part: from its steps (a car part's speed would read as sprinting), or by pace when slow. */
function partWalkKcal(steps: number | null, track: TrackResult, weightKg: number): number {
  const fromSteps = estimateKcalFromSteps(steps ?? 0, weightKg);
  const avg = track.movingS > 0 ? track.distanceM / track.movingS : 0;
  return avg > 0 && avg < 2.5 ? Math.max(fromSteps, walkActiveKcal(track.segments, weightKg)) : fromSteps;
}

export function buildWalk(input: BuildInput): BuiltWalk {
  const { startedAt, endedAt, activity, weightKg, strideM } = input;
  const elapsedS = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  const modes = [...(input.modes ?? [])].sort(byT);
  const points = [...input.points].filter((p) => p.t >= startedAt - 5000 && p.t <= endedAt + 5000).sort(byT);
  const activities = [...(input.activities ?? [])].sort(byT);
  const indoorRanges = modeRanges(modes, input.initialIndoor, startedAt, endedAt);
  const base = {
    startedAt,
    endedAt,
    activity,
    indoor: input.initialIndoor,
    placeId: input.placeId ?? null,
    effort: activity === 'ride' ? (input.effort ?? null) : null,
  };

  // Indoor bike: nothing to measure but time.
  if (activity === 'ride' && input.initialIndoor) {
    const effort = input.effort ?? 'steady';
    return {
      walk: {
        ...base,
        effort,
        distanceM: 0,
        movingS: elapsedS,
        steps: null,
        activeKcal: indoorRideKcal(effort, elapsedS, weightKg),
        distanceFrom: 'none',
        stepsFrom: 'none',
        floorsUp: null,
        floorsDown: null,
        liftUp: null,
        liftDown: null,
        climbM: null,
        topSpeedMs: null,
        stretches: null,
      },
      parts: [],
      points: [],
      stride: null,
      last: { indoor: true, track: null },
    };
  }

  // Fixes taken in indoor mode (one every minute, often Wi-Fi) never count.
  const outdoorFixes = points.filter((p) => !indoorAt(modes, input.initialIndoor, p.t));
  const rawTimeline = activity === 'walk' ? stepTimeline(input.steps) : null;
  const usable = rawTimeline && stepDataUsable(rawTimeline, outdoorFixes, strideM) ? rawTimeline : null;

  let stepsFrom: StepsSource;
  let stepsAt: ((a: number, b: number) => number) | null;
  if (activity === 'ride') {
    stepsFrom = 'none';
    stepsAt = null;
  } else if (usable) {
    stepsFrom = 'walk';
    stepsAt = (a, b) => stepsIn(usable, a, b);
  } else if (input.buckets?.length) {
    const buckets = input.buckets;
    stepsFrom = 'day';
    stepsAt = (a, b) => stepsInWindow(buckets, a, b);
  } else if (rawTimeline) {
    stepsFrom = 'walk';
    stepsAt = (a, b) => stepsIn(rawTimeline, a, b);
  } else {
    stepsFrom = 'none';
    stepsAt = null;
  }

  const found = findParts({
    points,
    steps: usable,
    activities,
    modes,
    initialIndoor: input.initialIndoor,
    activity,
    startedAt,
    endedAt,
  });

  const savedPoints: WalkPoint[] = [];
  const parts: Omit<WalkPart, 'walkId'>[] = found.map((f) => {
    const track = trackStretch(outdoorFixes, {
      cls: f.kind === 'vehicle' ? 'vehicle' : 'ride',
      from: f.startT,
      to: f.endT,
      warmUp: false,
    });
    for (const p of track.points) savedPoints.push({ ...p, part: f.ord });
    const steps = stepsAt ? Math.round(stepsAt(f.startT, f.endT)) : null;
    const movingS = track.movingS || Math.round((f.endT - f.startT) / 1000);
    return {
      ord: f.ord,
      startT: f.startT,
      endT: f.endT,
      kind: f.kind,
      steps,
      distanceM: track.distanceM,
      movingS,
      topSpeedMs: topSpeed(track.points) ?? f.topSpeedMs,
      kcalWalk: partWalkKcal(steps, track, weightKg),
      kcalRide: rideActiveKcal(track.distanceM, movingS, weightKg),
      choice: null,
      defaultKeep: f.defaultKeep,
    };
  });

  // The main route, a stretch at a time.
  const stretches = mainStretches(startedAt, endedAt, found, modes, input.initialIndoor);
  let routeM = 0;
  let stepM = 0;
  let movingS = 0;
  let mainSteps = 0;
  let indoorKcal = 0;
  const segments: WalkSegment[] = [];
  const weak: [number, number][] = [];
  const fromSteps: [number, number][] = [];
  let strideMetres = 0;
  let strideSteps = 0;
  let top: number | null = null;
  let last: BuiltWalk['last'] = null;
  const mainPoints: WalkPoint[] = [];

  for (let i = 0; i < stretches.length; i++) {
    const s = stretches[i];
    const stepsHere = stepsAt ? stepsAt(s.from, s.to) : 0;
    mainSteps += stepsHere;
    if (s.indoor) {
      const m = stepsHere * strideM;
      stepM += m;
      movingS += usable ? stepSeconds(usable, s.from, s.to) : (s.to - s.from) / 1000;
      indoorKcal += estimateKcalFromSteps(Math.round(stepsHere), weightKg);
      if (m > 0) mergeInto(fromSteps, [[s.from, s.to]]);
      last = { indoor: true, track: null };
      continue;
    }
    // GPS needs to settle at the start and after indoors; after a part it's already going.
    const warmUp = i === 0 ? !s.afterPart : stretches[i - 1].indoor || !s.afterPart;
    const track = trackStretch(outdoorFixes, {
      cls: activity === 'ride' ? 'ride' : 'walk',
      from: s.from,
      to: s.to,
      steps: usable,
      strideM,
      warmUp,
    });
    last = { indoor: false, track };
    if (track.distanceM === 0 && track.routeFrom === null && stepsAt && activity === 'walk') {
      // No route at all (GPS never settled), and the steps came from the day's buckets.
      const m = stepsHere * strideM;
      stepM += m;
      movingS += (s.to - s.from) / 1000;
      segments.push({ distanceM: m, seconds: (s.to - s.from) / 1000 });
      if (m > 0) mergeInto(fromSteps, [[s.from, s.to]]);
      continue;
    }
    routeM += track.gpsM;
    stepM += track.stepM;
    movingS += track.movingS;
    segments.push(...track.segments);
    mergeInto(weak, track.weak);
    mergeInto(fromSteps, track.fromSteps);
    if (track.stride) {
      strideMetres += track.stride.metres;
      strideSteps += track.stride.steps;
    }
    const t = topSpeed(track.points);
    if (t !== null && (top === null || t > top)) top = t;
    mainPoints.push(...track.points);
  }
  for (const p of mainPoints) savedPoints.push({ ...p, part: null });

  const mainDistance = Math.round(routeM + stepM);
  const mainMoving = Math.round(movingS);
  const activeKcal =
    activity === 'ride'
      ? rideActiveKcal(mainDistance, mainMoving, weightKg)
      : walkActiveKcal(segments, weightKg) + indoorKcal;

  // Stairs on foot only: parts are left out, rides get the climb instead.
  let floors: Pick<Walk, 'floorsUp' | 'floorsDown' | 'liftUp' | 'liftDown' | 'climbM'> = {
    floorsUp: null,
    floorsDown: null,
    liftUp: null,
    liftDown: null,
    climbM: null,
  };
  if (input.pressure?.length) {
    if (activity === 'ride') {
      floors = { ...floors, climbM: climbGain(input.pressure) };
    } else {
      const sorted = [...mainPoints].sort(byT);
      const count = countStairs(input.pressure, {
        steps: usable,
        exclude: found.map((p) => [p.startT, p.endT]),
        horizontalM: (a, b) => {
          if (indoorAt(modes, input.initialIndoor, a) || indoorAt(modes, input.initialIndoor, b)) return null;
          const inside = sorted.filter((p) => p.t >= a && p.t <= b);
          if (inside.length < 2) return null;
          let d = 0;
          for (let k = 1; k < inside.length; k++) d += distanceM(inside[k - 1], inside[k]);
          return d;
        },
      });
      if (count) {
        floors = {
          floorsUp: count.floorsUp,
          floorsDown: count.floorsDown,
          liftUp: count.liftUp,
          liftDown: count.liftDown,
          climbM: count.hillUpM,
        };
      }
    }
  }

  const stretchInfo: WalkStretches = {};
  if (indoorRanges.length) stretchInfo.indoor = indoorRanges;
  if (weak.length) stretchInfo.weak = weak;
  if (fromSteps.length) stretchInfo.fromSteps = fromSteps;

  let walk: BuiltWalkFields = {
    ...base,
    distanceM: mainDistance,
    movingS: mainMoving,
    steps: stepsAt ? Math.round(mainSteps) : null,
    activeKcal: Math.round(activeKcal),
    distanceFrom: 'none',
    stepsFrom,
    ...floors,
    topSpeedMs: top,
    stretches: Object.keys(stretchInfo).length ? stretchInfo : null,
  };
  // Parts that count until the person answers.
  walk = addParts(walk, parts.filter(isCounted), activity);
  const routeParts = parts.filter((p) => isCounted(p) && p.distanceM > 0);
  const routeTotal = routeM + routeParts.reduce((s, p) => s + p.distanceM, 0);
  walk.distanceFrom = distanceSource(routeTotal, stepM);
  for (const p of routeParts) if (p.topSpeedMs !== null && (walk.topSpeedMs == null || p.topSpeedMs > walk.topSpeedMs)) walk.topSpeedMs = p.topSpeedMs;

  // One fix per time: the end of one stretch can be the start of the next.
  const seen = new Set<number>();
  const pointsOut = savedPoints.sort(byT).filter((p) => (seen.has(p.t) ? false : (seen.add(p.t), true)));

  return {
    walk,
    parts,
    points: pointsOut,
    stride: strideMetres >= 200 && strideSteps > 0 ? { metres: strideMetres, steps: strideSteps } : null,
    last,
  };
}

export function distanceSource(routeM: number, stepM: number): DistanceSource {
  if (routeM > 0 && stepM > 0) return 'mixed';
  if (routeM > 0) return 'route';
  if (stepM > 0) return 'steps';
  return 'none';
}

// ---------------------------------------------------------------------------
// Keep, cycle, remove.

type PartLike = Pick<WalkPart, 'choice' | 'defaultKeep' | 'distanceM' | 'movingS' | 'steps' | 'kcalWalk' | 'kcalRide'>;

/** Counted in the walk: answered keep or cycle, or not answered and kept by default. */
export function isCounted(part: Pick<WalkPart, 'choice' | 'defaultKeep'>): boolean {
  return part.choice ? part.choice !== 'remove' : part.defaultKeep;
}

/** What a counted part adds: keep = distance, time, steps and walking kcal; cycle = distance, time and ride kcal. */
function contribution(part: PartLike, activity: WalkActivity) {
  if (!isCounted(part)) return { distanceM: 0, movingS: 0, steps: 0, activeKcal: 0 };
  const asRide = part.choice === 'cycle' || activity === 'ride';
  return {
    distanceM: part.distanceM,
    movingS: part.movingS,
    steps: asRide ? 0 : (part.steps ?? 0),
    activeKcal: asRide ? part.kcalRide : part.kcalWalk,
  };
}

function addParts<W extends Pick<Walk, 'distanceM' | 'movingS' | 'steps' | 'activeKcal'>>(
  walk: W,
  parts: PartLike[],
  activity: WalkActivity,
  sign = 1,
): W {
  let { distanceM: d, movingS: m, activeKcal: k } = walk;
  let steps = walk.steps;
  for (const p of parts) {
    const c = contribution(p, activity);
    d += sign * c.distanceM;
    m += sign * c.movingS;
    k += sign * c.activeKcal;
    if (steps !== null) steps += sign * c.steps;
  }
  return {
    ...walk,
    distanceM: Math.max(0, Math.round(d)),
    movingS: Math.max(0, Math.round(m)),
    activeKcal: Math.max(0, Math.round(k)),
    steps: steps === null ? null : Math.max(0, Math.round(steps)),
  };
}

/**
 * The walk after its parts' choices change: on foot = walk minus what the
 * parts added before, then plus what they add now. Start, end and total
 * time stay; only distance, moving time, steps and calories move, and
 * never the day's step total.
 */
export function recount<W extends Pick<Walk, 'distanceM' | 'movingS' | 'steps' | 'activeKcal' | 'activity'>>(
  walk: W,
  before: PartLike[],
  after: PartLike[],
): W {
  const activity = walk.activity ?? 'walk';
  const foot = addParts(walk, before, activity, -1);
  return addParts(foot, after, activity);
}

/** Sets one part's choice (null = back to unanswered) and recounts. */
export function applyChoice(walk: Walk, parts: WalkPart[], ord: number, choice: PartChoice | null): { walk: Walk; parts: WalkPart[] } | null {
  const target = parts.find((p) => p.ord === ord);
  if (!target) return null;
  const after = parts.map((p) => (p.ord === ord ? { ...p, choice } : p));
  return { walk: { ...recount(walk, parts, after), updatedAt: Date.now() }, parts: after };
}

/**
 * New step counts from the day's buckets for a walk whose steps came from
 * them (steps_from day or NULL): the main time plus the kept parts. Distance
 * follows only when it came from steps alone. Works on the row read inside
 * the transaction, so a keep/remove tapped meanwhile isn't overwritten.
 */
export function refreshSteps(
  walk: Walk,
  parts: WalkPart[],
  stepsAt: (a: number, b: number) => number,
  strideM: number,
  weightKg: number,
): { walk: Walk; parts: WalkPart[] } | null {
  if ((walk.activity ?? 'walk') === 'ride') return null;
  if (walk.stepsFrom && walk.stepsFrom !== 'day') return null;
  const freshParts = parts.map((p) => ({ ...p, steps: Math.round(stepsAt(p.startT, p.endT)) }));
  let mainSteps = 0;
  let cursor = walk.startedAt;
  for (const p of [...parts].sort((a, b) => a.startT - b.startT)) {
    if (p.startT > cursor) mainSteps += stepsAt(cursor, p.startT);
    cursor = Math.max(cursor, p.endT);
  }
  if (walk.endedAt > cursor) mainSteps += stepsAt(cursor, walk.endedAt);
  const counted = freshParts.filter(isCounted).filter((p) => p.choice !== 'cycle');
  const steps = Math.round(mainSteps + counted.reduce((s, p) => s + (p.steps ?? 0), 0));
  if (steps === walk.steps && freshParts.every((p, i) => p.steps === parts[i].steps)) return null;

  let next: Walk = { ...walk, steps, updatedAt: Date.now() };
  if (walk.distanceFrom === 'steps') {
    // Distance and calories came from steps: they follow the new count.
    const partsDistance = freshParts.filter(isCounted).reduce((s, p) => s + p.distanceM, 0);
    const partsKcal = freshParts.filter(isCounted).reduce((s, p) => s + (p.choice === 'cycle' ? p.kcalRide : p.kcalWalk), 0);
    next = {
      ...next,
      distanceM: Math.round(mainSteps * strideM + partsDistance),
      activeKcal: estimateKcalFromSteps(Math.round(mainSteps), weightKg) + partsKcal,
    };
  }
  return { walk: next, parts: freshParts };
}

// ---------------------------------------------------------------------------
// While recording.

export interface LiveWalk extends BuiltWalk {
  label: MotionLabel | null;
}

/** Everything the record screen shows, from the data so far. Recomputed at each poll; memoise on the data. */
export function liveWalk(input: BuildInput, now: number): LiveWalk {
  const built = buildWalk({ ...input, endedAt: now });
  const timeline = input.activity === 'walk' ? stepTimeline(input.steps) : null;
  const label =
    input.activity === 'ride' && input.initialIndoor
      ? null
      : liveLabel(
          {
            points: [...input.points].sort(byT),
            steps: timeline && stepDataUsable(timeline, input.points, input.strideM) ? timeline : null,
            activities: [...(input.activities ?? [])].sort(byT),
            modes: input.modes,
            initialIndoor: input.initialIndoor,
          },
          input.activity,
          input.startedAt,
          now,
        );
  return { ...built, label };
}

/**
 * When an interrupted recording ended: the latest of its last fix, sample,
 * AR result and the native "last alive" time. Never "now": an indoor walk
 * with no fixes would otherwise end hours later than it did.
 */
export function interruptedEnd(opts: {
  startedAt: number;
  points?: { t: number }[];
  steps?: { t: number }[] | null;
  pressure?: { t: number }[] | null;
  activities?: { t: number }[];
  lastAliveAt?: number | null;
}): number {
  let end = opts.startedAt;
  for (const list of [opts.points, opts.steps, opts.pressure, opts.activities]) {
    for (const x of list ?? []) if (x.t > end) end = x.t;
  }
  if (opts.lastAliveAt && opts.lastAliveAt > end) end = opts.lastAliveAt;
  return end;
}
