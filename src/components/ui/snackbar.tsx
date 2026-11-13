import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Motion, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { SHOW_MS, snackbarTimeout } from './snackbar-timing';

/**
 * Material 3 snackbar for brief feedback ("1 glass added · Undo"). It
 * dismisses itself; one at a time. With an action it honours Android's
 * "Time to take action" setting and waits longer while a screen reader is on. Place it at the bottom of a screen, above
 * the FAB, with `style`.
 */
export function Snackbar({
  message,
  action,
  onDismiss,
  style,
}: {
  /** Null hides it. */
  message: string | null;
  action?: { label: string; onPress: () => void };
  onDismiss: () => void;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const hasAction = !!action;
  useEffect(() => {
    if (!message) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = async () => {
      let recommended: number | null = null;
      let screenReader = false;
      if (hasAction) {
        try {
          [recommended, screenReader] = await Promise.all([
            Platform.OS === 'android' ? AccessibilityInfo.getRecommendedTimeoutMillis(SHOW_MS) : Promise.resolve(null),
            AccessibilityInfo.isScreenReaderEnabled(),
          ]);
        } catch {
          // Fall back to the plain timeout.
        }
      }
      if (live) timer = setTimeout(onDismiss, snackbarTimeout({ hasAction, recommended, screenReader }));
    };
    void settle();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [message, hasAction, onDismiss]);

  if (!message) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(Motion.duration.short)}
      exiting={FadeOut.duration(Motion.duration.short)}
      style={[styles.bar, { backgroundColor: theme.inverseSurface }, style]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert">
      <ThemedText type="bodyMedium" style={[styles.text, { color: theme.inverseOnSurface }]}>
        {message}
      </ThemedText>
      {action ? (
        <Pressable
          onPress={() => {
            action.onPress();
            onDismiss();
          }}
          accessibilityRole="button"
          style={styles.action}>
          <ThemedText type="labelLarge" style={{ color: theme.inversePrimary }}>
            {action.label}
          </ThemedText>
        </Pressable>
      ) : (
        <View />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: TouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    borderRadius: Radius.xs,
  },
  text: { flex: 1, paddingVertical: Spacing.three - 2 },
  action: { minHeight: TouchTarget, justifyContent: 'center', paddingHorizontal: Spacing.two },
});
