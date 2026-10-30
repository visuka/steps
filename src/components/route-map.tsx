import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { routeBounds, type WalkPoint } from '@/lib/walk';

/** OpenFreeMap: OpenStreetMap tiles, free with no key, commercial use allowed. */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * A walk's route on a map. `follow` keeps the latest point in view while
 * recording; otherwise the map frames the whole route.
 */
export function RouteMap({ points, height, follow }: { points: WalkPoint[]; height: number; follow?: boolean }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const coordinates = points.map((p) => [p.lon, p.lat]);
  const last = points[points.length - 1];
  const b = routeBounds(points);

  const route: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      ...(coordinates.length >= 2
        ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } }]
        : []),
      ...(points.length
        ? [
            {
              type: 'Feature' as const,
              properties: { end: 0 },
              geometry: { type: 'Point' as const, coordinates: [points[0].lon, points[0].lat] },
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
    <View style={[styles.frame, { height }]}>
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
            id="route-line"
            type="line"
            filter={['==', ['geometry-type'], 'LineString']}
            paint={{ 'line-color': colors.accent, 'line-width': 5 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
          <Layer
            id="route-ends"
            type="circle"
            filter={['==', ['geometry-type'], 'Point']}
            paint={{
              'circle-radius': 6,
              'circle-color': ['case', ['==', ['get', 'end'], 1], colors.accent, '#ffffff'],
              'circle-stroke-color': colors.accent,
              'circle-stroke-width': 3,
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: Spacing.four, overflow: 'hidden' },
});
