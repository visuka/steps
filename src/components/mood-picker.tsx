import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import type { Mood } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

export const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Awful' },
  { value: 2, emoji: '🙁', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

/** Kept for text that can carry an emoji (notifications); screens draw MoodFace. */
export const moodEmoji = (m: Mood) => MOODS[m - 1].emoji;
export const moodLabel = (m: Mood) => MOODS[m - 1].label;

/**
 * A mood as a drawn face in one ink stroke: the mouth bends from a frown
 * (Awful) to a smile (Great). Drawn, not an emoji, so it matches the icons
 * and looks the same on every phone.
 */
export function MoodFace({ mood, size = 32, color }: { mood: Mood; size?: number; color?: string }) {
  const theme = useTheme();
  const ink = color ?? theme.onSurface;
  const curve = (mood - 3) / 2; // -1 … 1
  const ends = 21.5 - 1.5 * curve;
  const middle = 21.5 + 4.5 * curve;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx={16} cy={16} r={14} stroke={ink} strokeWidth={2} fill="none" />
      <Circle cx={11.5} cy={13} r={1.75} fill={ink} />
      <Circle cx={20.5} cy={13} r={1.75} fill={ink} />
      <Path d={`M10 ${ends} Q16 ${middle} 22 ${ends}`} stroke={ink} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function MoodPicker({ value, onChange }: { value: Mood | null; onChange: (m: Mood) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {MOODS.map((m) => {
        const selected = m.value === value;
        const quiet = value !== null && !selected;
        return (
          <Pressable
            key={m.value}
            onPress={() => onChange(m.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={m.label}
            android_ripple={{ color: theme.outlineVariant, borderless: false }}
            style={({ pressed }) => [
              styles.option,
              selected && { backgroundColor: theme.secondaryContainer },
              pressed && !selected && { backgroundColor: theme.surfaceContainerHighest },
            ]}>
            <MoodFace
              mood={m.value}
              color={selected ? theme.onSecondaryContainer : quiet ? theme.onSurfaceVariant : theme.onSurface}
            />
            <ThemedText
              type="labelMedium"
              themeColor={selected ? 'onSecondaryContainer' : 'onSurfaceVariant'}
              numberOfLines={1}>
              {m.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.one },
  option: {
    flex: 1,
    minHeight: TouchTarget + Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    gap: Spacing.one,
    overflow: 'hidden',
  },
});
