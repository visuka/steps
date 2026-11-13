import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { confirmDelete } from '@/components/confirm';
import { Button, NumberField } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { WhenField } from '@/components/when-field';
import { Spacing } from '@/constants/theme';
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
  const theme = useTheme();
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

      <Card title="New reading">
        <BpForm key={formKey} actionLabel="Save reading" onSave={add} />
        {addNote ? <NoteText note={addNote} /> : null}
        <ThemedText type="small" themeColor="textSecondary">
          For a steady reading: sit quietly for 5 minutes first, back supported, feet flat, arm resting at heart height.
          Take two readings a minute apart and log both.
        </ThemedText>
      </Card>

      <Card title="Your readings">
        {shown.length === 0 ? (
          <ThemedText themeColor="textSecondary">No readings in the last {HISTORY_DAYS} days.</ThemedText>
        ) : (
          <>
            <Average label="Last 7 days" avg={week} />
            <Average label={`Last ${HISTORY_DAYS} days`} avg={month} />
            {shown.map((r) => {
              const mine = r.source === 'manual';
              if (mine && editing === r.id) {
                return (
                  <View key={r.id} style={[styles.editing, { borderColor: theme.backgroundSelected }]}>
                    <ThemedText type="smallBold">Change this reading</ThemedText>
                    <BpForm
                      initial={r}
                      actionLabel="Save"
                      onSave={(next) => change(r, next)}
                      onCancel={() => setEditing(null)}
                      onDelete={() => askRemove(r)}
                    />
                  </View>
                );
              }
              const label = `${r.systolic}/${r.diastolic} mmHg${r.pulse ? ` · pulse ${r.pulse}` : ''}`;
              const detail = `${formatWhen(r.loggedAt, now, clock)} · ${BP_CATEGORY[bpCategory(r.systolic, r.diastolic)].label}${
                mine ? '' : ` · from ${vitals.label ?? 'another app'}`
              }`;
              const text = (
                <View style={styles.entryText}>
                  <ThemedText>{label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {detail}
                  </ThemedText>
                </View>
              );
              if (!mine) {
                return (
                  <View key={r.id} style={styles.entry}>
                    {text}
                  </View>
                );
              }
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    setListNote(null);
                    setEditing(r.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, ${detail}. Tap to change or delete it.`}
                  style={styles.entry}>
                  {text}
                  <Pressable
                    onPress={() => askRemove(r)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${r.systolic} over ${r.diastolic}`}
                    hitSlop={10}>
                    <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
                  </Pressable>
                </Pressable>
              );
            })}
          </>
        )}
        {listNote ? <NoteText note={listNote} /> : null}
        {shown.some((r) => r.source === 'manual') && !editing ? (
          <ThemedText type="small" themeColor="textSecondary">
            Tap a reading you logged to change it or delete it.
          </ThemedText>
        ) : null}
        {shown.some((r) => r.source !== 'manual') ? (
          <ThemedText type="small" themeColor="textSecondary">
            Readings from {vitals.label ?? 'another app'} can only be changed in the app that made them.
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          Ranges are the American Heart Association&apos;s for adults. One reading says little on its own; what matters is
          how your numbers run over weeks. This isn&apos;t a diagnosis. Talk to your doctor about your readings.
        </ThemedText>
      </Card>
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
  const theme = useTheme();
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
      {preview ? (
        <ThemedText themeColor="textSecondary">
          {systolic}/{diastolic} is in the <CategoryText category={preview} /> range.
        </ThemedText>
      ) : null}
      {problem || error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error ?? problem}
        </ThemedText>
      ) : null}
      <Button label={actionLabel} onPress={save} disabled={systolic === null || diastolic === null || saving} />
      {onCancel ? <Button kind="secondary" label="Cancel" onPress={onCancel} /> : null}
      {onDelete ? <Button kind="danger" label="Delete this reading" onPress={onDelete} /> : null}
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

function CategoryText({ category }: { category: ReturnType<typeof bpCategory> }) {
  const theme = useTheme();
  const { label, tone } = BP_CATEGORY[category];
  return (
    <ThemedText type="smallBold" style={tone === 'high' ? { color: theme.danger } : undefined}>
      {label.toLowerCase()}
    </ThemedText>
  );
}

function Average({ label, avg }: { label: string; avg: BpAverage | null }) {
  if (!avg) return null;
  return (
    <View style={styles.average}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText>
        {avg.systolic}/{avg.diastolic} on average · {BP_CATEGORY[bpCategory(avg.systolic, avg.diastolic)].label} ·{' '}
        {avg.count} {avg.count === 1 ? 'reading' : 'readings'}
      </ThemedText>
    </View>
  );
}

/** Very high readings get plain next steps, following the AHA's advice for readings over 180/120. */
function SevereWarning({ reading }: { reading: BloodPressureEntry }) {
  const theme = useTheme();
  return (
    <Card style={{ borderColor: theme.danger, borderWidth: 1 }}>
      <ThemedText type="smallBold" style={{ color: theme.danger }}>
        {reading.systolic}/{reading.diastolic} is very high
      </ThemedText>
      <ThemedText>Sit quietly for 5 minutes and measure again.</ThemedText>
      <ThemedText>If it stays this high, contact a doctor today.</ThemedText>
      <ThemedText>
        If you also have chest pain, shortness of breath, back pain, numbness or weakness, a change in vision or trouble
        speaking, call 108 or 112 now.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  entryText: { flex: 1, gap: Spacing.half },
  average: { gap: Spacing.half },
  editing: { gap: Spacing.three, borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: Spacing.three },
});
