import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { PLAIN_ICON_COLOR, type PlainIconName } from './plain-theme';

/**
 * The plain look's label icons, drawn for this app on a 24 grid (thin lines,
 * round ends), each in its own colour (PLAIN_ICON_COLOR). Shown at 17 dp,
 * stroke 1.9, as on the mockup. Hidden from screen readers.
 */
const SHAPES: Record<PlainIconName, ReactNode> = {
  steps: (
    <>
      <Path d="M8 3.5c1.6 0 2.4 1.8 2.4 4S9.6 11.5 8 11.5 5.6 9.7 5.6 7.5 6.4 3.5 8 3.5z" />
      <Path d="M6 14.5h4v1.8a2 2 0 0 1-4 0z" />
      <Path d="M16 7.5c1.6 0 2.4 1.8 2.4 4s-.8 4-2.4 4-2.4-1.8-2.4-4 .8-4 2.4-4z" />
      <Path d="M14 18.5h4v.5a2 2 0 0 1-4 0z" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s6-5.5 6-11a6 6 0 0 0-12 0c0 5.5 6 11 6 11z" />
      <Circle cx={12} cy={10} r={2} />
    </>
  ),
  bolt: <Path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />,
  bowl: (
    <>
      <Path d="M4 11h16a8 8 0 0 1-16 0z" />
      <Path d="M9.5 7.5c0-1.2 1.2-1.2 1.2-2.5M13.5 7.5c0-1.2 1.2-1.2 1.2-2.5" />
    </>
  ),
  moon: <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  drop: <Path d="M12 3.5s6 6.3 6 10.5a6 6 0 0 1-12 0c0-4.2 6-10.5 6-10.5z" />,
  walk: (
    <>
      <Circle cx={13.5} cy={4.5} r={1.7} />
      <Path d="M10 21l2.2-6 2.8 2.8V21M12.2 15l-1-5.2 3-2 2 3.7 2.8 1M11.2 9.8L8 12v3" />
    </>
  ),
  flame: <Path d="M12 3c1 3.2 5 5 5 10a5 5 0 0 1-10 0c0-2.6 1.5-4 2.5-5 .3 2 1.4 3 2.5 3 0-3-1-5.2 0-8z" />,
  plus: (
    <>
      <Circle cx={12} cy={12} r={8} />
      <Path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  list: (
    <>
      <Path d="M9 7h11M9 12h11M9 17h11" />
      <Circle cx={5} cy={7} r={0.9} />
      <Circle cx={5} cy={12} r={0.9} />
      <Circle cx={5} cy={17} r={0.9} />
    </>
  ),
  leaf: (
    <>
      <Path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" />
      <Path d="M5 19l7-7" />
    </>
  ),
  chat: <Path d="M4 5h16v11H9.5L4 20z" />,
  useradd: (
    <>
      <Circle cx={10} cy={8} r={3.5} />
      <Path d="M3.5 20a6.5 6.5 0 0 1 13 0M18.5 8v6M15.5 11h6" />
    </>
  ),
  search: (
    <>
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="M16 16l4 4" />
    </>
  ),
  people: (
    <>
      <Circle cx={9} cy={8} r={3.2} />
      <Path d="M3 20a6 6 0 0 1 12 0" />
      <Circle cx={17} cy={9} r={2.6} />
      <Path d="M15.6 14.2A5 5 0 0 1 21 19" />
    </>
  ),
  card: (
    <>
      <Rect x={3} y={5} width={18} height={14} rx={2.5} />
      <Circle cx={9} cy={11} r={2} />
      <Path d="M6 16a3 3 0 0 1 6 0M14.5 10h4M14.5 13.5h4" />
    </>
  ),
  spark: <Path d="M12 3.5l1.8 5.2L19 10.5l-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z" />,
  lock: (
    <>
      <Rect x={5} y={11} width={14} height={9.5} rx={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  pill: (
    <>
      <Rect x={3.5} y={8.5} width={17} height={7} rx={3.5} transform="rotate(-40 12 12)" />
      <Path d="M9.7 9.3l4.6 5.4" />
    </>
  ),
  check: (
    <>
      <Circle cx={12} cy={12} r={8} />
      <Path d="M8.5 12.3l2.4 2.4 4.8-5" />
    </>
  ),
};

export function PlainIcon({ name, size = 17, color, stroke = 1.9 }: { name: PlainIconName; size?: number; color?: string; stroke?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? PLAIN_ICON_COLOR[name]}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {SHAPES[name]}
    </Svg>
  );
}

/** The calendar on the top row: dark lines, 18 dp, stroke 1.6. */
export function PlainCalendar({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M5 6.5h14v12.5H5z" />
      <Path d="M5 10.5h14" />
      <Path d="M9 4v4" />
      <Path d="M15 4v4" />
    </Svg>
  );
}
