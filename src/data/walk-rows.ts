/**
 * SQLite rows for walks, their parts and pinned places, read back with
 * defaults for rows written before a column existed. Kept apart from db.ts so
 * tests can read real migrated rows without expo-sqlite.
 */
import type { Place } from '@/lib/places';

import type {
  DistanceSource,
  PartChoice,
  PartKind,
  RideEffort,
  StepsSource,
  Walk,
  WalkActivity,
  WalkPart,
  WalkStretches,
} from './types';

export interface WalkRow {
  id: string;
  started_at: number;
  ended_at: number;
  distance_m: number;
  moving_s: number;
  steps: number | null;
  active_kcal: number;
  start_place: string | null;
  weather: string | null;
  updated_at: number;
  activity?: string | null;
  indoor?: number | null;
  place_id?: string | null;
  distance_from?: string | null;
  steps_from?: string | null;
  floors_up?: number | null;
  floors_down?: number | null;
  lift_up?: number | null;
  lift_down?: number | null;
  climb_m?: number | null;
  top_speed_ms?: number | null;
  effort?: string | null;
  stretches?: string | null;
}

const oneOf = <T extends string>(value: string | null | undefined, allowed: readonly T[]): T | null =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : null;

function parseJson<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function toWalk(r: WalkRow): Walk {
  return {
    id: r.id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    distanceM: r.distance_m,
    movingS: r.moving_s,
    steps: r.steps,
    activeKcal: r.active_kcal,
    startPlace: r.start_place,
    weather: parseJson<Walk['weather']>(r.weather),
    updatedAt: r.updated_at,
    activity: oneOf<WalkActivity>(r.activity, ['walk', 'ride']) ?? 'walk',
    indoor: r.indoor === 1,
    placeId: r.place_id ?? null,
    distanceFrom: oneOf<DistanceSource>(r.distance_from, ['route', 'steps', 'mixed', 'none']),
    stepsFrom: oneOf<StepsSource>(r.steps_from, ['walk', 'day', 'none']),
    floorsUp: r.floors_up ?? null,
    floorsDown: r.floors_down ?? null,
    liftUp: r.lift_up ?? null,
    liftDown: r.lift_down ?? null,
    climbM: r.climb_m ?? null,
    topSpeedMs: r.top_speed_ms ?? null,
    effort: oneOf<RideEffort>(r.effort, ['easy', 'steady', 'hard']),
    stretches: parseJson<WalkStretches>(r.stretches),
  };
}

export interface WalkPartRow {
  walk_id: string;
  ord: number;
  start_t: number;
  end_t: number;
  kind: string;
  steps: number | null;
  distance_m: number;
  moving_s: number;
  top_speed_ms: number | null;
  kcal_walk: number;
  kcal_ride: number;
  choice: string | null;
  default_keep: number;
}

export function toPart(r: WalkPartRow): WalkPart {
  return {
    walkId: r.walk_id,
    ord: r.ord,
    startT: r.start_t,
    endT: r.end_t,
    kind: oneOf<PartKind>(r.kind, ['vehicle', 'cycle', 'unsure']) ?? 'unsure',
    steps: r.steps,
    distanceM: r.distance_m,
    movingS: r.moving_s,
    topSpeedMs: r.top_speed_ms,
    kcalWalk: r.kcal_walk,
    kcalRide: r.kcal_ride,
    choice: oneOf<PartChoice>(r.choice, ['keep', 'cycle', 'remove']),
    defaultKeep: r.default_keep === 1,
  };
}

export interface PlaceRow {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radius_m: number;
  last_mode: string | null;
  updated_at: number;
}

export function toPlace(r: PlaceRow): Place {
  return {
    id: r.id,
    name: r.name,
    lat: r.lat,
    lon: r.lon,
    radiusM: r.radius_m,
    lastMode: oneOf<'indoor' | 'outside'>(r.last_mode, ['indoor', 'outside']),
    updatedAt: r.updated_at,
  };
}
