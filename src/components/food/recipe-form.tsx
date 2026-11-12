import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { recipeFood, type RecipeResult, type RecipeUnit } from '@/api/food-api';
import { checkRecipe, FoodApiError, RECIPE_MAX_SERVINGS } from '@/api/food-read';
import { Button, NumberField, Segmented, TextField } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const UNITS: { value: RecipeUnit; label: string }[] = [
  { value: 'bowl', label: 'Bowls' },
  { value: 'plate', label: 'Plates' },
  { value: 'piece', label: 'Pieces' },
  { value: 'glass', label: 'Glasses' },
];

/**
 * A dish we don't know: the person says what went in and how they cooked it,
 * and the server works out the nutrients from those ingredients.
 */
export function RecipeForm({
  initialName,
  onDone,
  onCancel,
}: {
  initialName: string;
  onDone: (result: RecipeResult) => void | Promise<void>;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(initialName);
  const [ingredients, setIngredients] = useState('');
  const [steps, setSteps] = useState('');
  const [servings, setServings] = useState<number | null>(null);
  const [unit, setUnit] = useState<RecipeUnit>('bowl');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cancelled or gone while waiting: the answer, when it comes, is ignored.
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  const request = {
    name,
    ingredients,
    steps,
    ...(servings !== null ? { servings: Math.round(servings), unit } : {}),
  };

  const submit = async () => {
    const problem = checkRecipe(request);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    live.current = true;
    try {
      const result = await recipeFood(request);
      if (live.current) await onDone(result);
    } catch (e) {
      if (live.current) setError(e instanceof FoodApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      if (live.current) setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">Tell us how you made it</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        We work out the nutrients from what went in and how it was cooked. Rough amounts are fine.
      </ThemedText>

      <ThemedText type="small">Dish name</ThemedText>
      <TextField label="Dish name" value={name} onChangeText={setName} placeholder="e.g. Grandma's kootu" />

      <ThemedText type="small">What went in</ThemedText>
      <TextField
        label="What went in"
        value={ingredients}
        onChangeText={setIngredients}
        placeholder="1 cup moong dal, 2 cups ash gourd, 2 tsp oil, salt"
        multiline
      />

      <ThemedText type="small">How you cooked it</ThemedText>
      <TextField
        label="How you cooked it"
        value={steps}
        onChangeText={setSteps}
        placeholder="Pressure cooked the dal and gourd, then added mustard seeds fried in the oil"
        multiline
      />

      <NumberField
        label="Makes (optional)"
        value={servings}
        onCommit={(v) => setServings(v !== null && v > 0 ? v : null)}
        placeholder="—"
      />
      {servings !== null ? <Segmented options={UNITS} value={unit} onChange={setUnit} /> : null}
      <ThemedText type="small" themeColor="textSecondary">
        {servings !== null
          ? `Up to ${RECIPE_MAX_SERVINGS}. You'll log it by the ${unit}.`
          : 'Leave it empty and we estimate how many servings it makes.'}
      </ThemedText>

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={theme.accent} />
          <ThemedText type="small" themeColor="textSecondary">
            Working it out. This can take up to half a minute.
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            kind="secondary"
            label="Cancel"
            onPress={() => {
              live.current = false;
              onCancel();
            }}
          />
        </View>
        <View style={styles.action}>
          <Button label="Work it out" disabled={busy || !name.trim() || !ingredients.trim()} onPress={submit} />
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        What you type here, and your phone&apos;s country, are sent to our server and an AI service to read the
        ingredients. It&apos;s kept without your name, so the same recipe is quicker next time.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two + 4 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
