import { useRouter } from 'expo-router';
import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { useFoodResultCovering } from '@/components/food/food-result-cover';
import { NavigationBar, type NavigationItem } from '@/components/ui/navigation-bar';
import { useReducedMotion } from '@/components/ui/motion';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Where the Log food button goes: Food, with a new `add` value so the keyboard opens on the search. */
export const LOG_FOOD_KEY = 'log-food';

/**
 * The bar, in order (icons as the mockup's nav): Today, Food, the Log food
 * button in the middle, Activity, You. Journal has no slot; it stays a hidden
 * route (see HIDDEN_ROUTES) and opens from the You tab.
 */
export const TABS: NavigationItem[] = [
  { key: 'index', label: 'Today', specIcon: 'today' },
  { key: 'food', label: 'Food', specIcon: 'bowl' },
  { key: LOG_FOOD_KEY, label: 'Log food', specIcon: 'plus', fab: true },
  { key: 'activity', label: 'Activity', specIcon: 'pulse' },
  { key: 'you', label: 'You', specIcon: 'person' },
];

/** Routes of the tabs navigator that have no slot in the bar but can still be opened. */
export const HIDDEN_ROUTES = ['journal'] as const;

/** Tabs that are real routes (the Log food button is an action, not a route). */
const ROUTE_TABS = TABS.filter((t) => !t.fab);

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
  const router = useRouter();
  const focused = state.routes[state.index];
  // A food result has no bottom bar (spec 7), and the keyboard takes the room of one.
  if (keyboardUp || resultUp) return null;

  const press = (name: string) => {
    if (name === LOG_FOOD_KEY) {
      // The same target Today's Log food used: Food with a fresh `add`, which opens the keyboard on the search.
      router.navigate({ pathname: '/food', params: { add: String(Date.now()) } });
      return;
    }
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
 * The Clean+ navigation bar: Today, Food, Log food, Activity and You, icons only.
 * Journal is a hidden route (href null) reached from the You tab.
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
