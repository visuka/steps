/**
 * The oval running track: two straights and two bends, drawn as the centre
 * line of the lane. Distance starts at the middle of the bottom straight and
 * runs anticlockwise, as on a real track. Plain maths (no React), so jest
 * can test it and Reanimated can run pointOnTrack on the UI thread.
 */

export interface TrackShape {
  /** Centre of the oval. */
  cx: number;
  cy: number;
  /** Radius of the bends, on the lane's centre line. */
  r: number;
  /** Length of each straight. */
  straight: number;
  /** Length of one lap along the centre line. */
  perimeter: number;
}

export interface TrackPoint {
  x: number;
  y: number;
  /** Unit normal pointing out of the oval, for painting ticks across the lane. */
  nx: number;
  ny: number;
}

/** The centre line of a lane `lane` wide drawn inside a `width` × `height` box. */
export function trackShape(width: number, height: number, lane: number): TrackShape {
  const w = Math.max(0, width - lane);
  const h = Math.max(0, Math.min(height, width) - lane);
  const r = h / 2;
  const straight = Math.max(0, w - h);
  return { cx: width / 2, cy: height / 2, r, straight, perimeter: 2 * straight + 2 * Math.PI * r };
}

/** SVG path of the centre line, starting at the middle of the bottom straight, anticlockwise. */
export function trackPath({ cx, cy, r, straight }: TrackShape): string {
  const half = straight / 2;
  const right = cx + half;
  const left = cx - half;
  return [
    `M ${cx} ${cy + r}`,
    `H ${right}`,
    `A ${r} ${r} 0 0 0 ${right} ${cy - r}`,
    `H ${left}`,
    `A ${r} ${r} 0 0 0 ${left} ${cy + r}`,
    'Z',
  ].join(' ');
}

/** The point `fraction` (0–1) of the way round one lap. */
export function pointOnTrack(shape: TrackShape, fraction: number): TrackPoint {
  'worklet';
  const { cx, cy, r, straight, perimeter } = shape;
  const half = straight / 2;
  const bend = Math.PI * r;
  let d = (((fraction % 1) + 1) % 1) * perimeter;

  // Bottom straight, from the middle to the right.
  if (d <= half) return { x: cx + d, y: cy + r, nx: 0, ny: 1 };
  d -= half;
  // Right bend, bottom to top.
  if (d <= bend) {
    const a = Math.PI / 2 - (r > 0 ? d / r : 0);
    return { x: cx + half + r * Math.cos(a), y: cy + r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) };
  }
  d -= bend;
  // Top straight, right to left.
  if (d <= straight) return { x: cx + half - d, y: cy - r, nx: 0, ny: -1 };
  d -= straight;
  // Left bend, top to bottom.
  if (d <= bend) {
    const a = -Math.PI / 2 - (r > 0 ? d / r : 0);
    return { x: cx - half + r * Math.cos(a), y: cy + r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) };
  }
  d -= bend;
  // Bottom straight, from the left back to the middle.
  return { x: cx - half + Math.min(d, half), y: cy + r, nx: 0, ny: 1 };
}

/**
 * How a step count sits on the track when one lap is the daily goal: how
 * much of the lane is covered (0–1, full once the goal is reached), where
 * the runner is on the current lap, and which lap that is (1 for the first).
 */
export function lapPosition(laps: number): { covered: number; runner: number; lap: number } {
  'worklet';
  const t = Math.max(0, Number.isFinite(laps) ? laps : 0);
  if (t < 1) return { covered: t, runner: t, lap: 1 };
  const whole = Math.floor(t);
  return { covered: 1, runner: t - whole, lap: whole + 1 };
}
