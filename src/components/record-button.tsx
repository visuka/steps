import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SIZE = 88;

/** The big round button in the middle of Today that starts (or returns to) a walk. */
export function RecordButton({ walking, onPress }: { walking: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={walking ? 'Open walk in progress' : 'Record a walk'}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: walking ? theme.danger : theme.accent,
            shadowColor: walking ? theme.danger : theme.accent,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}>
        <Ionicons name={walking ? 'radio-button-on' : 'walk'} size={40} color={theme.onAccent} />
      </Pressable>
      <ThemedText type="smallBold">{walking ? 'Walk in progress' : 'Record a walk'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {walking ? 'Tap to see it or finish' : 'Map your route, pace and calories'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.two },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
