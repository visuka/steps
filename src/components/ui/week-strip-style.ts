/** The Today week strip (spec 5.2), as plain numbers, a colour helper and a label builder. */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import type { ColorScheme } from '@/constants/tokens';

import { mixHex } from './hero-colors';

export interface WeekDay {
  /** Mon to Sun. */
  label: string;
  /** Share of that day's goal, 0..1 (more than 1 draws full); null = no data. */
  share: number | null;
}

export const WEEK_STYLE = {
  dayWidth: CLEAN_SPEC.sizes.week.dayWidth,
  /** A minimum: grows with large text. */
  dayMinHeight: CLEAN_SPEC.sizes.week.dayHeight,
  dayRadius: CLEAN_SPEC.radius.dayChip,
  gap: CLEAN_SPEC.space.s8,
  trackWidth: CLEAN_SPEC.sizes.week.trackWidth,
  trackHeight: CLEAN_SPEC.sizes.week.trackHeight,
  trackRadius: CLEAN_SPEC.radius.track,
  minTouch: CLEAN_SPEC.sizes.nav.minTouch,
  /** Today's label: s13 at 500. */
  todayWeight: '500',
} as const;

/** Hit slop per side that lifts the 40 dp column to 48 dp wide (60 tall already). */
export function dayHitSlop(): { horizontal: number; vertical: number } {
  return {
    horizontal: Math.max(0, Math.ceil((WEEK_STYLE.minTouch - WEEK_STYLE.dayWidth) / 2)),
    vertical: Math.max(0, Math.ceil((WEEK_STYLE.minTouch - WEEK_STYLE.dayMinHeight) / 2)),
  };
}

/** Height of the inner fill: share clamped to 0..1 times the track; null or NaN = none. */
export function fillHeight(share: number | null): number {
  if (share === null || !Number.isFinite(share)) return 0;
  return Math.min(1, Math.max(0, share)) * WEEK_STYLE.trackHeight;
}

type TrackTheme = Pick<ColorScheme, 'primary' | 'primaryContainer'>;

/**
 * Today's track: the spec's selectedTrack in Clean+, a mix of the tint and
 * primary in the other looks, so it differs from the box and from the fill.
 */
export function selectedTrack(theme: TrackTheme): string {
  const k = CLEAN_SPEC.colors;
  if (theme.primary.toUpperCase() === k.accent) return k.selectedTrack;
  return mixHex(theme.primaryContainer, theme.primary, 0.25);
}

/** "Mon, 90 percent of goal", "Sat, today, 78 percent of goal", "Sun, no data". */
export function weekDayLabel(label: string, share: number | null, isToday: boolean): string {
  const day = isToday ? `${label}, today` : label;
  if (share === null || !Number.isFinite(share)) return `${day}, no data`;
  return `${day}, ${Math.round(Math.max(0, share) * 100)} percent of goal`;
}
