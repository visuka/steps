/**
 * The Steps tile's figures (owner, 17 Nov 2026; docs/design.md "Current:
 * Today"), kept apart from the drawing so jest can check them without React
 * Native: dots per hour, the hours on your feet, the goal bar's segments.
 */

/** Rows of dots per hour, and segments in the goal bar. */
export const STEPS_TILE = { dotRows: 8, goalSegments: 16 } as const;

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

/**
 * The goal bar's segments: black up to the steps (to the goal at most), red
 * for steps past the goal, the rest still to walk. Past the goal the bar
 * stands for all the steps, so the red part shows how far past.
 */
export function goalSegments(steps: number, goal: number, n: number = STEPS_TILE.goalSegments): { done: number; extra: number; left: number } {
  const s = Math.max(0, Number(steps) || 0);
  const g = Math.max(0, Number(goal) || 0);
  if (g <= 0) return { done: 0, extra: 0, left: n };
  if (s <= g) {
    const done = Math.min(n, Math.round((s / g) * n));
    return { done, extra: 0, left: n - done };
  }
  const done = Math.max(1, Math.min(n - 1, Math.round((g / s) * n)));
  return { done, extra: n - done, left: 0 };
}
