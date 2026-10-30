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
/** Smallest movement counted, even with very precise fixes. */
const MIN_MOVE_M = 5;
/** Below this a segment was mostly standing; only the time needed to cover it at a normal pace counts as moving. */
const MOVING_SPEED_MS = 0.5;
const TYPICAL_WALK_MS = 1.3;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(a: Pick<WalkPoint, 'lat' | 'lon'>, b: Pick<WalkPoint, 'lat' | 'lon'>): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Drops imprecise fixes and jumps, oldest first. */
export function cleanPoints(points: WalkPoint[]): WalkPoint[] {
  const kept: WalkPoint[] = [];
  for (const p of [...points].sort((a, b) => a.t - b.t)) {
    if (p.acc !== null && p.acc > MAX_ACCURACY_M) continue;
    const last = kept[kept.length - 1];
    if (last) {
      const dt = (p.t - last.t) / 1000;
      if (dt <= 0 || distanceM(last, p) / dt > MAX_SPEED_MS) continue;
    }
    kept.push(p);
  }
  return kept;
}

/** Distance and moving time of cleaned points. */
export function walkStats(points: WalkPoint[]): WalkStats {
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
    moving += movingSeconds(s);
  }
  return { distanceM: Math.round(distance), movingS: Math.round(moving), segments };
}

function movingSeconds(s: WalkSegment): number {
  return s.distanceM / s.seconds >= MOVING_SPEED_MS ? s.seconds : s.distanceM / TYPICAL_WALK_MS;
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
