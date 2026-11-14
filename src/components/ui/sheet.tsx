import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Motion, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { decelerateEasing, useReducedMotion } from './motion';
import { PlainGround } from './tone-surface';

export interface SheetProps {
  visible: boolean;
  /** Called on the scrim, the system Back gesture and the Back button. */
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Material 3 modal bottom sheet: slides up over a scrim, closes on the
 * scrim, Back, or the caller's own button. Good for a short form or the
 * longer "Why?" behind a screen; never for a whole screen.
 */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={onClose}>
      <PlainGround>
        <View style={styles.root}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: `${theme.scrim}52` }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <Animated.View
            entering={reduced ? undefined : SlideInDown.duration(Motion.duration.medium).easing(decelerateEasing)}
            style={[
              styles.sheet,
              { backgroundColor: theme.surfaceContainerLow, paddingBottom: insets.bottom + Spacing.four },
            ]}
            accessibilityViewIsModal>
            <View style={[styles.handle, { backgroundColor: theme.onSurfaceVariant }]} />
            {title ? (
              <ThemedText type="titleLarge" accessibilityRole="header" style={styles.title}>
                {title}
              </ThemedText>
            ) : null}
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </PlainGround>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.three,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, opacity: 0.4, marginBottom: Spacing.three },
  title: { paddingHorizontal: Spacing.four, marginBottom: Spacing.three },
  body: { paddingHorizontal: Spacing.four, gap: Spacing.three },
});
