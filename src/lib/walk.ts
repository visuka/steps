/**
 * Route maths for recorded walks. Phones report a GPS fix every couple of
 * seconds with 5–30 m of error, so fixes are filtered and only movement
 * larger than that error is added up; otherwise standing still at a crossing
 * would slowly "walk" the route.
 */

export interface WalkPoint {
  /** Epoch ms. */
  t: number;
  lat: number;
  lon: number;
  /** Horizontal accuracy in metres, when the phone reports it. */
  acc: number | null;
  /** Doppler speed from the GPS chip, m/s, when the phone reports it. */
  speed?: number | null;
  /** Accuracy of `speed`, m/s. */
  speedAcc?: number | null;
  /** Height reported with the fix, m. */
  alt?: number | null;
  /** Saved walks: the part (vehicle or cycling stretch) this fix belongs to, by its ord; null or absent on the main route. */
  part?: number | null;
}

/** A recording is a walk (which may include running) or a cycle ride. */
export type WalkActivity = 'walk' | 'ride';

/** The walk's own step counter: steps since the walk started, cumulative, at a time. */
export interface StepSample {
  t: number;
  steps: number;
}

/** Air pressure (hPa), averaged over a few seconds. */
export interface PressureSample {
  t: number;
  hpa: number;
}

/** Google's Activity Recognition: one row per activity and result, confidence 0-100. */
export type ArType = 'vehicle' | 'bicycle' | 'foot' | 'walking' | 'running' | 'still' | 'tilting' | 'unknown';

export interface ActivitySample {
  t: number;
  type: ArType;
  conf: number;
}

/** A switch between indoor (steps only, no route) and outdoor recording. */
export interface ModeChange {
  t: number;
  indoor: boolean;
}

export interface WalkSegment {
  distanceM: number;
  seconds: number;
}

export interface WalkStats {
  distanceM: number;
  /** Time spent actually moving, so a stop at a tea stall doesn't slow the pace. */
  movingS: number;
  segments: WalkSegment[];
}

const EARTH_RADIUS_M = 6_371_000;
/** Fixes less precise than this are dropped. */
export const MAX_ACCURACY_M = 30;
/** Faster than a sprint between two fixes means one of them jumped. */
const MAX_SPEED_MS = 7;
/** Jump limits and "moving" speeds for rides and cycling parts, and for vehicle parts. */
export const RIDE_MAX_SPEED_MS = 20;
export const RIDE_MOVING_SPEED_MS = 1;
export const VEHICLE_MAX_SPEED_MS = 60;
/** Smallest movement counted, even with very precise fixes. */
const MIN_MOVE_M = 5;
/** Below this a segment was mostly standing; only the time needed to cover it at a normal pace counts as moving. */
const MOVING_SPEED_MS = 0.5;
const TYPICAL_WALK_MS = 1.3;
const TYPICAL_RIDE_MS = 4;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(a: Pick<WalkPoint, 'lat' | 'lon'>, b: Pick<WalkPoint, 'lat' | 'lon'>): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Drops imprecise fixes and jumps, oldest first. `maxSpeedMs`: 7 on foot, 20 for rides, 60 for vehicle parts. */
export function cleanPoints(points: WalkPoint[], maxSpeedMs = MAX_SPEED_MS): WalkPoint[] {
  const kept: WalkPoint[] = [];
  for (const p of [...points].sort((a, b) => a.t - b.t)) {
    if (p.acc != null && p.acc > MAX_ACCURACY_M) continue;
    const last = kept[kept.length - 1];
    if (last) {
      const dt = (p.t - last.t) / 1000;
      if (dt <= 0 || distanceM(last, p) / dt > maxSpeedMs) continue;
    }
    kept.push(p);
  }
  return kept;
}

/** Distance and moving time of cleaned points. `movingSpeedMs`: 0.5 on foot, 1 for rides. */
export function walkStats(points: WalkPoint[], movingSpeedMs = MOVING_SPEED_MS): WalkStats {
  const segments: WalkSegment[] = [];
  let anchor = points[0];
  for (const p of points.slice(1)) {
    const d = distanceM(anchor, p);
    const threshold = Math.max(MIN_MOVE_M, ((anchor.acc ?? 10) + (p.acc ?? 10)) / 4);
    if (d < threshold) continue;
    segments.push({ distanceM: d, seconds: (p.t - anchor.t) / 1000 });
    anchor = p;
  }
  let distance = 0;
  let moving = 0;
  for (const s of segments) {
    distance += s.distanceM;
    moving += movingSeconds(s, movingSpeedMs);
  }
  return { distanceM: Math.round(distance), movingS: Math.round(moving), segments };
}

function movingSeconds(s: WalkSegment, movingSpeedMs = MOVING_SPEED_MS): number {
  if (s.seconds <= 0) return 0;
  // Slower than "moving": only the time needed to cover it at an easy pace for the activity counts.
  const typical = movingSpeedMs > MOVING_SPEED_MS ? TYPICAL_RIDE_MS : TYPICAL_WALK_MS;
  return s.distanceM / s.seconds >= movingSpeedMs ? s.seconds : Math.min(s.seconds, s.distanceM / typical);
}

/**
 * Steps during a walk from minute buckets. Minutes the walk only partly
 * covers count for the part it covers, so steps just before the start or
 * after the end aren't added.
 */
export function stepsInWindow(buckets: { start: number; end: number; steps: number }[], startedAt: number, endedAt: number): number {
  let steps = 0;
  for (const b of buckets) {
    const overlap = Math.min(b.end, endedAt) - Math.max(b.start, startedAt);
    if (overlap > 0) steps += (b.steps * overlap) / (b.end - b.start);
  }
  return Math.round(steps);
}

/** METs by speed in km/h (Compendium of Physical Activities, walking then running). */
const MET_BY_SPEED: [number, number][] = [
  [0, 2.0],
  [3.2, 2.8],
  [4.0, 3.0],
  [4.8, 3.5],
  [5.6, 4.3],
  [6.4, 5.0],
  [7.2, 7.0],
  [8.0, 8.3],
  [9.7, 9.8],
  [11.3, 11.0],
  [12.9, 11.8],
];

export function metForSpeed(kmh: number): number {
  if (kmh <= 0) return MET_BY_SPEED[0][1];
  for (let i = 1; i < MET_BY_SPEED.length; i++) {
    const [s1, m1] = MET_BY_SPEED[i];
    if (kmh <= s1) {
      const [s0, m0] = MET_BY_SPEED[i - 1];
      return m0 + ((m1 - m0) * (kmh - s0)) / (s1 - s0);
    }
  }
  return MET_BY_SPEED[MET_BY_SPEED.length - 1][1];
}

/**
 * Active calories for the walk: (MET − 1) × kg × hours moving, per segment, so
 * a brisk stretch counts for more than a stroll. Same convention as the daily
 * figure: resting energy is left out.
 */
export function walkActiveKcal(segments: WalkSegment[], weightKg: number): number {
  let kcal = 0;
  for (const s of segments) {
    const seconds = movingSeconds(s);
    if (seconds <= 0) continue;
    const kmh = (s.distanceM / seconds) * 3.6;
    kcal += (metForSpeed(kmh) - 1) * weightKg * (seconds / 3600);
  }
  return Math.round(kcal);
}

/**
 * METs for cycling by speed in km/h, interpolated the same way as walking
 * (2024 Compendium of Physical Activities, bicycling on level ground). Slower
 * than 8.9 km/h counts as the slowest band; faster than 28.2 km/h is capped.
 */
const MET_BY_RIDE_SPEED: [number, number][] = [
  [8.9, 3.5],
  [15.1, 5.8],
  [17.7, 6.8],
  [20.9, 8.0],
  [24.1, 10.0],
  [28.2, 12.0],
];

export function metForRideSpeed(kmh: number): number {
  if (kmh <= MET_BY_RIDE_SPEED[0][0]) return MET_BY_RIDE_SPEED[0][1];
  for (let i = 1; i < MET_BY_RIDE_SPEED.length; i++) {
    const [s1, m1] = MET_BY_RIDE_SPEED[i];
    if (kmh <= s1) {
      const [s0, m0] = MET_BY_RIDE_SPEED[i - 1];
      return m0 + ((m1 - m0) * (kmh - s0)) / (s1 - s0);
    }
  }
  return MET_BY_RIDE_SPEED[MET_BY_RIDE_SPEED.length - 1][1];
}

/**
 * Active calories for a ride: (MET - 1) x kg x moving hours, with the MET from
 * the average moving speed. Not per segment: coasting downhill and GPS speed
 * noise would otherwise read as racing.
 */
export function rideActiveKcal(distanceM: number, movingS: number, weightKg: number): number {
  if (movingS <= 0 || distanceM <= 0) return 0;
  const kmh = (distanceM / movingS) * 3.6;
  return Math.round((metForRideSpeed(kmh) - 1) * weightKg * (movingS / 3600));
}

export type RideEffort = 'easy' | 'steady' | 'hard';

/** Stationary bike METs (Compendium: light, moderate and vigorous effort). */
export const INDOOR_RIDE_MET: Record<RideEffort, number> = { easy: 4.0, steady: 6.0, hard: 8.0 };

/**
 * Active calories for an indoor ride over its whole time: (MET - 1) x kg x
 * hours, the same "resting energy left out" convention as every other
 * active-calorie figure in the app.
 */
export function indoorRideKcal(effort: RideEffort, seconds: number, weightKg: number): number {
  if (seconds <= 0) return 0;
  return Math.round((INDOOR_RIDE_MET[effort] - 1) * weightKg * (seconds / 3600));
}

/** Best average speed over 10 s or more (m/s) along cleaned or smoothed points; null for under 10 s of route. */
export function topSpeed(points: Pick<WalkPoint, 't' | 'lat' | 'lon'>[], windowS = 10): number | null {
  let best: number | null = null;
  // Prefix sums of the path length, so each window is a subtraction.
  const along: number[] = [0];
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + distanceM(points[i - 1], points[i]));
  let j = 0;
  for (let i = 0; i < points.length; i++) {
    if (j < i) j = i;
    while (j < points.length - 1 && (points[j].t - points[i].t) / 1000 < windowS) j += 1;
    const span = (points[j].t - points[i].t) / 1000;
    if (span < windowS) break;
    const speed = (along[j] - along[i]) / span;
    if (best === null || speed > best) best = speed;
  }
  return best;
}

/** Seconds per kilometre, or null before there's enough distance to say. */
export function paceSecPerKm(distance: number, movingS: number): number | null {
  return distance >= 50 && movingS > 0 ? (movingS / distance) * 1000 : null;
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function routeBounds(points: Pick<WalkPoint, 'lat' | 'lon'>[]): Bounds | null {
  if (!points.length) return null;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const p of points) {
    west = Math.min(west, p.lon);
    east = Math.max(east, p.lon);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }
  return { west, south, east, north };
}

/**
 * Projects a route into a width × height box (y down), keeping its shape. Used
 * for small route drawings where a full map would be overkill.
 */
export function projectRoute(
  points: Pick<WalkPoint, 'lat' | 'lon'>[],
  width: number,
  height: number,
  padding: number,
): { x: number; y: number }[] {
  const b = routeBounds(points);
  if (!b) return [];
  const midLat = toRad((b.south + b.north) / 2);
  const spanX = Math.max((b.east - b.west) * Math.cos(midLat), 1e-6);
  const spanY = Math.max(b.north - b.south, 1e-6);
  const scale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  return points.map((p) => ({
    x: offsetX + (p.lon - b.west) * Math.cos(midLat) * scale,
    y: offsetY + (b.north - p.lat) * scale,
  }));
}
