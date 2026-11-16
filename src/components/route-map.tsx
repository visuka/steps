import { Camera, type CameraRef, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActiveTheme } from '@/constants/theme';
import { mapColorsOf } from '@/constants/themes/build';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconButton } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { routeBounds, type WalkPoint } from '@/lib/walk';
import { dashRuns, isDashed, lineColor, pathLengthM, type RouteLine } from '@/walks/view';

import { MAP_STYLE_URL, type MapStyle, mapSchemeFor, themedMapStyle } from './map-style';

const SOLID = ['route', 'part'];
/** The feature kind of a dashed stretch (weak GPS, a part left out): cut into dashes here, drawn as plain lines. */
const DASHED = 'dashed';

/** A start or end dot as the mockups draw it in SVG: radius to the middle of the ring, and the ring's width. */
export interface RouteDot {
  r: number;
  ring: number;
}

/**
 * A walk's route on a map, in the theme's map colours (ThemeDef.map; park
 * keeps OpenFreeMap's style for the scheme). Pass `lines` (from routeLines)
 * to draw weak GPS and vehicle or cycling parts their own way; `points`
 * alone draws one line. `follow` (recording) keeps the whole route framed as
 * it grows, with zoom buttons, "Show whole route" and, given `onExpand` or
 * `onClose`, full screen and back; a pinch or drag stops the framing until
 * that button is pressed or 30 s pass. Otherwise the map frames the whole
 * route once. `children` sit over
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
  onExpand,
  onClose,
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
  /** Recording: a full-screen button. */
  onExpand?: () => void;
  /** Full screen: the exit button. */
  onClose?: () => void;
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

  // Recording: frame the whole route as it grows, unless the person moved the map lately.
  const camera = useRef<CameraRef>(null);
  const zoom = useRef(16);
  const movedAt = useRef(0);
  const [moved, setMoved] = useState(false);
  const fit = useCallback(() => {
    if (!b || !camera.current) return;
    // Under about 150 m across, framing would zoom in to the street's paint: hold street level instead.
    const spanM = Math.max((b.north - b.south) * 111_000, (b.east - b.west) * 111_000 * Math.cos((b.north * Math.PI) / 180));
    if (spanM < 150) camera.current.easeTo({ center: [(b.west + b.east) / 2, (b.south + b.north) / 2], zoom: 17, duration: 500 });
    else camera.current.fitBounds([b.west, b.south, b.east, b.north], { padding: FIT_PAD, duration: 500, easing: 'ease' });
  }, [b]);
  useEffect(() => {
    if (!follow) return;
    if (movedAt.current && Date.now() - movedAt.current < HOLD_MS) return;
    if (movedAt.current) {
      movedAt.current = 0;
      setMoved(false);
    }
    fit();
  }, [follow, fit]);
  const showAll = () => {
    movedAt.current = 0;
    setMoved(false);
    fit();
  };
  const zoomBy = (d: number) => {
    movedAt.current = Date.now();
    setMoved(true);
    camera.current?.zoomTo(Math.max(3, Math.min(19, zoom.current + d)), { duration: 250 });
  };

  // A dash and its gap are each 1/140 of the route (at least 4 m): about 5 dp on the walk screen's card.
  const dashM = useMemo(() => Math.max(4, pathLengthM(all) / 140), [all]);

  const route: GeoJSON.FeatureCollection = useMemo(() => ({
    type: 'FeatureCollection',
    features: [
      ...drawn.map((l) => {
        // The route in the map's own colour (the mockup's); parts as before.
        const color = l.kind === 'route' || l.kind === 'weak' ? colors.route : lineColor(theme, l.kind);
        // The line style's dash pattern did not show on the emulator (a removed part left a gap), so dashes are cut here.
        if (isDashed(l.kind)) {
          return {
            type: 'Feature' as const,
            properties: { kind: DASHED, color },
            geometry: { type: 'MultiLineString' as const, coordinates: dashRuns(l.points, dashM, dashM) },
          };
        }
        return {
          type: 'Feature' as const,
          properties: { kind: l.kind, color },
          geometry: { type: 'LineString' as const, coordinates: l.points.map((p) => [p.lon, p.lat]) },
        };
      }),
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
  }), [drawn, first, last, theme, colors, dashM]);

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
        <Map
          mapStyle={styled as never}
          style={StyleSheet.absoluteFill}
          compass={false}
          logo={false}
          attribution
          onRegionWillChange={
            follow
              ? (e) => {
                  if (!e.nativeEvent.userInteraction) return;
                  movedAt.current = Date.now();
                  setMoved(true);
                }
              : undefined
          }
          onRegionDidChange={
            follow
              ? (e) => {
                  zoom.current = e.nativeEvent.zoom;
                }
              : undefined
          }>
          {follow && center ? (
            <Camera ref={camera} initialViewState={{ center, zoom: 16 }} />
          ) : b ? (
            <Camera
              initialViewState={{
                bounds: [b.west, b.south, b.east, b.north],
                padding: { top: 24, right: 24, bottom: 24, left: 24 },
              }}
            />
          ) : null}
          <GeoJSONSource id="route" data={route}>
            {colors.casing ? (
              /* A casing keeps the route apart from roads and parks under it (park's map). */
              <Layer
                id="route-casing"
                type="line"
                filter={['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]]}
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
              filter={['==', ['get', 'kind'], DASHED]}
              paint={{ 'line-color': ['get', 'color'], 'line-width': width }}
              layout={{ 'line-cap': 'butt', 'line-join': 'round' }}
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
      {follow && styled ? (
        <View style={[styles.controls, { backgroundColor: theme.surfaceContainerHigh }]}>
          {onClose ? (
            <IconButton icon="contract-outline" onPress={onClose} accessibilityLabel="Exit full screen" color={theme.onSurface} />
          ) : onExpand ? (
            <IconButton icon="expand-outline" onPress={onExpand} accessibilityLabel="Full screen map" color={theme.onSurface} />
          ) : null}
          <IconButton icon="add" onPress={() => zoomBy(1)} accessibilityLabel="Zoom in" color={theme.onSurface} />
          <IconButton icon="remove" onPress={() => zoomBy(-1)} accessibilityLabel="Zoom out" color={theme.onSurface} />
          <IconButton
            icon="scan-outline"
            onPress={showAll}
            accessibilityLabel="Show whole route"
            color={moved ? theme.primary : theme.onSurface}
          />
        </View>
      ) : null}
    </View>
  );
});

const FIT_PAD = { top: 32, right: 64, bottom: 32, left: 32 };
/** After a pinch, drag or zoom button, the map stays where the person put it this long. */
const HOLD_MS = 30_000;

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  controls: { position: 'absolute', top: 8, right: 8, borderRadius: 24, paddingVertical: 2 },
});
