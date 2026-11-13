import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { NavigationBar, type NavigationItem } from '@/components/ui/navigation-bar';
import { useReducedMotion } from '@/components/ui/motion';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** The five destinations, in order. Each name is a file in app/(tabs)/. */
export const TABS: NavigationItem[] = [
  { key: 'index', label: 'Today', icon: 'today-outline', activeIcon: 'today' },
  { key: 'food', label: 'Food', icon: 'restaurant-outline', activeIcon: 'restaurant' },
  { key: 'activity', label: 'Activity', icon: 'walk-outline', activeIcon: 'walk' },
  { key: 'journal', label: 'Journal', icon: 'book-outline', activeIcon: 'book' },
  { key: 'you', label: 'You', icon: 'person-circle-outline', activeIcon: 'person-circle' },
];

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
  const focused = state.routes[state.index];
  if (keyboardUp) return null;

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
      activeKey={TABS.some((t) => t.key === focused.name) ? focused.name : null}
      onSelect={press}
      onReselect={press}
      bottomInset={insets.bottom}
    />
  );
}

/**
 * The Material 3 navigation bar with Today, Food, Activity, Journal and You.
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
      {TABS.map((t) => (
        <Tabs.Screen key={t.key} name={t.key} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}
