import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { confirmDelete } from '@/components/confirm';
import { NumberField } from '@/components/controls';
import { EditPanel, EntryList, EntryRow, FormActions } from '@/components/journal/entry-parts';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Notice, SectionHeader } from '@/components/ui';
import { WhenField } from '@/components/when-field';
import { NumeralMaxScale, Spacing } from '@/constants/theme';
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
import { addWater } from '@/water/add';

/** One glass (the size set in You → Water a day) and a bottle. */
const quickMl = (glassMl: number) => [...new Set([glassMl, 500])];
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
    let problem: string | null = null;
    let id = newId();
    try {
      if (kind === 'water') {
        // The one water path, shared with "+1 glass" on Today and Food (water/add.ts).
        const added = await addWater(repo, source, metricValue, when);
        id = added.entry.id;
        if (added.healthFailed) problem = `Saved here, but couldn't copy it to ${source.label}.`;
      } else {
        let healthSampleId: string | null = null;
        try {
          healthSampleId = (await source.writeWeight?.(metricValue, when)) ?? null;
        } catch {
          problem = `Saved here, but couldn't copy it to ${source.label}.`;
        }
        await repo.addLog(kind, { id, loggedAt: when.getTime(), value: metricValue, healthSampleId });
        await followLatestWeight();
      }
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
        <View style={styles.hero}>
          <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
            {kind === 'weight' ? 'Latest' : 'Today'}
          </ThemedText>
          <ThemedText type="numeralLarge" maxFontSizeMultiplier={NumeralMaxScale}>
            {kind === 'weight' ? (shown[0] ? formatWeight(shown[0].value, units) : '—') : formatWater(waterToday, units)}
          </ThemedText>
        </View>
        {kind === 'water' ? (
          <View style={styles.quick}>
            {quickMl(profile.water.glassMl).map((ml) => (
              <Button
                key={ml}
                variant="tonal"
                icon="add"
                label={formatWater(ml, units)}
                accessibilityLabel={`Add ${formatWater(ml, units)}`}
                onPress={() => add(ml)}
                style={styles.quickItem}
              />
            ))}
          </View>
        ) : null}
        <NumberField
          label={kind === 'weight' ? 'New weight' : 'Other amount'}
          value={draft}
          unit={unit}
          decimals={kind === 'weight' ? 1 : 0}
          onCommit={setDraft}
          placeholder="0"
        />
        <WhenField value={at ?? now} onChange={setAt} />
        <Button
          label="Add"
          variant={kind === 'water' ? 'outlined' : 'filled'}
          onPress={submitDraft}
          disabled={draft === null || draft <= 0}
        />
        {addNote ? <Notice tone={addNote.problem ? 'problem' : 'info'} text={addNote.text} /> : null}
        {source.writeWeight ? (
          <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
            Also saved to {source.label}.
          </ThemedText>
        ) : null}
      </Card>

      {weightTrend.length >= 2 ? (
        <>
          <SectionHeader title="Last entries" />
          <Card>
            <BarChart
              bars={weightTrend.map((e) => ({ key: e.id, value: e.value, label: '' }))}
              color={theme.outline}
              height={90}
            />
          </Card>
        </>
      ) : null}

      <SectionHeader title="History" />
      {shown.length === 0 ? (
        <EmptyState
          icon={kind === 'weight' ? 'scale-outline' : 'water-outline'}
          title="Nothing logged yet"
          hint={kind === 'weight' ? 'Add a weight above to start.' : 'Tap a glass above to start.'}
        />
      ) : (
        <EntryList>
          {shown.map((e) =>
            editing === e.id ? (
              <EditPanel key={e.id} title="Change this entry">
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
              </EditPanel>
            ) : (
              <EntryRow
                key={e.id}
                title={format(e.value)}
                supporting={formatWhen(e.loggedAt, now, clock)}
                onPress={() => {
                  setListNote(null);
                  setEditing(e.id);
                }}
                onDelete={() => askRemove(e)}
                deleteLabel={`Delete ${format(e.value)}`}
              />
            ),
          )}
        </EntryList>
      )}
      {listNote ? <Notice tone={listNote.problem ? 'problem' : 'info'} text={listNote.text} /> : null}
      {shown.length && !editing ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          Tap an entry to change it.
        </ThemedText>
      ) : null}
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
      <FormActions
        onSave={save}
        saveDisabled={value === null || value <= 0}
        saving={saving}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hero: { gap: Spacing.half },
  quick: { flexDirection: 'row', gap: Spacing.two },
  quickItem: { flex: 1 },
});
