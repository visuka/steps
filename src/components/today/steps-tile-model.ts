/**
 * The Steps tile's figures (owner, 17 Nov 2026; docs/design.md "Current:
 * Today"), kept apart from the drawing so jest can check them without React
 * Native: dots per hour, the hours on your feet, the pills of the bars.
 */

/** Rows of dots per hour. */
export const STEPS_TILE = { dotRows: 7, perHour: 2 } as const;

/**
 * How many dots each hour lights (0..dotRows): steps against the day's busiest
 * hour, at least one for any hour with steps, none after now.
 */
export function hourDots(hourly: number[], nowHour: number, rows: number = STEPS_TILE.dotRows): number[] {
  const hours = Array.from({ length: 24 }, (_, i) => Math.max(0, Number(hourly[i]) || 0));
  const peak = Math.max(1, ...hours.filter((_, i) => i <= nowHour));
  return hours.map((s, i) => (i > nowHour || s <= 0 ? 0 : Math.max(1, Math.round((s / peak) * rows))));
}

/** The hours you were on your feet: "06:00 – 15:00", "06:00 – NOW" while this hour has steps, or null with none yet. */
export function activeRange(hourly: number[], nowHour: number): string | null {
  const lit = Array.from({ length: 24 }, (_, i) => i).filter((i) => i <= nowHour && (Number(hourly[i]) || 0) > 0);
  if (!lit.length) return null;
  const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  const last = lit[lit.length - 1];
  return `${hh(lit[0])} – ${last === nowHour ? 'NOW' : hh(last + 1)}`;
}

/** Each hour's columns, as shares of its height: a steep rise, then a step down (owner's reference). */
const RAMP = [1, 0.7] as const;

/**
 * The day as an even grid of dots: `perHour` columns per hour, each lit from
 * the bottom by its steps, every hour a small ramp so the day reads as peaks.
 * None after now. `recent` marks the latest hour with steps (drawn dark; the
 * older ones light).
 */
export function dotGrid(
  hourly: number[],
  nowHour: number,
  rows: number = STEPS_TILE.dotRows,
  perHour: number = STEPS_TILE.perHour,
): { n: number[]; recent: boolean[] } {
  const last = Math.min(23, Math.max(-1, Math.floor(nowHour)));
  const hours = Array.from({ length: 24 }, (_, i) => (i <= last ? Math.max(0, Number(hourly[i]) || 0) : 0));
  const value = Array.from({ length: 24 * perHour }, (_, c) => hours[Math.floor(c / perHour)] * (RAMP[c % perHour] ?? RAMP[RAMP.length - 1]));
  const peak = Math.max(0, ...value);
  const n = value.map((x) => (peak <= 0 || x <= 0 ? 0 : Math.max(1, Math.round((x / peak) * rows))));
  const latest = hours.reduce((k, x, i) => (x > 0 ? i : k), -1);
  const recent = n.map((k, c) => k > 0 && Math.floor(c / perHour) === latest);
  return { n, recent };
}

/** A piece of a drawn bar, in shares 0..1 of its length: a pill from `from` to `to`, or a dot at `from`. */
export interface Part {
  from: number;
  to: number;
  red: boolean;
  dot: boolean;
}

/** Where a long pill is cut in two, by turn: mixed lengths, as in the reference. */
const CUTS = [0.35, 0.6, 0.45] as const;

function pills(out: Part[], from: number, to: number, i: number, red = false) {
  if (to - from <= 1e-6) return;
  if (to - from > 0.3) {
    const c = from + (to - from) * CUTS[i % CUTS.length];
    out.push({ from, to: c, red, dot: false }, { from: c, to, red, dot: false });
  } else out.push({ from, to, red, dot: false });
}

/**
 * The goal bar: a red dot at the start, a few long black pills up to the
 * steps, another red dot at half the goal once passed. Past the goal the bar
 * stands for all the steps: black up to the goal, one red pill after it.
 */
export function goalTrack(steps: number, goal: number): { filled: number; parts: Part[] } {
  const s = Math.max(0, Number(steps) || 0);
  const g = Math.max(0, Number(goal) || 0);
  if (g <= 0 || s <= 0) return { filled: 0, parts: [] };
  const filled = s <= g ? s / g : 1;
  const goalAt = s <= g ? 1 : g / s;
  const black = Math.min(filled, goalAt);
  const marks = [0, 0.5 * goalAt].filter((m) => m === 0 || m < black - 0.03);
  const out: Part[] = [];
  let a = 0;
  [...marks, black].forEach((stop, i) => {
    pills(out, a, stop, i);
    if (i < marks.length) out.push({ from: stop, to: stop, red: true, dot: true });
    a = stop;
  });
  if (filled > goalAt + 1e-6) out.push({ from: goalAt, to: 1, red: true, dot: false });
  return { filled, parts: out };
}

/** Sleep's bar: two black pills over the night's share, a red dot at its end. */
export function sleepTrack(share: number): Part[] {
  const f = Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : 0;
  if (f <= 0) return [];
  const out: Part[] = [];
  if (f > 0.15) out.push({ from: 0, to: 0.4 * f, red: false, dot: false }, { from: 0.4 * f, to: f, red: false, dot: false });
  else out.push({ from: 0, to: f, red: false, dot: false });
  out.push({ from: f, to: f, red: true, dot: true });
  return out;
}
