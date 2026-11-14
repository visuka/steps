import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { memo, type ReactNode, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActiveTheme } from '@/constants/theme';
import { mapColorsOf } from '@/constants/themes/build';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { routeBounds, type WalkPoint } from '@/lib/walk';
import { lineColor, type RouteLine } from '@/walks/view';

import { MAP_STYLE_URL, type MapStyle, mapSchemeFor, themedMapStyle } from './map-style';

const SOLID = ['route', 'part'];
const DASHED = ['weak', 'left-out'];

/** A start or end dot as the mockups draw it in SVG: radius to the middle of the ring, and the ring's width. */
export interface RouteDot {
  r: number;
  ring: number;
}

/**
 * A walk's route on a map, in the theme's map colours (ThemeDef.map; park
 * keeps OpenFreeMap's style for the scheme). Pass `lines` (from routeLines)
 * to draw weak GPS and vehicle or cycling parts their own way; `points`
 * alone draws one line. `follow` keeps the latest point in view while
 * recording; otherwise the map frames the whole route. `children` sit over
 * the map (the walk screen's weather chip or scale bar).
 *
 * Memoised: a recording screen re-renders every second for its clock, and the
 * map should only get a new source when the route itself changes.
 */
export const RouteMap = memo(function RouteMap({
  points,
  lines,
  height,
  follow,
  dots,
  radius,
  label,
  children,
}: {
  points?: WalkPoint[];
  lines?: RouteLine[];
  height: number;
  follow?: boolean;
  /** Default: 6 dp dots inside 3 dp rings. */
  dots?: { start: RouteDot; end: RouteDot };
  /** The frame's corner radius; default the theme's map radius. */
  radius?: number;
  /** What TalkBack reads for the map. */
  label?: string;
  children?: ReactNode;
}) {
  const theme = useTheme();
  // The map follows its theme, never the phone's dark mode (mapSchemeFor).
  const scheme = mapSchemeFor(useColorScheme());
  const colors = useMemo(() => mapColorsOf(ActiveTheme, scheme), [scheme]);
  // A theme with its own map colours repaints the tiles; until that style is read the frame shows its land colour.
  const [styled, setStyled] = useState<MapStyle | string | null>(ActiveTheme.map ? null : MAP_STYLE_URL[scheme]);
  useEffect(() => {
    if (!ActiveTheme.map) {
      setStyled(MAP_STYLE_URL[scheme]);
      return;
    }
    let live = true;
    themedMapStyle(colors).then((s) => {
      if (live) setStyled(s ?? MAP_STYLE_URL[colors.base]);
    });
    return () => {
      live = false;
    };
  }, [colors, scheme]);

  const drawn: RouteLine[] = useMemo(
    () => lines ?? (points && points.length >= 2 ? [{ kind: 'route', ord: null, points }] : []),
    [lines, points],
  );
  const all = useMemo(() => drawn.flatMap((l) => l.points), [drawn]);
  const first = all[0];
  const last = all[all.length - 1];
  const b = useMemo(() => routeBounds(all), [all]);
  const lastLon = last?.lon;
  const lastLat = last?.lat;
  const center = useMemo<[number, number] | null>(
    () => (lastLon !== undefined && lastLat !== undefined ? [lastLon, lastLat] : null),
    [lastLon, lastLat],
  );

  const route: GeoJSON.FeatureCollection = useMemo(() => ({
    type: 'FeatureCollection',
    features: [
      ...drawn.map((l) => ({
        type: 'Feature' as const,
        // The route in the map's own colour (the mockup's); parts as before.
        properties: { kind: l.kind, color: l.kind === 'route' || l.kind === 'weak' ? colors.route : lineColor(theme, l.kind) },
        geometry: { type: 'LineString' as const, coordinates: l.points.map((p) => [p.lon, p.lat]) },
      })),
      ...(first && last
        ? [
            {
              type: 'Feature' as const,
              properties: { end: 0 },
              geometry: { type: 'Point' as const, coordinates: [first.lon, first.lat] },
            },
            {
              type: 'Feature' as const,
              properties: { end: 1 },
              geometry: { type: 'Point' as const, coordinates: [last.lon, last.lat] },
            },
          ]
        : []),
    ],
  }), [drawn, first, last, theme, colors]);

  const start = dots?.start ?? { r: 7.5, ring: 3 };
  const end = dots?.end ?? { r: 7.5, ring: 3 };
  // SVG's r runs to the middle of the ring; MapLibre's circle-radius stops where the ring starts.
  const inner = (d: RouteDot) => Math.max(0, d.r - d.ring / 2);
  const width = colors.routeWidth;

  return (
    <View
      style={[
        styles.frame,
        {
          height,
          backgroundColor: colors.land,
          borderRadius: radius ?? colors.radius,
          ...(colors.border ? { borderWidth: 1, borderColor: colors.border } : null),
        },
      ]}
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}>
      {styled ? (
        <Map mapStyle={styled as never} style={StyleSheet.absoluteFill} compass={false} logo={false} attribution>
          {follow && center ? (
            <Camera center={center} zoom={16} duration={500} />
          ) : b ? (
            <Camera
              initialViewState={{
                bounds: [b.west, b.south, b.east, b.north],
                padding: { top: 40, right: 40, bottom: 40, left: 40 },
              }}
            />
          ) : null}
          <GeoJSONSource id="route" data={route}>
            {colors.casing ? (
              /* A casing keeps the route apart from roads and parks under it (park's map). */
              <Layer
                id="route-casing"
                type="line"
                filter={['==', ['geometry-type'], 'LineString']}
                paint={{ 'line-color': colors.casing, 'line-width': width + 4 }}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              />
            ) : null}
            <Layer
              id="route-solid"
              type="line"
              filter={['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'kind'], ['literal', SOLID]]]}
              paint={{ 'line-color': ['get', 'color'], 'line-width': width }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id="route-dashed"
              type="line"
              filter={['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'kind'], ['literal', DASHED]]]}
              paint={{ 'line-color': ['get', 'color'], 'line-width': Math.max(3, width - 1), 'line-dasharray': [1.5, 1.5] }}
              layout={{ 'line-join': 'round' }}
            />
            <Layer
              id="route-ends"
              type="circle"
              filter={['==', ['geometry-type'], 'Point']}
              paint={{
                'circle-radius': ['case', ['==', ['get', 'end'], 1], inner(end), inner(start)],
                'circle-color': ['case', ['==', ['get', 'end'], 1], colors.end, colors.start],
                'circle-stroke-color': ['case', ['==', ['get', 'end'], 1], colors.endRing, colors.startRing],
                'circle-stroke-width': ['case', ['==', ['get', 'end'], 1], end.ring, start.ring],
              }}
            />
          </GeoJSONSource>
        </Map>
      ) : null}
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
});
