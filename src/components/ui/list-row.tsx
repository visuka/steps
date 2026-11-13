import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';

export interface ListRowProps {
  /** One line: what this row is. */
  title: string;
  /** One more line at most: a value or a short hint. */
  supporting?: string;
  icon?: IconName;
  /** Instead of `icon`, e.g. a route sketch. */
  leading?: ReactNode;
  /** A short value at the end, e.g. "8,000". */
  trailingText?: string;
  /** Anything else at the end: a switch, a button. */
  trailing?: ReactNode;
  /** Shows a chevron; rows that open another screen. */
  chevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/** Material 3 list item: 56 dp for one line, 72 with a supporting line. */
export function ListRow({
  title,
  supporting,
  icon,
  leading,
  trailingText,
  trailing,
  chevron,
  onPress,
  disabled,
  accessibilityLabel,
  accessibilityHint,
}: ListRowProps) {
  const theme = useTheme();
  const content = (
    <>
      {leading ?? (icon ? <Ionicons name={icon} size={24} color={theme.onSurfaceVariant} /> : null)}
      <View style={styles.text}>
        <ThemedText type="bodyLarge">{title}</ThemedText>
        {supporting ? (
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" numberOfLines={2}>
            {supporting}
          </ThemedText>
        ) : null}
      </View>
      {trailingText ? (
        <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
          {trailingText}
        </ThemedText>
      ) : null}
      {trailing}
      {chevron ? <Ionicons name="chevron-forward" size={20} color={theme.onSurfaceVariant} /> : null}
    </>
  );
  const minHeight = supporting ? 72 : 56;
  if (!onPress) return <View style={[styles.row, { minHeight }]}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (supporting ? `${title}, ${supporting}` : title)}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: theme.outlineVariant }}
      style={({ pressed }) => [
        styles.row,
        { minHeight },
        pressed && { backgroundColor: theme.surfaceContainerHighest },
        disabled && { opacity: 0.38 },
      ]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: { flex: 1, gap: Spacing.half },
});
