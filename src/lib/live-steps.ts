/**
 * The number on Today while the app is open: the synced total, plus the live
 * sensor's steps taken after the last step the source has counted. Steps the
 * source has already counted are never added twice, and steps neither has yet
 * are left out until the next sync rather than guessed, so the number never
 * runs ahead of what was walked. Small drops are held back, so it doesn't
 * flicker down and up between syncs.
 */

/** A live sensor event: steps since the subscription started, and when it arrived. */
export interface LiveSample {
  at: number;
  count: number;
}

/** How far back samples are kept: longer than any source's normal delay. */
export const LIVE_LOOKBACK_MS = 30 * 60_000;

export function addSample(samples: LiveSample[], sample: LiveSample): LiveSample[] {
  const kept = samples.filter((s) => s.at >= sample.at - LIVE_LOOKBACK_MS);
  // Keep the newest sample older than the window as the baseline for anything earlier.
  const older = samples.filter((s) => s.at < sample.at - LIVE_LOOKBACK_MS).at(-1);
  return [...(older ? [older] : []), ...kept, sample];
}

/**
 * Live steps after `since` (epoch ms), counted from the first sample at or
 * after it. A sample's count covers steps up to when it arrived, so starting
 * from an earlier one could add steps the source already has; starting from
 * the next one can only miss the step or two in between.
 */
export function liveStepsSince(samples: LiveSample[], since: number): number {
  const latest = samples.at(-1);
  if (!latest) return 0;
  const baseline = samples.find((s) => s.at >= since) ?? latest;
  return Math.max(0, latest.count - baseline.count);
}

export interface Shown {
  date: string;
  steps: number;
}

/**
 * A drop this small is the two counters disagreeing by a step or two, or a
 * minute caught mid-write: it's held back. A bigger one is a real correction
 * (a source fixed its figure, or another source was chosen) and is shown.
 */
export const HOLD_BACK_STEPS = 30;

/** What to show: synced steps for `date` plus live steps since `coveredUntil`. */
export function stepsToShow(opts: {
  date: string;
  synced: number;
  coveredUntil: number;
  samples: LiveSample[];
  previous: Shown | null;
}): Shown {
  const steps = opts.synced + liveStepsSince(opts.samples, opts.coveredUntil);
  const shown = opts.previous?.date === opts.date ? opts.previous.steps : null;
  const held = shown !== null && steps < shown && shown - steps <= HOLD_BACK_STEPS;
  return { date: opts.date, steps: held ? shown : steps };
}
