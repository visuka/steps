import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { confirmDelete } from '@/components/confirm';
import { NumberField } from '@/components/controls';
import { EditPanel, EntryList, EntryRow, FormActions } from '@/components/journal/entry-parts';
import { ThemedText } from '@/components/themed-text';
import { Card, EmptyState, Notice, SectionHeader, StatTile, Why } from '@/components/ui';
import { WhenField } from '@/components/when-field';
import { Radius, Spacing } from '@/constants/theme';
import { changeBloodPressure, deleteBloodPressure } from '@/data/entries';
import { type BloodPressureEntry, newId } from '@/data/types';
import { vitalsSource } from '@/health/vitals';
import { useClockStyle } from '@/hooks/use-clock-style';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { averageBp, BP_CATEGORY, bpCategory, type BpAverage, checkBp } from '@/lib/blood-pressure';
import { formatWhen, formatWhenInSentence, timeNow } from '@/lib/when';
import { useApp } from '@/state/app-state';
import { useVitalsConnection } from '@/state/use-vitals';

const HISTORY_DAYS = 30;
const DAY_MS = 86_400_000;

const STEADY_WHY =
  'Sit quietly for 5 minutes first, back supported, feet flat, arm resting at heart height. Take two readings a minute apart and log both.';
const RANGES_WHY =
  "Ranges are the American Heart Association's for adults. One reading says little on its own; what matters is how your numbers run over weeks.";

/** What the form gives back. */
interface Reading {
  systolic: number;
  diastolic: number;
  pulse: number | null;
  at: number;
}

interface Note {
  text: string;
  problem: boolean;
}

export function BloodPressureLog() {
  const { repo, dataVersion, touch } = useApp();
  const clock = useClockStyle();
  const vitals = useVitalsConnection();
  const [readings, setReadings] = useState<BloodPressureEntry[]>([]);
  const [addNote, setAddNote] = useState<Note | null>(null);
  const [listNote, setListNote] = useState<Note | null>(null);
  const [warning, setWarning] = useState<BloodPressureEntry | null>(null);
  const [since, setSince] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  /** Deleted, so off the list before the next read. */
  const [gone, setGone] = useState<string[]>([]);
  // A new form after each reading is saved.
  const [formKey, setFormKey] = useState(0);
  const store = vitalsSource?.label ?? 'Health Connect';

  useEffect(() => {
    let live = true;
    const now = timeNow();
    repo.getBloodPressure(now - HISTORY_DAYS * DAY_MS, now + 1).then((r) => {
      if (!live) return;
      setReadings(r);
      setSince(now);
    });
    return () => {
      live = false;
    };
  }, [repo, dataVersion]);

  /** Said when a reading is dated before the days listed here. */
  const outsideList = (at: number) =>
    at < timeNow() - HISTORY_DAYS * DAY_MS
      ? `Saved for ${formatWhenInSentence(at, timeNow(), clock)}. Only the last ${HISTORY_DAYS} days are listed here.`
      : null;

  const add = async (r: Reading) => {
    setAddNote(null);
    const at = new Date(r.at);
    let healthId: string | null = null;
    let problem: string | null = null;
    if (vitalsSource && vitals.connected) {
      try {
        healthId = await vitalsSource.writeBloodPressure(r.systolic, r.diastolic, at);
      } catch {
        problem = `Saved here, but couldn't copy it to ${vitalsSource.label}.`;
      }
    }
    const entry: BloodPressureEntry = {
      id: newId(),
      loggedAt: r.at,
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse,
      source: 'manual',
      healthId,
      updatedAt: timeNow(),
    };
    try {
      await repo.saveBloodPressure(entry);
    } catch {
      setAddNote({ text: "Couldn't save that reading. Please try again.", problem: true });
      return;
    }
    setWarning(bpCategory(entry.systolic, entry.diastolic) === 'severe' ? entry : null);
    const text = [problem, outsideList(r.at)].filter(Boolean).join(' ');
    setAddNote(text ? { text, problem: Boolean(problem) } : null);
    setFormKey((k) => k + 1);
    touch();
  };

  const change = async (before: BloodPressureEntry, r: Reading) => {
    setListNote(null);
    const after: BloodPressureEntry = { ...before, loggedAt: r.at, systolic: r.systolic, diastolic: r.diastolic, pulse: r.pulse };
    try {
      const copy = await changeBloodPressure(repo, vitalsSource, before, after);
      setEditing(null);
      setWarning(bpCategory(after.systolic, after.diastolic) === 'severe' ? after : null);
      const failed = copy === 'failed' ? `Saved here, but couldn't update it in ${store}.` : null;
      const text = [failed, outsideList(r.at)].filter(Boolean).join(' ');
      setListNote(text ? { text, problem: Boolean(failed) } : null);
    } catch {
      setListNote({ text: "Couldn't save that change. Please try again.", problem: true });
    }
    touch();
  };

  const remove = async (entry: BloodPressureEntry) => {
    setGone((g) => [...g, entry.id]);
    setEditing((id) => (id === entry.id ? null : id));
    setListNote(null);
    if (warning?.id === entry.id) setWarning(null);
    try {
      if ((await deleteBloodPressure(repo, vitalsSource, entry)) === 'failed') {
        setListNote({ text: `Deleted here, but couldn't delete the copy in ${store} yet. The app will try again.`, problem: true });
      }
    } catch {
      setGone((g) => g.filter((id) => id !== entry.id));
      setListNote({ text: "Couldn't delete that reading. Please try again.", problem: true });
    }
    touch();
  };

  const askRemove = (entry: BloodPressureEntry) => confirmDelete('reading', () => remove(entry));

  const shown = readings.filter((r) => !gone.includes(r.id));
  const week = since === null ? null : averageBp(shown.filter((r) => r.loggedAt >= since - 7 * DAY_MS));
  const month = averageBp(shown);
  const now = useNow();

  return (
    <>
      {warning ? <SevereWarning reading={warning} /> : null}

      <Card title="New reading" right={<Why title="A steady reading" text={STEADY_WHY} label="How?" />}>
        <BpForm key={formKey} actionLabel="Save reading" onSave={add} />
        {addNote ? <Notice tone={addNote.problem ? 'problem' : 'info'} text={addNote.text} /> : null}
      </Card>

      <SectionHeader title="Your readings" why={RANGES_WHY} />
      {shown.length === 0 ? (
        <EmptyState icon="pulse-outline" title="No readings yet" hint={`Readings from the last ${HISTORY_DAYS} days show here.`} />
      ) : (
        <>
          <View style={styles.tiles}>
            <Average label="Last 7 days" avg={week} />
            <Average label={`Last ${HISTORY_DAYS} days`} avg={month} />
          </View>
          <EntryList>
            {shown.map((r) => {
              const mine = r.source === 'manual';
              if (mine && editing === r.id) {
                return (
                  <EditPanel key={r.id} title="Change this reading">
                    <BpForm
                      initial={r}
                      actionLabel="Save"
                      onSave={(next) => change(r, next)}
                      onCancel={() => setEditing(null)}
                      onDelete={() => askRemove(r)}
                    />
                  </EditPanel>
                );
              }
              const label = `${r.systolic}/${r.diastolic} mmHg${r.pulse ? ` · pulse ${r.pulse}` : ''}`;
              const detail = `${formatWhen(r.loggedAt, now, clock)} · ${BP_CATEGORY[bpCategory(r.systolic, r.diastolic)].label}${
                mine ? '' : ` · ${vitals.label ?? 'another app'}`
              }`;
              return (
                <EntryRow
                  key={r.id}
                  title={label}
                  supporting={detail}
                  onPress={
                    mine
                      ? () => {
                          setListNote(null);
                          setEditing(r.id);
                        }
                      : undefined
                  }
                  onDelete={mine ? () => askRemove(r) : undefined}
                  deleteLabel={`Delete ${r.systolic} over ${r.diastolic}`}
                  readOnly={!mine}
                />
              );
            })}
          </EntryList>
        </>
      )}
      {listNote ? <Notice tone={listNote.problem ? 'problem' : 'info'} text={listNote.text} /> : null}
      {shown.some((r) => r.source === 'manual') && !editing ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          Tap a reading you logged to change it.
        </ThemedText>
      ) : null}
      {shown.some((r) => r.source !== 'manual') ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          Readings from {vitals.label ?? 'another app'} change only in the app that made them.
        </ThemedText>
      ) : null}
      <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
        Not a diagnosis. Talk to your doctor about your readings.
      </ThemedText>
    </>
  );
}

/** The reading's numbers and time: empty for a new one, filled in to change one. */
function BpForm({
  initial,
  actionLabel,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: BloodPressureEntry;
  actionLabel: string;
  onSave: (r: Reading) => void | Promise<void>;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const [systolic, setSystolic] = useState<number | null>(initial?.systolic ?? null);
  const [diastolic, setDiastolic] = useState<number | null>(initial?.diastolic ?? null);
  const [pulse, setPulse] = useState<number | null>(initial?.pulse ?? null);
  /** Null is "now", whenever Save is tapped. */
  const [at, setAt] = useState<number | null>(initial?.loggedAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const now = useNow();

  const problem = systolic !== null && diastolic !== null ? checkBp(systolic, diastolic, pulse) : null;
  const preview = systolic !== null && diastolic !== null && !problem ? bpCategory(systolic, diastolic) : null;

  const save = async () => {
    const message = checkBp(systolic, diastolic, pulse);
    if (message) {
      setError(message);
      return;
    }
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      await onSave({
        systolic: Math.round(systolic!),
        diastolic: Math.round(diastolic!),
        pulse: pulse === null ? null : Math.round(pulse),
        at: at ?? timeNow(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <NumberField label="Top number (systolic)" value={systolic} unit="mmHg" onCommit={setSystolic} placeholder="120" />
      <NumberField label="Bottom number (diastolic)" value={diastolic} unit="mmHg" onCommit={setDiastolic} placeholder="80" />
      <NumberField label="Pulse (optional)" value={pulse} unit="bpm" onCommit={setPulse} placeholder="—" />
      <WhenField value={at ?? now} onChange={setAt} />
      {preview ? <CategoryLine systolic={systolic!} diastolic={diastolic!} category={preview} /> : null}
      {problem || error ? <Notice tone="problem" text={(error ?? problem)!} /> : null}
      <FormActions
        saveLabel={actionLabel}
        onSave={save}
        saveDisabled={systolic === null || diastolic === null}
        saving={saving}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </>
  );
}

/** "128/84 · Elevated", with a mark for the readings to watch; the label always says it too. */
function CategoryLine({
  systolic,
  diastolic,
  category,
}: {
  systolic: number;
  diastolic: number;
  category: ReturnType<typeof bpCategory>;
}) {
  const theme = useTheme();
  const { label, tone } = BP_CATEGORY[category];
  const mark = tone === 'high' ? theme.over : tone === 'watch' ? theme.near : theme.steps;
  return (
    <View style={styles.category} accessible accessibilityLabel={`${systolic} over ${diastolic} is in the ${label.toLowerCase()} range`}>
      <View style={[styles.dot, { backgroundColor: mark }]} />
      <ThemedText type="labelLarge">
        {systolic}/{diastolic} · {label}
      </ThemedText>
    </View>
  );
}

function Average({ label, avg }: { label: string; avg: BpAverage | null }) {
  if (!avg) return null;
  return (
    <StatTile
      label={label}
      value={`${avg.systolic}/${avg.diastolic}`}
      note={`${BP_CATEGORY[bpCategory(avg.systolic, avg.diastolic)].label} · ${avg.count} ${avg.count === 1 ? 'reading' : 'readings'}`}
      style={styles.tile}
      accessibilityLabel={`${label}: ${avg.systolic} over ${avg.diastolic} on average, ${avg.count} readings`}
    />
  );
}

/** Very high readings get plain next steps, following the AHA's advice for readings over 180/120. */
function SevereWarning({ reading }: { reading: BloodPressureEntry }) {
  const theme = useTheme();
  const ink = { color: theme.onErrorContainer };
  return (
    <View style={[styles.warning, { backgroundColor: theme.errorContainer }]} accessibilityRole="alert">
      <View style={styles.warningHead}>
        <Ionicons name="warning-outline" size={24} color={theme.onErrorContainer} />
        <ThemedText type="titleMedium" style={[styles.flex, ink]}>
          {reading.systolic}/{reading.diastolic} is very high
        </ThemedText>
      </View>
      <Step n={1} text="Sit quietly for 5 minutes and measure again." />
      <Step n={2} text="If it stays this high, contact a doctor today." />
      <ThemedText type="bodyMedium" style={ink}>
        Chest pain, short of breath, back pain, numbness, weakness, a change in vision or trouble speaking?
      </ThemedText>
      <ThemedText type="titleMedium" style={ink}>
        Call 108 or 112 now.
      </ThemedText>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.step}>
      <ThemedText type="labelLarge" style={{ color: theme.onErrorContainer }}>
        {n}.
      </ThemedText>
      <ThemedText type="bodyLarge" style={[styles.flex, { color: theme.onErrorContainer }]}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: Spacing.two },
  tile: { flexBasis: 0, minWidth: 0 },
  category: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 10, height: 10, borderRadius: 5 },
  warning: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two },
  warningHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  step: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
