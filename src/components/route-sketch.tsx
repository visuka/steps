import type { mapColorsOf } from '@/constants/themes/build';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { projectRoute, type WalkPoint } from '@/lib/walk';
import type { RouteDot } from './route-map';
import { isDashed, lineColor, type RouteLine } from '@/walks/view';

/** How the web map stand-in paints the route: the theme's map colours and the end dots' size. */
export interface SketchMap {
  colors: Pick<ReturnType<typeof mapColorsOf>, 'route' | 'routeWidth' | 'start' | 'startRing' | 'end' | 'endRing'>;
  dots: { start: RouteDot; end: RouteDot };
}

/**
 * The route's shape without a map: list thumbnails, and the map's stand-in on
 * the web. `lines` (from routeLines) draws weak GPS dashed and parts in their
 * own colour; `points` alone draws one line. `map` (the web map stand-in)
 * draws as the native map does: the map colours' route, width and end dots.
 */
export function RouteSketch({
  points,
  lines,
  width,
  height,
  map,
}: {
  points?: WalkPoint[];
  lines?: RouteLine[];
  width: number;
  height: number;
  map?: SketchMap;
}) {
  const theme = useTheme();
  const drawn: RouteLine[] = lines ?? (points && points.length >= 2 ? [{ kind: 'route', ord: null, points }] : []);
  // One projection for every line, so they line up.
  const xy = projectRoute(
    drawn.flatMap((l) => l.points),
    width,
    height,
    // Room for the dots at the route's ends.
    map ? Math.max(6, ...[map.dots.start, map.dots.end].map((d) => d.r + d.ring / 2)) : 6,
  );
  if (xy.length < 2) return <Svg width={width} height={height} />;
  // Where each line's points start in the shared projection.
  const starts = drawn.reduce<number[]>((acc, l, i) => [...acc, i ? acc[i - 1] + drawn[i - 1].points.length : 0], []);
  const shapes = drawn.map((l, i) => ({ line: l, xy: xy.slice(starts[i], starts[i] + l.points.length) }));
  const start = xy[0];
  const end = xy[xy.length - 1];
  const thin = width < 100;
  const lineWidth = map ? map.colors.routeWidth : thin ? 3 : 4;
  const colorOf = (kind: RouteLine['kind']) =>
    map && (kind === 'route' || kind === 'weak') ? map.colors.route : lineColor(theme, kind);
  return (
    <Svg width={width} height={height}>
      {shapes.map(({ line, xy: p }, i) => (
        <Polyline
          key={i}
          points={p.map((q) => `${q.x},${q.y}`).join(' ')}
          fill="none"
          stroke={colorOf(line.kind)}
          strokeWidth={isDashed(line.kind) && map ? Math.max(3, lineWidth - 1) : lineWidth}
          strokeDasharray={isDashed(line.kind) ? (thin ? '3 3' : '6 6') : undefined}
          strokeLinejoin="round"
          strokeLinecap={isDashed(line.kind) ? 'butt' : 'round'}
        />
      ))}
      {map ? (
        <>
          <Circle
            cx={start.x}
            cy={start.y}
            r={map.dots.start.r}
            fill={map.colors.start}
            stroke={map.colors.startRing}
            strokeWidth={map.dots.start.ring}
          />
          <Circle
            cx={end.x}
            cy={end.y}
            r={map.dots.end.r}
            fill={map.colors.end}
            stroke={map.colors.endRing}
            strokeWidth={map.dots.end.ring}
          />
        </>
      ) : (
        <>
          <Circle cx={start.x} cy={start.y} r={4} fill={theme.tick} stroke={theme.steps} strokeWidth={2} />
          <Circle cx={end.x} cy={end.y} r={4} fill={theme.steps} />
        </>
      )}
    </Svg>
  );
}
