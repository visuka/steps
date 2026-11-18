import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';

import { useReducedMotion } from '@/components/ui/motion';
import { BAR_TABS, TAB_SCREENS } from '@/components/tab-routes';
import { PART_SCREEN, PartBar, partOfScreen } from '@/components/plain/part-bar';
import { PLAIN } from '@/components/plain/plain-theme';

/** The bar's buttons; the screens without one are in tab-routes.ts. */
export const TABS = BAR_TABS;

/** The part bar under the focused tab, when it is one of the three parts (part-bar.tsx). */
function TabsPartBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (route) navigateToTab(route.key);
  };
  return <PartBar part={partOfScreen(state.routes[state.index].name)} bottomInset={insets.bottom} onChange={(p) => go(PART_SCREEN[p])} />;
}

/**
 * The bottom bar is the Nutrition · Activity · Buddies switch (owner, 18 Nov
 * 2026), under Food, Today and Chats only; the top row's avatar opens Profile. Every screen is still declared (never href null: see tab-routes.ts).
 * Tabs move with a short shift (Material's shared axis), or cut with reduce motion.
 * System Back from any tab returns to Today, then leaves the app.
 */
export default function AppTabs() {
  const reduced = useReducedMotion();
  return (
    <Tabs
      tabBar={(props) => <TabsPartBar {...props} />}
      backBehavior="firstRoute"
      screenOptions={{
        headerShown: false,
        animation: reduced ? 'none' : 'shift',
        // The plain look is light on every phone, dark mode or not.
        sceneStyle: { backgroundColor: PLAIN.ground.top },
      }}>
      {TAB_SCREENS.map((r) => (
        <Tabs.Screen key={r.name} name={r.name} options={{ title: r.title }} />
      ))}
    </Tabs>
  );
}
