import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { useFoodResultCovering } from '@/components/food/food-result-cover';
import { NavigationBar, type NavigationItem } from '@/components/ui/navigation-bar';
import { useReducedMotion } from '@/components/ui/motion';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * The bar, in order (icons as the mockup's nav): Today, Food, the chats button in the
 * middle (chats and groups), Activity (health readings and workouts), You.
 * Each thing lives in one tab. Journal is only a hidden route now, sending
 * old links to Food or Activity (see HIDDEN_ROUTES).
 */
export const TABS: NavigationItem[] = [
  { key: 'index', label: 'Today', specIcon: 'today' },
  { key: 'food', label: 'Food', specIcon: 'bowl' },
  { key: 'plus', label: 'Chats and groups', specIcon: 'chats', fab: true },
  { key: 'activity', label: 'Activity', specIcon: 'pulse' },
  { key: 'you', label: 'You', specIcon: 'person' },
];

/** Routes of the tabs navigator that have no slot in the bar but can still be opened. */
export const HIDDEN_ROUTES = ['journal'] as const;

/** Every slot of the bar is a route. */
const ROUTE_TABS = TABS;

/** On Android the bar steps aside while the keyboard is up, so a search keeps its room. */
function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return up;
}

function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const keyboardUp = useKeyboardUp();
  const resultUp = useFoodResultCovering();
  const focused = state.routes[state.index];
  // A food result has no bottom bar (spec 7), and the keyboard takes the room of one.
  if (keyboardUp || resultUp) return null;

  const press = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    // Pressing the open tab again lets its screen scroll to the top.
    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (route.key !== focused.key && !event.defaultPrevented) navigateToTab(route.key);
  };

  return (
    <NavigationBar
      items={TABS}
      activeKey={ROUTE_TABS.some((t) => t.key === focused.name) ? focused.name : null}
      onSelect={press}
      onReselect={press}
      bottomInset={insets.bottom}
    />
  );
}

/**
 * The Clean+ navigation bar: Today, Food, Chats and groups, Activity and You,
 * icons only. Journal is a hidden route (href null) that redirects old links.
 * Tabs move with a short shift (Material's shared axis), or cut with reduce motion.
 * System Back from any tab returns to Today, then leaves the app.
 */
export default function AppTabs() {
  const dark = useColorScheme() === 'dark';
  const reduced = useReducedMotion();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      backBehavior="firstRoute"
      screenOptions={{
        headerShown: false,
        animation: reduced ? 'none' : 'shift',
        sceneStyle: { backgroundColor: Colors[dark ? 'dark' : 'light'].surface },
      }}>
      {ROUTE_TABS.map((t) => (
        <Tabs.Screen key={t.key} name={t.key} options={{ title: t.label }} />
      ))}
      {HIDDEN_ROUTES.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ title: 'Journal', href: null }} />
      ))}
    </Tabs>
  );
}
