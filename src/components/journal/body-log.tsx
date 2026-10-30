import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { Card } from '@/components/card';
import { Button, NumberField } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { type LogEntry, type LogKind, newId } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/dates';
import {
  formatWater,
  formatWeight,
  waterToMl,
  waterUnit,
  weightToKg,
  weightUnit,
} from '@/lib/format';
import { useApp } from '@/state/app-state';

const WATER_QUICK_ML = [250, 500];

/** Weight or water entries, on the Journal tab. */
export function BodyLog({ kind }: { kind: LogKind }) {
  const { repo, source, profile, dataVersion, touch, updateProfile } = useApp();
  const theme = useTheme();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [draft, setDraft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const units = profile.units;

  useEffect(() => {
    let live = true;
    repo.getLogs(kind, 60).then((e) => live && setEntries(e));
    return () => {
      live = false;
    };
  }, [repo, kind, dataVersion]);

  const add = async (metricValue: number) => {
    setError(null);
    const at = new Date();
    let healthSampleId: string | null = null;
    try {
      healthSampleId =
        (kind === 'weight' ? await source.writeWeight?.(metricValue, at) : await source.writeWater?.(metricValue, at)) ??
        null;
    } catch {
      setError(`Saved here, but couldn't copy it to ${source.label}.`);
    }
    await repo.addLog(kind, { id: newId(), loggedAt: at.getTime(), value: metricValue, healthSampleId });
    // The latest weight also drives calorie estimates.
    if (kind === 'weight') await updateProfile({ weightKg: metricValue });
    setDraft(null);
    touch();
  };

  const remove = async (entry: LogEntry) => {
    if (entry.healthSampleId) await source.deleteSample?.(kind, entry.healthSampleId).catch(() => undefined);
    await repo.deleteLog(kind, entry.id);
    touch();
  };

  const submitDraft = () => {
    if (draft === null || draft <= 0) return;
    const metric = kind === 'weight' ? weightToKg(draft, units) : waterToMl(draft, units);
    if (kind === 'weight' && (metric < 20 || metric > 350)) {
      setError('That weight looks off. Check the number and units.');
      return;
    }
    add(Math.round(metric * 10) / 10);
  };

  const today = dayKey(new Date());
  const waterToday = entries
    .filter((e) => kind === 'water' && dayKey(new Date(e.loggedAt)) === today)
    .reduce((s, e) => s + e.value, 0);
  const weightTrend = kind === 'weight' ? [...entries].slice(0, 14).reverse() : [];
  const format = (v: number) => (kind === 'weight' ? formatWeight(v, units) : formatWater(v, units));

  return (
    <>
      <Card>
        {kind === 'weight' ? (
          <View style={styles.headline}>
            <ThemedText type="small" themeColor="textSecondary">
              Latest
            </ThemedText>
            <ThemedText style={styles.big}>{entries[0] ? formatWeight(entries[0].value, units) : '—'}</ThemedText>
          </View>
        ) : (
          <View style={styles.headline}>
            <ThemedText type="small" themeColor="textSecondary">
              Today
            </ThemedText>
            <ThemedText style={styles.big}>{formatWater(waterToday, units)}</ThemedText>
          </View>
        )}
        <NumberField
          label={kind === 'weight' ? 'New weight' : 'Add water'}
          value={draft}
          unit={kind === 'weight' ? weightUnit(units) : waterUnit(units)}
          decimals={kind === 'weight' ? 1 : 0}
          onCommit={setDraft}
          placeholder="0"
        />
        <Button label="Add" onPress={submitDraft} disabled={draft === null || draft <= 0} />
        {kind === 'water' ? (
          <View style={styles.quick}>
            {WATER_QUICK_ML.map((ml) => (
              <View key={ml} style={styles.quickItem}>
                <Button kind="secondary" label={`+ ${formatWater(ml, units)}`} onPress={() => add(ml)} />
              </View>
            ))}
          </View>
        ) : null}
        {error ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        ) : null}
        {source.writeWeight ? (
          <ThemedText type="small" themeColor="textSecondary">
            Entries are also saved to {source.label}.
          </ThemedText>
        ) : null}
      </Card>

      {weightTrend.length >= 2 ? (
        <Card title="Last entries">
          <BarChart
            bars={weightTrend.map((e) => ({ key: e.id, value: e.value, label: '' }))}
            height={90}
          />
        </Card>
      ) : null}

      <Card title="History">
        {entries.length === 0 ? (
          <ThemedText themeColor="textSecondary">Nothing logged yet.</ThemedText>
        ) : (
          entries.map((e) => (
            <View key={e.id} style={styles.entry}>
              <View>
                <ThemedText>{format(e.value)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {new Date(e.loggedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => remove(e)}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${format(e.value)}`}
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

const styles = StyleSheet.create({
  headline: { gap: Spacing.half },
  big: { fontSize: 32, lineHeight: 40, fontWeight: 700, fontVariant: ['tabular-nums'] },
  quick: { flexDirection: 'row', gap: Spacing.two },
  quickItem: { flex: 1 },
  entry: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
