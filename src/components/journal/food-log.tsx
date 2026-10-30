import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, Chip, NumberField, Segmented, TextField } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { type FoodEntry, newId, type RecentFood } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { formatSteps } from '@/lib/format';
import { useApp } from '@/state/app-state';
import { useCaloriesToday } from '@/state/use-calories';

/** People often log after eating; minutes ago. */
const WHEN: { value: string; label: string; minutesAgo: number }[] = [
  { value: '0', label: 'Now', minutesAgo: 0 },
  { value: '30', label: '30 min ago', minutesAgo: 30 },
  { value: '60', label: '1 h ago', minutesAgo: 60 },
  { value: '120', label: '2 h ago', minutesAgo: 120 },
];

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function FoodLog() {
  const { repo, source, dataVersion, touch } = useApp();
  const theme = useTheme();
  const { foods, eaten, resting, active, burned } = useCaloriesToday();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState<number | null>(null);
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

  const add = async (foodName: string, calories: number) => {
    setError(null);
    const minutesAgo = WHEN.find((w) => w.value === when)!.minutesAgo;
    const at = new Date(Date.now() - minutesAgo * 60_000);
    let healthSampleId: string | null = null;
    try {
      healthSampleId = (await source.writeFood?.(calories, foodName, at)) ?? null;
    } catch {
      setError(`Saved here, but couldn't copy it to ${source.label}.`);
    }
    await repo.addFood({ id: newId(), loggedAt: at.getTime(), name: foodName, kcal: calories, healthSampleId });
    setWhen('0');
    touch();
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || kcal === null || kcal <= 0) return;
    if (kcal > 5000) {
      setError('That looks like a lot for one item. Check the number.');
      return;
    }
    await add(trimmed, Math.round(kcal));
    setName('');
    setKcal(null);
  };

  const remove = async (entry: FoodEntry) => {
    if (entry.healthSampleId) await source.deleteSample?.('food', entry.healthSampleId).catch(() => undefined);
    await repo.deleteFood(entry.id);
    touch();
  };

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
        <TextField label="Food" value={name} onChangeText={setName} placeholder="What did you have? e.g. 2 dosa" />
        <NumberField label="Calories" unit="kcal" value={kcal} onCommit={setKcal} placeholder="0" />
        <Segmented options={WHEN} value={when} onChange={setWhen} />
        <Button label="Add" onPress={submit} disabled={!name.trim() || kcal === null || kcal <= 0} />
        {recent.length ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Had it again? Tap to add
            </ThemedText>
            <View style={styles.chips}>
              {recent.map((r) => (
                <Chip key={r.name} label={`${r.name} · ${Math.round(r.kcal)}`} onPress={() => add(r.name, r.kcal)} />
              ))}
            </View>
          </>
        ) : null}
        {error ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        ) : null}
        {source.writeFood ? (
          <ThemedText type="small" themeColor="textSecondary">
            Entries are also saved to {source.label}.
          </ThemedText>
        ) : null}
      </Card>

      <Card title="Eaten today">
        {foods.length === 0 ? (
          <ThemedText themeColor="textSecondary">Nothing logged today.</ThemedText>
        ) : (
          foods.map((f) => (
            <View key={f.id} style={styles.entry}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
                {timeOf(f.loggedAt)}
              </ThemedText>
              <ThemedText style={styles.entryName}>{f.name}</ThemedText>
              <ThemedText style={styles.entryKcal}>{formatSteps(f.kcal)} kcal</ThemedText>
              <Pressable
                onPress={() => remove(f)}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${f.name}`}
                hitSlop={10}>
                <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          ))
        )}
      </Card>
    </>
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
  entry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  time: { width: 64, fontVariant: ['tabular-nums'] },
  entryName: { flex: 1 },
  entryKcal: { fontVariant: ['tabular-nums'] },
});
