import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/components/ui/motion';
import { ActiveTheme, MaxTextScale } from '@/constants/theme';
import type { NewsItem } from '@/state/use-good-news';

/** dp a second: slow enough to read a headline as it passes. */
const SPEED = 36;
const F = ActiveTheme.fonts;
const START_DELAY_MS = 1200;
/** docs/design.md "Good news ticker": 32 high, label 11 semibold, headlines 12. */
export const TICKER_HEIGHT = 32;

export interface TickerColors {
  background: string;
  label: string;
  labelInk: string;
  ink: string;
  quiet: string;
  ripple: string;
}

/**
 * One line of good-news headlines moving right to left, under the quote at
 * the top of Today (owner, 16 Nov 2026: "some news scrolling section"). A tap
 * opens every headline as a list (app/news.tsx), where each opens its story.
 * With the phone's reduce-motion setting on, the first headline stands still.
 */
export function NewsTicker({ items, colors, onPress }: { items: NewsItem[]; colors: TickerColors; onPress: () => void }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(x);
    x.set(0);
    if (reduced || width <= 0) return;
    x.set(
      withDelay(START_DELAY_MS, withRepeat(withTiming(-width, { duration: (width / SPEED) * 1000, easing: Easing.linear }), -1, false)),
    );
    return () => cancelAnimation(x);
  }, [width, reduced, x]);

  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  const line = (copy: number) => (
    <View
      key={copy}
      style={styles.row}
      onLayout={copy === 0 ? (e) => setWidth(Math.round(e.nativeEvent.layout.width)) : undefined}>
      {items.map((n, i) => (
        <View key={`${copy}-${i}`} style={styles.row}>
          <Text style={[styles.title, { color: colors.ink }]} maxFontSizeMultiplier={MaxTextScale} numberOfLines={1}>
            {n.title}
          </Text>
          <Text style={[styles.source, { color: colors.quiet }]} maxFontSizeMultiplier={MaxTextScale} numberOfLines={1}>
            {`  ${n.source}`}
          </Text>
          <Text style={[styles.dot, { color: colors.quiet }]} maxFontSizeMultiplier={MaxTextScale}>
            {'   •   '}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Good news, ${items.length} ${items.length === 1 ? 'headline' : 'headlines'}. First: ${items[0]?.title ?? ''}`}
      accessibilityHint="Opens the list of headlines"
      android_ripple={{ color: colors.ripple, foreground: true }}
      style={[styles.ticker, { backgroundColor: colors.background }]}>
      <View style={[styles.label, { backgroundColor: colors.label }]}>
        <Text style={[styles.labelText, { color: colors.labelInk }]} maxFontSizeMultiplier={1.2} numberOfLines={1}>
          Good news
        </Text>
      </View>
      {reduced ? (
        <Text style={[styles.title, styles.still, { color: colors.ink }]} maxFontSizeMultiplier={MaxTextScale} numberOfLines={1}>
          {items[0]?.title}
        </Text>
      ) : (
        <ScrollView
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          pointerEvents="none"
          style={styles.window}
          contentContainerStyle={styles.windowContent}>
          {/* Two copies one after the other: when the first has moved out, the second is where it began. */}
          <Animated.View style={[styles.row, moving]}>{[line(0), line(1)]}</Animated.View>
        </ScrollView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ticker: {
    height: TICKER_HEIGHT,
    borderRadius: TICKER_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    overflow: 'hidden',
  },
  label: {
    height: TICKER_HEIGHT - 8,
    borderRadius: (TICKER_HEIGHT - 8) / 2,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  labelText: { fontFamily: F.semibold.family, fontSize: 11, lineHeight: 14, includeFontPadding: false },
  window: { flex: 1, marginLeft: 8 },
  windowContent: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontFamily: F.regular.family, fontSize: 12, lineHeight: 16, includeFontPadding: false },
  source: { fontFamily: F.regular.family, fontSize: 11, lineHeight: 16, includeFontPadding: false },
  dot: { fontFamily: F.regular.family, fontSize: 12, lineHeight: 16, includeFontPadding: false },
  still: { flex: 1, marginLeft: 8, marginRight: 14 },
});
