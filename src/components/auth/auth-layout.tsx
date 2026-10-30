import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, type ReactNode, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The full-screen frame shared by sign-in, the lock and the lock question. */
export function AuthLayout({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.inner}>
              <Ionicons name={icon} size={48} color={theme.accent} />
              <ThemedText type="subtitle">{title}</ThemedText>
              {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** A quiet text-only action, e.g. "Forgot password?". */
export function TextButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [styles.textButton, { opacity: disabled ? 0.5 : pressed ? 0.6 : 1 }]}>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

type FieldKind = 'email' | 'password' | 'new-password' | 'code';

const KIND_PROPS: Record<FieldKind, TextInputProps> = {
  email: { keyboardType: 'email-address', autoComplete: 'email', textContentType: 'emailAddress' },
  password: { autoComplete: 'current-password', textContentType: 'password' },
  'new-password': { autoComplete: 'new-password', textContentType: 'newPassword' },
  code: { keyboardType: 'number-pad', autoComplete: 'one-time-code', textContentType: 'oneTimeCode', maxLength: 10 },
};

/**
 * A labelled input that tells the phone what it holds, so the password
 * manager can fill and save passwords and the keyboard can offer the code
 * from the email.
 */
export function Field({
  label,
  kind,
  value,
  onChangeText,
  onSubmitEditing,
  onCard,
}: {
  label: string;
  kind: FieldKind;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
  /** Inside a Card, whose background the default input colour would match. */
  onCard?: boolean;
}) {
  const theme = useTheme();
  const [hidden, setHidden] = useState(true);
  const secret = kind === 'password' || kind === 'new-password';
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={[styles.inputRow, { backgroundColor: onCard ? theme.background : theme.backgroundElement }]}>
        <TextInput
          {...KIND_PROPS[kind]}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          secureTextEntry={secret && hidden}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}
          style={[styles.input, { color: theme.text }, kind === 'code' && styles.code]}
        />
        {secret ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={8}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing.four, justifyContent: 'center', alignItems: 'center' },
  inner: { width: '100%', maxWidth: 440, gap: Spacing.three },
  textButton: { alignSelf: 'center', paddingVertical: Spacing.one },
  field: { gap: Spacing.one },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two + 4,
    paddingHorizontal: Spacing.three - 4,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.three - 4 },
  code: { fontSize: 22, letterSpacing: 6, fontVariant: ['tabular-nums'] },
});
