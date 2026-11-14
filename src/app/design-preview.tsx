import { useLocalSearchParams, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TodayScreen from '@/app/(tabs)/index';
import { Detail } from '@/app/detail/[kind]';
import { dayKey } from '@/lib/dates';
import { WalkDetail } from '@/app/walk/[id]';
import { TABS } from '@/components/app-tabs';
import { FoodResultScreen } from '@/components/food/food-result';
import { ThemedText } from '@/components/themed-text';
import { NavigationBar } from '@/components/ui/navigation-bar';
import { ActiveTheme, Spacing } from '@/constants/theme';
import { parsePreviewParams, type PreviewScreen } from '@/design-preview/params';
import { SampleDataProvider } from '@/design-preview/providers';
import { SAMPLE_FOOD_RESULT, SAMPLE_WALK_ID } from '@/design-preview/sample';
import { useTheme } from '@/hooks/use-theme';
import type { SeriesKind } from '@/state/series';

/** The tab each mockup screen shows as selected in its navigation bar (the detail screen is a stack screen: no bar). */
const TAB_OF: Record<Exclude<PreviewScreen, 'detail' | 'food'>, string> = { today: 'index', walk: 'activity' };

/**
 * The real Today, Food result, Walk and hourly detail screens over the mockups'
 * sample day, in one theme, for CI to photograph next to the mockups:
 *
 *   neutcraftssteps://design-preview?theme=d&screen=today
 *   neutcraftssteps://design-preview?theme=clean&screen=detail&kind=water
 *
 * Opened with the app closed, the whole run is a preview (design-preview/
 * launch.ts): the link's theme, the sample day's clock, no sign-in, and none
 * of the phone's data read or written; the person's saved theme stays. Every
 * screen here reads design-preview/providers.tsx's sample data, never the
 * phone's, however the route was reached.
 */
export default function DesignPreviewRoute() {
  const raw = useLocalSearchParams();
  const params = parsePreviewParams(raw);
  const shown = params && params.theme === ActiveTheme.id ? `${params.theme} ${params.screen}` : 'refused';

  // CI waits for this line in logcat before photographing (.github/scripts/launch-and-capture.sh).
  useEffect(() => {
    console.log(`design-preview ready: ${shown}`);
  }, [shown]);

  if (!params) {
    return <Notice text="Unknown preview. Use ?theme=clean|park|a|b|c|d|e|f&screen=today|food|walk|detail (detail also takes &kind=steps|active|food|water|sleep)." />;
  }
  if (params.theme !== ActiveTheme.id) {
    return <Notice text={`This run is in theme ${ActiveTheme.id}, not ${params.theme}. Close the app, then open the link again.`} />;
  }
  if (params.screen === 'detail') {
    return (
      <SampleDataProvider>
        <DetailPreview kind={params.kind ?? 'steps'} />
      </SampleDataProvider>
    );
  }
  if (params.screen === 'food') {
    // The food result has no bottom bar (spec 7): its buttons sit 24 above the bottom.
    return (
      <SampleDataProvider>
        <View style={styles.fill}>
          <PreviewScreenBody screen="food" />
        </View>
      </SampleDataProvider>
    );
  }
  return (
    <SampleDataProvider>
      <WithNavigationBar activeKey={TAB_OF[params.screen]}>
        <PreviewScreenBody screen={params.screen} />
      </WithNavigationBar>
    </SampleDataProvider>
  );
}

/**
 * The real detail screen (app/detail/[kind].tsx) for the kind parsed from the link
 * (steps when missing or unknown), on today. It is given the kind directly: this
 * route has no [kind] segment, so the screen cannot read it from the route's params
 * (the first CI run drew a blank page that way). It is a stack screen on the phone,
 * so there is no navigation bar under it.
 */
function DetailPreview({ kind }: { kind: SeriesKind }) {
  return <Detail kind={kind} firstDay={dayKey(new Date())} />;
}

function PreviewScreenBody({ screen }: { screen: PreviewScreen }) {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : undefined);
  switch (screen) {
    case 'today':
      return <TodayScreen />;
    case 'food':
      return (
        <FoodResultScreen
          query={SAMPLE_FOOD_RESULT.query}
          script={SAMPLE_FOOD_RESULT.script}
          food={SAMPLE_FOOD_RESULT.food}
          overrides={{}}
          initialUnit={SAMPLE_FOOD_RESULT.unit}
          initialQuantity={SAMPLE_FOOD_RESULT.quantity}
          actionLabel={`Save to ${SAMPLE_FOOD_RESULT.meal}`}
          onDone={() => undefined}
          onCancel={back}
          onSetPortion={() => undefined}
        />
      );
    case 'walk':
      return <WalkDetail id={SAMPLE_WALK_ID} />;
    case 'detail':
      return null; // drawn by DetailPreview, without the navigation bar
  }
}

/**
 * The screen above the real navigation bar, with the tab the mockup selects;
 * the screen is told it is inside the tabs, as on the phone. Tabs do nothing here.
 */
function WithNavigationBar({ activeKey, children }: { activeKey: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [barHeight, setBarHeight] = useState(80);
  return (
    <View style={styles.fill}>
      <BottomTabBarHeightContext.Provider value={barHeight}>
        <View style={styles.fill}>{children}</View>
      </BottomTabBarHeightContext.Provider>
      <View onLayout={(e) => setBarHeight(Math.round(e.nativeEvent.layout.height))}>
        <NavigationBar items={TABS} activeKey={activeKey} onSelect={() => undefined} bottomInset={insets.bottom} />
      </View>
    </View>
  );
}

function Notice({ text }: { text: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, styles.notice, { backgroundColor: theme.surface, paddingTop: insets.top + Spacing.four }]}>
      <ThemedText type="bodyLarge">{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  notice: { paddingHorizontal: Spacing.three },
});
