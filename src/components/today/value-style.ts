/**
 * Which tiles draw their value muted (spec 10.2). Pure, so jest can check it;
 * today-clean.tsx passes the result to StatTile's `valueStyle`.
 *  - Sleep, no data: the dash "—" keeps the value size (18/24 at 500) in the muted colour.
 *  - Walk, no walk today: "No walk yet" is body 15/22 at 400 in the muted colour.
 */
import type { TileValueStyle } from '@/components/ui/stat-tile-style';

export type TodayTileKind = 'food' | 'water' | 'sleep' | 'walk';

/** The model fields this needs: a walk with a walk today has a pill, one without has none. */
export interface ValueStyleInput {
  value: string;
  pill?: string;
  /** A Premium-locked tile: "Premium" is body 15/22 in the muted colour (spec 10.3). */
  locked?: boolean;
}

export function tileValueStyle(kind: TodayTileKind, model: ValueStyleInput): TileValueStyle {
  if (model.locked) return 'muted';
  if (kind === 'sleep' && model.value === '—') return 'mutedValue';
  if (kind === 'walk' && !model.pill) return 'muted';
  return 'default';
}
