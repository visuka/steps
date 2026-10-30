import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const theme = useTheme();
  const bg = kind === 'primary' ? theme.accent : theme.backgroundSelected;
  const fg = kind === 'primary' ? theme.onAccent : kind === 'danger' ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
      <ThemedText type="smallBold" style={{ color: fg }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ThemedView type="backgroundSelected" style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.segment}>
            <ThemedView type={active ? 'background' : 'backgroundSelected'} style={styles.segmentInner}>
              <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
                {o.label}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </ThemedView>
  );
}

export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  format = String,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  format?: (v: number) => string;
}) {
  return (
    <View style={styles.stepper}>
      <RoundButton label="−" onPress={() => onChange(Math.max(min, value - step))} disabled={value <= min} />
      <ThemedText type="subtitle" style={styles.stepperValue}>
        {format(value)}
      </ThemedText>
      <RoundButton label="+" onPress={() => onChange(Math.min(max, value + step))} disabled={value >= max} />
    </View>
  );
}

function RoundButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Increase' : 'Decrease'}
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}>
      <ThemedView type="backgroundSelected" style={styles.round}>
        <ThemedText type="subtitle" style={styles.roundLabel}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function parseNumber(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(n) ? null : n;
}

/**
 * A labelled number field. Reports every parsable value as it is typed; with
 * `commitOnBlur` it reports only when editing ends, so half-typed values never
 * reach the profile.
 */
export function NumberField({
  label,
  value,
  unit,
  onCommit,
  decimals = 0,
  placeholder,
  commitOnBlur,
}: {
  label: string;
  value: number | null;
  unit?: string;
  onCommit: (v: number | null) => void;
  decimals?: number;
  placeholder?: string;
  commitOnBlur?: boolean;
}) {
  const theme = useTheme();
  const format = (v: number | null) => (v === null ? '' : v.toFixed(decimals));
  const [text, setText] = useState(format(value));
  const [lastValue, setLastValue] = useState(value);
  // Only reformat when the value changed from outside, never mid-typing.
  if (value !== lastValue) {
    setLastValue(value);
    if (parseNumber(text) !== value) setText(format(value));
  }

  const onChangeText = (t: string) => {
    setText(t);
    if (!commitOnBlur) onCommit(parseNumber(t));
  };
  const commit = () => {
    if (commitOnBlur) onCommit(parseNumber(text));
  };

  return (
    <View style={styles.field}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      <View style={styles.fieldInput}>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          onEndEditing={commit}
          onBlur={commit}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
          accessibilityLabel={label}
        />
        {unit ? <ThemedText themeColor="textSecondary">{unit}</ThemedText> : null}
      </View>
    </View>
  );
}

/** A plain text input, e.g. a food name or a note. */
export function TextField({
  value,
  onChangeText,
  placeholder,
  label,
  multiline,
  onEndEditing,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  label: string;
  multiline?: boolean;
  onEndEditing?: () => void;
}) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onEndEditing={onEndEditing}
      onBlur={onEndEditing}
      placeholder={placeholder}
      placeholderTextColor={theme.textSecondary}
      multiline={multiline}
      accessibilityLabel={label}
      style={[
        styles.input,
        styles.textField,
        multiline && styles.multiline,
        { color: theme.text, backgroundColor: theme.background },
      ]}
    />
  );
}

/** A small rounded button, e.g. a recent food to log again. */
export function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <ThemedView type="backgroundSelected" style={styles.chip}>
        <ThemedText type="small">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Spacing.three - 4,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  segmented: { flexDirection: 'row', padding: Spacing.half, borderRadius: Spacing.three },
  segment: { flex: 1 },
  segmentInner: { paddingVertical: Spacing.two, borderRadius: Spacing.three - 2, alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperValue: { fontVariant: ['tabular-nums'] },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  roundLabel: { lineHeight: 34 },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  fieldLabel: { flexShrink: 1 },
  fieldInput: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: {
    minWidth: 88,
    textAlign: 'right',
    fontSize: 16,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two + 4,
    borderRadius: Spacing.two + 4,
  },
  textField: { textAlign: 'left', minWidth: 0 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  chip: { paddingVertical: Spacing.one + 2, paddingHorizontal: Spacing.three - 4, borderRadius: Spacing.three },
});
