import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { routeBounds, type WalkPoint } from '@/lib/walk';
import { lineColor, type RouteLine } from '@/walks/view';

/** OpenFreeMap: OpenStreetMap tiles, free with no key, commercial use allowed. */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const SOLID = ['route', 'part'];
const DASHED = ['weak', 'left-out'];

/**
 * A walk's route on a map. Pass `lines` (from routeLines) to draw weak GPS
 * and vehicle or cycling parts their own way; `points` alone draws one line.
 * `follow` keeps the latest point in view while recording; otherwise the map
 * frames the whole route.
 */
export function RouteMap({
  points,
  lines,
  height,
  follow,
}: {
  points?: WalkPoint[];
  lines?: RouteLine[];
  height: number;
  follow?: boolean;
}) {
  const theme = useTheme();
  const drawn: RouteLine[] =
    lines ?? (points && points.length >= 2 ? [{ kind: 'route', ord: null, points }] : []);
  const all = drawn.flatMap((l) => l.points);
  const first = all[0];
  const last = all[all.length - 1];
  const b = routeBounds(all);

  const route: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      ...drawn.map((l) => ({
        type: 'Feature' as const,
        properties: { kind: l.kind, color: lineColor(theme, l.kind) },
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
  };

  return (
    <View style={[styles.frame, { height, backgroundColor: theme.surfaceContainerHigh }]}>
      <Map mapStyle={MAP_STYLE} style={StyleSheet.absoluteFill} compass={false} logo={false} attribution>
        {follow && last ? (
          <Camera center={[last.lon, last.lat]} zoom={16} duration={500} />
        ) : b ? (
          <Camera
            initialViewState={{
              bounds: [b.west, b.south, b.east, b.north],
              padding: { top: 40, right: 40, bottom: 40, left: 40 },
            }}
          />
        ) : null}
        <GeoJSONSource id="route" data={route}>
          <Layer
            id="route-solid"
            type="line"
            filter={['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'kind'], ['literal', SOLID]]]}
            paint={{ 'line-color': ['get', 'color'], 'line-width': 5 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
          <Layer
            id="route-dashed"
            type="line"
            filter={['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'kind'], ['literal', DASHED]]]}
            paint={{ 'line-color': ['get', 'color'], 'line-width': 4, 'line-dasharray': [1.5, 1.5] }}
            layout={{ 'line-join': 'round' }}
          />
          <Layer
            id="route-ends"
            type="circle"
            filter={['==', ['geometry-type'], 'Point']}
            paint={{
              'circle-radius': 6,
              'circle-color': ['case', ['==', ['get', 'end'], 1], theme.steps, theme.tick],
              'circle-stroke-color': theme.steps,
              'circle-stroke-width': 3,
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: Radius.md, overflow: 'hidden' },
});
