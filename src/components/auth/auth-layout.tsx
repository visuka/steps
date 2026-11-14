import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveFont, ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing, TouchTarget, Type } from '@/constants/theme';
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
  /** One short line. */
  subtitle?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.inner}>
              <View style={[styles.mark, { backgroundColor: theme.surfaceContainerHigh }]}>
                <Ionicons name={icon} size={32} color={theme.onSurface} />
              </View>
              <View style={styles.heading}>
                <ThemedText type="headlineMedium" accessibilityRole="header">
                  {title}
                </ThemedText>
                {subtitle ? (
                  <ThemedText type="bodyLarge" themeColor="onSurfaceVariant">
                    {subtitle}
                  </ThemedText>
                ) : null}
              </View>
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** A quiet text-only action, e.g. "Not now". */
export function TextButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Button label={label} onPress={onPress} disabled={disabled} variant="text" style={styles.textButton} />;
}

type FieldKind = 'email' | 'code';

const KIND_PROPS: Record<FieldKind, TextInputProps> = {
  email: { keyboardType: 'email-address', autoComplete: 'email', textContentType: 'emailAddress', maxLength: 254 },
  // Not 6: the phone cuts a paste such as "123 456" to fit before cleanCode
  // (src/auth/rules.ts) sees it, losing digits. cleanCode keeps the first 6.
  code: { keyboardType: 'number-pad', autoComplete: 'one-time-code', textContentType: 'oneTimeCode', maxLength: 32 },
};

/**
 * A Material filled text field that tells the phone what it holds, so the
 * keyboard can offer the person's email, or the code from the email.
 */
export function Field({
  label,
  kind,
  value,
  onChangeText,
  onSubmitEditing,
  onCard,
  editable = true,
  supporting,
}: {
  label: string;
  kind: FieldKind;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
  /** Inside a Card, whose background the default field colour would match. */
  onCard?: boolean;
  editable?: boolean;
  /** One short line under the field. */
  supporting?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <View
        style={[
          styles.box,
          {
            backgroundColor: onCard ? theme.surfaceContainerLowest : theme.surfaceContainerHighest,
            borderBottomColor: theme.onSurfaceVariant,
            opacity: editable ? 1 : 0.6,
          },
        ]}>
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          {label}
        </ThemedText>
        <TextInput
          {...KIND_PROPS[kind]}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}
          cursorColor={theme.primary}
          selectionColor={theme.primaryContainer}
          placeholderTextColor={theme.onSurfaceVariant}
          style={resolveFont([
            kind === 'code' ? Type.numeralSmall : Type.bodyLarge,
            styles.input,
            { color: theme.onSurface },
            kind === 'code' && styles.code,
          ])}
        />
      </View>
      {supporting ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" style={styles.supporting}>
          {supporting}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing.four, justifyContent: 'center', alignItems: 'center' },
  inner: { width: '100%', maxWidth: 440, gap: Spacing.three },
  mark: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  heading: { gap: Spacing.two, marginBottom: Spacing.two },
  textButton: { alignSelf: 'center' },
  field: { gap: Spacing.one },
  box: {
    minHeight: 56,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderTopLeftRadius: Radius.xs,
    borderTopRightRadius: Radius.xs,
    borderBottomWidth: 1,
    justifyContent: 'center',
  },
  input: { minHeight: TouchTarget - 16, paddingVertical: Spacing.one, paddingHorizontal: 0 },
  code: { letterSpacing: 6 },
  supporting: { paddingHorizontal: Spacing.three },
});
