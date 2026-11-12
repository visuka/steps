/**
 * Turns a recorded route into a saved walk: distance and moving time from GPS,
 * steps from the step source over the same minutes, calories from speed and
 * weight, plus where it started and the weather at the time.
 */
import { profileStride } from '@/data/profile';
import type { Profile, Repository, Walk } from '@/data/types';
import { newId } from '@/data/types';
import type { StepSource } from '@/health/types';
import { dayKey } from '@/lib/dates';
import { estimateKcalFromSteps } from '@/lib/metrics';
import { cleanPoints, stepsInWindow, walkActiveKcal, type WalkPoint, walkStats } from '@/lib/walk';
import { placeName } from '@/location/place';
import { weatherAt } from '@/weather/met';

export async function stepsBetween(source: StepSource, startedAt: number, endedAt: number): Promise<number | null> {
  try {
    return stepsInWindow(await source.getStepBuckets(new Date(startedAt), new Date(endedAt), 1), startedAt, endedAt);
  } catch {
    return null;
  }
}

export async function saveWalk(opts: {
  repo: Repository;
  source: StepSource;
  profile: Profile;
  startedAt: number;
  endedAt: number;
  points: WalkPoint[];
}): Promise<Walk> {
  const { repo, source, profile, startedAt, endedAt } = opts;
  const points = cleanPoints(opts.points);
  const stats = walkStats(points);
  const steps = await stepsBetween(source, startedAt, endedAt);

  // Without a usable route (indoors, GPS off), fall back to steps × stride.
  const useRoute = stats.distanceM > 0;
  const distanceM = useRoute ? stats.distanceM : Math.round((steps ?? 0) * profileStride(profile));
  const walk: Walk = {
    id: newId(),
    startedAt,
    endedAt,
    distanceM,
    movingS: useRoute ? stats.movingS : Math.round((endedAt - startedAt) / 1000),
    steps,
    activeKcal: useRoute
      ? walkActiveKcal(stats.segments, profile.weightKg)
      : estimateKcalFromSteps(steps ?? 0, profile.weightKg),
    startPlace: points[0] ? await placeName(points[0].lat, points[0].lon) : null,
    weather: weatherAt(await repo.getWeather(dayKey(new Date(startedAt))), startedAt),
    updatedAt: Date.now(),
  };
  await repo.saveWalk(walk, points);
  return walk;
}

/**
 * Step counts arrive late: the phone's sensor batches up to a minute, and
 * other apps sync to Health Connect when they like. Re-reads a recent walk's
 * steps and saves them if they changed. A walk with no usable route got its
 * distance and calories from its steps, so those follow the new count.
 */
export async function refreshWalkSteps(
  repo: Repository,
  source: StepSource,
  profile: Profile,
  walk: Walk,
  points: WalkPoint[],
): Promise<Walk> {
  if (Date.now() - walk.endedAt > 2 * 86_400_000) return walk;
  const steps = await stepsBetween(source, walk.startedAt, walk.endedAt);
  if (steps === null || steps === walk.steps) return walk;
  const fromSteps = walkStats(cleanPoints(points)).distanceM === 0;
  const updated: Walk = {
    ...walk,
    steps,
    ...(fromSteps
      ? {
          distanceM: Math.round(steps * profileStride(profile)),
          activeKcal: estimateKcalFromSteps(steps, profile.weightKg),
        }
      : {}),
    updatedAt: Date.now(),
  };
  await repo.saveWalk(updated);
  return updated;
}
