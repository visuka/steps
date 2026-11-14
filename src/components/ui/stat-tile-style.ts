/** The Clean+ stat tile (spec 5.5, section 3), as plain numbers and label builders. */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

const T = CLEAN_SPEC.sizes.tile;

/**
 * Bottom padding of a tile that ends in a note line (the walk tile). The mockup
 * draws the note ending 6 dp above the tile bottom (y 708 of 714), because
 * 16 + 40 + 16 + 18 + 24 + 8 + 18 + 16 = 156 would not fit the 146 dp height.
 */
const NOTE_BOTTOM_PADDING = 6;

export const TILE_STYLE = {
  radius: CLEAN_SPEC.radius.tile,
  padding: T.padding,
  /** A minimum: at 1.3x text the tile grows, never clips. */
  minHeight: T.height,
  boxShadow: CLEAN_SPEC.shadow.card,
  /** Header row: the 40 dp icon circle on the left, the optional trailing item on the right. */
  headerHeight: CLEAN_SPEC.icon.circle,
  circleRadius: CLEAN_SPEC.icon.circle / 2,
  /** Between the header and the label. */
  labelGap: T.gap,
  /** Between the value and the bar or pips. */
  extraGap: CLEAN_SPEC.space.s12,
  /** Between the value and a line of text instead of a bar (the walk tile). */
  noteGap: CLEAN_SPEC.space.s8,
} as const;

/** Bottom padding: the short one when the tile ends in a note, the spec padding otherwise. */
export function tileBottomPadding(hasNote: boolean, hasExtra: boolean): number {
  return hasNote && !hasExtra ? NOTE_BOTTOM_PADDING : T.padding;
}

/** The value and its unit as nested inline text: '5 ' then the unit (spec 3: one space). */
export function valueWithUnit(value: string, unit?: string): { value: string; unit?: string } {
  return unit ? { value: `${value} `, unit } : { value };
}

/** What a screen reader says for the whole tile, e.g. "Water, 5 of 8 glasses". */
export function tileAccessibilityLabel(label: string, value: string, unit?: string, note?: string): string {
  return `${label}, ${value}${unit ? ` ${unit}` : ''}${note ? `, ${note}` : ''}`;
}

/**
 * How a tile's value is drawn. 'muted' is the spec 10.2 "no walk yet" value:
 * body 15/22 at 400 in the muted colour (the bodyMedium role). 'mutedValue' is the
 * spec 10.2 sleep "no data" dash: the normal value size (18/24 at 500, the
 * titleMedium role) in the muted colour.
 */
export type TileValueStyle = 'default' | 'muted' | 'mutedValue';

/** The theme type role that carries the value: body for 'muted', the value role otherwise. */
export function valueTypeRole(style: TileValueStyle = 'default'): 'bodyMedium' | 'titleMedium' {
  return style === 'muted' ? 'bodyMedium' : 'titleMedium';
}

/** Whether the value takes the muted colour instead of the ink. */
export function valueIsMuted(style: TileValueStyle = 'default'): boolean {
  return style !== 'default';
}
