import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { Sheet } from './sheet';
import { SECTION, type SectionGap, headerMarginTop, rowTouchHeight } from './section-header-style';
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
          <ThemedText type="labelLarge" themeColor="primary" maxFontSizeMultiplier={1.3} style={styles.underline}>
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
 * The heading above a group (spec 5.10): 15/22 medium on the left, an optional
 * 13 muted caption on the right, at most one action (a text button) or a
 * "Why?". `gap` is the margin above: 24 for a section (the first on a screen),
 * 16 for a sub-heading. A row with a button is 48 dp high so it can be tapped.
 */
export function SectionHeader({
  title,
  action,
  why,
  caption,
  gap = 'section',
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  /** The explanation behind a "Why?" tap. */
  why?: string;
  /** Muted 13 text at the end of the row, e.g. "Some ingredients still being added". */
  caption?: string;
  /** Margin above: 'section' is 24, 'sub' is 16. */
  gap?: SectionGap;
}) {
  const interactive = !!why || !!action;
  return (
    <View
      style={[
        styles.row,
        { marginTop: headerMarginTop(gap, interactive), minHeight: rowTouchHeight(interactive) },
        interactive ? styles.rowCentered : styles.rowBaseline,
      ]}>
      <ThemedText type="labelLarge" accessibilityRole="header" maxFontSizeMultiplier={1.3} style={styles.title}>
        {title}
      </ThemedText>
      {caption || why || action ? (
        <View style={[styles.end, interactive ? styles.rowCentered : styles.rowBaseline]}>
          {caption ? (
            <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3} style={styles.caption}>
              {caption}
            </ThemedText>
          ) : null}
          {why ? <Why title={title} text={why} /> : null}
          {action ? (
            <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8} style={styles.why}>
              <ThemedText type="labelLarge" themeColor="primary" maxFontSizeMultiplier={1.3}>
                {action.label}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: SECTION.gap },
  rowBaseline: { alignItems: 'baseline' },
  rowCentered: { alignItems: 'center' },
  title: { flexShrink: 1 },
  end: { flexDirection: 'row', flexShrink: 1, gap: SECTION.gap },
  caption: { flexShrink: 1, textAlign: 'right' },
  why: { minHeight: TouchTarget, justifyContent: 'center', paddingHorizontal: Spacing.one },
  info: { width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
