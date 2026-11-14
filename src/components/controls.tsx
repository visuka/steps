import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { resolveFont, ThemedText } from '@/components/themed-text';
import { Button as UiButton, type ButtonVariant } from '@/components/ui/button';
import { Chip as UiChip } from '@/components/ui/chip';
import { Controls, NumeralMaxScale, Radius, Spacing, TouchTarget, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The older button API, drawn as Material 3 buttons: primary = filled,
 * secondary = tonal, danger = outlined in the error colour. New code can
 * use Button from '@/components/ui' with `variant` directly.
 */
export function Button({
  label,
  onPress,
  kind = 'primary',
  variant,
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  /** Overrides `kind` with a Material variant. */
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  const v: ButtonVariant = variant ?? (kind === 'primary' ? 'filled' : kind === 'danger' ? 'outlined' : 'tonal');
  return <UiButton label={label} onPress={onPress} variant={v} danger={kind === 'danger'} disabled={disabled} />;
}

/** Material 3 segmented buttons: 2 to 5 short choices, the chosen one ticked. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { borderColor: theme.outline }]}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            aria-selected={active}
            accessibilityLabel={o.label}
            style={({ pressed }) => [
              styles.segment,
              i > 0 && { borderLeftWidth: 1, borderLeftColor: theme.outline },
              { backgroundColor: active ? theme.secondaryContainer : pressed ? theme.surfaceContainerHigh : 'transparent' },
            ]}>
            {active ? <Ionicons name="checkmark" size={16} color={theme.onSecondaryContainer} /> : null}
            <ThemedText
              type="labelLarge"
              themeColor={active ? 'onSecondaryContainer' : 'onSurface'}
              numberOfLines={1}
              style={[styles.segmentLabel, Controls.buttonLabel]}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
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
      <ThemedText type="numeralLarge" maxFontSizeMultiplier={NumeralMaxScale} style={styles.stepperValue}>
        {format(value)}
      </ThemedText>
      <RoundButton label="+" onPress={() => onChange(Math.min(max, value + step))} disabled={value >= max} />
    </View>
  );
}

function RoundButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Increase' : 'Decrease'}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: theme.secondaryContainer, opacity: disabled ? 0.38 : pressed ? 0.8 : 1 },
      ]}>
      <Ionicons name={label === '+' ? 'add' : 'remove'} size={24} color={theme.onSecondaryContainer} />
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
          placeholderTextColor={theme.onSurfaceVariant}
          cursorColor={theme.primary}
          selectionColor={theme.primaryContainer}
          style={inputStyle(theme, [styles.input, styles.numberInput])}
          accessibilityLabel={label}
        />
        {unit ? <ThemedText themeColor="onSurfaceVariant">{unit}</ThemedText> : null}
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
  maxLength,
  autoFocus,
  keyboardType,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  label: string;
  multiline?: boolean;
  onEndEditing?: () => void;
  maxLength?: number;
  /** Opens the keyboard on this field when it appears. */
  autoFocus?: boolean;
  /** 'number-pad' for digits kept as text (a barcode number keeps its leading zeros). */
  keyboardType?: 'default' | 'number-pad';
}) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onEndEditing={onEndEditing}
      onBlur={onEndEditing}
      placeholder={placeholder}
      placeholderTextColor={theme.onSurfaceVariant}
      cursorColor={theme.primary}
      selectionColor={theme.primaryContainer}
      multiline={multiline}
      maxLength={maxLength}
      autoFocus={autoFocus}
      keyboardType={keyboardType}
      accessibilityLabel={label}
      style={inputStyle(theme, [styles.input, styles.textField, multiline && styles.multiline])}
    />
  );
}

/** Field colours and the theme's UI face (TextInput is not a ThemedText). */
function inputStyle(theme: ReturnType<typeof useTheme>, extra: Parameters<typeof resolveFont>[0]) {
  return resolveFont([
    Type.bodyLarge,
    {
      color: theme.onSurface,
      backgroundColor: theme.surfaceContainerHighest,
      borderBottomColor: theme.onSurfaceVariant,
    },
    extra,
  ]);
}

/**
 * A small chip, e.g. a recent food to log again or a portion unit.
 * `dot` puts a data-colour dot before the label, e.g. theme.near for "High in salt".
 */
export function Chip({
  label,
  onPress,
  selected,
  dot,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  dot?: string;
}) {
  return <UiChip label={label} onPress={onPress} selected={selected} dot={dot} />;
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
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: Controls.button.borderRadius, overflow: 'hidden' },
  segment: {
    flex: 1,
    minHeight: TouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  segmentLabel: { flexShrink: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  stepperValue: { flexShrink: 1, textAlign: 'center' },
  round: { width: TouchTarget, height: TouchTarget, borderRadius: TouchTarget / 2, alignItems: 'center', justifyContent: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, minHeight: TouchTarget },
  fieldLabel: { flexShrink: 1 },
  fieldInput: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  // A set width: the web preview's inputs are 20 characters wide by default, which pushed the unit off a phone screen.
  numberInput: { width: 112 },
  input: {
    minWidth: 88,
    minHeight: TouchTarget,
    textAlign: 'right',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three - 4,
    borderTopLeftRadius: Radius.xs,
    borderTopRightRadius: Radius.xs,
    borderBottomWidth: 1,
  },
  textField: { textAlign: 'left', minWidth: 0 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
});
