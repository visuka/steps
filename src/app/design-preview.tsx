import { useLocalSearchParams, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { type ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TodayScreen from '@/app/(tabs)/index';
import NewsRoute from '@/app/news';
import ActivityTab from '@/app/(tabs)/activity';
import PlusTab from '@/app/(tabs)/plus';
import YouScreen from '@/app/(tabs)/you';
import FoodTab from '@/app/(tabs)/food';
import SettingsScreen from '@/app/settings';
import InsightsRoute from '@/app/insights';
import StepCheckScreen from '@/app/step-check';
import PlacesRoute from '@/app/walk/places';
import RecordScreen from '@/app/walk/record';
import FindWalkers from '@/app/buddies/find';
import Requests from '@/app/buddies/requests';
import ChatScreen from '@/app/buddies/chat/[key]';
import WalkerScreen from '@/app/buddies/walker/[pid]';
import { AuthScreen } from '@/components/auth/auth-screen';
import { BuddiesHome } from '@/components/buddies/buddies-home';
import { ScanScreen } from '@/components/food/scan-screen';
import { Onboarding } from '@/components/onboarding';
import { Detail } from '@/app/detail/[kind]';
import { dayKey } from '@/lib/dates';
import { BuddiesSource } from '@/buddies/use-buddies';
import { SAMPLE_SOCIAL_API } from '@/design-preview/buddies-sample';
import { WalkDetail } from '@/app/walk/[id]';
import { FoodResultScreen } from '@/components/food/food-result';
import { ThemedText } from '@/components/themed-text';
import { ActiveTheme, Spacing } from '@/constants/theme';
import { parsePreviewParams, type PreviewScreen } from '@/design-preview/params';
import { SampleDataProvider } from '@/design-preview/providers';
import { SAMPLE_COOKING_FOOD, SAMPLE_COOKING_TABLES } from '@/design-preview/cooking-sample';
import { SAMPLE_FOOD_RESULT, SAMPLE_WALK_ID } from '@/design-preview/sample';
import { DayPartOverride } from '@/hooks/use-day-part';
import { useTheme } from '@/hooks/use-theme';
import type { SeriesKind } from '@/state/series';

/** The tab each tab screen shows as selected in its navigation bar ('none': a tab screen without a button, e.g. Food). */
const TAB_OF: Partial<Record<PreviewScreen, string>> = {
  today: 'index',
  walk: 'activity',
  plus: 'plus',
  buddies: 'plus',
  activity: 'activity',
  you: 'you',
  foodtab: 'none',
};

/**
 * The real Today, Food result, Walk and hourly detail screens over the mockups'
 * sample day, in one theme, for CI to photograph next to the mockups:
 *
 *   neutcraftssteps://design-preview?theme=e&screen=today
 *   neutcraftssteps://design-preview?theme=e&screen=detail&kind=water
 *
 * Opened with the app closed, the whole run is a preview (design-preview/
 * launch.ts): the link's theme, the sample day's clock, no sign-in, and none
 * of the phone's data read or written; the person's saved theme stays. Every
 * screen here reads design-preview/providers.tsx's sample data, never the
 * phone's, however the route was reached.
 */
export default function DesignPreviewRoute() {
  // &part=dawn|noon|dusk: Today and the bar in that part's colours, not the clock's (T18).
  const part = parsePreviewParams(useLocalSearchParams())?.part ?? null;
  return (
    <DayPartOverride.Provider value={part}>
      <DesignPreviewScreens />
    </DayPartOverride.Provider>
  );
}

function DesignPreviewScreens() {
  const raw = useLocalSearchParams();
  const params = parsePreviewParams(raw);
  const shown = params && params.theme === ActiveTheme.id ? `${params.theme} ${params.screen}${params.edit ? ' edit' : ''}${params.mine ? ' mine' : ''}${params.part ? ` ${params.part}` : ''}` : 'refused';

  // CI waits for this line in logcat before photographing (.github/scripts/launch-and-capture.sh).
  useEffect(() => {
    console.log(`design-preview ready: ${shown}`);
  }, [shown]);

  if (!params) {
    return <Notice text="Unknown preview. Use ?theme=e&screen=today|food|walk|detail|plus|activity|news|you|settings|… (detail also takes &kind=steps|active|food|water|sleep)." />;
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
  if (params.screen === 'news') {
    // The ticker's list: a stack screen, so no navigation bar under it.
    return (
      <SampleDataProvider>
        <NewsRoute />
      </SampleDataProvider>
    );
  }
  if (!TAB_OF[params.screen] && params.screen !== 'food') {
    // Screens pushed over the tabs (and sign-in, first run): no navigation bar under them.
    return (
      <SampleDataProvider>
        <BuddiesSource api={SAMPLE_SOCIAL_API}>
          <View style={styles.fill}>
            <StackScreen screen={params.screen} />
          </View>
        </BuddiesSource>
      </SampleDataProvider>
    );
  }
  if (params.screen === 'food') {
    // The food result has no bottom bar (spec 7): its buttons sit 24 above the bottom.
    return (
      <SampleDataProvider>
        <View style={styles.fill}>
          <PreviewScreenBody screen="food" edit={params.edit} mine={params.mine} />
        </View>
      </SampleDataProvider>
    );
  }
  return (
    <SampleDataProvider>
      <WithNavigationBar activeKey={TAB_OF[params.screen] ?? 'none'}>
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

/** A screen pushed over the tabs, over the sample data. Chat and walker read their key, pid and name from the link. */
function StackScreen({ screen }: { screen: PreviewScreen }) {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : undefined);
  switch (screen) {
    case 'settings':
      return <SettingsScreen />;
    case 'insights':
      return <InsightsRoute />;
    case 'stepcheck':
      return <StepCheckScreen />;
    case 'places':
      return <PlacesRoute />;
    case 'record':
      return <RecordScreen />;
    case 'scan':
      return <ScanScreen onClose={back} />;
    case 'find':
      return <FindWalkers />;
    case 'requests':
      return <Requests />;
    case 'chat':
      return <ChatScreen />;
    case 'walker':
      return <WalkerScreen />;
    case 'signin':
      return <AuthScreen />;
    case 'welcome':
      return <Onboarding />;
    default:
      return null;
  }
}

function PreviewScreenBody({ screen, edit, mine }: { screen: PreviewScreen; edit?: boolean; mine?: boolean }) {
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
          food={mine ? { ...SAMPLE_FOOD_RESULT.food, id: 'mine:1', source: 'mine', basedOn: SAMPLE_FOOD_RESULT.food.id } : edit ? SAMPLE_COOKING_FOOD : SAMPLE_FOOD_RESULT.food}
          overrides={{}}
          initialUnit={SAMPLE_FOOD_RESULT.unit}
          initialQuantity={SAMPLE_FOOD_RESULT.quantity}
          actionLabel={`Save to ${SAMPLE_FOOD_RESULT.meal}`}
          onDone={() => undefined}
          onCancel={back}
          onSetPortion={() => undefined}
          // Nothing is worked out in the preview: the editor opens, and Use these ingredients just closes it.
          onChangeIngredients={async () => null}
          startEditing={edit}
          // The editor opens with the sample's own profiles and tables: nothing is looked up here.
          cooking={
            edit
              ? { tables: SAMPLE_COOKING_TABLES, country: '*', fetchProfiles: async () => [], withProfiles: async (f) => f.ingredients ?? null }
              : undefined
          }
          // The person's version opens on its Edit panel, where Use our guess again is.
          showWorking={mine}
          onUseOurGuess={mine ? () => undefined : undefined}
        />
      );
    case 'plus':
      // The bar's plus: chats and groups.
      return (
        <BuddiesSource api={SAMPLE_SOCIAL_API}>
          <PlusTab />
        </BuddiesSource>
      );
    case 'buddies':
      // Chats and buddies on its Buddies side.
      return (
        <BuddiesSource api={SAMPLE_SOCIAL_API}>
          <BuddiesHome initialSegment="buddies" />
        </BuddiesSource>
      );
    case 'activity':
      // Activity on its Health side (or the link's &section=workouts|bp|weight).
      return <ActivityTab />;
    case 'you':
      return <YouScreen />;
    case 'foodtab':
      return <FoodTab />;
    case 'walk':
      return <WalkDetail id={SAMPLE_WALK_ID} />;
    case 'detail':
      return null; // drawn by DetailPreview, without the navigation bar
    default:
      return null; // stack screens: drawn by StackScreen
  }
}

/**
 * The screen above the real navigation bar, with the tab the mockup selects;
 * the screen is told it is inside the tabs, as on the phone. Tabs do nothing here.
 */
function WithNavigationBar({ children }: { activeKey: string; children: ReactNode }) {
  // No bottom bar any more (owner, 17 Nov 2026): the top row's switch moves between the parts.
  return (
    <BottomTabBarHeightContext.Provider value={0}>
      <View style={styles.fill}>{children}</View>
    </BottomTabBarHeightContext.Provider>
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
