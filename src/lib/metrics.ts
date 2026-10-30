/**
 * Turns step buckets into the numbers the app shows. All calorie figures are
 * estimates and are labelled as such in the UI.
 */

/** Steps per minute at which walking counts as moderate intensity. */
export const ACTIVE_CADENCE = 100;

/** Slowest pace we assume someone was actually walking at; below it, the rest of the bucket was standing still. */
const SLOW_WALK_CADENCE = 90;

/** Stride ≈ 0.413–0.415 × height, the usual population estimates. */
export function strideMeters(
  heightCm: number,
  overrideM: number | null,
  sex: 'female' | 'male' | 'unspecified' = 'unspecified',
): number {
  if (overrideM && overrideM > 0) return overrideM;
  const factor = sex === 'male' ? 0.415 : sex === 'female' ? 0.413 : 0.414;
  return Math.round(factor * heightCm) / 100;
}

/** Approximate METs by walking cadence (Compendium of Physical Activities walking speeds). */
export function metForCadence(stepsPerMinute: number): number {
  if (stepsPerMinute < 100) return 2.8;
  if (stepsPerMinute < 120) return 3.5;
  if (stepsPerMinute < 130) return 4.3;
  return 5.0;
}

export interface StepBucket {
  /** Epoch ms. */
  start: number;
  end: number;
  steps: number;
}

export interface DayMetrics {
  steps: number;
  distanceM: number;
  activeKcal: number;
  activeMin: number;
  /** Steps per local hour, 24 entries. */
  hourly: number[];
}

/**
 * Active calories for one bucket: (MET − 1) × kg × hours walked.
 * Subtracting 1 MET leaves out resting energy.
 */
export function bucketKcal(steps: number, durationMin: number, weightKg: number): number {
  if (steps <= 0 || durationMin <= 0) return 0;
  const cadence = Math.max(steps / durationMin, SLOW_WALK_CADENCE);
  const walkingMin = steps / cadence;
  return (metForCadence(cadence) - 1) * weightKg * (walkingMin / 60);
}

export function summarizeBuckets(
  buckets: StepBucket[],
  opts: { weightKg: number; strideM: number },
): DayMetrics {
  const hourly = new Array<number>(24).fill(0);
  let steps = 0;
  let kcal = 0;
  let activeMin = 0;

  for (const b of buckets) {
    if (b.steps <= 0) continue;
    const durationMin = Math.max((b.end - b.start) / 60_000, 1);
    steps += b.steps;
    kcal += bucketKcal(b.steps, durationMin, opts.weightKg);
    if (b.steps / durationMin >= ACTIVE_CADENCE) activeMin += durationMin;
    hourly[new Date(b.start).getHours()] += b.steps;
  }

  return {
    steps: Math.round(steps),
    distanceM: Math.round(steps * opts.strideM),
    activeKcal: Math.round(kcal),
    activeMin: Math.round(activeMin),
    hourly: hourly.map(Math.round),
  };
}

/** For days we only have a total for (older history): assume a steady 100 steps/min walk. */
export function estimateKcalFromSteps(steps: number, weightKg: number): number {
  return Math.round(bucketKcal(steps, steps / ACTIVE_CADENCE, weightKg));
}
