import Svg, { Circle, Polyline } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { projectRoute, type WalkPoint } from '@/lib/walk';

/** The route's shape without a map: list thumbnails, and the map's stand-in on the web. */
export function RouteSketch({ points, width, height }: { points: WalkPoint[]; width: number; height: number }) {
  const theme = useTheme();
  const xy = projectRoute(points, width, height, 6);
  if (xy.length < 2) return <Svg width={width} height={height} />;
  const start = xy[0];
  const end = xy[xy.length - 1];
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={xy.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={theme.accent}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={start.x} cy={start.y} r={4} fill={theme.background} stroke={theme.accent} strokeWidth={2} />
      <Circle cx={end.x} cy={end.y} r={4} fill={theme.accent} />
    </Svg>
  );
}
