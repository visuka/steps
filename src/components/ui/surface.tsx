import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { type DataTone, Elevation, Look, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { InCardContext, toneInk, ToneInkContext } from './tone-surface';

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
 *
 * The theme's `tile` style: with 'filled', a card with a `tone` is painted in
 * that tone's container and its text takes the container's `on` colour; with
 * 'filled' or 'outlined', untoned cards at level 0 to 2 are drawn outlined.
 */
export function Card({
  title,
  right,
  children,
  style,
  level = 2,
  outlined,
  tone,
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
  /** What the card is about, e.g. 'food' for the day's energy. */
  tone?: DataTone;
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
  const ink = tone && Look.tile === 'filled' ? toneInk(theme, tone) : null;
  const drawnOutlined = outlined || (!ink && Look.tile !== 'plain' && level <= 2);
  const look: ViewStyle = ink
    ? { backgroundColor: ink.plate }
    : drawnOutlined
      ? { backgroundColor: outlined ? theme.surface : theme.surfaceContainerLowest, borderColor: theme.outlineVariant, borderWidth: 1 }
      : { backgroundColor: theme[LEVEL[level]] };
  const wrap = (card: ReactNode) => (
    <InCardContext value>{ink ? <ToneInkContext value={ink}>{card}</ToneInkContext> : card}</InCardContext>
  );

  if (!onPress) return wrap(<View style={[styles.card, look, style]}>{body}</View>);
  return wrap(
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: theme.outlineVariant, foreground: true }}
      style={({ pressed }) => [styles.card, look, pressed && !ink && { backgroundColor: theme.surfaceContainerHighest }, style]}>
      {body}
    </Pressable>,
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.three, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  title: { flexShrink: 1 },
});
