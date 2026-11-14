import { describe, expect, it } from '@jest/globals';

import clean from '@/constants/themes/clean';
import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import d from '@/constants/themes/d';
import { THEMES } from '@/constants/themes';

import { layerColor, MAP_STYLE_URL, mapSchemeFor, restyle } from '../map-style';

const map = d.map!;

describe('themed map style', () => {
  it('paints land, water, parks, streets and labels in the theme colours', () => {
    const style = {
      version: 8,
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#000' } },
        { id: 'water', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': '#000' } },
        { id: 'park', type: 'fill', 'source-layer': 'park', paint: { 'fill-color': '#000' } },
        { id: 'building', type: 'fill', 'source-layer': 'building', paint: { 'fill-color': '#000' } },
        { id: 'highway_major_inner', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': '#000' } },
        { id: 'highway_minor', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': '#000' } },
        { id: 'boundary_2', type: 'line', 'source-layer': 'boundary', paint: { 'line-color': '#000' } },
        { id: 'place_city', type: 'symbol', 'source-layer': 'place', paint: { 'text-color': '#000' } },
        { id: 'hills', type: 'hillshade' },
      ],
    };
    const out = restyle(style, map).layers;
    expect(out[0].paint?.['background-color']).toBe(map.land);
    expect(out[1].paint?.['fill-color']).toBe(map.water);
    expect(out[2].paint?.['fill-color']).toBe(map.park);
    expect(out[3].paint?.['fill-color']).toBe(map.building);
    expect(out[4].paint?.['line-color']).toBe(map.road);
    expect(out[5].paint?.['line-color']).toBe(map.minorRoad);
    expect(out[6].layout?.visibility).toBe('none');
    expect(out[7].paint).toMatchObject({ 'text-color': map.label, 'text-halo-color': map.land, 'icon-opacity': 0 });
    expect(out[8]).toBe(style.layers[8]);
    expect(style.layers[0].paint?.['background-color']).toBe('#000');
  });

  it('leaves layer types it does not know alone', () => {
    expect(layerColor({ id: 'x', type: 'raster' }, map)).toBeNull();
  });
});

describe('the map never follows the phone dark mode', () => {
  it('is the light base whatever the phone says', () => {
    for (const phone of ['light', 'dark', 'unspecified', null, undefined] as const) {
      const scheme = mapSchemeFor(phone);
      expect(scheme).toBe('light');
      expect(MAP_STYLE_URL[scheme]).toBe('https://tiles.openfreemap.org/styles/positron');
    }
  });

  it('gives Clean+ the mockup map: its colours on the light base', () => {
    const m = clean.map!;
    expect(m.base).toBe('light');
    expect(MAP_STYLE_URL[m.base]).toBe(MAP_STYLE_URL[mapSchemeFor('dark')]);
    expect(m).toMatchObject({
      land: CLEAN_SPEC.colors.mapLand,
      water: CLEAN_SPEC.colors.mapWater,
      park: CLEAN_SPEC.colors.mapBlock,
      building: CLEAN_SPEC.colors.mapBlock,
      road: CLEAN_SPEC.colors.white,
      minorRoad: CLEAN_SPEC.colors.white,
      route: CLEAN_SPEC.colors.accent,
      routeWidth: 3,
      casing: null,
      height: CLEAN_SPEC.sizes.map.height,
    });
  });

  it('repaints a style in the light colours in both phone modes', () => {
    const style = {
      version: 8,
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#000' } },
        { id: 'water', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': '#000' } },
      ],
    };
    for (const phone of ['light', 'dark'] as const) {
      const out = restyle(style, clean.map!).layers;
      expect(mapSchemeFor(phone)).toBe(clean.map!.base);
      expect(out[0].paint?.['background-color']).toBe(CLEAN_SPEC.colors.mapLand);
      expect(out[1].paint?.['fill-color']).toBe(CLEAN_SPEC.colors.mapWater);
    }
  });

  it('keeps each look its own map colours; only Night has a dark base', () => {
    const dark = THEMES.filter((t) => t.map?.base === 'dark').map((t) => t.id);
    expect(dark).toEqual(['b']);
    for (const t of THEMES) if (t.map) expect(t.map.land).toMatch(/^#/);
  });
});
