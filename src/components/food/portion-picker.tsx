import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, NumberField, Stepper } from '@/components/controls';
import { NutrientBars } from '@/components/food/nutrient-bars';
import { ThemedText } from '@/components/themed-text';
import { Button as UiButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { gramsFor, isSavedFoodId, nutrientsFor, type PortionOverrides, unitsFor } from '@/nutrition/catalog';
import { formatNutrient, NUTRIENT } from '@/nutrition/nutrients';
import type { FoodItem, Nutrients } from '@/nutrition/types';
import { glBand, glycemicIndex, type WatchOut, watchOuts } from '@/nutrition/watch';

const DEEP_FRIED_NOTE = 'Cooked in a lot of hot oil, so it soaks some up: more fat and calories than the same food made another way.';

/**
 * Picks how much of a food: a unit (roti, bowl, grams) and a quantity, with a
 * live preview. "Change" sets what that unit weighs for this person; it applies
 * to every entry of the food, past and future.
 */
export function PortionPicker({
  food,
  overrides,
  initialUnit,
  initialQuantity,
  showWorking,
  actionLabel,
  onDone,
  onCancel,
  onSetPortion,
  busy,
  children,
}: {
  food: FoodItem;
  overrides: PortionOverrides;
  initialUnit?: string;
  initialQuantity?: number;
  /** Open "How we worked this out" from the start, e.g. right after a recipe. */
  showWorking?: boolean;
  actionLabel: string;
  onDone: (unit: string, quantity: number, nutrients: Nutrients) => void;
  onCancel: () => void;
  onSetPortion: (unit: string, grams: number) => void;
  /** Saving is waiting on the server: both buttons wait too. */
  busy?: boolean;
  /** Extra controls under the preview, e.g. when it was eaten. */
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const units = unitsFor(food, overrides);
  const [unit, setUnit] = useState(
    initialUnit && units.some((u) => u.key === initialUnit) ? initialUnit : food.defaultUnit,
  );
  const [quantity, setQuantity] = useState(initialQuantity ?? (unit === 'g' ? 100 : 1));
  const [editing, setEditing] = useState(false);
  const [grams, setGrams] = useState<number | null>(null);
  const [allNutrients, setAllNutrients] = useState(false);
  const [working, setWorking] = useState(Boolean(showWorking));
  const [watchOpen, setWatchOpen] = useState<WatchOut['key'] | null>(null);

  const current = units.find((u) => u.key === unit) ?? units[0];
  const isGrams = unit === 'g';
  const n = nutrientsFor(food, unit, quantity, overrides);
  const totalGrams = Math.round(gramsFor(food, unit, quantity, overrides));
  const own = food.category === 'own';
  const watch = watchOuts(food, gramsFor(food, unit, quantity, overrides));
  const gi = glycemicIndex(food);
  const hasWorking = isSavedFoodId(food.id) || Boolean(food.ingredients?.length || food.notes?.length);

  const pickUnit = (key: string) => {
    setUnit(key);
    setQuantity(key === 'g' ? 100 : 1);
    setEditing(false);
  };

  const macros = (['protein', 'carbs', 'fat', 'fiber'] as const)
    .filter((k) => n[k] !== undefined)
    .map((k) => `${k === 'fiber' ? 'Fibre' : k[0].toUpperCase() + k.slice(1)} ${formatNutrient(k, n[k]!)}`)
    .join(' · ');

  const openWatch = watch.find((w) => w.key === watchOpen);
  const watchNote = (w: WatchOut) => {
    if (w.key === 'deep-fried') return DEEP_FRIED_NOTE;
    const amount = n[w.key];
    return `${amount === undefined ? '' : `This amount: ${formatNutrient(w.key, amount)}. `}${NUTRIENT[w.key].note}`;
  };

  // Ingredients are given for the food's first unit (a recipe's one serving).
  const workingUnit = food.units[0];

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">{food.name}</ThemedText>
      {units.length > 1 ? (
        <View style={styles.chips}>
          {units.map((u) => (
            <Chip key={u.key} label={u.label} selected={u.key === unit} onPress={() => pickUnit(u.key)} />
          ))}
        </View>
      ) : null}

      {isGrams ? (
        <NumberField label="Amount" unit="g" value={quantity} onCommit={(v) => setQuantity(v && v > 0 ? v : 1)} />
      ) : (
        <Stepper
          value={quantity}
          onChange={setQuantity}
          step={0.5}
          min={0.5}
          max={20}
          format={(q) => `${Number.isInteger(q) ? q : q.toFixed(1)} × ${current.label}`}
        />
      )}

      <ThemedText>
        {formatNutrient('kcal', n.kcal ?? 0)}
        {own ? '' : ` · ${totalGrams} g`}
      </ThemedText>
      {macros ? (
        <ThemedText type="small" themeColor="textSecondary">
          {macros}
        </ThemedText>
      ) : null}

      {watch.length ? (
        <View style={styles.chips}>
          {watch.map((w) => (
            <Chip
              key={w.key}
              label={w.text}
              dot={w.level === 'high' ? theme.danger : theme.warning}
              selected={watchOpen === w.key}
              onPress={() => setWatchOpen(watchOpen === w.key ? null : w.key)}
            />
          ))}
        </View>
      ) : null}
      {openWatch ? (
        <ThemedText type="small" themeColor="textSecondary">
          {watchNote(openWatch)}
        </ThemedText>
      ) : null}

      {gi !== null && n.gl !== undefined ? (
        <ThemedText type="small" themeColor="textSecondary">
          GI about {gi} · glycemic load {formatNutrient('gl', n.gl)} for this amount: {glBand(n.gl, 'portion')}
        </ThemedText>
      ) : null}

      {!isGrams && !own ? (
        editing ? (
          <View style={styles.portion}>
            <NumberField
              label={`For me, 1 ${current.label} is`}
              unit="g"
              value={grams ?? current.grams}
              onCommit={setGrams}
            />
            <ThemedText type="small" themeColor="textSecondary">
              This updates your past entries of {food.name.toLowerCase()} too.
            </ThemedText>
            <Button
              kind="secondary"
              label="Save portion size"
              disabled={!grams || grams <= 0}
              onPress={() => {
                if (grams && grams > 0) onSetPortion(unit, grams);
                setEditing(false);
              }}
            />
          </View>
        ) : (
          <View style={styles.inline}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.grow}>
              1 {current.label} = {current.grams} g
            </ThemedText>
            <UiButton
              variant="text"
              compact
              label="Change"
              accessibilityLabel={`Change the size of 1 ${current.label}`}
              onPress={() => setEditing(true)}
            />
          </View>
        )
      ) : null}

      <UiButton
        variant="text"
        compact
        icon={allNutrients ? 'chevron-up' : 'chevron-down'}
        label={allNutrients ? 'Hide nutrients' : 'Show all nutrients'}
        onPress={() => setAllNutrients(!allNutrients)}
      />
      {allNutrients ? (
        <View style={styles.section}>
          <NutrientBars nutrients={n} groups={['energy', 'macro', 'limit', 'glucose', 'vitamin', 'mineral']} />
          <ThemedText type="small" themeColor="textSecondary">
            Percent of a general adult daily value for this amount. Tap a row to see what it is.
          </ThemedText>
        </View>
      ) : null}

      {hasWorking ? (
        <>
          <UiButton
            variant="text"
            compact
            icon={working ? 'chevron-up' : 'chevron-down'}
            label={working ? 'Hide how we worked this out' : 'How we worked this out'}
            onPress={() => setWorking(!working)}
          />
          {working ? (
            <View style={styles.section}>
              {food.ingredients?.length ? (
                <>
                  <ThemedText type="small">
                    In 1 {workingUnit.label}
                    {workingUnit.key === 'g' ? '' : ` (${Math.round(workingUnit.grams)} g)`}:
                  </ThemedText>
                  {food.ingredients.map((i, index) => (
                    <ThemedText key={`${i.name}-${index}`} type="small" themeColor="textSecondary">
                      · {i.name}: {i.grams < 10 && !Number.isInteger(i.grams) ? i.grams.toFixed(1) : Math.round(i.grams)} g
                    </ThemedText>
                  ))}
                </>
              ) : null}
              {food.notes?.map((note, index) => (
                <ThemedText key={`note-${index}`} type="small" themeColor="textSecondary">
                  {note}
                </ThemedText>
              ))}
              <ThemedText type="small" themeColor="textSecondary">
                Nutrients are added up from each ingredient, not guessed. They are estimates.
              </ThemedText>
            </View>
          ) : null}
        </>
      ) : null}

      {children}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button kind="secondary" label="Cancel" onPress={onCancel} disabled={busy} />
        </View>
        <View style={styles.action}>
          <Button label={actionLabel} onPress={() => onDone(unit, quantity, n)} disabled={busy} />
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {food.source}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two + 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  portion: { gap: Spacing.two },
  section: { gap: Spacing.two },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grow: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
