/**
 * Steps known to lie in a stretch of time but not when within it: the phone's
 * counter was stopped, or another app synced one record covering hours.
 * None of them go into a particular hour.
 */
export interface UntimedSpan {
  /** Epoch ms. */
  from: number;
  to: number;
  steps: number;
}

/**
 * Which day a stretch's steps count for: the day it began. A stretch that
 * starts in the evening and ends when the app is opened next morning mostly
 * holds the evening's walking (the night is spent asleep), and this way a
 * morning never shows steps from a stretch that began the night before.
 */
export function untimedForDay(spans: UntimedSpan[], dayStart: number, dayEnd: number): number {
  return spans.reduce((sum, s) => (s.steps > 0 && s.from >= dayStart && s.from < dayEnd ? sum + s.steps : sum), 0);
}

/** For sharing by time of day: awake hours count, night hours barely. */
export const DEFAULT_HOUR_WEIGHTS: number[] = Array.from({ length: 24 }, (_, h) => (h >= 6 && h <= 22 ? 1 : 0.05));

/** Time in [from, to), each moment weighted by its local hour; plain time without weights. */
export function weightedSpan(from: number, to: number, weights?: number[]): number {
  if (!weights) return Math.max(0, to - from);
  let total = 0;
  for (let t = from; t < to; ) {
    const d = new Date(t);
    const next = Math.min(to, new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime());
    total += (next - t) * weights[d.getHours()];
    t = next;
  }
  return total;
}

/** The part of each span that falls in [start, end) by (weighted) time, unrounded. */
export function untimedShare(spans: UntimedSpan[], start: number, end: number, weights?: number[]): number {
  let total = 0;
  for (const s of spans) {
    if (s.steps <= 0) continue;
    if (s.to <= s.from) {
      if (s.from >= start && s.from < end) total += s.steps;
      continue;
    }
    const from = Math.max(s.from, start);
    const to = Math.min(s.to, end);
    if (to <= from) continue;
    let whole = weightedSpan(s.from, s.to, weights);
    let part = weightedSpan(from, to, weights);
    if (whole <= 0) {
      whole = s.to - s.from;
      part = to - from;
    }
    total += (s.steps * part) / whole;
  }
  return total;
}
