import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { useReducedMotion } from './motion';
import { PlainGround } from './tone-surface';

export interface DialogProps {
  visible: boolean;
  title: string;
  /** One or two short sentences: what happens, and whether it can be undone. */
  message?: string;
  /** The confirming action, e.g. "Delete". */
  confirmLabel: string;
  /** Destructive: the confirming action is in the error colour. */
  danger?: boolean;
  cancelLabel?: string;
  onConfirm: () => void;
  /** The scrim, Cancel, the system Back gesture and the Back button. */
  onCancel: () => void;
  children?: ReactNode;
}

/**
 * Material 3 basic dialog, only for a decision that must interrupt (delete,
 * sign out). Text buttons at the end; Cancel first, the action last.
 */
export function Dialog({
  visible,
  title,
  message,
  confirmLabel,
  danger,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  children,
}: DialogProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={onCancel}>
      <PlainGround>
        <View style={styles.root}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: `${theme.scrim}52` }]}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
          />
          <View
            style={[styles.dialog, { backgroundColor: theme.surfaceContainerHigh }]}
            accessibilityViewIsModal
            accessibilityRole="alert">
            <ThemedText type="headlineSmall" accessibilityRole="header">
              {title}
            </ThemedText>
            {message ? (
              <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
                {message}
              </ThemedText>
            ) : null}
            {children}
            <View style={styles.actions}>
              <Button label={cancelLabel} variant="text" compact onPress={onCancel} />
              <Button label={confirmLabel} variant="text" danger={danger} compact onPress={onConfirm} />
            </View>
          </View>
        </View>
      </PlainGround>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  dialog: {
    width: '100%',
    minWidth: 280,
    maxWidth: 560,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
    marginRight: -Spacing.two,
  },
});
