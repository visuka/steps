/**
 * The colours of a stat tile, worked out from the theme alone so jest can
 * check every theme's pairs. The text colours always belong to the plate they
 * sit on: a selected tile is painted secondaryContainer, so its number, unit
 * and note take onSecondaryContainer (theme F's selected plate is the same ink
 * as its body text).
 */

import { type ColorScheme, type DataTone, toneColors } from '@/constants/tokens';

export type TileLook = 'filled' | 'outlined' | 'plain';

export interface TileColors {
  /** The tile's own colour. */
  plate: string;
  border: string;
  borderWidth: number;
  /** The number. */
  text: string;
  /** The label, unit, note and icon. */
  quiet: string;
  /** True when the tile sits in its tone's container (children read the tone plate). */
  toned: boolean;
}

export function tileColors(c: ColorScheme, look: TileLook, tone: DataTone | undefined, selected: boolean): TileColors {
  if (tone && look === 'filled') {
    const t = toneColors(c, tone);
    // A filled tile keeps its colour when selected and gains a 2 dp ink edge.
    return {
      plate: t.container,
      border: selected ? t.onContainer : t.container,
      borderWidth: 2,
      text: t.onContainer,
      quiet: t.onContainer,
      toned: true,
    };
  }
  if (selected) {
    return {
      plate: c.secondaryContainer,
      border: c.secondaryContainer,
      borderWidth: look === 'plain' ? 0 : 1,
      text: c.onSecondaryContainer,
      quiet: c.onSecondaryContainer,
      toned: false,
    };
  }
  if (look === 'plain') {
    return { plate: c.surfaceContainer, border: c.surfaceContainer, borderWidth: 0, text: c.onSurface, quiet: c.onSurfaceVariant, toned: false };
  }
  return {
    plate: c.surfaceContainerLowest,
    border: c.outlineVariant,
    borderWidth: 1,
    text: c.onSurface,
    quiet: c.onSurfaceVariant,
    toned: false,
  };
}
