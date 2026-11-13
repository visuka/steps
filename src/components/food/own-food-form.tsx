import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { estimateFood } from '@/api/food-api';
import { unknownDishMessage } from '@/api/food-read';
import { Button, NumberField, TextField } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Notice, Button as UiButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { newId } from '@/data/types';
import type { PortionOverrides } from '@/nutrition/catalog';
import { NUTRIENT, NUTRIENTS } from '@/nutrition/nutrients';
import {
  checkFill,
  fieldDecimals,
  fillDescription,
  fillErrorMessage,
  fillFromEstimate,
  fillKey,
  fillNote,
  mergeFill,
  NOTHING_NOTE,
  STALE_NOTE,
  ZERO_NOTE,
} from '@/nutrition/own-fill';
import type { Where } from '@/nutrition/place';
import type { NutrientKey, Nutrients, OwnFood } from '@/nutrition/types';

/** What a packet label shows first. */
const FIRST: NutrientKey[] = ['kcal', 'protein', 'carbs', 'sugars', 'fiber', 'fat', 'satFat', 'sodium'];
/**
 * Everything else a label might give, in the usual order. Glycemic load is
 * worked out, never on a label, so it isn't asked for.
 */
const MORE: NutrientKey[] = NUTRIENTS.map((n) => n.key).filter((k) => !FIRST.includes(k) && k !== 'gl');

type Fill =
  | { status: 'idle' }
  | { status: 'loading' }
  /** `parts`: the foods added up, when more than one. */
  | { status: 'filled'; parts: string[] }
  | { status: 'unknown'; name: string }
  | { status: 'problem'; message: string };

/**
 * A food that isn't in the list. The person names it and the serving, and
 * "Fill with AI" works out calories, vitamins and minerals from the food
 * estimate API; typing them from a label is still there. Only calories are
 * needed to save. The full map is kept, even where the form shows fewer fields.
 */
export function OwnFoodForm({
  initialName,
  where,
  overrides,
  onSave,
  onCancel,
  onRecipe,
  children,
}: {
  initialName: string;
  /** Where it was from, sent with Fill as the Food tab's look-up does; null lets the server read the text. */
  where?: Where | null;
  /** The person's own portion sizes. */
  overrides?: PortionOverrides;
  onSave: (food: OwnFood) => void;
  onCancel: () => void;
  /** A dish the server couldn't work out: open "Tell us how it's made". */
  onRecipe?: (name: string) => void;
  /** Extra controls above the buttons, e.g. where it was from. */
  children?: React.ReactNode;
}) {
  const [name, setName] = useState(initialName);
  const [serving, setServing] = useState('');
  const [values, setValues] = useState<Nutrients>({});
  /** Values the person typed or cleared: a fill never overwrites them. */
  const edited = useRef(new Set<NutrientKey>());
  const [more, setMore] = useState(false);
  const [manual, setManual] = useState(false);
  const [fill, setFill] = useState<Fill>({ status: 'idle' });
  /**
   * What the values on screen were last filled for (fillKey), kept apart from
   * `fill` so a later Fill that fails still shows them as out of date.
   */
  const [filledFor, setFilledFor] = useState<string | null>(null);
  /** Set at once on tap, so a quick double tap sends one request, not two. */
  const busy = useRef(false);
  // Only the latest Fill counts; Cancel or leaving the form drops a late answer.
  const run = useRef(0);
  useEffect(
    () => () => {
      run.current += 1;
    },
    [],
  );

  const set = (key: NutrientKey) => (v: number | null) => {
    edited.current.add(key);
    setValues((prev) => {
      const next = { ...prev };
      if (v === null || v < 0) delete next[key];
      else next[key] = v;
      return next;
    });
  };

  const description = fillDescription(name, serving);
  const fillProblem = checkFill(name, serving);
  const loading = fill.status === 'loading';
  const filled = fill.status === 'filled';
  const note = fillNote(filledFor, fillKey(description, where));
  const stale = note === STALE_NOTE;

  const askAi = async () => {
    if (fillProblem || busy.current) return;
    busy.current = true;
    const id = ++run.current;
    const key = fillKey(description, where);
    setFill({ status: 'loading' });
    try {
      const result = await estimateFood(description, where ?? null);
      if (id !== run.current) return;
      const out = fillFromEstimate(result, overrides);
      if (out.kind === 'unknown') {
        setFill({ status: 'unknown', name: out.name });
      } else if (out.kind === 'zero') {
        setFill({ status: 'problem', message: ZERO_NOTE });
      } else if (out.kind === 'nothing') {
        setFill({ status: 'problem', message: NOTHING_NOTE });
      } else {
        // Read at answer time, so a value typed while waiting still wins.
        setValues((prev) => mergeFill(prev, edited.current, out.nutrients));
        // An empty serving takes the portion the server counted, and the values stay "for" it.
        const took = !serving.trim() && out.serving ? out.serving : null;
        if (took) setServing((prev) => (prev.trim() ? prev : took));
        setFilledFor(took ? fillKey(fillDescription(name, took), where) : key);
        setFill({ status: 'filled', parts: out.parts });
      }
    } catch (e) {
      if (id !== run.current) return;
      setFill({ status: 'problem', message: fillErrorMessage(e) });
    } finally {
      busy.current = false;
    }
  };

  const cancel = () => {
    run.current += 1;
    onCancel();
  };

  const showFields = manual || filledFor !== null || Object.keys(values).length > 0;
  const shown = (more ? [...FIRST, ...MORE] : FIRST).map((k) => NUTRIENT[k]);
  const ready = name.trim() !== '' && (values.kcal ?? 0) > 0 && !loading;

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">Add your own food</ThemedText>
      <TextField label="Food name" value={name} onChangeText={setName} placeholder="e.g. Haldiram aloo bhujia" />
      <TextField label="Serving" value={serving} onChangeText={setServing} placeholder="Serving, e.g. 1 packet or 1 glass" />

      <UiButton
        variant={filledFor !== null && !stale ? 'tonal' : 'filled'}
        icon="sparkles-outline"
        label={filledFor !== null ? 'Fill again with AI' : 'Fill with AI'}
        loading={loading}
        disabled={!!fillProblem}
        accessibilityLabel={loading ? 'Working it out' : undefined}
        accessibilityHint="Works out calories, vitamins and minerals for one serving"
        onPress={askAi}
      />
      {loading ? <Notice text="Working it out. This can take up to half a minute." /> : null}
      {!loading && fill.status === 'idle' ? (
        <ThemedText type="small" themeColor="textSecondary">
          We’ll work out calories, vitamins and minerals. You can change any of them.
        </ThemedText>
      ) : null}
      {note && !loading ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {note}
        </ThemedText>
      ) : null}
      {filled && fill.parts.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          Added up: {fill.parts.join(' + ')}
        </ThemedText>
      ) : null}
      {fill.status === 'problem' ? <Notice tone="problem" text={fill.message} /> : null}
      {fill.status === 'unknown' ? (
        <View style={styles.wrap}>
          <ThemedText type="small" themeColor="textSecondary">
            {unknownDishMessage(fill.name)}
          </ThemedText>
          {onRecipe ? (
            <Button kind="secondary" label="Tell us how it’s made" onPress={() => onRecipe(name.trim() || fill.name)} />
          ) : null}
        </View>
      ) : null}

      {showFields ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            For one serving. Only calories are needed.
          </ThemedText>
          {shown.map((n) => (
            <NumberField
              key={n.key}
              label={n.key === 'kcal' ? 'Calories (needed)' : n.label}
              unit={n.unit}
              decimals={fieldDecimals(n.key, values[n.key])}
              value={values[n.key] ?? null}
              onCommit={set(n.key)}
              placeholder="—"
            />
          ))}
          {!more ? (
            <UiButton
              variant="text"
              compact
              icon="chevron-down"
              label="More: added sugar, cholesterol, vitamins, minerals"
              onPress={() => setMore(true)}
            />
          ) : null}
        </>
      ) : (
        <UiButton variant="text" compact icon="create-outline" label="Or type them from the label" onPress={() => setManual(true)} />
      )}
      {children}
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button kind="secondary" label="Cancel" onPress={cancel} />
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
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
