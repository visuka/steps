import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, IconButton } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The pieces every Journal section shares, so a night, a reading, a weight
 * and a mood all list, open and close the same way.
 */

/** A list of entries on one quiet plate; rows inside are separated by hairlines. */
export function EntryList({ children }: { children: ReactNode }) {
  return (
    <Surface level={1} style={styles.list}>
      {children}
    </Surface>
  );
}

/**
 * One entry: what it is, one line of when and where from, and a delete
 * button. Tapping the row opens it for changes in place. Entries from
 * another app have neither; they show a small "from" mark instead.
 */
export function EntryRow({
  title,
  supporting,
  leading,
  onPress,
  onDelete,
  deleteLabel,
  readOnly,
}: {
  title: string;
  supporting?: string;
  leading?: ReactNode;
  onPress?: () => void;
  onDelete?: () => void;
  /** "Delete 120 over 80". */
  deleteLabel?: string;
  /** Kept in another app: shows a link icon at the end. */
  readOnly?: boolean;
}) {
  const theme = useTheme();
  const body = (
    <>
      {leading}
      <View style={styles.text}>
        <ThemedText type="bodyLarge">{title}</ThemedText>
        {supporting ? (
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" numberOfLines={2}>
            {supporting}
          </ThemedText>
        ) : null}
      </View>
    </>
  );
  return (
    <View style={[styles.row, { borderTopColor: theme.outlineVariant }]}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${title}${supporting ? `, ${supporting}` : ''}`}
          accessibilityHint="Opens it to change or delete"
          android_ripple={{ color: theme.outlineVariant }}
          style={({ pressed }) => [styles.main, pressed && { backgroundColor: theme.surfaceContainerHighest }]}>
          {body}
        </Pressable>
      ) : (
        <View style={styles.main} accessible accessibilityLabel={`${title}${supporting ? `, ${supporting}` : ''}`}>
          {body}
        </View>
      )}
      {onDelete ? (
        <IconButton icon="trash-outline" onPress={onDelete} accessibilityLabel={deleteLabel ?? `Delete ${title}`} />
      ) : readOnly ? (
        <View style={styles.mark}>
          <Ionicons name="link-outline" size={20} color={theme.onSurfaceVariant} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * An entry opened for changes, in place in its list: a raised plate with a
 * short title and the form. The rest of the list stays where it was.
 */
export function EditPanel({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: theme.surfaceContainerHigh, borderTopColor: theme.outlineVariant }]}>
      <ThemedText type="titleSmall" accessibilityRole="header">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

/** Save as the main action; Delete and Cancel as quiet text buttons under it. */
export function FormActions({
  saveLabel = 'Save',
  onSave,
  saveDisabled,
  saving,
  onCancel,
  onDelete,
  deleteLabel = 'Delete',
}: {
  saveLabel?: string;
  onSave: () => void;
  saveDisabled?: boolean;
  saving?: boolean;
  onCancel?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <View style={styles.actions}>
      <Button label={saveLabel} onPress={onSave} disabled={saveDisabled} loading={saving} />
      {onCancel || onDelete ? (
        <View style={styles.secondary}>
          {onDelete ? <Button label={deleteLabel} variant="text" danger icon="trash-outline" compact onPress={onDelete} /> : <View />}
          {onCancel ? <Button label="Cancel" variant="text" compact onPress={onCancel} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** A small label above a group of fields, e.g. "How rested?". */
export function FieldLabel({ children }: { children: string }) {
  return (
    <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  list: { overflow: 'hidden', borderRadius: Radius.md },
  row: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, marginTop: -StyleSheet.hairlineWidth },
  main: {
    flex: 1,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    paddingVertical: Spacing.two,
  },
  text: { flex: 1, gap: Spacing.half },
  mark: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  panel: {
    padding: Spacing.three,
    gap: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: -StyleSheet.hairlineWidth,
  },
  actions: { gap: Spacing.one },
  secondary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
