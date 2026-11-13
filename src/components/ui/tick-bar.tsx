import { StyleSheet, View, type ViewStyle } from 'react-native';

import { type DataTone, Radius, toneColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface TickBarProps {
  value: number;
  /** The full bar, e.g. a daily amount. Past it the bar stays full; say so in a label too. */
  max: number;
  tone?: DataTone;
  /** A neutral fill instead of the tone (a theme role, e.g. theme.outline for "so far"). */
  color?: string;
  /** An ink mark across the bar at this share, 0–1, e.g. a nutrient's low line. */
  mark?: number | null;
  /** Bar thickness in dp: 8 in lists, 12 in tiles. */
  height?: number;
  /** Painted ticks every 10%; off for very short bars. */
  ticks?: boolean;
  /** For screen readers, e.g. "1,240 of 2,000 kcal". */
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/** Every tenth, and the end of the bar so its full length reads. */
const TICK_AT = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * A straight piece of the track: flat data colour over the lane, ticks every 10%.
 * Ticks over the covered part are painted in the tone's on colour; ticks on the
 * part still to go use laneTick, so the remaining tenths can be counted.
 */
export function TickBar({
  value,
  max,
  tone = 'steps',
  color,
  mark,
  height = 12,
  ticks = true,
  accessibilityLabel,
  style,
}: TickBarProps) {
  const theme = useTheme();
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const markAt = mark === null || mark === undefined ? null : Math.min(1, Math.max(0, mark));
  const paint = toneColors(theme, tone);
  const onFill = color ? theme.tick : paint.on;
  return (
    <View
      style={[styles.lane, { height, backgroundColor: theme.lane }, style]}
      accessible={!!accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}>
      <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: color ?? paint.fill }]} />
      {ticks
        ? TICK_AT.map((k) => (
            <View
              key={k}
              style={[
                k === 10 ? styles.end : styles.tick,
                { left: `${k * 10}%`, backgroundColor: k / 10 <= share ? onFill : theme.laneTick },
              ]}
            />
          ))
        : null}
      {markAt !== null ? (
        <View style={[styles.mark, { left: `${markAt * 100}%`, backgroundColor: theme.onSurface }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lane: { width: '100%', borderRadius: Radius.xs, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1 },
  end: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -2 },
  mark: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1 },
});
