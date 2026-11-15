import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, type StyleProp, type ViewStyle } from 'react-native';

import { ActiveTheme } from '@/constants/theme';
import { deviceStore, THEME_NOTE_KEY } from '@/constants/themes/choice';

/** Read once per run: whether the note was already shown on this phone. */
function seenBefore(): boolean {
  try {
    const store = deviceStore();
    // No store (web preview): never show it.
    return !store || store.getItemSync(THEME_NOTE_KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * Today, once: a quiet card saying the app's look can be changed. It is
 * marked seen the first time it shows, so it never comes back; it stays for
 * this visit until closed. Choosing opens Settings with the picker up.
 */
/** `style` places the card (the themed Todays set their own margins). */
export function AppearanceNote(_props: { style?: StyleProp<ViewStyle> } = {}) {
  const router = useRouter();
  const [show] = useState(() => !seenBefore());

  // A one-time dialog rather than a card, so Today's first screen never grows (owner, 15 Nov 2026).
  useEffect(() => {
    if (!show) return;
    try {
      deviceStore()?.setItemSync(THEME_NOTE_KEY, '1');
    } catch {
      // Not saved: it may show once more; harmless.
    }
    Alert.alert(
      `This look is ${ActiveTheme.name}`,
      'There are eight to choose from, Clean+ the one you start with. Change it any time in Settings → Appearance.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Choose a look', onPress: () => router.push({ pathname: '/settings', params: { appearance: '1' } }) },
      ],
    );
  }, [show, router]);

  return null;
}
