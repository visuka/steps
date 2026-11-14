import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';
import { SpecIcon } from './icons';
import { ROW, rowLook, rowRipple } from './list-row-style';

export interface ListRowProps {
  /** One line: what this row is. */
  title: string;
  /** One more line at most: a value or a short hint. */
  supporting?: string;
  icon?: IconName;
  /** Instead of `icon`, e.g. a route sketch or an IconCircle. */
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
  /** Spec layout (any of tall / last / hairline selects it): 56 high instead of 48, for the "Parts" rows. */
  tall?: boolean;
  /** Spec layout: the last row of a group has no hairline. */
  last?: boolean;
  /** Spec layout: force the hairline under the text part on or off (default: on unless `last`). */
  hairline?: boolean;
}

/**
 * A list item. Without the new props it is the Material one: 56 dp for one
 * line, 72 with a supporting line, 16 side padding. With tall / last /
 * hairline it is the Clean+ ingredient row (spec 5.10, 5.11): at least 48
 * (56 tall), gap 12, no side padding (the screen's 24 margin applies), and a
 * 1 dp hairline under the text part only, not under the leading circle.
 */
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
  tall,
  last,
  hairline,
}: ListRowProps) {
  const theme = useTheme();
  const look = rowLook({ supporting: !!supporting, tall, last, hairline });
  const content = (
    <>
      {leading ?? (icon ? <Ionicons name={icon} size={24} color={theme.onSurfaceVariant} /> : null)}
      <View
        style={[
          styles.part,
          look.spec ? styles.partSpec : null,
          look.spec ? { minHeight: look.minHeight } : null,
          look.hairline ? { borderBottomWidth: ROW.hairline, borderBottomColor: theme.outlineVariant } : null,
        ]}>
        <View style={styles.text}>
          <ThemedText
            type={look.spec ? 'bodyMedium' : 'bodyLarge'}
            maxFontSizeMultiplier={1.3}
            numberOfLines={look.spec ? 2 : undefined}>
            {title}
          </ThemedText>
          {supporting ? (
            <ThemedText
              type={look.spec ? 'bodySmall' : 'bodyMedium'}
              themeColor="onSurfaceVariant"
              maxFontSizeMultiplier={1.3}
              numberOfLines={2}>
              {supporting}
            </ThemedText>
          ) : null}
        </View>
        {trailingText ? (
          <ThemedText
            type={look.spec ? 'bodyMedium' : 'labelLarge'}
            themeColor="onSurfaceVariant"
            maxFontSizeMultiplier={1.3}
            style={look.spec ? styles.amount : null}>
            {trailingText}
          </ThemedText>
        ) : null}
        {trailing}
        {chevron ? (
          look.spec ? (
            <SpecIcon name="chevron-right" color={theme.onSurfaceVariant} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={theme.onSurfaceVariant} />
          )
        ) : null}
      </View>
    </>
  );
  const rowStyle = [styles.row, look.spec ? styles.rowSpec : styles.rowLegacy, { minHeight: look.minHeight }];
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (supporting ? `${title}, ${supporting}` : title)}
      accessibilityHint={accessibilityHint}
      android_ripple={rowRipple(theme.onSurface)}
      style={[rowStyle, disabled && { opacity: ROW.disabledOpacity }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLegacy: { gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  // No side padding: the screen's 24 margin applies.
  rowSpec: { gap: ROW.gap },
  // The text part carries what used to be row children, with the row's old gap between them.
  part: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  partSpec: { gap: ROW.gap, justifyContent: 'space-between' },
  text: { flex: 1, gap: Spacing.half },
  amount: { textAlign: 'right' },
});
