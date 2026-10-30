import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Mood } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

export const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Awful' },
  { value: 2, emoji: '🙁', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

export const moodEmoji = (m: Mood) => MOODS[m - 1].emoji;
export const moodLabel = (m: Mood) => MOODS[m - 1].label;

export function MoodPicker({ value, onChange }: { value: Mood | null; onChange: (m: Mood) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {MOODS.map((m) => {
        const selected = m.value === value;
        return (
          <Pressable
            key={m.value}
            onPress={() => onChange(m.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={m.label}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: selected ? theme.accentSoft : 'transparent', opacity: pressed ? 0.7 : 1 },
            ]}>
            <Text style={[styles.emoji, { opacity: value === null || selected ? 1 : 0.45 }]}>{m.emoji}</Text>
            <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
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
  option: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.three, gap: Spacing.half },
  emoji: { fontSize: 30, lineHeight: 38 },
});
