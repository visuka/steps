/**
 * The screens of the tabs navigator (app/(tabs)) and the bar's buttons, as
 * plain data so jest can check them (components/__tests__/tab-routes.test.ts).
 *
 * The bar, in order: Today, the chats button in the middle (chats and
 * groups), You. Food and Activity left the bar (owner, 16 Nov 2026): Today's
 * Food tile and Log food open Food, its Walk tile opens Activity. Journal only
 * sends old links (notifications) on to Food or Activity.
 *
 * Every screen is declared, and none gets `href: null`: expo-router sends a
 * focused hidden tab straight back to Today (useVisibleTabsWithRedirect),
 * which is what broke build 69. A screen without a button is simply left out
 * of BAR_TABS.
 */
import type { NavigationItem } from '@/components/ui/navigation-bar';

export const BAR_TABS: NavigationItem[] = [
  { key: 'index', label: 'Today', specIcon: 'today' },
  { key: 'plus', label: 'Chats and groups', specIcon: 'chats', fab: true },
  { key: 'you', label: 'You', specIcon: 'person' },
];

/** Screens of the tabs navigator with no button in the bar. */
export const OFF_BAR_SCREENS = [
  { name: 'food', title: 'Food' },
  { name: 'activity', title: 'Activity' },
  { name: 'journal', title: 'Journal' },
] as const;

/** Every screen of the tabs navigator, bar buttons first, with its title. */
export const TAB_SCREENS: { name: string; title: string }[] = [
  ...BAR_TABS.map((t) => ({ name: t.key, title: t.label })),
  ...OFF_BAR_SCREENS,
];
