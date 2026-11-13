import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ElevationLevel = 0 | 1 | 2 | 3 | 4;

const LEVEL = [Elevation.level0, Elevation.level1, Elevation.level2, Elevation.level3, Elevation.level4] as const;

/**
 * A flat plate on a tonal surface role. Higher `level` = a higher
 * surfaceContainer tone, never a shadow.
 */
export function Surface({
  level = 2,
  radius = Radius.md,
  style,
  children,
}: {
  level?: ElevationLevel;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return <View style={[{ backgroundColor: theme[LEVEL[level]], borderRadius: radius }, style]}>{children}</View>;
}

/**
 * A Material filled card (or outlined, with `outlined`): an optional title
 * row, then its content in a 16 dp column. With `onPress` the whole card is
 * one button. Keep cards one level deep: never a card inside a card.
 */
export function Card({
  title,
  right,
  children,
  style,
  level = 2,
  outlined,
  onPress,
  accessibilityLabel,
}: {
  title?: string;
  /** End of the title row: a short value or a small action. */
  right?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  level?: ElevationLevel;
  outlined?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const body = (
    <>
      {title || right ? (
        <View style={styles.header}>
          {title ? (
            <ThemedText type="titleMedium" style={styles.title}>
              {title}
            </ThemedText>
          ) : (
            <View />
          )}
          {right}
        </View>
      ) : null}
      {children}
    </>
  );
  const look: ViewStyle = outlined
    ? { backgroundColor: theme.surface, borderColor: theme.outlineVariant, borderWidth: 1 }
    : { backgroundColor: theme[LEVEL[level]] };

  if (!onPress) return <View style={[styles.card, look, style]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: theme.outlineVariant, foreground: true }}
      style={({ pressed }) => [styles.card, look, pressed && { backgroundColor: theme.surfaceContainerHighest }, style]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.three, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  title: { flexShrink: 1 },
});
