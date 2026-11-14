import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { resolveFont, ThemedText } from '@/components/themed-text';
import { IconCircle, SpecIcon } from '@/components/ui';
import { NumeralMaxScale, Type } from '@/constants/theme';
import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import { useTheme } from '@/hooks/use-theme';

import { type EditRow, gramsInput } from './food-result-edit';
import { editRowLayout, ingredientIcon, ingredientLine, ingredientSuffix, ingredientTitle, RESULT } from './food-result-layout';

interface Handlers {
  onName: (key: string, name: string) => void;
  onGrams: (key: string, grams: string) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}

/**
 * The ingredient rows while the person edits them (T15, "UI" in docs/current-task.md):
 * the same 48 high rows with a grams field and a remove button, then "Add
 * ingredient". Draws only; the state and what to do with it live in food-result.tsx.
 */
export function EditIngredientRows({
  rows,
  width,
  fontScale,
  locked,
  ...on
}: Handlers & { rows: EditRow[]; width: number; fontScale: number; locked: boolean }) {
  const theme = useTheme();
  return (
    <View>
      {rows.map((r, index) => {
        const line = ingredientLine(r.name);
        const shown = `${ingredientTitle(line)}${ingredientSuffix(line)}`;
        const layout = editRowLayout(shown, width, fontScale);
        const label = r.name.trim() || 'new ingredient';
        return (
          <View key={r.key} style={styles.row}>
            {/* The bowl until it is named; then the usual icon rules. */}
            <IconCircle name={r.name.trim() ? ingredientIcon(r.name) : 'bowl'} tone="warm" />
            <View
              style={[
                styles.part,
                { minHeight: layout.minHeight },
                index === rows.length - 1 ? null : { borderBottomWidth: 1, borderBottomColor: theme.outlineVariant },
              ]}>
              {r.added ? (
                <Field
                  value={r.name}
                  onChangeText={(t) => on.onName(r.key, t)}
                  placeholder="Ingredient"
                  label="Ingredient name"
                  autoFocus
                  editable={!locked}
                  maxLength={80}
                  style={styles.nameField}
                />
              ) : (
                <ThemedText
                  type="bodyMedium"
                  numberOfLines={RESULT.ingredientMaxLines}
                  ellipsizeMode="tail"
                  maxFontSizeMultiplier={NumeralMaxScale}
                  style={styles.name}>
                  {ingredientTitle(line)}
                  <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale}>
                    {ingredientSuffix(line)}
                  </ThemedText>
                </ThemedText>
              )}
              <View style={styles.end}>
                <View style={styles.gramsWrap}>
                  <Field
                    value={r.grams}
                    onChangeText={(t) => on.onGrams(r.key, gramsInput(t))}
                    placeholder="0"
                    label={`Grams of ${label}`}
                    keyboardType="number-pad"
                    editable={!locked}
                    maxLength={4}
                    style={styles.gramsField}
                    align="right"
                  />
                  <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale} style={styles.unit}>
                    g
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => on.onRemove(r.key)}
                  disabled={locked}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${label}`}
                  style={styles.remove}>
                  <SpecIcon name="close" color={theme.onSurfaceVariant} />
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}
      <Pressable
        onPress={on.onAdd}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel="Add ingredient"
        style={[styles.row, styles.add, locked && { opacity: 0.5 }]}>
        <IconCircle name="plus" tone="accent" />
        <ThemedText type="labelLarge" maxFontSizeMultiplier={NumeralMaxScale} style={{ color: theme.primary }}>
          Add ingredient
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** A 40 high soft field, radius 12 (the TextInput is not a ThemedText, so it takes the UI face itself). */
function Field({
  value,
  onChangeText,
  placeholder,
  label,
  keyboardType,
  autoFocus,
  editable,
  maxLength,
  style,
  align,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  label: string;
  keyboardType?: 'number-pad';
  autoFocus?: boolean;
  editable: boolean;
  maxLength: number;
  style: object;
  align?: 'right';
}) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.onSurfaceVariant}
      cursorColor={theme.primary}
      selectionColor={theme.primaryContainer}
      keyboardType={keyboardType}
      autoFocus={autoFocus}
      editable={editable}
      maxLength={maxLength}
      maxFontSizeMultiplier={NumeralMaxScale}
      accessibilityLabel={label}
      style={[
        styles.field,
        resolveFont([Type.bodyMedium, { color: theme.onSurface, backgroundColor: theme.surfaceContainer }]),
        align === 'right' && { textAlign: 'right' },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: RESULT.ingredientGap },
  part: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: RESULT.ingredientGap, paddingVertical: 4 },
  name: { flex: 1, flexShrink: 1 },
  nameField: { flex: 1 },
  end: { flexDirection: 'row', alignItems: 'center' },
  gramsWrap: { justifyContent: 'center' },
  // "g" sits inside the field after the number.
  gramsField: { width: RESULT.gramsFieldWidth, paddingRight: 28 },
  unit: { position: 'absolute', right: 12 },
  remove: { width: RESULT.removeTouch, height: RESULT.removeTouch, alignItems: 'center', justifyContent: 'center' },
  add: { minHeight: RESULT.ingredientRowHeight },
  field: { height: RESULT.fieldHeight, borderRadius: RESULT.fieldRadius, paddingHorizontal: CLEAN_SPEC.space.s12, paddingVertical: 0 },
});
