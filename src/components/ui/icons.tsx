import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { ICON_PARTS, LOCK_BODY, type SpecIconName } from './icon-paths';

export type { SpecIconName } from './icon-paths';

/**
 * A Clean+ icon (spec section 8): 24-unit box, stroke 1.5, round caps and
 * joins, drawn at 20 dp unless `size` says otherwise. Hidden from screen
 * readers: the control or row around it carries the label.
 */
export function SpecIcon({
  name,
  color,
  size = CLEAN_SPEC.icon.size,
}: {
  name: SpecIconName;
  color: string;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${CLEAN_SPEC.icon.viewBox} ${CLEAN_SPEC.icon.viewBox}`}
      fill="none"
      stroke={color}
      strokeWidth={CLEAN_SPEC.icon.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {name === 'lock' ? <Rect x={LOCK_BODY.x} y={LOCK_BODY.y} width={LOCK_BODY.width} height={LOCK_BODY.height} rx={LOCK_BODY.rx} /> : null}
      {ICON_PARTS[name].map((p, i) =>
        typeof p === 'string' ? <Path key={i} d={p} /> : <Circle key={i} cx={p[0]} cy={p[1]} r={p[2]} />,
      )}
    </Svg>
  );
}
