import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { type ReactNode, use } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ScreenProps {
  title: string;
  /** One line under the title, e.g. "Updated 2 min ago · Health Connect". */
  subtitle?: string;
  /** 'large' for the five tab screens, 'small' for screens pushed over them (the default with onBack). */
  titleSize?: 'large' | 'small';
  children: ReactNode;
  /** Pull to refresh. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** End of the title row: one icon button at most. */
  right?: ReactNode;
  /** Shows a back arrow (screens pushed over the tabs). System Back works either way. */
  onBack?: () => void;
  /** The screen's one ExtendedFab, kept above the navigation bar. */
  fab?: ReactNode;
  /** Pinned to the bottom above the FAB, e.g. a Snackbar. */
  overlay?: ReactNode;
}

/**
 * A screen edge to edge: the system bars stay see-through and the content
 * keeps clear of them. Inside the tabs the navigation bar takes its own
 * room; screens pushed over the tabs keep clear of the gesture bar.
 */
export function Screen({
  title,
  subtitle,
  titleSize,
  children,
  refreshing,
  onRefresh,
  right,
  onBack,
  fab,
  overlay,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inTabs = use(BottomTabBarHeightContext) !== undefined;
  const bottom = (inTabs ? 0 : insets.bottom) + Spacing.three;
  const small = (titleSize ?? (onBack ? 'small' : 'large')) === 'small';
  const fabRoom = fab ? 56 + Spacing.three : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.two, paddingBottom: bottom + fabRoom + Spacing.five },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
              progressBackgroundColor={theme.surfaceContainerHigh}
              progressViewOffset={insets.top}
            />
          ) : undefined
        }>
        <View style={styles.inner}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              {onBack ? (
                <Pressable
                  onPress={onBack}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  style={styles.back}
                  hitSlop={4}>
                  <Ionicons name="arrow-back" size={24} color={theme.onSurface} />
                </Pressable>
              ) : null}
              <ThemedText
                type={small ? 'titleLarge' : 'headlineMedium'}
                accessibilityRole="header"
                style={styles.title}
                numberOfLines={2}>
                {title}
              </ThemedText>
              {right}
            </View>
            {subtitle ? (
              <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={onBack ? styles.subtitleBack : null}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {children}
        </View>
      </ScrollView>
      {fab || overlay ? (
        <View pointerEvents="box-none" style={[styles.bottomLayer, { bottom }]}>
          {overlay ? <View style={styles.overlay}>{overlay}</View> : null}
          {fab ? <View style={styles.fab}>{fab}</View> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.three, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  header: { gap: Spacing.one, minHeight: 56, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  back: { width: TouchTarget, height: TouchTarget, marginLeft: -Spacing.three + 4, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  subtitleBack: { marginLeft: TouchTarget - Spacing.three + 8 },
  bottomLayer: { position: 'absolute', left: Spacing.three, right: Spacing.three, gap: Spacing.three, alignItems: 'flex-end' },
  overlay: { alignSelf: 'stretch' },
  fab: {},
});
