import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, NumberField, Stepper } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { gramsFor, nutrientsFor, type PortionOverrides, unitsFor } from '@/nutrition/catalog';
import { formatNutrient } from '@/nutrition/nutrients';
import type { FoodItem, Nutrients } from '@/nutrition/types';

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
  actionLabel,
  onDone,
  onCancel,
  onSetPortion,
  children,
}: {
  food: FoodItem;
  overrides: PortionOverrides;
  initialUnit?: string;
  initialQuantity?: number;
  actionLabel: string;
  onDone: (unit: string, quantity: number, nutrients: Nutrients) => void;
  onCancel: () => void;
  onSetPortion: (unit: string, grams: number) => void;
  /** Extra controls under the preview, e.g. when it was eaten. */
  children?: React.ReactNode;
}) {
  const units = unitsFor(food, overrides);
  const [unit, setUnit] = useState(initialUnit ?? food.defaultUnit);
  const [quantity, setQuantity] = useState(initialQuantity ?? (unit === 'g' ? 100 : 1));
  const [editing, setEditing] = useState(false);
  const [grams, setGrams] = useState<number | null>(null);

  const current = units.find((u) => u.key === unit) ?? units[0];
  const isGrams = unit === 'g';
  const n = nutrientsFor(food, unit, quantity, overrides);
  const totalGrams = Math.round(gramsFor(food, unit, quantity, overrides));
  const own = food.category === 'own';

  const pickUnit = (key: string) => {
    setUnit(key);
    setQuantity(key === 'g' ? 100 : 1);
    setEditing(false);
  };

  const macros = (['protein', 'carbs', 'fat', 'fiber'] as const)
    .filter((k) => n[k] !== undefined)
    .map((k) => `${k === 'fiber' ? 'Fibre' : k[0].toUpperCase() + k.slice(1)} ${formatNutrient(k, n[k]!)}`)
    .join(' · ');

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
          <ThemedText type="small" themeColor="textSecondary" onPress={() => setEditing(true)} style={styles.link}>
            1 {current.label} = {current.grams} g. Yours is different? Change
          </ThemedText>
        )
      ) : null}

      {children}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button kind="secondary" label="Cancel" onPress={onCancel} />
        </View>
        <View style={styles.action}>
          <Button label={actionLabel} onPress={() => onDone(unit, quantity, n)} />
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
  link: { textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
