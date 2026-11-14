import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { midTone } from './hero-colors';
import { pressedColor } from './surface-style';
import { dayHitSlop, fillHeight, selectedTrack, WEEK_STYLE, weekDayLabel, type WeekDay } from './week-strip-style';

export type { WeekDay } from './week-strip-style';

export interface WeekStripProps {
  /** Seven days, Monday first. */
  days: readonly WeekDay[];
  /** Today's column (the marked one). */
  selectedIndex: number;
  /** Makes each day a button (opens that day in Journal). */
  onSelect?: (index: number) => void;
}

export function WeekStrip({ days, selectedIndex, onSelect }: WeekStripProps) {
  const theme = useTheme();
  const slop = dayHitSlop();
  return (
    <View style={styles.row}>
      {days.map((d, i) => {
        const today = i === selectedIndex;
        const column = (
          <>
            <ThemedText
              type="bodySmall"
              maxFontSizeMultiplier={1.3}
              style={today ? { color: theme.primary, fontWeight: WEEK_STYLE.todayWeight } : { color: theme.onSurfaceVariant }}>
              {d.label}
            </ThemedText>
            <View style={[styles.track, { backgroundColor: today ? selectedTrack(theme) : midTone(theme) }]}>
              <View style={[styles.fill, { height: fillHeight(d.share), backgroundColor: theme.primary }]} />
            </View>
          </>
        );
        const style = [styles.day, today && { backgroundColor: theme.primaryContainer }];
        const label = weekDayLabel(d.label, d.share, today);
        return onSelect ? (
          <Pressable
            key={i}
            onPress={() => onSelect(i)}
            hitSlop={{ left: slop.horizontal, right: slop.horizontal, top: slop.vertical, bottom: slop.vertical }}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: today }}
            android_ripple={{ color: pressedColor(theme.onSurface), foreground: true }}
            style={style}>
            {column}
          </Pressable>
        ) : (
          <View key={i} accessible accessibilityLabel={label} style={style}>
            {column}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: WEEK_STYLE.dayWidth,
    minHeight: WEEK_STYLE.dayMinHeight,
    borderRadius: WEEK_STYLE.dayRadius,
    alignItems: 'center',
    justifyContent: 'center',
    gap: WEEK_STYLE.gap,
  },
  track: {
    width: WEEK_STYLE.trackWidth,
    height: WEEK_STYLE.trackHeight,
    borderRadius: WEEK_STYLE.trackRadius,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: { width: WEEK_STYLE.trackWidth, borderRadius: WEEK_STYLE.trackRadius },
});
