/**
 * Walk buddies, shared pieces: the initial circle, a person row, a section
 * heading and the snackbar hook. Colours and type come from the look's
 * theme roles only.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ListRow } from '@/components/ui';
import { displayName } from '@/buddies/read';
import type { Walker } from '@/buddies/types';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The avatar circle, also the size of other round leading marks (the goal kind badge). */
export const AVATAR = 40;

/** The person's first letter in a tinted circle, as the greeting's avatar. */
export function Avatar({ label, size = AVATAR }: { label: string; size?: number }) {
  const theme = useTheme();
  const letter = label.replace(/^@/, '').trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.primaryContainer }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <ThemedText type="titleSmall" maxFontSizeMultiplier={1.3} style={{ color: theme.onPrimaryContainer }}>
        {letter}
      </ThemedText>
    </View>
  );
}

/** A walker: initial, name (or @handle) over @handle, then an action or chevron. */
export function PersonRow({
  walker,
  supporting,
  trailing,
  onPress,
  last,
}: {
  walker: Pick<Walker, 'name' | 'handle'>;
  supporting?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const name = displayName(walker);
  return (
    // Inside a card: the padded row (the bare-list "tall" row has no side padding).
    <ListRow
      title={name}
      supporting={supporting ?? (walker.name ? `@${walker.handle}` : undefined)}
      leading={<Avatar label={name} />}
      trailing={trailing}
      chevron={!trailing && !!onPress}
      onPress={onPress}
      accessibilityLabel={`${name}, @${walker.handle}${supporting ? `, ${supporting}` : ''}`}
    />
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <ThemedText type="titleSmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3} style={styles.section}>
      {children}
    </ThemedText>
  );
}

/** A message for the snackbar, and a way to show one. */
export function useSnack() {
  const [snack, setSnack] = useState<string | null>(null);
  const show = useCallback((m: string | null) => {
    if (m) setSnack(m);
  }, []);
  return { snack, show, dismiss: () => setSnack(null) };
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: Spacing.four, marginBottom: Spacing.one },
});
