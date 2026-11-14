import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { ActiveTheme, Spacing } from '@/constants/theme';
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
export function AppearanceNote({ style }: { style?: StyleProp<ViewStyle> } = {}) {
  const router = useRouter();
  const [show, setShow] = useState(() => !seenBefore());

  useEffect(() => {
    if (!show) return;
    try {
      deviceStore()?.setItemSync(THEME_NOTE_KEY, '1');
    } catch {
      // Not saved: it may show once more; harmless.
    }
  }, [show]);

  if (!show) return null;
  return (
    <View style={style}>
      <Card title={`This look is ${ActiveTheme.name}`}>
        <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
          There are eight to choose from, Clean+ the one you start with. Change it any time in Settings → Appearance.
        </ThemedText>
        <View style={styles.buttons}>
          <Button label="Not now" variant="text" compact onPress={() => setShow(false)} />
          <Button
            label="Choose a look"
            variant="tonal"
            compact
            onPress={() => {
              setShow(false);
              router.push({ pathname: '/settings', params: { appearance: '1' } });
            }}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
});
