/**
 * Where a tap on Today goes, and the "Walk in progress" card's line, as plain
 * functions (no theme, no router) so jest can check them. index.tsx wires them.
 */

import type { Units } from '@/lib/format';

import { distanceOf } from './model';

/** The detail screens exist (app/detail/[kind].tsx): the tiles open them. False restores the old targets. */
export const DETAIL_ROUTES_LIVE = true;

export type DetailKind = 'steps' | 'food' | 'water' | 'sleep' | 'walk';

/** A router target: a path, with params when the path is a pattern. */
export interface DetailTarget {
  pathname: string;
  params?: Record<string, string>;
}

/**
 * The screen a tap on `kind` opens: /detail/<kind> for steps, food, water and
 * sleep (the series screen's kinds, state/series.ts). The Walk tile has no
 * detail screen: it opens today's walk (`walkId`), or Activity when there is
 * none. Null only in the old (not live) layout, where Water acted in place.
 */
export function detailRoute(
  kind: DetailKind,
  walkId: string | null = null,
  live: boolean = DETAIL_ROUTES_LIVE,
): DetailTarget | null {
  if (kind === 'walk') return walkId ? { pathname: '/walk/[id]', params: { id: walkId } } : { pathname: '/activity' };
  if (live) return { pathname: `/detail/${kind}` };
  switch (kind) {
    case 'steps':
      return { pathname: '/activity' };
    case 'food':
      return { pathname: '/food' };
    case 'water':
      return null;
    case 'sleep':
      return { pathname: '/journal', params: { section: 'sleep' } };
  }
}

/**
 * "12 min · 1.1 km": the line under "Walk in progress" (spec 10.3). Whole
 * minutes, rounded down, so a walk just begun reads "0 min". `distanceM` is
 * null when there is no route yet (an indoor walk): then only the time shows.
 */
export function walkingLine(elapsedS: number, distanceM: number | null, units: Units): string {
  const min = `${Math.max(0, Math.floor(elapsedS / 60))} min`;
  if (distanceM === null) return min;
  const d = distanceOf(distanceM, units);
  return `${min} · ${d.value} ${d.unit}`;
}

/** The card's spoken label: "Walk in progress, 12 min · 1.1 km". */
export function walkingSpoken(line: string): string {
  return `Walk in progress, ${line}`;
}
