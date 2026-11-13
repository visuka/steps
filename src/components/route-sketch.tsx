import Svg, { Circle, Polyline } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { projectRoute, type WalkPoint } from '@/lib/walk';
import { isDashed, lineColor, type RouteLine } from '@/walks/view';

/**
 * The route's shape without a map: list thumbnails, and the map's stand-in on
 * the web. `lines` (from routeLines) draws weak GPS dashed and parts in their
 * own colour; `points` alone draws one line.
 */
export function RouteSketch({
  points,
  lines,
  width,
  height,
}: {
  points?: WalkPoint[];
  lines?: RouteLine[];
  width: number;
  height: number;
}) {
  const theme = useTheme();
  const drawn: RouteLine[] = lines ?? (points && points.length >= 2 ? [{ kind: 'route', ord: null, points }] : []);
  // One projection for every line, so they line up.
  const xy = projectRoute(
    drawn.flatMap((l) => l.points),
    width,
    height,
    6,
  );
  if (xy.length < 2) return <Svg width={width} height={height} />;
  // Where each line's points start in the shared projection.
  const starts = drawn.reduce<number[]>((acc, l, i) => [...acc, i ? acc[i - 1] + drawn[i - 1].points.length : 0], []);
  const shapes = drawn.map((l, i) => ({ line: l, xy: xy.slice(starts[i], starts[i] + l.points.length) }));
  const start = xy[0];
  const end = xy[xy.length - 1];
  const thin = width < 100;
  return (
    <Svg width={width} height={height}>
      {shapes.map(({ line, xy: p }, i) => (
        <Polyline
          key={i}
          points={p.map((q) => `${q.x},${q.y}`).join(' ')}
          fill="none"
          stroke={lineColor(theme, line.kind)}
          strokeWidth={thin ? 3 : 4}
          strokeDasharray={isDashed(line.kind) ? (thin ? '3 3' : '6 6') : undefined}
          strokeLinejoin="round"
          strokeLinecap={isDashed(line.kind) ? 'butt' : 'round'}
        />
      ))}
      <Circle cx={start.x} cy={start.y} r={4} fill={theme.tick} stroke={theme.steps} strokeWidth={2} />
      <Circle cx={end.x} cy={end.y} r={4} fill={theme.steps} />
    </Svg>
  );
}
