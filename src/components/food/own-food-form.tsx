import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, NumberField, TextField } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { newId } from '@/data/types';
import { NUTRIENT, NUTRIENTS } from '@/nutrition/nutrients';
import type { NutrientKey, Nutrients, OwnFood } from '@/nutrition/types';

/** What a packet label shows first. */
const FIRST: NutrientKey[] = ['kcal', 'protein', 'carbs', 'sugars', 'fiber', 'fat', 'satFat', 'sodium'];
/**
 * Everything else a label might give, in the usual order. Glycemic load is
 * worked out, never on a label, so it isn't asked for.
 */
const MORE: NutrientKey[] = NUTRIENTS.map((n) => n.key).filter((k) => !FIRST.includes(k) && k !== 'gl');

/** A food that isn't in the list: calories are required, everything else is optional. */
export function OwnFoodForm({
  initialName,
  onSave,
  onCancel,
  children,
}: {
  initialName: string;
  onSave: (food: OwnFood) => void;
  onCancel: () => void;
  /** Extra controls above the buttons, e.g. where it was from. */
  children?: React.ReactNode;
}) {
  const [name, setName] = useState(initialName);
  const [serving, setServing] = useState('');
  const [values, setValues] = useState<Nutrients>({});
  const [more, setMore] = useState(false);

  const set = (key: NutrientKey) => (v: number | null) =>
    setValues((prev) => {
      const next = { ...prev };
      if (v === null || v < 0) delete next[key];
      else next[key] = v;
      return next;
    });

  const shown = (more ? [...FIRST, ...MORE] : FIRST).map((k) => NUTRIENT[k]);
  const ready = name.trim() !== '' && (values.kcal ?? 0) > 0;

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">Add your own food</ThemedText>
      <TextField label="Food name" value={name} onChangeText={setName} placeholder="e.g. Mom's rava kesari" />
      <TextField label="Serving" value={serving} onChangeText={setServing} placeholder="Serving, e.g. 1 plate or 1 packet" />
      <ThemedText type="small" themeColor="textSecondary">
        Per serving. Only calories are needed; a packet label has the rest.
      </ThemedText>
      {shown.map((n) => (
        <NumberField
          key={n.key}
          label={n.key === 'kcal' ? 'Calories (needed)' : n.label}
          unit={n.unit}
          decimals={n.unit === 'kcal' ? 0 : 1}
          value={values[n.key] ?? null}
          onCommit={set(n.key)}
          placeholder="—"
        />
      ))}
      {!more ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.link} onPress={() => setMore(true)}>
          More: added sugar, cholesterol, vitamins, minerals
        </ThemedText>
      ) : null}
      {children}
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button kind="secondary" label="Cancel" onPress={onCancel} />
        </View>
        <View style={styles.action}>
          <Button
            label="Save and add"
            disabled={!ready}
            onPress={() =>
              onSave({
                id: newId(),
                name: name.trim(),
                serving: serving.trim() || 'serving',
                nutrients: values,
                updatedAt: Date.now(),
              })
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two + 4 },
  link: { textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
