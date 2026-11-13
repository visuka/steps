import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { Card } from '@/components/card';
import { confirmDelete } from '@/components/confirm';
import { Button, NumberField } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { WhenField } from '@/components/when-field';
import { Spacing } from '@/constants/theme';
import { changeLog, deleteLog } from '@/data/entries';
import { type LogEntry, type LogKind, newId } from '@/data/types';
import { copyStore } from '@/health/select-source';
import { useClockStyle } from '@/hooks/use-clock-style';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/dates';
import {
  formatWater,
  formatWeight,
  kgToWeight,
  mlToWater,
  waterToMl,
  waterUnit,
  weightToKg,
  weightUnit,
} from '@/lib/format';
import { formatWhen, formatWhenInSentence, timeNow } from '@/lib/when';
import { useApp } from '@/state/app-state';

const WATER_QUICK_ML = [250, 500];
/** How many entries the history lists, newest first. */
const LISTED = 60;
const OFF_LIST = `Only your latest ${LISTED} entries are listed here.`;

interface Note {
  text: string;
  problem: boolean;
}

/** Weight or water entries, on the Journal tab. */
export function BodyLog({ kind }: { kind: LogKind }) {
  const { repo, source, profile, dataVersion, touch, updateProfile } = useApp();
  const theme = useTheme();
  const clock = useClockStyle();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [draft, setDraft] = useState<number | null>(null);
  /** When for the next entry; null is "now", whenever Add is tapped. */
  const [at, setAt] = useState<number | null>(null);
  const [addNote, setAddNote] = useState<Note | null>(null);
  const [listNote, setListNote] = useState<Note | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  /** Deleted, so off the list before the next read. */
  const [gone, setGone] = useState<string[]>([]);
  const units = profile.units;

  useEffect(() => {
    let live = true;
    repo.getLogs(kind, LISTED).then((e) => live && setEntries(e));
    return () => {
      live = false;
    };
  }, [repo, kind, dataVersion]);

  /** Whether an entry is among those listed; one dated before them can't be found there. */
  const listed = async (id: string) => {
    try {
      return (await repo.getLogs(kind, LISTED)).some((e) => e.id === id);
    } catch {
      return true;
    }
  };

  /** The latest weight drives calorie estimates; after any change it's whichever entry is now latest. */
  const followLatestWeight = async () => {
    if (kind !== 'weight') return;
    const [latest] = await repo.getLogs('weight', 1);
    if (latest && latest.value !== profile.weightKg) await updateProfile({ weightKg: latest.value });
  };

  /** The entry's value in the person's units, for the form. */
  const shownValue = (metric: number) => (kind === 'weight' ? kgToWeight(metric, units) : mlToWater(metric, units));

  /** A typed value in metric, or a reason it can't be saved. */
  const toMetric = (typed: number): { value: number } | { problem: string } => {
    const metric = kind === 'weight' ? weightToKg(typed, units) : waterToMl(typed, units);
    if (kind === 'weight' && (metric < 20 || metric > 350)) return { problem: 'That weight looks off. Check the number and units.' };
    return { value: Math.round(metric * 10) / 10 };
  };

  const add = async (metricValue: number) => {
    setAddNote(null);
    const when = new Date(at ?? timeNow());
    let healthSampleId: string | null = null;
    let problem: string | null = null;
    try {
      healthSampleId =
        (kind === 'weight' ? await source.writeWeight?.(metricValue, when) : await source.writeWater?.(metricValue, when)) ??
        null;
    } catch {
      problem = `Saved here, but couldn't copy it to ${source.label}.`;
    }
    const id = newId();
    try {
      await repo.addLog(kind, { id, loggedAt: when.getTime(), value: metricValue, healthSampleId });
      await followLatestWeight();
    } catch {
      setAddNote({ text: "Couldn't save that. Please try again.", problem: true });
      return;
    }
    const day =
      dayKey(when) === dayKey(new Date()) ? null : `Added for ${formatWhenInSentence(when.getTime(), timeNow(), clock)}.`;
    const text = [problem, day, day && !(await listed(id)) ? OFF_LIST : null].filter(Boolean).join(' ');
    setAddNote(text ? { text, problem: Boolean(problem) } : null);
    setDraft(null);
    setAt(null);
    touch();
  };

  const change = async (before: LogEntry, typed: number, when: number) => {
    const metric = toMetric(typed);
    if ('problem' in metric) {
      setListNote({ text: metric.problem, problem: true });
      return;
    }
    setListNote(null);
    // An amount left as it was keeps its exact value, not one rounded through pounds or ounces.
    const value = typed === shownValue(before.value) ? before.value : metric.value;
    try {
      // The copy is wherever it was saved, even if steps now come from somewhere else.
      const copy = await changeLog(repo, copyStore, kind, before, { ...before, value, loggedAt: when });
      await followLatestWeight();
      setEditing(null);
      const failed = copy === 'failed' ? `Saved here, but couldn't update it in ${copyStore.label}.` : null;
      // Moved before the entries listed: say where it went.
      const moved =
        when !== before.loggedAt && !(await listed(before.id))
          ? `Moved to ${formatWhenInSentence(when, timeNow(), clock)}. ${OFF_LIST}`
          : null;
      const text = [failed, moved].filter(Boolean).join(' ');
      setListNote(text ? { text, problem: Boolean(failed) } : null);
    } catch {
      setListNote({ text: "Couldn't save that change. Please try again.", problem: true });
    }
    touch();
  };

  const remove = async (entry: LogEntry) => {
    setGone((g) => [...g, entry.id]);
    setEditing((id) => (id === entry.id ? null : id));
    setListNote(null);
    try {
      if ((await deleteLog(repo, copyStore, kind, entry)) === 'failed') {
        setListNote({ text: `Deleted here, but couldn't delete the copy in ${copyStore.label}.`, problem: true });
      }
      await followLatestWeight();
    } catch {
      setGone((g) => g.filter((id) => id !== entry.id));
      setListNote({ text: "Couldn't delete that entry. Please try again.", problem: true });
    }
    touch();
  };

  const askRemove = (entry: LogEntry) => confirmDelete('entry', () => remove(entry));

  const submitDraft = () => {
    if (draft === null || draft <= 0) return;
    const metric = toMetric(draft);
    if ('problem' in metric) {
      setAddNote({ text: metric.problem, problem: true });
      return;
    }
    add(metric.value);
  };

  const shown = entries.filter((e) => !gone.includes(e.id));
  const today = dayKey(new Date());
  const waterToday = shown
    .filter((e) => kind === 'water' && dayKey(new Date(e.loggedAt)) === today)
    .reduce((s, e) => s + e.value, 0);
  const weightTrend = kind === 'weight' ? [...shown].slice(0, 14).reverse() : [];
  const format = (v: number) => (kind === 'weight' ? formatWeight(v, units) : formatWater(v, units));
  const unit = kind === 'weight' ? weightUnit(units) : waterUnit(units);
  const now = useNow();

  return (
    <>
      <Card>
        {kind === 'weight' ? (
          <View style={styles.headline}>
            <ThemedText type="small" themeColor="textSecondary">
              Latest
            </ThemedText>
            <ThemedText style={styles.big}>{shown[0] ? formatWeight(shown[0].value, units) : '—'}</ThemedText>
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
          unit={unit}
          decimals={kind === 'weight' ? 1 : 0}
          onCommit={setDraft}
          placeholder="0"
        />
        <WhenField value={at ?? now} onChange={setAt} />
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
        {addNote ? <NoteText note={addNote} /> : null}
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
        {shown.length === 0 ? (
          <ThemedText themeColor="textSecondary">Nothing logged yet.</ThemedText>
        ) : (
          shown.map((e) =>
            editing === e.id ? (
              <View key={e.id} style={[styles.editing, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold">Change this entry</ThemedText>
                <LogForm
                  label={kind === 'weight' ? 'Weight' : 'Water'}
                  unit={unit}
                  decimals={kind === 'weight' ? 1 : 0}
                  initialValue={shownValue(e.value)}
                  initialAt={e.loggedAt}
                  onSave={(typed, when) => change(e, typed, when)}
                  onCancel={() => setEditing(null)}
                  onDelete={() => askRemove(e)}
                />
              </View>
            ) : (
              <Pressable
                key={e.id}
                onPress={() => {
                  setListNote(null);
                  setEditing(e.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${format(e.value)}, ${formatWhen(e.loggedAt, now, clock)}. Tap to change or delete it.`}
                style={styles.entry}>
                <View>
                  <ThemedText>{format(e.value)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatWhen(e.loggedAt, now, clock)}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => askRemove(e)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${format(e.value)}`}
                  hitSlop={10}>
                  <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
                </Pressable>
              </Pressable>
            ),
          )
        )}
        {listNote ? <NoteText note={listNote} /> : null}
        {shown.length && !editing ? (
          <ThemedText type="small" themeColor="textSecondary">
            Tap an entry to change it or delete it.
          </ThemedText>
        ) : null}
      </Card>
    </>
  );
}

/** One entry's amount and time, to change it. */
function LogForm({
  label,
  unit,
  decimals,
  initialValue,
  initialAt,
  onSave,
  onCancel,
  onDelete,
}: {
  label: string;
  unit: string;
  decimals: number;
  initialValue: number;
  initialAt: number;
  onSave: (typed: number, at: number) => void | Promise<void>;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState<number | null>(initialValue);
  const [at, setAt] = useState(initialAt);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (value === null || value <= 0 || saving) return;
    setSaving(true);
    try {
      await onSave(value, at);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <NumberField label={label} value={value} unit={unit} decimals={decimals} onCommit={setValue} placeholder="0" />
      <WhenField value={at} onChange={setAt} />
      <Button label="Save" onPress={save} disabled={value === null || value <= 0 || saving} />
      <Button kind="secondary" label="Cancel" onPress={onCancel} />
      <Button kind="danger" label="Delete this entry" onPress={onDelete} />
    </>
  );
}

function NoteText({ note }: { note: Note }) {
  const theme = useTheme();
  return (
    <ThemedText type="small" themeColor="textSecondary" style={note.problem ? { color: theme.danger } : undefined}>
      {note.text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  headline: { gap: Spacing.half },
  big: { fontSize: 32, lineHeight: 40, fontWeight: 700, fontVariant: ['tabular-nums'] },
  quick: { flexDirection: 'row', gap: Spacing.two },
  quickItem: { flex: 1 },
  entry: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editing: { gap: Spacing.three, borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: Spacing.three },
});
