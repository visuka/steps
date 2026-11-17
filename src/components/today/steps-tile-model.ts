/**
 * The Steps tile's figures (owner, 17 Nov 2026; docs/design.md "Current:
 * Today"), kept apart from the drawing so jest can check them without React
 * Native: dots per hour, the hours on your feet, the pills of the bars.
 */

/** Rows of dots per hour. */
export const STEPS_TILE = { dotRows: 8 } as const;

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

/** One rounded piece of a bar: its share of the whole bar, and whether it is red. */
export interface Pill {
  w: number;
  red: boolean;
}

/** Pill lengths, as shares of the whole bar, repeated: long and short mixed (owner's reference). */
export const PILL_PATTERN = [0.075, 0.035, 0.12, 0.05, 0.095, 0.04, 0.13, 0.06] as const;

/**
 * A filled stretch (0..1 of the bar) cut into pills of mixed length. With
 * `goalAt`, the pills after it are red (steps past the goal); otherwise the
 * last pill is red when `leadRed` (where you are now). No slivers at the end.
 * `stretch` lengthens every pill, for short bars (Sleep, in a half card).
 */
export function pillRun(filled: number, goalAt: number | null = null, leadRed = true, stretch = 1): Pill[] {
  const f = Number.isFinite(filled) ? Math.min(1, Math.max(0, filled)) : 0;
  const out: Pill[] = [];
  let a = 0;
  for (let i = 0; a < f - 1e-6 && i < 200; i++) {
    let b = Math.min(f, a + PILL_PATTERN[i % PILL_PATTERN.length] * stretch);
    if (f - b < 0.02) b = f;
    if (goalAt !== null && a < goalAt - 1e-6 && b > goalAt + 1e-6) b = goalAt;
    out.push({ w: b - a, red: goalAt !== null && a >= goalAt - 1e-6 });
    a = b;
  }
  if (goalAt === null && leadRed && out.length) out[out.length - 1].red = true;
  return out;
}

/**
 * The goal bar: black pills up to the steps with the leading one red, the
 * rest still to walk. Past the goal the bar stands for all the steps: black
 * up to the goal, red after it.
 */
export function goalPills(steps: number, goal: number): { filled: number; pills: Pill[] } {
  const s = Math.max(0, Number(steps) || 0);
  const g = Math.max(0, Number(goal) || 0);
  if (g <= 0 || s <= 0) return { filled: 0, pills: [] };
  if (s <= g) return { filled: s / g, pills: pillRun(s / g) };
  return { filled: 1, pills: pillRun(1, g / s) };
}

/** An hour's dots as a small peak of three columns: the middle the tallest. */
export function clusterDots(n: number): [number, number, number] {
  const k = Math.max(0, Math.round(Number(n) || 0));
  if (k === 0) return [0, 0, 0];
  return [Math.max(1, Math.round(k * 0.6)), k, Math.max(1, Math.round(k * 0.8))];
}
