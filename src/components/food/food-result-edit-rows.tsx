import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { resolveFont, ThemedText } from '@/components/themed-text';
import { Chip, IconCircle, Sheet, SpecIcon } from '@/components/ui';
import { NumeralMaxScale, Type } from '@/constants/theme';
import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import { useTheme } from '@/hooks/use-theme';
import type { CookMethod } from '@/nutrition/cooking/types';

import {
  chipSelected,
  chipSpoken,
  COOKED_QUESTION,
  METHOD_CHIPS,
  MORE_CHIP,
  moreSelected,
  rowMethodSpoken,
  rowMethodWord,
  rowNote,
  sheetChoices,
  sheetTitle,
  showsMethods,
} from './food-result-cooking';
import { cookable, type EditRow, gramsInput, LOOKING_UP, LOOKUP_FAILED } from './food-result-edit';
import { editRowLayout, ingredientIcon, ingredientLine, ingredientSuffix, ingredientTitle, RESULT } from './food-result-layout';

interface Handlers {
  onName: (key: string, name: string) => void;
  /** The person left a name field: look the added ingredient up. */
  onNameDone: () => void;
  onGrams: (key: string, grams: string) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  /** Every cookable row cooked this way (the chips, and "More…"). */
  onAllMethods: (method: CookMethod) => void;
  /** One row cooked this way (its method text). */
  onRowMethod: (key: string, method: CookMethod) => void;
  /** Tapped a failed look-up: try again. */
  onRetry: () => void;
}

/** What the sheet is for: every row, or the one with this key. */
type SheetFor = { all: true } | { key: string };

/**
 * The ingredient rows while the person edits them (T15, T15c, "UI" in docs/current-task.md):
 * "How was it cooked?" with its chips, the same 48 high rows with a grams field and a remove
 * button and the method as small text, the oil soaked up as a line of its own, then "Add
 * ingredient". Draws only; the state and what to do with it live in food-result.tsx.
 */
export function EditIngredientRows({
  rows,
  width,
  fontScale,
  locked,
  oil,
  ...on
}: Handlers & {
  rows: EditRow[];
  width: number;
  fontScale: number;
  locked: boolean;
  /** The oil soaked up in frying, or null when there is none. */
  oil: { name: string; grams: string; spoken: string } | null;
}) {
  const theme = useTheme();
  const [sheet, setSheet] = useState<SheetFor | null>(null);
  const sheetKey = sheet && 'key' in sheet ? sheet.key : null;
  const sheetRow = sheetKey === null ? undefined : rows.find((r) => r.key === sheetKey);
  const pick = (method: CookMethod) => {
    if (sheetKey !== null) on.onRowMethod(sheetKey, method);
    else on.onAllMethods(method);
    setSheet(null);
  };
  return (
    <View>
      {showsMethods(rows) ? <MethodChips rows={rows} locked={locked} onPick={on.onAllMethods} onMore={() => setSheet({ all: true })} /> : null}
      {rows.map((r, index) => {
        const line = ingredientLine(r.name);
        const shown = `${ingredientTitle(line)}${ingredientSuffix(line)}`;
        const layout = editRowLayout(shown, width, fontScale);
        const label = r.name.trim() || 'new ingredient';
        const note = rowNote(r, LOOKING_UP, LOOKUP_FAILED);
        const failed = r.lookup === 'failed';
        return (
          <View key={r.key} style={styles.row}>
            {/* The bowl until it is named; then the usual icon rules. */}
            <IconCircle name={r.name.trim() ? ingredientIcon(r.name) : 'bowl'} tone="warm" />
            <View
              style={[
                styles.part,
                { minHeight: layout.minHeight },
                index === rows.length - 1 && !oil ? null : { borderBottomWidth: 1, borderBottomColor: theme.outlineVariant },
              ]}>
              <View style={styles.nameColumn}>
                {r.added ? (
                  <Field
                    value={r.name}
                    onChangeText={(t) => on.onName(r.key, t)}
                    onDone={on.onNameDone}
                    placeholder="Ingredient"
                    label="Ingredient name"
                    autoFocus={!r.name && !r.profile}
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
                {cookable(r) ? (
                  <Pressable
                    onPress={() => setSheet({ key: r.key })}
                    disabled={locked}
                    accessibilityRole="button"
                    accessibilityLabel={rowMethodSpoken(r)}
                    hitSlop={{ left: RESULT.methodSlack, right: RESULT.methodSlack }}
                    style={styles.method}>
                    <ThemedText type="bodySmall" maxFontSizeMultiplier={NumeralMaxScale} style={{ color: theme.onSurface }}>
                      {rowMethodWord(r)}
                    </ThemedText>
                    <SpecIcon name="chevron-down" color={theme.primary} size={RESULT.methodChevron} />
                  </Pressable>
                ) : note ? (
                  <Pressable
                    onPress={failed ? on.onRetry : undefined}
                    disabled={!failed}
                    accessibilityRole={failed ? 'button' : 'text'}
                    accessibilityLabel={failed ? `${note} Try again` : note}
                    accessibilityLiveRegion="polite">
                    <ThemedText
                      type="bodySmall"
                      themeColor={failed ? undefined : 'onSurfaceVariant'}
                      maxFontSizeMultiplier={NumeralMaxScale}
                      style={failed ? { color: theme.error } : undefined}>
                      {note}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
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
      {oil ? (
        // Like a row, but with no field and no remove button: only its grams (plan T15c, decision 7).
        <View style={styles.row} accessible accessibilityLabel={oil.spoken}>
          <IconCircle name={ingredientIcon(oil.name)} tone="warm" />
          <View style={[styles.part, { minHeight: RESULT.ingredientRowHeight }]}>
            <ThemedText type="bodyMedium" maxFontSizeMultiplier={NumeralMaxScale} style={styles.name}>
              {oil.name}
            </ThemedText>
            <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale} style={styles.oilGrams}>
              {oil.grams}
            </ThemedText>
          </View>
        </View>
      ) : null}
      <Pressable
        onPress={on.onAdd}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel="Add ingredient"
        style={[styles.row, styles.add, locked && { opacity: 0.5 }]}>
        <IconCircle name="plus" tone="accent" />
        <ThemedText type="labelLarge" maxFontSizeMultiplier={NumeralMaxScale} style={{ color: theme.onSurface }}>
          Add ingredient
        </ThemedText>
      </Pressable>
      <MethodSheet
        visible={sheet !== null}
        title={sheetKey === null ? COOKED_QUESTION : sheetTitle(sheetRow?.name ?? '')}
        current={sheetRow?.method}
        onPick={pick}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

/** "How was it cooked?" and one row of chips that scrolls sideways; "More…" opens the full list. */
function MethodChips({ rows, locked, onPick, onMore }: { rows: EditRow[]; locked: boolean; onPick: (m: CookMethod) => void; onMore: () => void }) {
  return (
    <View style={styles.chipsBlock}>
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale}>
        {COOKED_QUESTION}
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.chipsStrip} contentContainerStyle={styles.chipsRow}>
        {METHOD_CHIPS.map((c) => (
          <Chip
            key={c.method}
            label={c.label}
            selected={chipSelected(rows, c.method)}
            disabled={locked}
            accessibilityLabel={chipSpoken(c.label)}
            onPress={() => onPick(c.method)}
          />
        ))}
        <Chip label={MORE_CHIP} selected={moreSelected(rows)} disabled={locked} accessibilityLabel="More ways it was cooked" onPress={onMore} />
      </ScrollView>
    </View>
  );
}

/** Every method of the plan's decision 6 as 48 high rows; the one the row has is marked. */
function MethodSheet({
  visible,
  title,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  current?: CookMethod;
  onPick: (m: CookMethod) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {sheetChoices(current).map((c) => {
        const on = c.method === current;
        return (
          <Pressable
            key={c.method}
            onPress={() => onPick(c.method)}
            accessibilityRole="button"
            accessibilityLabel={c.label}
            accessibilityState={{ selected: on }}
            style={[styles.choice, on && { backgroundColor: theme.secondaryContainer }]}>
            <ThemedText type="bodyMedium" maxFontSizeMultiplier={NumeralMaxScale} style={on ? { color: theme.onSecondaryContainer } : undefined}>
              {c.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </Sheet>
  );
}

/** A 40 high soft field, radius 12 (the TextInput is not a ThemedText, so it takes the UI face itself). */
function Field({
  value,
  onChangeText,
  onDone,
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
  onDone?: () => void;
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
      onEndEditing={onDone}
      onBlur={onDone}
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
        // Its own white box with a hairline, like the app's other inputs: the grey fill vanished on the grey ground.
        resolveFont([Type.bodyMedium, { color: theme.onSurface, backgroundColor: theme.surface, borderColor: theme.outlineVariant }]),
        align === 'right' && { textAlign: 'right' },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: RESULT.ingredientGap },
  part: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: RESULT.ingredientGap, paddingVertical: 4 },
  nameColumn: { flex: 1, flexShrink: 1 },
  name: { flexShrink: 1 },
  nameField: { flex: 1 },
  end: { flexDirection: 'row', alignItems: 'center' },
  gramsWrap: { justifyContent: 'center' },
  // "g" sits inside the field after the number.
  gramsField: { width: RESULT.gramsFieldWidth, paddingRight: 28 },
  unit: { position: 'absolute', right: 12 },
  // The oil line has no remove button: its grams end where a remove button's column does.
  oilGrams: { marginRight: RESULT.removeTouch },
  remove: { width: RESULT.removeTouch, height: RESULT.removeTouch, alignItems: 'center', justifyContent: 'center' },
  add: { minHeight: RESULT.ingredientRowHeight },
  field: { height: RESULT.fieldHeight, borderRadius: RESULT.fieldRadius, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: CLEAN_SPEC.space.s12, paddingVertical: 0 },
  method: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: RESULT.oilLineGap, minWidth: RESULT.methodTouch, minHeight: RESULT.methodTouch },
  chipsBlock: { gap: RESULT.chipGap, marginBottom: RESULT.chipGap },
  // The strip runs to the screen's edges, so a chip slides out of view instead of being cut at
  // the margin; the first chip still starts on the column edge.
  chipsStrip: { marginHorizontal: -CLEAN_SPEC.space.sideMargin },
  chipsRow: { gap: RESULT.chipGap, paddingHorizontal: CLEAN_SPEC.space.sideMargin },
  choice: {
    minHeight: RESULT.methodTouch,
    justifyContent: 'center',
    paddingHorizontal: CLEAN_SPEC.space.s16,
    borderRadius: CLEAN_SPEC.radius.chip,
  },
});
