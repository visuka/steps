import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, Chip, Segmented, TextField } from '@/components/controls';
import { NutrientBars } from '@/components/food/nutrient-bars';
import { OwnFoodForm } from '@/components/food/own-food-form';
import { PortionPicker } from '@/components/food/portion-picker';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { type FoodEntry, newId, type RecentFood } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { formatSteps } from '@/lib/format';
import { findFood, nutrientsFor, OWN_PREFIX, portionLabel, searchFoods } from '@/nutrition/catalog';
import type { FoodItem, Nutrients } from '@/nutrition/types';
import { useApp } from '@/state/app-state';
import { useCaloriesToday } from '@/state/use-calories';

/** People often log after eating; minutes ago. */
const WHEN: { value: string; label: string; minutesAgo: number }[] = [
  { value: '0', label: 'Now', minutesAgo: 0 },
  { value: '30', label: '30 min ago', minutesAgo: 30 },
  { value: '60', label: '1 h ago', minutesAgo: 60 },
  { value: '120', label: '2 h ago', minutesAgo: 120 },
];

const eatenAt = (when: string) => new Date(Date.now() - WHEN.find((w) => w.value === when)!.minutesAgo * 60_000);

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

type Mode =
  | { kind: 'search' }
  | { kind: 'pick'; food: FoodItem }
  | { kind: 'own'; name: string }
  | { kind: 'edit'; entry: FoodEntry; food: FoodItem };

export function FoodLog() {
  const { repo, source, dataVersion, touch } = useApp();
  const theme = useTheme();
  const { book, foods, nutrients, caloriesOnly, eaten, resting, active, burned } = useCaloriesToday();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>({ kind: 'search' });
  const [when, setWhen] = useState('0');
  const [recent, setRecent] = useState<RecentFood[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    repo.recentFoods(8).then((r) => live && setRecent(r));
    return () => {
      live = false;
    };
  }, [repo, dataVersion]);

  const reset = () => {
    setMode({ kind: 'search' });
    setQuery('');
    setWhen('0');
  };

  const log = async (foodId: string | null, name: string, unit: string | null, quantity: number | null, n: Nutrients) => {
    setError(null);
    const at = eatenAt(when);
    let healthSampleId: string | null = null;
    try {
      healthSampleId = (await source.writeFood?.(name, n, at)) ?? null;
    } catch {
      setError(`Saved here, but couldn't copy it to ${source.label}.`);
    }
    await repo.addFood({
      id: newId(),
      loggedAt: at.getTime(),
      name,
      foodId,
      unit,
      quantity,
      kcal: Math.round(n.kcal ?? 0),
      healthSampleId,
    });
    reset();
    touch();
  };

  const logAgain = (r: RecentFood) => {
    const food = r.foodId ? findFood(r.foodId, book.own) : null;
    if (food && r.unit && r.quantity !== null) {
      log(food.id, food.name, r.unit, r.quantity, nutrientsFor(food, r.unit, r.quantity, book.overrides));
    } else {
      log(null, r.name, null, null, { kcal: r.kcal });
    }
  };

  const remove = async (entry: FoodEntry) => {
    if (entry.healthSampleId) await source.deleteSample?.('food', entry.healthSampleId).catch(() => undefined);
    await repo.deleteFood(entry.id);
    reset();
    touch();
  };

  const results = mode.kind === 'search' ? searchFoods(query, book.own) : [];
  const balance = eaten - burned;

  return (
    <>
      <Card title="Today so far">
        <View style={styles.totals}>
          <Total label="Eaten" value={eaten} />
          <Total label="Burned" value={burned} />
          <Total label={balance > 0 ? 'Over' : 'Under'} value={Math.abs(balance)} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Burned = {formatSteps(resting)} resting (what your body uses anyway) + {formatSteps(active)} from walking.
          Both are estimates; add your birth year in Settings to improve the resting figure.
        </ThemedText>
      </Card>

      <Card title="I ate">
        {mode.kind === 'search' ? (
          <>
            <TextField label="Search foods" value={query} onChangeText={setQuery} placeholder="Search: roti, dal, banana, fish…" />
            {results.map((food) => (
              <SearchResult key={food.id} food={food} onPress={() => setMode({ kind: 'pick', food })} />
            ))}
            {query.trim() ? (
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.link}
                onPress={() => setMode({ kind: 'own', name: query.trim() })}>
                {results.length ? 'Not here? ' : 'No match. '}Add “{query.trim()}” as your own food
              </ThemedText>
            ) : recent.length ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Had it again? Tap to add the same amount
                </ThemedText>
                <View style={styles.chips}>
                  {recent.map((r) => (
                    <Chip key={r.foodId ?? r.name} label={r.name} onPress={() => logAgain(r)} />
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {mode.kind === 'pick' ? (
          <PortionPicker
            food={mode.food}
            overrides={book.overrides}
            actionLabel="Add"
            onCancel={reset}
            onSetPortion={(unit, grams) => book.setPortion(mode.food, unit, grams)}
            onDone={(unit, quantity, n) => log(mode.food.id, mode.food.name, unit, quantity, n)}>
            <Segmented options={WHEN} value={when} onChange={setWhen} />
          </PortionPicker>
        ) : null}

        {mode.kind === 'edit' ? (
          <PortionPicker
            food={mode.food}
            overrides={book.overrides}
            initialUnit={mode.entry.unit ?? undefined}
            initialQuantity={mode.entry.quantity ?? undefined}
            actionLabel="Save"
            onCancel={reset}
            onSetPortion={(unit, grams) => book.setPortion(mode.food, unit, grams)}
            onDone={async (unit, quantity, n) => {
              await repo.updateFood({ ...mode.entry, unit, quantity, kcal: Math.round(n.kcal ?? 0) });
              reset();
              touch();
            }}>
            <Button kind="danger" label="Delete this entry" onPress={() => remove(mode.entry)} />
          </PortionPicker>
        ) : null}

        {mode.kind === 'own' ? (
          <OwnFoodForm
            initialName={mode.name}
            onCancel={reset}
            onSave={async (own) => {
              await book.saveOwn(own);
              await log(OWN_PREFIX + own.id, own.name, 'serving', 1, own.nutrients);
            }}
          />
        ) : null}

        {error ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        ) : null}
      </Card>

      <Card title="Eaten today">
        {foods.length === 0 ? (
          <ThemedText themeColor="textSecondary">Nothing logged today.</ThemedText>
        ) : (
          foods.map((f) => {
            const food = f.foodId ? findFood(f.foodId, book.own) : null;
            const kcal = Math.round(book.nutrientsOf(f).kcal ?? f.kcal);
            return (
              <Pressable
                key={f.id}
                onPress={() => (food ? setMode({ kind: 'edit', entry: f, food }) : undefined)}
                accessibilityRole="button"
                accessibilityLabel={`${f.name}, ${kcal} kcal. ${food ? 'Change amount' : ''}`}
                style={styles.entry}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
                  {timeOf(f.loggedAt)}
                </ThemedText>
                <View style={styles.entryName}>
                  <ThemedText>{f.name}</ThemedText>
                  {food && f.unit && f.quantity !== null ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {portionLabel(food, f.unit, f.quantity)}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText style={styles.entryKcal}>{formatSteps(kcal)} kcal</ThemedText>
                {food ? null : (
                  <Pressable onPress={() => remove(f)} accessibilityRole="button" accessibilityLabel={`Delete ${f.name}`} hitSlop={10}>
                    <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
                  </Pressable>
                )}
              </Pressable>
            );
          })
        )}
        {foods.some((f) => f.foodId) ? (
          <ThemedText type="small" themeColor="textSecondary">
            Tap an entry to change the amount or delete it.
          </ThemedText>
        ) : null}
      </Card>

      {foods.length ? (
        <Card title="Nutrients today">
          <NutrientBars nutrients={nutrients} groups={['macro']} />
          <NutrientBars nutrients={nutrients} groups={['vitamin', 'mineral']} />
          <ThemedText type="small" themeColor="textSecondary">
            Percent of a general adult daily value (US FDA); your own needs may differ. Values are estimates
            {caloriesOnly ? `; ${caloriesOnly} calorie-only ${caloriesOnly === 1 ? 'entry adds' : 'entries add'} no nutrients` : ''}.
          </ThemedText>
        </Card>
      ) : null}
    </>
  );
}

function SearchResult({ food, onPress }: { food: FoodItem; onPress: () => void }) {
  const unit = food.units.find((u) => u.key === food.defaultUnit) ?? food.units[0];
  const kcal = Math.round(((food.per100g.kcal ?? 0) * unit.grams) / 100);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.result, { opacity: pressed ? 0.6 : 1 }]}>
      <ThemedText style={styles.entryName}>{food.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        1 {unit.label} · {kcal} kcal
      </ThemedText>
    </Pressable>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.total}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.totalValue}>{formatSteps(value)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        kcal
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', justifyContent: 'space-between' },
  total: { flex: 1, alignItems: 'center', gap: Spacing.half },
  totalValue: { fontSize: 24, lineHeight: 30, fontWeight: 700, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  link: { textDecorationLine: 'underline' },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  entry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  time: { width: 64, fontVariant: ['tabular-nums'] },
  entryName: { flex: 1 },
  entryKcal: { fontVariant: ['tabular-nums'] },
});
