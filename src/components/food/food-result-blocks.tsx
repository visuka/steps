/**
 * Colour blocks (look D) parts of the food result, drawn as its mockup
 * (Figma of1WY3BRkYf0FmZHr1tVSu, node 1:27, middle phone): the portion and
 * energy on one line over three white macro tiles, ingredients as outlined
 * chips, nutrients as plain name and value rows with the High row tinted, and
 * one info line. Every function of the shared result stays: the portion opens
 * the details, a flagged row still opens its note, and each row's share of a
 * day's need is said when the row is tapped.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { SpecIcon } from '@/components/ui';
import { NumeralMaxScale } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { NUTRIENT, percentOfDaily, percentOfLimit } from '@/nutrition/nutrients';
import type { FoodItem, NutrientKey } from '@/nutrition/types';

import { resultLine } from './food-result-cooking';
import { gramsText, nutrientLabel, nutrientText, spokenNutrientText } from './food-result-format';
import { ingredientSpoken, ingredientSuffix, ingredientTitle } from './food-result-layout';

const MACROS = [
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'fat', label: 'Fat' },
] as const;

export interface BlocksHeroProps {
  portion: string;
  kcal: string;
  spoken: string;
  macros: readonly { text: string; spoken: string }[];
  onPortion: () => void;
}

/** "1 bowl · 412 kcal" (the portion opens the portion and details) over three white macro tiles. */
export function BlocksHero({ portion, kcal, spoken, macros, onPortion }: BlocksHeroProps) {
  const theme = useTheme();
  const ink = theme.onFoodContainer;
  return (
    <View style={[styles.hero, { backgroundColor: theme.foodContainer }]}>
      <View style={styles.heroLine}>
        <Pressable
          onPress={onPortion}
          accessibilityRole="button"
          accessibilityLabel={`Portion: ${portion}. Change it`}
          hitSlop={8}
          style={styles.portion}>
          <ThemedText type="titleMedium" maxFontSizeMultiplier={NumeralMaxScale} style={{ color: ink }}>
            {portion}
          </ThemedText>
          <SpecIcon name="chevron-down" color={ink} size={16} />
        </Pressable>
        <ThemedText type="titleMedium" maxFontSizeMultiplier={NumeralMaxScale} style={{ color: ink }}>
          ·
        </ThemedText>
        <View accessible accessibilityLabel={spoken} style={styles.kcal}>
          <ThemedText type="numeralLarge" maxFontSizeMultiplier={NumeralMaxScale} style={{ color: ink }}>
            {kcal}
          </ThemedText>
          <ThemedText type="titleMedium" maxFontSizeMultiplier={NumeralMaxScale} style={{ color: ink }}>
            kcal
          </ThemedText>
        </View>
      </View>
      <View style={styles.tiles}>
        {MACROS.map((m, i) => (
          <View
            key={m.key}
            accessible
            accessibilityLabel={`${m.label} ${macros[i]?.spoken ?? 'not known'}`}
            style={[styles.tile, { backgroundColor: `${theme.surfaceContainerLowest}D9` }]}>
            <ThemedText type="bodySmall" maxFontSizeMultiplier={NumeralMaxScale} numberOfLines={1} style={{ color: ink }}>
              {m.label}
            </ThemedText>
            <ThemedText type="titleMedium" maxFontSizeMultiplier={NumeralMaxScale} numberOfLines={1} style={[styles.bold, { color: ink }]}>
              {macros[i]?.text ?? '—'}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The ingredients as outlined chips that wrap: name (and how it is cooked) in ink, the amount in grey. */
export function BlocksIngredientChips({ food }: { food: FoodItem }) {
  const theme = useTheme();
  const list = food.ingredients ?? [];
  return (
    <View style={styles.chips}>
      {list.map((ing, index) => {
        const line = resultLine(ing);
        const grams = gramsText(ing.grams);
        return (
          <View
            key={`${ing.name}-${index}`}
            accessible
            accessibilityLabel={`${ingredientSpoken(line)}, ${grams}`}
            style={[styles.chip, { borderColor: theme.outlineVariant }]}>
            <ThemedText type="bodyMedium" maxFontSizeMultiplier={NumeralMaxScale} style={styles.chipText}>
              <ThemedText type="bodyMedium" maxFontSizeMultiplier={NumeralMaxScale} style={styles.bold}>
                {ingredientTitle(line)}
              </ThemedText>
              <ThemedText type="bodyMedium" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale}>
                {ingredientSuffix(line)}
                {'  '}
                {grams}
              </ThemedText>
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

/** A nutrient's share of a day's need (or of the day's limit), as words, or null when it has no target. */
function needLine(key: NutrientKey, value: number): string | null {
  const limit = Boolean(NUTRIENT[key].limit);
  const pct = limit ? percentOfLimit(key, value) : percentOfDaily(key, value);
  if (pct === null) return null;
  return `About ${Math.round(pct)}% of ${limit ? "a day's limit" : "a day's need"}.`;
}

/**
 * One nutrient as a plain row: name left, value right. A high row is tinted
 * with a filled "High" badge. A tap opens its note: the share of a day's need,
 * and for a flagged row why it matters.
 */
export function BlocksNutrientRow({
  k,
  value,
  least,
  high,
  flagged,
  open,
  onToggle,
}: {
  k: NutrientKey;
  value: number;
  least: boolean;
  high: boolean;
  flagged: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const need = needLine(k, value);
  const note = [flagged ? `This amount: ${spokenNutrientText(k, value, least)}.` : null, need, flagged ? NUTRIENT[k].note : null]
    .filter(Boolean)
    .join(' ');
  const ink = high ? theme.onErrorContainer : theme.onSurface;
  return (
    <View>
      <Pressable
        onPress={note ? onToggle : undefined}
        disabled={!note}
        accessibilityRole={note ? 'button' : undefined}
        accessibilityState={note ? { expanded: open } : undefined}
        accessibilityLabel={`${nutrientLabel(k)}, ${spokenNutrientText(k, value, least)}${high ? ', high' : ''}`}
        style={[styles.row, high && { backgroundColor: theme.errorContainer }]}>
        <ThemedText type="bodyLarge" maxFontSizeMultiplier={NumeralMaxScale} style={[styles.rowName, high && styles.bold, { color: ink }]}>
          {nutrientLabel(k)}
        </ThemedText>
        <ThemedText type="bodyLarge" maxFontSizeMultiplier={NumeralMaxScale} style={[styles.bold, { color: ink }]}>
          {nutrientText(k, value, least)}
        </ThemedText>
        {high ? (
          <View style={[styles.badge, { backgroundColor: theme.error }]}>
            <SpecIcon name="warning" color={theme.onError} size={14} />
            <ThemedText type="labelMedium" maxFontSizeMultiplier={NumeralMaxScale} style={[styles.bold, { color: theme.onError }]}>
              High
            </ThemedText>
          </View>
        ) : null}
      </Pressable>
      {open && note ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale} style={styles.note}>
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** "ⓘ Some ingredients still being added · updates soon": one quiet line under the nutrients. */
export function BlocksInfoLine({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.info} accessible accessibilityLabel={text}>
      <View style={[styles.infoMark, { borderColor: theme.onSurfaceVariant }]}>
        <ThemedText type="labelSmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={1}>
          i
        </ThemedText>
      </View>
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant" maxFontSizeMultiplier={NumeralMaxScale} style={styles.rowName}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 16, borderRadius: 28, padding: 20, gap: 16 },
  heroLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8 },
  portion: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  kcal: { flexDirection: 'row', alignItems: 'baseline', columnGap: 6 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, minHeight: 64, justifyContent: 'center' },
  bold: { fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', maxWidth: '100%' },
  chipText: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 12 },
  rowName: { flex: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  note: { paddingVertical: 4 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  infoMark: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
