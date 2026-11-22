/**
 * T18c: takes out the background steps that came from riding, not feet
 * (docs/step-filter.md). The step chip counts bumps on a bike, scooter, car
 * or bus as steps, and Google's recorder reads the same chip, so both
 * counters need this. Each minute with steps is judged from what Android
 * said the person was doing and the accelerometer burst of that minute
 * (movement-features.ts). One signal never removes a minute: at least two
 * must say "not walking", and one of them must be a riding signal (Android's
 * vehicle or bicycle, a forward push, hard braking, or more speed gained than
 * a person on foot). Shaking alone, slow steps alone or an irregular rhythm
 * alone never remove anything, so pottering about at home still counts.
 * Pure, so tests can run it without a phone.
 */
import type { ActivityTransition, MinuteBucket, MinuteFeature } from '../../modules/step-counter';

const MINUTE = 60_000;

/** Where the ranges come from: docs/step-filter.md, set above anything walking or running reaches. */
export const FILTER = {
  /** More than this in a minute is never walking or running. */
  MAX_STEPS_PER_MINUTE: 220,
  /** Speed gained in 5 to 10 s (m/s): a walk turning into a run stays under 4. */
  SPEED_GAINED: 4,
  /** Forward speed-up (m/s^2, smoothed over 2 s): a walk turning into a run reaches about 2 for a second or two. */
  PUSH: 2.5,
  /** Slow-down (m/s^2): small walking, gentle running; bikes 1 to 3, motorbikes 2 to 6, cars 3 to 8. */
  BRAKE: 2.5,
  /** Share of the shaking at engine-like frequencies; a hint, never proof. */
  BUZZ: 0.5,
  /** Walking and running are steady (about 0.9); below this the steps are irregular. A hint. */
  RHYTHM: 0.4,
  /** Fewer than this in a minute isn't steady walking. A hint, only beside Android's riding and without a walking burst. */
  SLOW_STEPS: 60,
  /** A burst this regular, with no riding figure, is someone walking. */
  WALK_RHYTHM: 0.7,
  /** A minute Android calls riding with no burst read is removed when riding minutes lie this close on both sides. */
  STRETCH_GAP_MS: 3 * MINUTE,
  /** ...unless it has as many steps as a walking minute. */
  STRETCH_WALK_STEPS: 100,
} as const;

/** Android's last activity change can be hours old, so transitions are read this far back. */
export const ACTIVITY_LOOKBACK_MS = 6 * 60 * MINUTE;

export type RideKind = 'vehicle' | 'bicycle';

export interface RemovedMinute {
  start: number;
  steps: number;
  kind: RideKind;
}

export interface Filtered {
  kept: MinuteBucket[];
  removed: RemovedMinute[];
}

/** What Android said the person was doing at `at`: the last activity entered and not left since. */
export function activityAt(transitions: ActivityTransition[], at: number): string | null {
  let current: string | null = null;
  for (const tr of [...transitions].sort((a, b) => a.t - b.t)) {
    if (tr.t > at) break;
    if (tr.enter) current = tr.activity;
    else if (current === tr.activity) current = null;
  }
  return current;
}

/** The signals of one minute that say "not walking or running". */
export function rideSignals(steps: number, features: MinuteFeature | null, activity: string | null) {
  const androidRiding = activity === 'vehicle' || activity === 'bicycle';
  const burstRiding = [
    !!features && features.speedGained >= FILTER.SPEED_GAINED,
    !!features && features.push >= FILTER.PUSH,
    !!features && features.brake >= FILTER.BRAKE,
  ].filter(Boolean).length;
  const riding = (androidRiding ? 1 : 0) + burstRiding;
  // Android keeps saying "vehicle" for a minute or two after getting off; a steady burst then says walking.
  const walkingBurst = !!features && burstRiding === 0 && features.rhythm >= FILTER.WALK_RHYTHM;
  const hints = [
    !!features && features.buzz >= FILTER.BUZZ,
    !!features && features.rhythm < FILTER.RHYTHM,
    // Slow steps only count beside Android's riding signal: on their own they're someone pottering about.
    androidRiding && !walkingBurst && steps < FILTER.SLOW_STEPS,
  ].filter(Boolean).length;
  return { riding, hints, androidRiding };
}

/** Vehicle or bicycle for a minute that is out, or null when it is kept (before the stretch rule). */
export function judgeMinute(steps: number, features: MinuteFeature | null, activity: string | null): RideKind | null {
  if (steps > FILTER.MAX_STEPS_PER_MINUTE) return kindOf(features, activity);
  const { riding, hints } = rideSignals(steps, features, activity);
  if (riding >= 1 && riding + hints >= 2) return kindOf(features, activity);
  return null;
}

/** Bicycle only when Android says so and nothing looks like an engine. */
function kindOf(features: MinuteFeature | null, activity: string | null): RideKind {
  if (activity === 'bicycle' && !(features && features.buzz >= FILTER.BUZZ)) return 'bicycle';
  return 'vehicle';
}

/**
 * Splits a window's minute buckets into kept and removed. `features` and
 * `transitions` are what the counter stored (transitions from
 * ACTIVITY_LOOKBACK_MS before the window). Without either, nothing is removed
 * by the burst rules, only impossible minutes.
 */
export function filterRiding(
  minutes: MinuteBucket[],
  features: MinuteFeature[],
  transitions: ActivityTransition[],
): Filtered {
  const minuteOf = (ms: number) => Math.floor(ms / MINUTE) * MINUTE;
  const burst = new Map<number, MinuteFeature>();
  for (const f of features) burst.set(minuteOf(f.start), f);
  const sortedTransitions = [...transitions].sort((a, b) => a.t - b.t);
  const sorted = [...minutes].sort((a, b) => a.start - b.start);

  const judged = sorted.map((m) => {
    const features = burst.get(minuteOf(m.start)) ?? null;
    const activity = activityAt(sortedTransitions, m.start + MINUTE / 2);
    return { m, features, activity, kind: m.steps > 0 ? judgeMinute(m.steps, features, activity) : null };
  });

  // A riding stretch: Android says riding, no burst was read, and minutes on both sides were taken out.
  const outAt = judged.filter((j) => j.kind).map((j) => j.m.start);
  for (const j of judged) {
    if (j.kind || j.features || j.m.steps <= 0) continue;
    if (j.activity !== 'vehicle' && j.activity !== 'bicycle') continue;
    if (j.m.steps >= FILTER.STRETCH_WALK_STEPS) continue;
    const before = outAt.some((t) => t < j.m.start && j.m.start - t <= FILTER.STRETCH_GAP_MS);
    const after = outAt.some((t) => t > j.m.start && t - j.m.start <= FILTER.STRETCH_GAP_MS);
    if (before && after) j.kind = j.activity === 'bicycle' ? 'bicycle' : 'vehicle';
  }

  const kept: MinuteBucket[] = [];
  const removed: RemovedMinute[] = [];
  for (const j of judged) {
    if (j.kind) removed.push({ start: j.m.start, steps: j.m.steps, kind: j.kind });
    else kept.push(j.m);
  }
  return { kept, removed };
}

export const RIDE_TEXT: Record<RideKind, string> = {
  vehicle: 'In a vehicle',
  bicycle: 'On a bicycle',
};
