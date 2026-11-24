import { Children, type ReactNode, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBarBelow } from '@/components/plain/part-bar';
import { PlainGround } from '@/components/plain/plain-kit';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { SpecIcon } from './icons';
import { Rise } from './rise';
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
  // The part bar takes the bottom inset when it sits under this screen.
  const inTabs = useBarBelow();
  const bottom = bottomOffset(inTabs, insets.bottom);
  // The page's height, so the status strip can show the same ground as the page behind it.
  const win = useWindowDimensions();
  const [height, setHeight] = useState(0);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {/* The same soft grey ground as the three parts. */}
      <PlainGround />
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
          <Rise style={styles.header}>
            <View style={styles.titleRow}>
              {onBack ? <BackButton onPress={onBack} /> : null}
              <ThemedText
                type="headlineSmall"
                accessibilityRole="header"
                maxFontSizeMultiplier={1.3}
                numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
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
          </Rise>
          {Children.toArray(children).map((child, i) => (
            // A block that is a fragment (HealthLog, Workouts, Patterns) spaces its parts like top-level blocks.
            <Rise key={keyOf(child, i)} delay={Math.min(i + 1, 6) * 50} style={styles.block}>
              {child}
            </Rise>
          ))}
        </View>
      </ScrollView>
      {/*
        The status bar's strip: content scrolls under it, never under the clock. It shows the
        page's own ground (a clipped copy, as tall as the page), so there is no flat band or seam.
      */}
      <View pointerEvents="none" style={[styles.statusInset, { height: insets.top, backgroundColor: theme.surface }]}>
        <View style={{ height: height || win.height }}>
          <PlainGround />
        </View>
      </View>
      {fab || overlay ? (
        <View pointerEvents="box-none" style={[styles.bottomLayer, { bottom }]}>
          {overlay ? <View style={styles.overlay}>{overlay}</View> : null}
          {fab ? <View style={styles.fab}>{fab}</View> : null}
        </View>
      ) : null}
    </View>
  );
}

/** The back chevron of a pushed screen, also for screens that draw their own top bar (a club). */
export function BackButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Back" style={styles.back} hitSlop={backHitSlop()}>
      <SpecIcon name="chevron-left" color={theme.onSurface} size={SCREEN.back.iconSize} />
    </Pressable>
  );
}

/*
 * The title and then each block rise into place when a screen opens, 50 ms
 * apart (the sixth block on all at once), so the page settles rather than
 * pops. Only on first draw; a cut with the phone's less-motion setting.
 */

function keyOf(child: ReactNode, i: number): string {
  const k = child && typeof child === 'object' && 'key' in child ? child.key : null;
  return k == null ? String(i) : String(k);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusInset: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  content: { paddingHorizontal: SCREEN.sideMargin, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: SCREEN.blockGap },
  block: { gap: SCREEN.blockGap },
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
