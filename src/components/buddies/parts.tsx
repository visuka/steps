/**
 * Walk buddies, shared pieces: the initial circle, a person row, a section
 * heading and the snackbar hook. Colours and type come from the look's
 * theme roles only.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Label } from '@/components/plain/plain-kit';
import type { PlainIconName } from '@/components/plain/plain-theme';
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
      // Sand, as the hub's avatars (rule: sand for avatars), so a person looks the same on every screen.
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.secondaryContainer }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {/* The letter grows with the circle (a 72 circle no longer holds a tiny letter). */}
      <ThemedText
        type="titleSmall"
        maxFontSizeMultiplier={1.3}
        style={{ color: theme.onSecondaryContainer, fontSize: Math.round(size * 0.4), lineHeight: Math.round(size * 0.5), fontWeight: '600' }}>
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

/** A section's label: the plain kit's tracked capitals with its icon, as the hub's tile labels. */
export function SectionTitle({ children, icon }: { children: string; icon?: PlainIconName }) {
  return <Label icon={icon} text={children} style={styles.section} />;
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
