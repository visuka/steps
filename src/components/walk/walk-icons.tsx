/**
 * The walk screen's drawn icons the spec's list has no shape for (spec 8): a
 * bicycle for a ride or a cycling part, and the weather glyphs other than the
 * sun (the sun is the spec's own, SpecIcon "sun"). 24 x 24 boxes, round caps and
 * joins, drawn at the spec's stroke 1.5.
 */

import Svg, { Circle, Path } from 'react-native-svg';

import type { WeatherCondition } from '@/data/types';

/** A path, or a circle [cx, cy, r]. */
export type GlyphPart = string | readonly [number, number, number];

export function Glyph({
  parts,
  size,
  color,
  stroke,
}: {
  parts: readonly GlyphPart[];
  size: number;
  color: string;
  stroke: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {parts.map((p, i) => (typeof p === 'string' ? <Path key={i} d={p} /> : <Circle key={i} cx={p[0]} cy={p[1]} r={p[2]} />))}
    </Svg>
  );
}

/** A bicycle: a ride's own row, and a cycling part (the mockup draws none; same strokes). */
export const CYCLE: readonly GlyphPart[] = [[6, 17, 3.5], [18, 17, 3.5], 'M6 17l4-8h5l3 8M10 9l2 8M14 6h2'];

const CLOUD = 'M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 11 3.5 3.5 0 0 0 7 18z';
const HIGH_CLOUD = 'M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8 3.5 3.5 0 0 0 7 15z';

/** The weather glyphs for every condition but clear (the mockup draws only the sun). */
export const WEATHER_GLYPH: Record<Exclude<WeatherCondition, 'clear'>, readonly GlyphPart[]> = {
  partly: [CLOUD, 'M14 3v1M19.5 5.5l-.7.7M21 10h-1'],
  cloudy: [CLOUD],
  fog: ['M4 10h16M4 14h16M6 18h12M6 6h12'],
  rain: [HIGH_CLOUD, 'M8 18l-1 3M12 18l-1 3M16 18l-1 3'],
  storm: [HIGH_CLOUD, 'M12 16l-2 4h4l-2 4'],
  snow: [HIGH_CLOUD, 'M8 19h.01M12 21h.01M16 19h.01'],
};
