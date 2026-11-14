import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { Sheet } from './sheet';
import { useToneInk } from './tone-surface';

/**
 * A small "Why?" that opens the longer explanation in a sheet, so the
 * screen itself never carries a paragraph. With `label="(i)"` it is an
 * (i) icon instead of the word, for the end of a list row.
 */
export function Why({ title, text, label = 'Why?' }: { title: string; text: string; label?: string }) {
  const theme = useTheme();
  const plate = useToneInk();
  const [open, setOpen] = useState(false);
  const icon = label === '(i)';
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={icon ? `More about ${title}` : `${label} ${title}`}
        hitSlop={8}
        style={icon ? styles.info : styles.why}>
        {icon ? (
          <Ionicons name="information-circle-outline" size={24} color={plate ? plate.ink : theme.onSurfaceVariant} />
        ) : (
          <ThemedText type="labelLarge" themeColor="primary" style={styles.underline}>
            {label}
          </ThemedText>
        )}
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={title}>
        <ThemedText type="bodyLarge">{text}</ThemedText>
        <Button label="Got it" variant="tonal" onPress={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

/**
 * The heading above a group: a title, and at most one action (a text button)
 * or a "Why?" at the end. More space above it than below.
 */
export function SectionHeader({
  title,
  action,
  why,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  /** The explanation behind a "Why?" tap. */
  why?: string;
}) {
  return (
    <View style={styles.row}>
      <ThemedText type="titleMedium" accessibilityRole="header" style={styles.title}>
        {title}
      </ThemedText>
      {why ? <Why title={title} text={why} /> : null}
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8} style={styles.why}>
          <ThemedText type="labelLarge" themeColor="primary">
            {action.label}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    minHeight: TouchTarget,
  },
  title: { flex: 1 },
  why: { minHeight: TouchTarget, justifyContent: 'center', paddingHorizontal: Spacing.one },
  info: { width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
