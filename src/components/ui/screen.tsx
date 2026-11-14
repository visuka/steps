import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { type ReactNode, use } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { SpecIcon } from './icons';
import { SCREEN, backHitSlop, bottomOffset, bottomPadding, subtitleIndent, topPadding } from './screen-style';

export interface ScreenProps {
  title: string;
  /** One line under the title, e.g. "Updated 2 min ago · Health Connect". */
  subtitle?: string;
  /** 'large' for the five tab screens, 'small' for screens pushed over them (the default with onBack). Both are 22/30 in Clean+. */
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
 * keeps clear of them. Content starts at the status-bar inset plus the spec
 * gap (24 on a tab screen, 16 with a back control). Inside the tabs the
 * navigation bar takes its own room; screens pushed over the tabs keep clear
 * of the gesture bar.
 */
export function Screen({
  title,
  subtitle,
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
  const bottom = bottomOffset(inTabs, insets.bottom);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPadding(insets.top, !!onBack), paddingBottom: bottomPadding(inTabs, insets.bottom, !!fab) },
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
                  hitSlop={backHitSlop()}>
                  <SpecIcon name="chevron-left" color={theme.onSurface} size={SCREEN.back.iconSize} />
                </Pressable>
              ) : null}
              <ThemedText
                type="headlineSmall"
                accessibilityRole="header"
                maxFontSizeMultiplier={1.3}
                style={styles.title}>
                {title}
              </ThemedText>
              {right}
            </View>
            {subtitle ? (
              <ThemedText
                type="bodyMedium"
                themeColor="onSurfaceVariant"
                maxFontSizeMultiplier={1.3}
                style={onBack ? styles.subtitleBack : null}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {children}
        </View>
      </ScrollView>
      {/* The status bar's strip in the page colour: content scrolls under it, never under the clock. */}
      <View pointerEvents="none" style={[styles.statusInset, { height: insets.top, backgroundColor: theme.surface }]} />
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
  statusInset: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: { paddingHorizontal: SCREEN.sideMargin, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: SCREEN.blockGap },
  // Heights from the spec are minimums: the row grows with large text.
  header: { minHeight: SCREEN.topBarHeight, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SCREEN.back.titleGap, minHeight: SCREEN.topBarHeight },
  back: { height: SCREEN.topBarHeight, marginLeft: SCREEN.back.marginLeft, justifyContent: 'center' },
  title: { flex: 1 },
  subtitleBack: { marginLeft: subtitleIndent() },
  bottomLayer: { position: 'absolute', left: SCREEN.sideMargin, right: SCREEN.sideMargin, gap: SCREEN.fabGap, alignItems: 'flex-end' },
  overlay: { alignSelf: 'stretch' },
  fab: {},
});
