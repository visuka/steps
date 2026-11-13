import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { IconName } from './button';

export type NoticeTone = 'info' | 'done' | 'problem';

const ICON: Record<NoticeTone, IconName> = {
  info: 'information-circle-outline',
  done: 'checkmark-circle-outline',
  problem: 'alert-circle-outline',
};

/**
 * One short line of feedback under a form or a list: "Saved for Tuesday.",
 * "Couldn't save that. Please try again." A problem is in the error colour
 * and has its own icon, so colour is never the only sign.
 */
export function Notice({
  text,
  tone = 'info',
  style,
}: {
  text: string;
  tone?: NoticeTone;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const color = tone === 'problem' ? theme.error : theme.onSurfaceVariant;
  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityLabel={text}
      accessibilityLiveRegion={tone === 'problem' ? 'assertive' : 'polite'}>
      <Ionicons name={ICON[tone]} size={18} color={color} style={styles.icon} />
      <ThemedText type="bodyMedium" style={[styles.text, { color }]}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  icon: { marginTop: 1 },
  text: { flex: 1 },
});
