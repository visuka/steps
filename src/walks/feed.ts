/**
 * The record screen's data while recording: polls the recorder every few
 * seconds for what's new since the last poll (fixes, steps, pressure,
 * activity), keeps it all, and turns it into the live view.
 */
import type { Profile } from '@/data/types';
import type { ActivitySample, PressureSample, StepSample, WalkPoint } from '@/lib/walk';
import { type LiveWalk, liveWalk } from '@/lib/walk-totals';

import type { WalkMode, WalkRecorder } from './recorder.types';

export interface WalkFeedData {
  walkId: number;
  points: WalkPoint[];
  steps: StepSample[];
  pressure: PressureSample[];
  activities: ActivitySample[];
  mode: WalkMode | null;
  /** Bumped on every poll that brought something new, for memoising. */
  version: number;
}

export interface WalkFeed {
  /** The data so far (a new object after every poll that changed it). */
  data(): WalkFeedData;
  /** Reads what's new; call every 3 s while recording. */
  poll(): Promise<WalkFeedData>;
}

const lastT = (rows: { t: number }[]) => rows[rows.length - 1]?.t ?? 0;

export function createWalkFeed(recorder: WalkRecorder, walkId: number): WalkFeed {
  let data: WalkFeedData = { walkId, points: [], steps: [], pressure: [], activities: [], mode: null, version: 0 };
  let busy: Promise<WalkFeedData> | null = null;

  const poll = async (): Promise<WalkFeedData> => {
    const [points, steps, pressure, activities, mode] = await Promise.all([
      recorder.points(walkId, lastT(data.points)),
      recorder.steps(walkId, lastT(data.steps)),
      recorder.pressure(walkId, lastT(data.pressure)),
      recorder.activities(walkId, lastT(data.activities)),
      recorder.mode(),
    ]);
    const changed =
      points.length || steps.length || pressure.length || activities.length || JSON.stringify(mode) !== JSON.stringify(data.mode);
    if (changed) {
      data = {
        walkId,
        points: points.length ? [...data.points, ...points] : data.points,
        steps: steps.length ? [...data.steps, ...steps] : data.steps,
        pressure: pressure.length ? [...data.pressure, ...pressure] : data.pressure,
        activities: activities.length ? [...data.activities, ...activities] : data.activities,
        mode,
        version: data.version + 1,
      };
    }
    return data;
  };

  return {
    data: () => data,
    poll() {
      // Overlapping polls would read the same rows twice.
      busy ??= poll().finally(() => {
        busy = null;
      });
      return busy;
    },
  };
}

/**
 * The live view (distance, moving time, steps, kcal, stairs, the label,
 * GPS state and the drawn route) from the feed's data. The same maths as the
 * saved walk, so the summary matches what was shown.
 */
export function liveView(data: WalkFeedData, profile: Profile, strideM: number, now: number): LiveWalk {
  return liveWalk(
    {
      startedAt: data.walkId,
      endedAt: now,
      activity: data.mode?.activity ?? 'walk',
      initialIndoor: data.mode?.indoor ?? false,
      placeId: data.mode?.place?.id ?? null,
      effort: data.mode?.effort ?? null,
      points: data.points,
      steps: data.steps,
      pressure: data.pressure,
      activities: data.activities,
      modes: data.mode?.changes ?? [],
      weightKg: profile.weightKg,
      strideM,
    },
    now,
  );
}
