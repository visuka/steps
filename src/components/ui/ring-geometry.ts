/** A thin progress ring as plain numbers (butt caps, starts at 12 o'clock, clamps at 100 %). */

export const RING = { minSize: 40, maxSize: 88, defaultStroke: 4 } as const;

export function clampShare(value: number, goal: number): number {
  if (!(goal > 0) || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1, value / goal);
}

/** Size kept inside 40..88. */
export function ringSize(size: number): number {
  return Math.min(RING.maxSize, Math.max(RING.minSize, size));
}

/** Dash pattern for the arc: draw `share` of the circumference; the circle is rotated -90 deg to start at the top. */
export function ringArc(share: number, r: number): { circumference: number; dasharray: string; offset: number } {
  const circumference = 2 * Math.PI * r;
  const s = Math.min(1, Math.max(0, share));
  return { circumference, dasharray: `${s * circumference} ${circumference}`, offset: 0 };
}

export function ringLabel(value: number, goal: number): string {
  return `${Math.round(clampShare(value, goal) * 100)} percent`;
}
