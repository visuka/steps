/**
 * The walk map in the theme's own colours (ThemeDef.map, mapColorsOf): the
 * OpenFreeMap style is fetched once and every layer repainted with the
 * mockup's land, streets, parks, water, buildings and labels, so a light
 * theme gets its light map whatever the phone's dark mode.
 */

import type { MapColors } from '@/constants/themes/types';

/**
 * OpenFreeMap: OpenStreetMap tiles, free with no key, commercial use allowed.
 * Muted styles, one per scheme; the theme's colours go over them.
 */
export const MAP_STYLE_URL = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

export type MapScheme = 'light' | 'dark';

/**
 * The scheme of the map a theme without its own map colours falls back to. The
 * phone's dark mode is never read: a map follows its theme (a theme with `map`
 * colours carries its own base), so a light look keeps its light map on a
 * phone in dark mode (the dark map bug).
 */
export function mapSchemeFor(_phone?: MapScheme | 'unspecified' | null): MapScheme {
  return 'light';
}

/** The parts of a MapLibre style this touches; everything else passes through. */
export interface StyleLayer {
  id: string;
  type: string;
  'source-layer'?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface MapStyle {
  layers: StyleLayer[];
  [key: string]: unknown;
}

const WATER = /water|ocean|lake|river|stream|canal|sea\b/;
const GREEN = /park|wood|grass|forest|landcover|green|cemetery|garden|pitch|scrub|meadow|nature/;
const BUILDING = /building/;
const MAJOR = /motorway|trunk|primary|secondary|major/;
const ROAD = /road|highway|street|tunnel|bridge|path|track|service|minor|aeroway|rail|transit|pier/;
const BOUNDARY = /boundary|admin/;

/** Which of the theme's colours a layer takes, or 'hide' (borders, POI icons). */
export function layerColor(layer: Pick<StyleLayer, 'id' | 'type' | 'source-layer'>, c: MapColors): string | 'hide' | null {
  const key = `${layer.id} ${layer['source-layer'] ?? ''}`.toLowerCase();
  switch (layer.type) {
    case 'background':
      return c.land;
    case 'fill':
      if (WATER.test(key)) return c.water;
      if (BUILDING.test(key)) return c.building;
      if (GREEN.test(key)) return c.park;
      return c.land;
    case 'fill-extrusion':
      return c.building;
    case 'line':
      if (BOUNDARY.test(key)) return 'hide';
      if (WATER.test(key)) return c.water;
      if (BUILDING.test(key)) return c.building;
      if (MAJOR.test(key)) return c.road;
      if (ROAD.test(key)) return c.minorRoad;
      return c.minorRoad;
    case 'symbol':
      return c.label;
    default:
      return null;
  }
}

/** The style with every layer in the theme's colours. Pure: the tests check it. */
export function restyle(style: MapStyle, c: MapColors): MapStyle {
  const layers = style.layers.map((layer): StyleLayer => {
    const color = layerColor(layer, c);
    if (color === null) return layer;
    if (color === 'hide') return { ...layer, layout: { ...layer.layout, visibility: 'none' } };
    const paint = { ...layer.paint };
    switch (layer.type) {
      case 'background':
        paint['background-color'] = color;
        delete paint['background-pattern'];
        break;
      case 'fill':
        paint['fill-color'] = color;
        paint['fill-outline-color'] = color;
        delete paint['fill-pattern'];
        break;
      case 'fill-extrusion':
        paint['fill-extrusion-color'] = color;
        break;
      case 'line':
        paint['line-color'] = color;
        delete paint['line-pattern'];
        break;
      case 'symbol':
        paint['text-color'] = color;
        paint['text-halo-color'] = c.land;
        // Shop and transit icons would be the only other colour on the map.
        paint['icon-opacity'] = 0;
        break;
    }
    return { ...layer, paint };
  });
  return { ...style, layers };
}

const cache = new Map<string, Promise<MapStyle | null>>();

/** The theme's map style, fetched once per run; null when it can't be read (the plain style is drawn then). */
export function themedMapStyle(c: MapColors): Promise<MapStyle | null> {
  const key = JSON.stringify(c);
  let found = cache.get(key);
  if (!found) {
    found = fetch(MAP_STYLE_URL[c.base])
      .then((r) => (r.ok ? (r.json() as Promise<MapStyle>) : null))
      .then((s) => (s && Array.isArray(s.layers) ? restyle(s, c) : null))
      .catch(() => null);
    // A failure is tried again next time the map opens.
    found.then((s) => {
      if (!s) cache.delete(key);
    });
    cache.set(key, found);
  }
  return found;
}
