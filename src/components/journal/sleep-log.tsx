import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { Card } from '@/components/card';
import { Button, Stepper } from '@/components/controls';
import { ConnectHealth } from '@/components/journal/connect-health';
import { MoodPicker, moodEmoji } from '@/components/mood-picker';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Mood, SleepEntry, SleepStages } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { addDaysToKey, dayKey, formatDayLong, parseDayKey, weekdayShort } from '@/lib/dates';
import { formatSleep, guessSleepWindow, type Night, nightsByDate } from '@/lib/sleep';
import { FULL_NIGHT_MIN } from '@/lib/vitals-insights';
import { useApp } from '@/state/app-state';
import { useVitalsConnection } from '@/state/use-vitals';

const HISTORY_NIGHTS = 14;
const QUARTER_MS = 15 * 60_000;
const HOUR_MS = 3_600_000;

/** Only ever called from the Save handler. */
const savedAt = () => Date.now();

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

interface Draft {
  bedAt?: number;
  wakeAt?: number;
  rested?: Mood | null;
}

export function SleepLog() {
  const { repo, dataVersion, touch } = useApp();
  const theme = useTheme();
  const vitals = useVitalsConnection();
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [guess, setGuess] = useState<{ bedAt: number; wakeAt: number } | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const today = dayKey(new Date());

  useEffect(() => {
    let live = true;
    (async () => {
      const [list, evening, morning] = await Promise.all([
        repo.getSleep(addDaysToKey(today, -HISTORY_NIGHTS), today),
        repo.getHourly(addDaysToKey(today, -1)),
        repo.getHourly(today),
      ]);
      if (!live) return;
      setEntries(list);
      setGuess(guessSleepWindow(today, evening, morning, Date.now()));
    })();
    return () => {
      live = false;
    };
  }, [repo, today, dataVersion]);

  const nights = nightsByDate(entries);
  const lastNight = nights.find((n) => n.date === today) ?? null;
  const watchNight = lastNight?.fromHealth ? lastNight : null;
  const saved = entries.find((e) => e.date === today && e.source === 'manual') ?? null;

  const bedAt = draft.bedAt ?? saved?.startAt ?? guess?.bedAt ?? null;
  const wakeAt = draft.wakeAt ?? saved?.endAt ?? guess?.wakeAt ?? null;
  const rested = draft.rested !== undefined ? draft.rested : (saved?.rested ?? null);
  const changed = Object.keys(draft).length > 0;

  const morning = parseDayKey(today).getTime();

  const save = async () => {
    const start = watchNight?.bedAt ?? bedAt;
    const end = watchNight?.wakeAt ?? wakeAt;
    if (start === null || end === null) return;
    await repo.saveSleep({
      // One entry of their own per morning; saving again replaces it.
      id: `sleep-${today}`,
      date: today,
      startAt: start,
      endAt: end,
      asleepMin: watchNight?.asleepMin ?? Math.round((end - start) / 60_000),
      rested,
      source: 'manual',
      healthId: null,
      stages: null,
      updatedAt: savedAt(),
    });
    setDraft({});
    touch();
  };

  const remove = async (date: string) => {
    await repo.deleteSleep(`sleep-${date}`);
    touch();
  };

  const recent = nights.filter((n) => n.date > addDaysToKey(today, -7));
  const weekAverage = recent.length ? recent.reduce((s, n) => s + n.asleepMin, 0) / recent.length : null;
  const chartDays = Array.from({ length: HISTORY_NIGHTS }, (_, i) => addDaysToKey(today, i - HISTORY_NIGHTS + 1));
  const byDate = new Map(nights.map((n) => [n.date, n]));

  return (
    <>
      <Card title="Last night">
        {watchNight ? (
          <>
            <ThemedText style={styles.big}>{formatSleep(watchNight.asleepMin)}</ThemedText>
            <ThemedText themeColor="textSecondary">
              {clock(watchNight.bedAt)} to {clock(watchNight.wakeAt)}, from {vitals.label ?? 'your watch'}
            </ThemedText>
            {watchNight.stages ? <StageLine stages={watchNight.stages} /> : null}
          </>
        ) : bedAt !== null && wakeAt !== null ? (
          <>
            <TimeRow label="Went to sleep">
              <Stepper
                value={bedAt}
                step={QUARTER_MS}
                min={morning - 8 * HOUR_MS}
                max={wakeAt - HOUR_MS}
                format={clock}
                onChange={(v) => setDraft((d) => ({ ...d, bedAt: v }))}
              />
            </TimeRow>
            <TimeRow label="Woke up">
              <Stepper
                value={wakeAt}
                step={QUARTER_MS}
                min={bedAt + HOUR_MS}
                max={morning + 14 * HOUR_MS}
                format={clock}
                onChange={(v) => setDraft((d) => ({ ...d, wakeAt: v }))}
              />
            </TimeRow>
            <ThemedText themeColor="textSecondary">About {formatSleep((wakeAt - bedAt) / 60_000)} of sleep.</ThemedText>
          </>
        ) : null}

        <ThemedText type="smallBold">How rested do you feel?</ThemedText>
        <MoodPicker value={rested} onChange={(m) => setDraft((d) => ({ ...d, rested: m }))} />

        {!saved || changed ? (
          <Button label={saved ? 'Save changes' : 'Save'} onPress={save} disabled={!watchNight && (bedAt === null || wakeAt === null)} />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Saved. Change anything above to update it.
          </ThemedText>
        )}
        {!watchNight && !saved ? (
          <ThemedText type="small" themeColor="textSecondary">
            Times are a guess from when your phone stopped and started moving. Adjust them if they&apos;re off.
          </ThemedText>
        ) : null}
      </Card>

      <ConnectHealth what="sleep and heart rate" />

      <Card title="Last two weeks">
        {nights.length === 0 ? (
          <ThemedText themeColor="textSecondary">No nights logged yet.</ThemedText>
        ) : (
          <>
            {weekAverage !== null ? (
              <ThemedText>
                Past week: {formatSleep(weekAverage)} a night on average ({recent.length}{' '}
                {recent.length === 1 ? 'night' : 'nights'}).
              </ThemedText>
            ) : null}
            <BarChart
              bars={chartDays.map((date, i) => ({
                key: date,
                value: byDate.get(date)?.asleepMin ?? 0,
                label: i % 2 === 1 ? weekdayShort(date).slice(0, 2) : '',
              }))}
              goal={FULL_NIGHT_MIN}
              height={90}
            />
            <ThemedText type="small" themeColor="textSecondary">
              The dashed line is 7 hours, the least most adults are advised to get.
            </ThemedText>
            {[...nights].reverse().map((n) => (
              <NightRow key={n.date} night={n} onDelete={n.fromHealth ? undefined : () => remove(n.date)} color={theme.textSecondary} />
            ))}
          </>
        )}
      </Card>
    </>
  );
}

function TimeRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.timeRow}>
      <ThemedText>{label}</ThemedText>
      {children}
    </View>
  );
}

function StageLine({ stages }: { stages: SleepStages }) {
  const parts = [
    ['Deep', stages.deep],
    ['REM', stages.rem],
    ['Light', stages.light],
    ['Awake', stages.awake],
  ] as const;
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {parts
        .filter(([, min]) => min > 0)
        .map(([label, min]) => `${label} ${formatSleep(min)}`)
        .join(' · ')}
    </ThemedText>
  );
}

function NightRow({ night, onDelete, color }: { night: Night; onDelete?: () => void; color: string }) {
  return (
    <View style={styles.night}>
      <View style={styles.nightText}>
        <ThemedText>
          {formatDayLong(night.date)} · {formatSleep(night.asleepMin)}
          {night.rested ? ` ${moodEmoji(night.rested)}` : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {clock(night.bedAt)} to {clock(night.wakeAt)}
          {night.fromHealth ? ' · from your watch' : ''}
        </ThemedText>
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel={`Delete ${formatDayLong(night.date)}`} hitSlop={10}>
          <Ionicons name="trash-outline" size={20} color={color} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 32, lineHeight: 40, fontWeight: 700, fontVariant: ['tabular-nums'] },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  night: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  nightText: { flex: 1, gap: Spacing.half },
});
