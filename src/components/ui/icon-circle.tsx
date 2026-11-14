import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { SpecIcon, type SpecIconName } from './icons';
import {
  ICON_CIRCLE_STYLE,
  iconCircleColors,
  iconCircleHitSlop,
  iconCircleRipple,
  type IconCircleTone,
} from './icon-circle-style';

export type { IconCircleTone } from './icon-circle-style';

interface Base {
  name: SpecIconName;
  tone?: IconCircleTone;
  size?: number;
}

/** Decorative circle, or (with onPress) a button that must say what it does. */
export type IconCircleProps =
  | (Base & { onPress?: undefined; accessibilityLabel?: string })
  | (Base & { onPress: () => void; accessibilityLabel: string });

/** A 40 dp circle with a 20 dp spec icon; 'accentSolid' is the water tile's plus. */
export function IconCircle({ name, tone = 'accent', size = ICON_CIRCLE_STYLE.size, onPress, accessibilityLabel }: IconCircleProps) {
  const theme = useTheme();
  const { fill, icon } = iconCircleColors(theme, tone);
  const circle = [styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: fill }];
  const mark = <SpecIcon name={name} color={icon} size={ICON_CIRCLE_STYLE.iconSize} />;
  if (!onPress) return <View style={circle}>{mark}</View>;
  const slop = iconCircleHitSlop(size);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: iconCircleRipple(theme, tone), foreground: true }}
      style={circle}>
      {mark}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
