import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { pressedColor } from './surface-style';
import { avatarHitSlop, GREETING_STYLE, greetingTitle, initialOf } from './greeting-style';

export interface GreetingProps {
  /** Already formatted, e.g. "Sat, 14 Nov". */
  date: string;
  name: string;
  /** The avatar letter; defaults to the first letter of the name. */
  initial?: string;
  /** Makes the avatar a button (opens You). */
  onAvatarPress?: () => void;
  /** The words before the name ("Good morning"); the caller picks them for the time of day. */
  greeting?: string;
}

/** Date over "Good morning, Ravi" on the left, the avatar on the right. */
export function Greeting({ date, name, initial, onAvatarPress, greeting = 'Hello' }: GreetingProps) {
  const theme = useTheme();
  const letter = initial ?? initialOf(name);
  const avatar = (
    <ThemedText
      type="bodyMedium"
      maxFontSizeMultiplier={1.3}
      style={{ color: theme.primary, fontWeight: GREETING_STYLE.initialWeight }}>
      {letter}
    </ThemedText>
  );
  const circle = [styles.avatar, { backgroundColor: theme.primaryContainer }];
  const slop = avatarHitSlop();
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3}>
          {date}
        </ThemedText>
        <ThemedText type="titleLarge" accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {greetingTitle(greeting, name)}
        </ThemedText>
      </View>
      {letter === '' ? null : onAvatarPress ? (
        <Pressable
          onPress={onAvatarPress}
          hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
          accessibilityRole="button"
          accessibilityLabel={name}
          android_ripple={{ color: pressedColor(theme.onSurface), foreground: true }}
          style={circle}>
          {avatar}
        </Pressable>
      ) : (
        <View style={circle}>{avatar}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: GREETING_STYLE.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // The title wraps when long, so the text block takes the free width.
  texts: { flex: 1 },
  avatar: {
    width: GREETING_STYLE.avatar,
    height: GREETING_STYLE.avatar,
    borderRadius: GREETING_STYLE.avatarRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
