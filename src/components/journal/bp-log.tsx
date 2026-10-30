import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, NumberField, Segmented } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { type BloodPressureEntry, newId } from '@/data/types';
import { vitalsSource } from '@/health/vitals';
import { useTheme } from '@/hooks/use-theme';
import { averageBp, BP_CATEGORY, bpCategory, type BpAverage, checkBp } from '@/lib/blood-pressure';
import { useApp } from '@/state/app-state';
import { useVitalsConnection } from '@/state/use-vitals';

const HISTORY_DAYS = 30;
const DAY_MS = 86_400_000;

const WHEN: { value: string; label: string; minutesAgo: number }[] = [
  { value: '0', label: 'Now', minutesAgo: 0 },
  { value: '30', label: '30 min ago', minutesAgo: 30 },
  { value: '60', label: '1 h ago', minutesAgo: 60 },
  { value: '120', label: '2 h ago', minutesAgo: 120 },
];

const takenAt = (when: string) => new Date(Date.now() - WHEN.find((w) => w.value === when)!.minutesAgo * 60_000);

const when = (ms: number) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export function BloodPressureLog() {
  const { repo, dataVersion, touch } = useApp();
  const theme = useTheme();
  const vitals = useVitalsConnection();
  const [readings, setReadings] = useState<BloodPressureEntry[]>([]);
  const [systolic, setSystolic] = useState<number | null>(null);
  const [diastolic, setDiastolic] = useState<number | null>(null);
  const [pulse, setPulse] = useState<number | null>(null);
  const [whenValue, setWhen] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<BloodPressureEntry | null>(null);
  const [since, setSince] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    const now = Date.now();
    repo.getBloodPressure(now - HISTORY_DAYS * DAY_MS, now + 1).then((r) => {
      if (!live) return;
      setReadings(r);
      setSince(now);
    });
    return () => {
      live = false;
    };
  }, [repo, dataVersion]);

  const problem = systolic !== null && diastolic !== null ? checkBp(systolic, diastolic, pulse) : null;
  const preview = systolic !== null && diastolic !== null && !problem ? bpCategory(systolic, diastolic) : null;

  const save = async () => {
    const message = checkBp(systolic, diastolic, pulse);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    const at = takenAt(whenValue);
    let healthId: string | null = null;
    if (vitalsSource && vitals.connected) {
      try {
        healthId = await vitalsSource.writeBloodPressure(systolic!, diastolic!, at);
      } catch {
        setError(`Saved here, but couldn't copy it to ${vitalsSource.label}.`);
      }
    }
    const entry: BloodPressureEntry = {
      id: newId(),
      loggedAt: at.getTime(),
      systolic: Math.round(systolic!),
      diastolic: Math.round(diastolic!),
      pulse: pulse === null ? null : Math.round(pulse),
      source: 'manual',
      healthId,
      updatedAt: Date.now(),
    };
    await repo.saveBloodPressure(entry);
    setWarning(bpCategory(entry.systolic, entry.diastolic) === 'severe' ? entry : null);
    setSystolic(null);
    setDiastolic(null);
    setPulse(null);
    setWhen('0');
    touch();
  };

  const remove = async (entry: BloodPressureEntry) => {
    if (entry.healthId && vitalsSource) await vitalsSource.deleteBloodPressure(entry).catch(() => undefined);
    await repo.deleteBloodPressure(entry.id);
    if (warning?.id === entry.id) setWarning(null);
    touch();
  };

  const week = since === null ? null : averageBp(readings.filter((r) => r.loggedAt >= since - 7 * DAY_MS));
  const month = averageBp(readings);

  return (
    <>
      {warning ? <SevereWarning reading={warning} /> : null}

      <Card title="New reading">
        <NumberField label="Top number (systolic)" value={systolic} unit="mmHg" onCommit={setSystolic} placeholder="120" />
        <NumberField label="Bottom number (diastolic)" value={diastolic} unit="mmHg" onCommit={setDiastolic} placeholder="80" />
        <NumberField label="Pulse (optional)" value={pulse} unit="bpm" onCommit={setPulse} placeholder="—" />
        <Segmented options={WHEN} value={whenValue} onChange={setWhen} />
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
        <Button label="Save reading" onPress={save} disabled={systolic === null || diastolic === null} />
        <ThemedText type="small" themeColor="textSecondary">
          For a steady reading: sit quietly for 5 minutes first, back supported, feet flat, arm resting at heart height.
          Take two readings a minute apart and log both.
        </ThemedText>
      </Card>

      <Card title="Your readings">
        {readings.length === 0 ? (
          <ThemedText themeColor="textSecondary">No readings in the last {HISTORY_DAYS} days.</ThemedText>
        ) : (
          <>
            <Average label="Last 7 days" avg={week} />
            <Average label={`Last ${HISTORY_DAYS} days`} avg={month} />
            {readings.map((r) => (
              <View key={r.id} style={styles.entry}>
                <View style={styles.entryText}>
                  <ThemedText>
                    {r.systolic}/{r.diastolic} mmHg{r.pulse ? ` · pulse ${r.pulse}` : ''}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {when(r.loggedAt)} · {BP_CATEGORY[bpCategory(r.systolic, r.diastolic)].label}
                    {r.source === 'health' ? ` · from ${vitals.label ?? 'another app'}` : ''}
                  </ThemedText>
                </View>
                {r.source === 'manual' ? (
                  <Pressable
                    onPress={() => remove(r)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${r.systolic} over ${r.diastolic}`}
                    hitSlop={10}>
                    <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          Ranges are the American Heart Association&apos;s for adults. One reading says little on its own; what matters is
          how your numbers run over weeks. This isn&apos;t a diagnosis. Talk to your doctor about your readings.
        </ThemedText>
      </Card>
    </>
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
});
