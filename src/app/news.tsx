import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { SpecIcon } from '@/components/ui';
import { Screen } from '@/components/ui/screen';
import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import { useTheme } from '@/hooks/use-theme';
import { type NewsItem, useGoodNews } from '@/state/use-good-news';

/**
 * Every good-news headline from Today's ticker. A tap opens the story on its
 * own site in the browser; the app keeps only the headline and the link.
 */
export default function NewsRoute() {
  const router = useRouter();
  const theme = useTheme();
  const items = useGoodNews();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const sources = [...new Set(items.map((n) => n.source))];

  return (
    <Screen title="Good news" onBack={back}>
      {items.length ? (
        <View style={[styles.list, { backgroundColor: theme.surfaceContainerLow }]}>
          {items.map((n, i) => (
            <Row key={n.link} item={n} last={i === items.length - 1} />
          ))}
        </View>
      ) : (
        <ThemedText type="bodyLarge" themeColor="onSurfaceVariant">
          No headlines yet. They come when the phone is online.
        </ThemedText>
      )}
      {sources.length ? (
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" style={styles.note}>
          {`Headlines from ${sources.join(' and ')}. Each story opens on its own website.`}
        </ThemedText>
      ) : null}
    </Screen>
  );
}

function Row({ item, last }: { item: NewsItem; last: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(item.link).catch(() => undefined)}
      accessibilityRole="link"
      accessibilityLabel={`${item.title}. ${item.source}`}
      accessibilityHint="Opens the story in the browser"
      android_ripple={{ color: `${theme.onSurface}1A` }}
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.outlineVariant }]}>
      <View style={styles.text}>
        <ThemedText type="titleMedium">{item.title}</ThemedText>
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
          {item.source}
        </ThemedText>
      </View>
      <SpecIcon name="chevron-right" color={theme.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: CLEAN_SPEC.radius.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CLEAN_SPEC.space.s12,
    paddingHorizontal: CLEAN_SPEC.space.s16,
    paddingVertical: CLEAN_SPEC.space.s12,
    minHeight: 64,
  },
  text: { flex: 1, gap: 2 },
  note: { marginTop: CLEAN_SPEC.space.s12 },
});
