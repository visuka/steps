/**
 * Turns step buckets into the numbers the app shows. All calorie figures are
 * estimates and are labelled as such in the UI.
 */

/**
 * Steps per minute from which a minute counts as walking, brisk walking
 * (moderate intensity) and running. 100 and 130 are the research cut-offs for
 * moderate and vigorous walking; few people walk faster than 140 for a whole
 * minute, so that's where running starts. Slower minutes are moving about.
 */
export const WALK_CADENCE = 60;
export const ACTIVE_CADENCE = 100;
export const RUN_CADENCE = 140;

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
  /** Timed and untimed steps. */
  steps: number;
  untimedSteps: number;
  distanceM: number;
  activeKcal: number;
  /** briskMin + runMin. */
  activeMin: number;
  walkMin: number;
  briskMin: number;
  runMin: number;
  /** Steps per local hour, 24 entries; untimed steps aren't in any hour. */
  hourly: number[];
  /** End of the last minute with steps (epoch ms), or null: what the source has counted up to. */
  lastStepAt: number | null;
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

/**
 * Day figures from timed buckets plus steps whose time isn't known. Untimed
 * steps count toward the total, distance and calories (at a slow pace, the
 * safe assumption) but not toward any hour or minute.
 */
export function summarizeBuckets(
  buckets: StepBucket[],
  opts: { weightKg: number; strideM: number },
  untimedSteps = 0,
): DayMetrics {
  const hourly = new Array<number>(24).fill(0);
  let steps = 0;
  let kcal = 0;
  let walkMin = 0;
  let briskMin = 0;
  let runMin = 0;
  let lastStepAt: number | null = null;

  for (const b of buckets) {
    if (b.steps <= 0) continue;
    const durationMin = Math.max((b.end - b.start) / 60_000, 1);
    const cadence = b.steps / durationMin;
    steps += b.steps;
    kcal += bucketKcal(b.steps, durationMin, opts.weightKg);
    if (cadence >= RUN_CADENCE) runMin += durationMin;
    else if (cadence >= ACTIVE_CADENCE) briskMin += durationMin;
    else if (cadence >= WALK_CADENCE) walkMin += durationMin;
    hourly[new Date(b.start).getHours()] += b.steps;
    lastStepAt = Math.max(lastStepAt ?? 0, b.end);
  }

  const untimed = Math.max(0, Math.round(untimedSteps));
  const total = Math.round(steps) + untimed;
  kcal += bucketKcal(untimed, untimed / SLOW_WALK_CADENCE, opts.weightKg);
  return {
    steps: total,
    untimedSteps: untimed,
    distanceM: Math.round(total * opts.strideM),
    activeKcal: Math.round(kcal),
    activeMin: Math.round(briskMin + runMin),
    walkMin: Math.round(walkMin),
    briskMin: Math.round(briskMin),
    runMin: Math.round(runMin),
    hourly: hourly.map(Math.round),
    lastStepAt,
  };
}

/** For days we only have a total for (older history): assume a steady 100 steps/min walk. */
export function estimateKcalFromSteps(steps: number, weightKg: number): number {
  return Math.round(bucketKcal(steps, steps / ACTIVE_CADENCE, weightKg));
}
