import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { useFoodResultCovering } from '@/components/food/food-result-cover';
import { NavigationBar } from '@/components/ui/navigation-bar';
import { useReducedMotion } from '@/components/ui/motion';
import { BAR_TABS, TAB_SCREENS } from '@/components/tab-routes';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { barColorsOf, useDayPart } from '@/hooks/use-day-part';

/** The bar's buttons; the screens without one are in tab-routes.ts. */
export const TABS = BAR_TABS;

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
  const { palette } = useDayPart();
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
      activeKey={TABS.some((t) => t.key === focused.name) ? focused.name : null}
      onSelect={press}
      onReselect={press}
      bottomInset={insets.bottom}
      // On Today the bar wears the time-of-day colours; elsewhere the Calm theme.
      colors={focused.name === 'index' ? barColorsOf(palette) : undefined}
    />
  );
}

/**
 * The navigation bar: Today, Chats and Profile, each with a label.
 * Food, Activity and Journal are screens without a button (never href null: see tab-routes.ts).
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
      {TAB_SCREENS.map((r) => (
        <Tabs.Screen key={r.name} name={r.name} options={{ title: r.title }} />
      ))}
    </Tabs>
  );
}
