/**
 * Turns a recording into a saved walk or ride: parts found on the raw fixes,
 * then distance and moving time from GPS a stretch at a time (steps x stride
 * indoors and where GPS was poor), steps from the walk's own counter (else
 * the day's minute buckets), calories, stairs, where it started (the pin's
 * name, never a lookup of home's coordinates) and the forecast for its hours.
 */
import { profileStride } from '@/data/profile';
import type { PartChoice, Profile, Repository, Walk } from '@/data/types';
import { newId } from '@/data/types';
import type { StepSource } from '@/health/types';
import { dayKey } from '@/lib/dates';
import { type LearnedStride, learnStride, walkStride } from '@/lib/gps';
import {
  type ActivitySample,
  cleanPoints,
  type ModeChange,
  type PressureSample,
  type RideEffort,
  type StepSample,
  stepsInWindow,
  type WalkActivity,
  type WalkPoint,
  walkStats,
} from '@/lib/walk';
import { buildWalk, interruptedEnd, refreshSteps } from '@/lib/walk-totals';
import { placeName } from '@/location/place';
import { walkWeather } from '@/weather/met';

import type { RecordingPlace, WalkRecorder } from './recorder.types';

/** kv key of the stride learned from good GPS walking. */
export const STRIDE_KEY = 'walkStride';

export async function stepsBetween(source: StepSource, startedAt: number, endedAt: number): Promise<number | null> {
  try {
    return stepsInWindow(await source.getStepBuckets(new Date(startedAt), new Date(endedAt), 1), startedAt, endedAt);
  } catch {
    return null;
  }
}

async function bucketsBetween(source: StepSource, startedAt: number, endedAt: number) {
  try {
    return await source.getStepBuckets(new Date(startedAt), new Date(endedAt), 1);
  } catch {
    return null;
  }
}

/** The stride for steps x stride on walks: the person's setting, else learned from good GPS walking, else from height. */
export async function strideFor(repo: Repository, profile: Profile): Promise<number> {
  const learned = await repo.getKv<LearnedStride>(STRIDE_KEY).catch(() => null);
  return walkStride(profile, profileStride(profile), learned);
}

export interface SaveWalkOptions {
  repo: Repository;
  source: StepSource;
  profile: Profile;
  startedAt: number;
  endedAt: number;
  /** Raw fixes, as recorded. */
  points: WalkPoint[];
  steps?: StepSample[] | null;
  pressure?: PressureSample[] | null;
  activities?: ActivitySample[];
  modes?: ModeChange[];
  activity?: WalkActivity;
  /** Started indoors (walk at a pin, or indoor bike). */
  indoor?: boolean;
  /** The pin it started at: its name becomes the start place. */
  place?: RecordingPlace | null;
  effort?: RideEffort | null;
}

export async function saveWalk(opts: SaveWalkOptions): Promise<Walk> {
  const { repo, source, profile, startedAt, endedAt } = opts;
  const activity = opts.activity ?? 'walk';
  const learned = await repo.getKv<LearnedStride>(STRIDE_KEY).catch(() => null);
  const strideM = walkStride(profile, profileStride(profile), learned);
  const buckets = activity === 'walk' ? await bucketsBetween(source, startedAt, endedAt) : null;

  const built = buildWalk({
    startedAt,
    endedAt,
    activity,
    initialIndoor: !!opts.indoor,
    placeId: opts.place?.id ?? null,
    effort: opts.effort ?? null,
    points: opts.points,
    steps: opts.steps,
    pressure: opts.pressure,
    activities: opts.activities ?? [],
    modes: opts.modes ?? [],
    buckets,
    weightKg: profile.weightKg,
    strideM,
  });

  const first = built.points.find((p) => p.part == null);
  const startPlace = opts.place?.name ?? (first ? await placeName(first.lat, first.lon) : null);
  const walk: Walk = {
    id: newId(),
    ...built.walk,
    startPlace,
    weather: walkWeather(await repo.getWeather(dayKey(new Date(startedAt))), startedAt, endedAt),
    updatedAt: Date.now(),
  };
  await repo.saveWalk(
    walk,
    built.points,
    built.parts.map((p) => ({ ...p, walkId: walk.id })),
  );
  if (built.stride) {
    const next = learnStride(learned, built.stride);
    if (next && next !== learned) await repo.setKv(STRIDE_KEY, next).catch(() => undefined);
  }
  return walk;
}

/**
 * Stops the recorder, reads everything it kept, saves the walk, and only then
 * discards the native data, so a failed save loses nothing. An interrupted
 * recording ends at its last sign of life, never "now".
 */
export async function finishRecording(opts: {
  repo: Repository;
  source: StepSource;
  profile: Profile;
  recorder: WalkRecorder;
  walkId: number;
  interrupted: boolean;
}): Promise<Walk> {
  const { recorder, walkId } = opts;
  const mode = await recorder.mode();
  await recorder.stop();
  const [points, steps, pressure, activities] = await Promise.all([
    recorder.points(walkId, 0),
    recorder.steps(walkId, 0),
    recorder.pressure(walkId, 0),
    recorder.activities(walkId, 0),
  ]);
  const endedAt = opts.interrupted
    ? interruptedEnd({ startedAt: walkId, points, steps, pressure, activities, lastAliveAt: mode?.lastAliveAt })
    : Date.now();
  const walk = await saveWalk({
    repo: opts.repo,
    source: opts.source,
    profile: opts.profile,
    startedAt: walkId,
    endedAt,
    points,
    steps,
    pressure,
    activities,
    modes: mode?.changes ?? [],
    activity: mode?.activity ?? 'walk',
    indoor: mode?.indoor ?? false,
    place: mode?.place ?? null,
    effort: mode?.effort ?? null,
  });
  await recorder.discard(walkId);
  return walk;
}

/** Keep / cycle / remove a part (null = undo). The walk's distance, moving time, steps and kcal follow; nothing else. */
export function choosePart(repo: Repository, walkId: string, ord: number, choice: PartChoice | null): Promise<Walk | null> {
  return repo.setPartChoice(walkId, ord, choice);
}

/**
 * Step counts arrive late: the phone's sensor batches up to a minute, and
 * other apps sync to Health Connect when they like. Re-reads a recent walk's
 * steps from the day's buckets when that's where they came from (never for
 * the walk's own counter or rides), inside a transaction so a keep/remove
 * tapped meanwhile stands. Also replaces the weather of walks saved before
 * it was read for the walk's own hours.
 */
export async function refreshWalkSteps(
  repo: Repository,
  source: StepSource,
  profile: Profile,
  walk: Walk,
  points: WalkPoint[],
): Promise<Walk> {
  let current = walk;
  if (walk.weather && walk.weather.forecast === undefined) {
    const day = await repo.getWeather(dayKey(new Date(walk.startedAt)));
    if (day) {
      const weather = walkWeather(day, walk.startedAt, walk.endedAt);
      current = (await repo.updateWalk(walk.id, (row) => ({ walk: { ...row, weather, updatedAt: Date.now() } }))) ?? current;
    }
  }

  if (Date.now() - walk.endedAt > 2 * 86_400_000) return current;
  if ((walk.activity ?? 'walk') === 'ride') return current;
  if (walk.stepsFrom === 'walk' || walk.stepsFrom === 'none') return current;
  const buckets = await bucketsBetween(source, walk.startedAt, walk.endedAt);
  if (!buckets) return current;
  const strideM = await strideFor(repo, profile);
  // Walks from before distance_from: no usable route means the distance came from steps.
  const guessed = walk.distanceFrom == null ? (walkStats(cleanPoints(points)).distanceM === 0 ? 'steps' : 'route') : null;
  const updated = await repo.updateWalk(walk.id, (row, parts) =>
    refreshSteps(
      guessed && row.distanceFrom == null ? { ...row, distanceFrom: guessed } : row,
      parts,
      (a, b) => stepsInWindow(buckets, a, b),
      strideM,
      profile.weightKg,
    ),
  );
  return updated ?? current;
}
