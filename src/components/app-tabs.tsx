import { Tabs } from 'expo-router/js-tabs';

import { useReducedMotion } from '@/components/ui/motion';
import { BAR_TABS, TAB_SCREENS } from '@/components/tab-routes';
import { PLAIN } from '@/components/plain/plain-theme';

/** The bar's buttons; the screens without one are in tab-routes.ts. */
export const TABS = BAR_TABS;

/**
 * No bottom bar (owner, 17 Nov 2026, the plain look): the top row's
 * Nutrition · Activity · Meet switch moves between Food, Today and Chats, and
 * the avatar opens Profile. Every screen is still declared (never href null: see tab-routes.ts).
 * Tabs move with a short shift (Material's shared axis), or cut with reduce motion.
 * System Back from any tab returns to Today, then leaves the app.
 */
export default function AppTabs() {
  const reduced = useReducedMotion();
  return (
    <Tabs
      tabBar={() => null}
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
