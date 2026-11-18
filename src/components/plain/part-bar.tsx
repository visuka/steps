/**
 * The bottom switch of the three parts (owner, 18 Nov 2026: "move the nutrition,
 * activity, meet to bottom and rename meet to buddies"): NUTRITION · ACTIVITY ·
 * BUDDIES under Food, Today and Chats, nowhere else.
 *
 * The tabs navigator draws it once for all three (app-tabs.tsx), so no screen
 * carries it. It tells the navigator its height, so the parts end above it and the
 * bar, not the page, keeps clear of the gesture bar: a page asks `useBarBelow()`
 * instead of working that out itself.
 */
import { BottomTabBarHeightCallbackContext, BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { use, useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFoodResultCovering } from '@/components/food/food-result-cover';
import { MaxContentWidth } from '@/constants/theme';
import { PLAIN, PLAIN_SIZE } from '@/constants/themes/plain';
import { scaled } from '@/constants/ui-scale';

import { Segments } from './plain-kit';

const S = scaled;

export type Part = 'nutrition' | 'activity' | 'buddies';

/** The tab screen (app/(tabs)) of each part. */
export const PART_SCREEN: Record<Part, string> = { nutrition: 'food', activity: 'index', buddies: 'plus' };

/** The part a tab screen belongs to, or null for a tab with no bar (Profile, Activity, Journal). */
export function partOfScreen(name: string): Part | null {
  const hit = (Object.keys(PART_SCREEN) as Part[]).find((p) => PART_SCREEN[p] === name);
  return hit ?? null;
}

const PARTS = [
  { value: 'nutrition' as const, text: 'NUTRITION' },
  { value: 'activity' as const, text: 'ACTIVITY' },
  { value: 'buddies' as const, text: 'BUDDIES' },
];

const SPOKEN: Record<Part, string> = {
  nutrition: 'Nutrition: food',
  activity: 'Activity: today',
  buddies: 'Buddies: chats and walk buddies',
};

/** True while the soft keyboard is up: the bar steps aside so it never rides on the keyboard. */
function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return up;
}

/**
 * The bar itself: the switch, full width inside the page gutter, on the ground's
 * own grey, `bottomInset` + 8 above the bottom. Hidden (and 0 tall) while the
 * keyboard or a food result is up.
 */
export function PartBar({ part, onChange, bottomInset }: { part: Part | null; onChange: (p: Part) => void; bottomInset: number }) {
  const report = use(BottomTabBarHeightCallbackContext);
  const keyboard = useKeyboardUp();
  const covered = useFoodResultCovering();
  const hidden = !part || keyboard || covered;
  useEffect(() => {
    if (hidden) report?.(0);
  }, [hidden, report]);
  if (hidden) return null;
  return (
    <View onLayout={(e) => report?.(e.nativeEvent.layout.height)} style={[styles.bar, { paddingBottom: bottomInset + S(8) }]}>
      <View style={styles.column}>
        <Segments<Part>
          stretch
          parts={PARTS}
          value={part}
          onChange={(p) => {
            if (p !== part) onChange(p);
          }}
          spoken={(p) => SPOKEN[p]}
        />
      </View>
    </View>
  );
}

/**
 * Whether the part bar sits under this screen. When it does, the bar keeps clear
 * of the gesture bar and the page adds no bottom inset; anywhere else (pushed
 * screens, Profile) the page adds it. The one place every screen asks.
 */
export function useBarBelow(): boolean {
  return Boolean(use(BottomTabBarHeightContext));
}

/** The room a page leaves under its last line for the gesture bar: none above the part bar. */
export function useFootInset(): number {
  const insets = useSafeAreaInsets();
  return useBarBelow() ? 0 : insets.bottom;
}

const styles = StyleSheet.create({
  bar: { backgroundColor: PLAIN.ground.bottom, paddingTop: S(6) },
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: S(PLAIN_SIZE.gutter) },
});
