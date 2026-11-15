import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { ADD_KEY, ADD_LABEL } from '@/components/add-sheet-rows';
import { AddSheet } from '@/components/add-sheet';
import { useFoodResultCovering } from '@/components/food/food-result-cover';
import { NavigationBar, type NavigationItem } from '@/components/ui/navigation-bar';
import { useReducedMotion } from '@/components/ui/motion';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * The bar, in order (icons as the mockup's nav): Today, Food, the Add button
 * in the middle (opens the Add sheet: Sleep, Mood, Weight, Blood pressure,
 * Water, Start walk), Activity, You. Journal has no slot; it stays a hidden
 * route (see HIDDEN_ROUTES), opened from the Add sheet and from the You tab.
 */
export const TABS: NavigationItem[] = [
  { key: 'index', label: 'Today', specIcon: 'today' },
  { key: 'food', label: 'Food', specIcon: 'bowl' },
  { key: ADD_KEY, label: ADD_LABEL, specIcon: 'plus', fab: true },
  { key: 'activity', label: 'Activity', specIcon: 'pulse' },
  { key: 'you', label: 'You', specIcon: 'person' },
];

/** Routes of the tabs navigator that have no slot in the bar but can still be opened. */
export const HIDDEN_ROUTES = ['journal'] as const;

/** Tabs that are real routes (the Add button is an action, not a route). */
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
  const [addOpen, setAddOpen] = useState(false);
  const focused = state.routes[state.index];
  // A food result has no bottom bar (spec 7), and the keyboard takes the room of one.
  if (keyboardUp || resultUp) return null;

  const press = (name: string) => {
    if (name === ADD_KEY) {
      setAddOpen(true);
      return;
    }
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    // Pressing the open tab again lets its screen scroll to the top.
    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (route.key !== focused.key && !event.defaultPrevented) navigateToTab(route.key);
  };

  return (
    <>
      <NavigationBar
        items={TABS}
        activeKey={ROUTE_TABS.some((t) => t.key === focused.name) ? focused.name : null}
        onSelect={press}
        onReselect={press}
        bottomInset={insets.bottom}
      />
      <AddSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

/**
 * The Clean+ navigation bar: Today, Food, Add, Activity and You, icons only.
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
