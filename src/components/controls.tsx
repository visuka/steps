import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { resolveFont, ThemedText } from '@/components/themed-text';
import { Button as UiButton, type ButtonVariant } from '@/components/ui/button';
import { Segments } from '@/components/plain/plain-kit';
import { PLAIN_FIELD } from '@/constants/themes/plain';
import { Chip as UiChip } from '@/components/ui/chip';
import { Controls, MaxTextScale, NumeralMaxScale, Spacing, TouchTarget, Type } from '@/constants/theme';
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

/**
 * A screen's segmented choice (Day / Week / Month, Walk / Cycle): the plain
 * switch on glass, the chosen part a white pill, so the screen's one sage pill
 * stays its main button. 2 to 5 short choices.
 */
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
    <Segments<T>
      quiet
      stretch
      parts={options.map((o) => ({ value: o.value, text: o.label.toUpperCase() }))}
      value={value}
      onChange={onChange}
      spoken={(v) => options.find((o) => o.value === v)?.label ?? v}
    />
  );
}

export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  format = String,
  compact,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  format?: (v: number) => string;
  /** The medium numeral, for a value that carries a unit word (the food portion). */
  compact?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <RoundButton label="−" onPress={() => onChange(Math.max(min, value - step))} disabled={value <= min} />
      <ThemedText type={compact ? 'numeralMedium' : 'numeralLarge'}maxFontSizeMultiplier={NumeralMaxScale} style={styles.stepperValue}>
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
  unitSlot,
}: {
  label: string;
  value: number | null;
  unit?: string;
  /** Keep the unit's room with no unit, so this field's input lines up with unit fields in the same form. */
  unitSlot?: boolean;
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
          placeholderTextColor={theme.outline}
          maxFontSizeMultiplier={MaxTextScale}
          cursorColor={theme.primary}
          selectionColor={theme.primaryContainer}
          style={inputStyle(theme, [styles.input, styles.numberInput])}
          accessibilityLabel={label}
        />
        {/* A set slot for the unit, so every field in a form shares one input column (bpm under mmHg). */}
        {unit ? (
          <ThemedText themeColor="onSurfaceVariant" style={styles.unit} maxFontSizeMultiplier={1.3}>
            {unit}
          </ThemedText>
        ) : unitSlot ? (
          <View style={styles.unit} />
        ) : null}
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
  plain,
  onSubmit,
  returnKeyType,
  showLabel,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  /** Read by screen readers; drawn above the box too with `showLabel`. */
  label: string;
  /** Draw `label` above the box (forms with several fields). */
  showLabel?: boolean;
  multiline?: boolean;
  onEndEditing?: () => void;
  maxLength?: number;
  /** Opens the keyboard on this field when it appears. */
  autoFocus?: boolean;
  /** 'number-pad' for digits kept as text (a barcode number keeps its leading zeros). */
  keyboardType?: 'default' | 'number-pad';
  /** An ID or code: no capitals, autocorrect or suggestions added by the keyboard. */
  plain?: boolean;
  /** The keyboard's Enter / Search key. */
  onSubmit?: () => void;
  returnKeyType?: 'search' | 'done' | 'go';
}) {
  const theme = useTheme();
  const input = (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onEndEditing={onEndEditing}
      onBlur={onEndEditing}
      placeholder={placeholder}
      placeholderTextColor={theme.outline}
      maxFontSizeMultiplier={MaxTextScale}
      cursorColor={theme.primary}
      selectionColor={theme.primaryContainer}
      multiline={multiline}
      maxLength={maxLength}
      autoFocus={autoFocus}
      keyboardType={keyboardType}
      autoCapitalize={plain ? 'none' : undefined}
      autoCorrect={plain ? false : undefined}
      autoComplete={plain ? 'off' : undefined}
      onSubmitEditing={onSubmit}
      returnKeyType={returnKeyType}
      accessibilityLabel={label}
      style={inputStyle(theme, [styles.input, styles.textField, multiline && styles.multiline])}
    />
  );
  if (!showLabel) return input;
  return (
    <View>
      <ThemedText type="titleSmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1.3} style={styles.shownLabel}>
        {label}
      </ThemedText>
      {input}
    </View>
  );
}

/** Field colours and the theme's UI face (TextInput is not a ThemedText). */
function inputStyle(theme: ReturnType<typeof useTheme>, extra: Parameters<typeof resolveFont>[0]) {
  return resolveFont([
    Type.bodyLarge,
    PLAIN_FIELD,
    { color: theme.onSurface },
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

/**
 * A labelled text field in the Settings rows' layout (as NumberField), reporting the text only
 * when editing ends. For the name: capitalised words, the keyboard's name suggestion.
 */
export function NameField({
  label,
  value,
  onCommit,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string | null;
  onCommit: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const theme = useTheme();
  const [text, setText] = useState(value ?? '');
  const [lastValue, setLastValue] = useState(value);
  // Only follow a change from outside (a trimmed save), never mid-typing.
  if (value !== lastValue) {
    setLastValue(value);
    if ((value ?? '') !== text.trim()) setText(value ?? '');
  }
  const commit = () => onCommit(text);
  return (
    <View style={styles.field}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={commit}
        onBlur={commit}
        placeholder={placeholder}
        placeholderTextColor={theme.outline}
        maxFontSizeMultiplier={MaxTextScale}
        cursorColor={theme.primary}
        selectionColor={theme.primaryContainer}
        maxLength={maxLength}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="givenName"
        autoCorrect={false}
        accessibilityLabel={label}
        style={inputStyle(theme, [styles.input, styles.nameInput])}
      />
    </View>
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
  fieldInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.two },
  // A set width: the web preview's inputs are 20 characters wide by default, which pushed the unit off a phone screen.
  numberInput: { width: 112 },
  // Fits "mmHg" at text size 1.3, so "bpm" leaves its input in the same column.
  // Right-aligned in its slot, so the unit ends on the column edge with the full-width fields below.
  unit: { minWidth: 56, textAlign: 'right' },
  nameInput: { flex: 1, minWidth: 0 },
  input: {
    minWidth: 88,
    minHeight: TouchTarget,
    textAlign: 'right',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  textField: { textAlign: 'left', minWidth: 0 },
  // A field's own label above it, on the column edge in the form headings' style ("Day", "Name").
  shownLabel: { marginBottom: Spacing.two },
  multiline: { minHeight: 72, textAlignVertical: 'top', borderRadius: 16 },
});
