import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { confirmDelete } from '@/components/confirm';
import { ConnectHealth } from '@/components/journal/connect-health';
import { EditPanel, EntryList, EntryRow, FieldLabel, FormActions } from '@/components/journal/entry-parts';
import { MoodFace, MoodPicker } from '@/components/mood-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Notice, SectionHeader, Why } from '@/components/ui';
import { WhenField } from '@/components/when-field';
import { NumeralMaxScale, Spacing } from '@/constants/theme';
import { saveLastNight, saveNight } from '@/data/entries';
import type { Mood, SleepEntry, SleepStages } from '@/data/types';
import { useClockStyle } from '@/hooks/use-clock-style';
import { useTheme } from '@/hooks/use-theme';
import { addDaysToKey, dayKey, formatDayLong, weekdayShort } from '@/lib/dates';
import { checkNight, formatSleep, guessSleepWindow, type Night, nightClash, nightOf, nightsByDate } from '@/lib/sleep';
import { FULL_NIGHT_MIN } from '@/lib/vitals-insights';
import { BACK_DAYS, type ClockStyle, formatClock, timeNow } from '@/lib/when';
import { useApp } from '@/state/app-state';
import { useVitalsConnection } from '@/state/use-vitals';

const HISTORY_NIGHTS = 14;

interface Draft {
  bedAt?: number;
  wakeAt?: number;
  rested?: Mood | null;
}

interface Note {
  text: string;
  problem: boolean;
}

const REPLACES = 'That morning already has a night you logged. Saving replaces it.';
const watchHas = (store: string) => `That morning already has a night from ${store}. Pick another date.`;
const GUESS_WHY =
  'The times are a guess from when your phone stopped and started moving. Tap a time to change its date or time.';
const CHART_WHY = 'The dashed line is 7 hours, the least most adults are advised to get.';

/** The morning a night counts toward; a wake-up time left as it was keeps the night's own. */
const morningFor = (wakeAt: number, entry: SleepEntry | null) =>
  entry && wakeAt === entry.endAt ? entry.date : nightOf(wakeAt);

export function SleepLog() {
  const { repo, dataVersion, touch } = useApp();
  const clock = useClockStyle();
  const vitals = useVitalsConnection();
  /** A year of nights: the list shows two weeks, the rest is to see what a night saved for an older morning would replace. */
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [guess, setGuess] = useState<{ bedAt: number; wakeAt: number } | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [cardNote, setCardNote] = useState<Note | null>(null);
  /** The id of the night open for changes. */
  const [editing, setEditing] = useState<string | null>(null);
  const [listNote, setListNote] = useState<Note | null>(null);
  /** Deleted, so off the list before the next read. */
  const [gone, setGone] = useState<string[]>([]);
  const today = dayKey(new Date());

  useEffect(() => {
    let live = true;
    (async () => {
      const [list, evening, morning] = await Promise.all([
        repo.getSleep(addDaysToKey(today, -BACK_DAYS), today),
        repo.getHourly(addDaysToKey(today, -1)),
        repo.getHourly(today),
      ]);
      if (!live) return;
      setEntries(list);
      setGuess(guessSleepWindow(today, evening, morning, timeNow()));
    })();
    return () => {
      live = false;
    };
  }, [repo, today, dataVersion]);

  const all = entries.filter((e) => !gone.includes(e.id));
  const listFrom = addDaysToKey(today, -HISTORY_NIGHTS);
  const nights = nightsByDate(all.filter((e) => e.date >= listFrom));
  const lastNight = nights.find((n) => n.date === today) ?? null;
  const watchNight = lastNight?.fromHealth ? lastNight : null;
  const saved = all.find((e) => e.date === today && e.source === 'manual') ?? null;
  const manualOn = (date: string) => all.find((e) => e.date === date && e.source === 'manual') ?? null;
  const store = vitals.label ?? 'your watch';
  /** Said after saving for a morning older than the list goes back. */
  const outsideList = (date: string) => (date < listFrom ? ' Only the last two weeks are listed here.' : '');

  const bedAt = draft.bedAt ?? saved?.startAt ?? guess?.bedAt ?? null;
  const wakeAt = draft.wakeAt ?? saved?.endAt ?? guess?.wakeAt ?? null;
  const rested = draft.rested !== undefined ? draft.rested : (saved?.rested ?? null);
  const changed = Object.keys(draft).length > 0;
  // The pickers never go past now, so only the order and length can be wrong here.
  const problem = !watchNight && bedAt !== null && wakeAt !== null ? checkNight(bedAt, wakeAt, Infinity) : null;
  const morningOf = !watchNight && wakeAt !== null ? morningFor(wakeAt, saved) : today;
  const clash = watchNight ? null : nightClash(all, morningOf, saved?.id ?? null);

  const save = async () => {
    const start = watchNight?.bedAt ?? bedAt;
    const end = watchNight?.wakeAt ?? wakeAt;
    if (start === null || end === null) return;
    if (!watchNight && (checkNight(start, end, timeNow()) || clash === 'health')) return;
    try {
      // This morning's night is changed; times for another morning add a night there instead.
      const entry = await saveLastNight(repo, saved, {
        startAt: start,
        endAt: end,
        asleepMin: watchNight?.asleepMin,
        rested,
      });
      // Its id is the morning's, which may have been deleted earlier.
      setGone((g) => g.filter((id) => id !== entry.id));
      setDraft({});
      setCardNote(
        entry.date === today
          ? null
          : { text: `Saved for the morning of ${formatDayLong(entry.date)}.${outsideList(entry.date)}`, problem: false },
      );
    } catch {
      setCardNote({ text: "Couldn't save that. Please try again.", problem: true });
    }
    touch();
  };

  const change = async (before: SleepEntry, night: { bedAt: number; wakeAt: number; rested: Mood | null }) => {
    if (checkNight(night.bedAt, night.wakeAt, timeNow())) return;
    if (nightClash(all, morningFor(night.wakeAt, before), before.id) === 'health') return;
    setListNote(null);
    try {
      const entry = await saveNight(repo, before, { startAt: night.bedAt, endAt: night.wakeAt, rested: night.rested });
      setGone((g) => g.filter((id) => id !== entry.id));
      setEditing(null);
      if (entry.date !== before.date) {
        setListNote({ text: `Moved to the morning of ${formatDayLong(entry.date)}.${outsideList(entry.date)}`, problem: false });
      }
    } catch {
      setListNote({ text: "Couldn't save that change. Please try again.", problem: true });
    }
    touch();
  };

  const remove = async (entry: SleepEntry) => {
    setGone((g) => [...g, entry.id]);
    setEditing((id) => (id === entry.id ? null : id));
    setListNote(null);
    try {
      await repo.deleteSleep(entry.id);
    } catch {
      setGone((g) => g.filter((id) => id !== entry.id));
      setListNote({ text: "Couldn't delete that night. Please try again.", problem: true });
    }
    touch();
  };

  const askRemove = (entry: SleepEntry) => confirmDelete('night', () => remove(entry));

  const recent = nights.filter((n) => n.date > addDaysToKey(today, -7));
  const weekAverage = recent.length ? recent.reduce((s, n) => s + n.asleepMin, 0) / recent.length : null;
  const chartDays = Array.from({ length: HISTORY_NIGHTS }, (_, i) => addDaysToKey(today, i - HISTORY_NIGHTS + 1));
  const byDate = new Map(nights.map((n) => [n.date, n]));

  return (
    <>
      <Card title="Last night" right={!watchNight && !saved ? <Why title="Last night" text={GUESS_WHY} /> : undefined}>
        {watchNight ? (
          <View style={styles.hero}>
            <ThemedText type="numeralLarge" maxFontSizeMultiplier={NumeralMaxScale}>
              {formatSleep(watchNight.asleepMin)}
            </ThemedText>
            <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
              {formatClock(watchNight.bedAt, clock)} – {formatClock(watchNight.wakeAt, clock)} · {store}
            </ThemedText>
            {watchNight.stages ? <StageLine stages={watchNight.stages} /> : null}
          </View>
        ) : bedAt !== null && wakeAt !== null ? (
          <NightTimes
            bedAt={bedAt}
            wakeAt={wakeAt}
            onBed={(v) => setDraft((d) => ({ ...d, bedAt: v }))}
            onWake={(v) => setDraft((d) => ({ ...d, wakeAt: v }))}
          />
        ) : null}
        {problem ? <Notice tone="problem" text={problem} /> : null}
        {clash === 'health' ? (
          <Notice tone="problem" text={watchHas(store)} />
        ) : clash === 'manual' ? (
          <Notice text={REPLACES} />
        ) : null}
        {saved && morningOf !== today ? (
          <Notice text={`Saves a night for ${formatDayLong(morningOf)}. Last night stays.`} />
        ) : null}

        <FieldLabel>How rested do you feel?</FieldLabel>
        <MoodPicker value={rested} onChange={(m) => setDraft((d) => ({ ...d, rested: m }))} />

        {!saved || changed ? (
          <Button
            label={saved && morningOf === today ? 'Save changes' : 'Save'}
            onPress={save}
            disabled={!watchNight && (bedAt === null || wakeAt === null || problem !== null || clash === 'health')}
          />
        ) : (
          <Notice tone="done" text="Saved. Change anything above to update it." />
        )}
        {cardNote ? <Notice tone={cardNote.problem ? 'problem' : 'info'} text={cardNote.text} /> : null}
      </Card>

      <ConnectHealth what="sleep and heart rate" />

      <SectionHeader title="Last two weeks" why={nights.length ? CHART_WHY : undefined} />
      {nights.length === 0 ? (
        <EmptyState icon="moon-outline" title="No nights logged yet" hint="Save last night above to start." />
      ) : (
        <>
          <Card>
            {weekAverage !== null ? (
              <View style={styles.value}>
                <ThemedText type="numeralMedium" maxFontSizeMultiplier={NumeralMaxScale}>
                  {formatSleep(weekAverage)}
                </ThemedText>
                <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
                  a night · past week, {recent.length} {recent.length === 1 ? 'night' : 'nights'}
                </ThemedText>
              </View>
            ) : null}
            <BarChart
              bars={chartDays.map((date, i) => ({
                key: date,
                value: byDate.get(date)?.asleepMin ?? 0,
                label: i % 2 === 1 ? weekdayShort(date).slice(0, 2) : '',
              }))}
              goal={FULL_NIGHT_MIN}
              tone="sleep"
              height={90}
            />
          </Card>

          <EntryList>
            {[...nights].reverse().map((n) => {
              const own = n.fromHealth ? null : manualOn(n.date);
              if (own && editing === own.id) {
                return (
                  <EditPanel key={n.date} title="Change this night">
                    <NightForm
                      entry={own}
                      clash={(morning) => nightClash(all, morning, own.id)}
                      store={store}
                      onSave={(night) => change(own, night)}
                      onCancel={() => setEditing(null)}
                      onDelete={() => askRemove(own)}
                    />
                  </EditPanel>
                );
              }
              return (
                <NightRow
                  key={n.date}
                  night={n}
                  clock={clock}
                  from={store}
                  onPress={
                    own
                      ? () => {
                          setListNote(null);
                          setEditing(own.id);
                        }
                      : undefined
                  }
                  onDelete={own ? () => askRemove(own) : undefined}
                />
              );
            })}
          </EntryList>
        </>
      )}
      {listNote ? <Notice tone={listNote.problem ? 'problem' : 'info'} text={listNote.text} /> : null}
      {nights.some((n) => !n.fromHealth) && !editing ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          Tap a night you logged to change it.
        </ThemedText>
      ) : null}
      {nights.some((n) => n.fromHealth) ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          Nights from {store} change only in the app that made them.
        </ThemedText>
      ) : null}
    </>
  );
}

/** Bedtime and wake-up time, each an exact date and time. */
function NightTimes({
  bedAt,
  wakeAt,
  onBed,
  onWake,
}: {
  bedAt: number;
  wakeAt: number;
  onBed: (v: number) => void;
  onWake: (v: number) => void;
}) {
  return (
    <>
      <WhenField label="Went to sleep" value={bedAt} onChange={onBed} />
      <WhenField label="Woke up" value={wakeAt} onChange={onWake} />
      {wakeAt > bedAt ? (
        <View style={styles.value}>
          <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
            About
          </ThemedText>
          <ThemedText type="numeralSmall" maxFontSizeMultiplier={NumeralMaxScale}>
            {formatSleep((wakeAt - bedAt) / 60_000)}
          </ThemedText>
          <ThemedText type="labelLarge" themeColor="onSurfaceVariant">
            of sleep
          </ThemedText>
        </View>
      ) : null}
    </>
  );
}

/** A night someone logged, filled in to change it. */
function NightForm({
  entry,
  clash,
  store,
  onSave,
  onCancel,
  onDelete,
}: {
  entry: SleepEntry;
  /** What saving for that morning would run into (lib/sleep.ts nightClash). */
  clash: (morning: string) => 'health' | 'manual' | null;
  /** Where nights from a watch come from, e.g. "Health Connect". */
  store: string;
  onSave: (night: { bedAt: number; wakeAt: number; rested: Mood | null }) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [bedAt, setBedAt] = useState(entry.startAt);
  const [wakeAt, setWakeAt] = useState(entry.endAt);
  const [rested, setRested] = useState<Mood | null>(entry.rested);
  const problem = checkNight(bedAt, wakeAt, Infinity);
  const there = clash(morningFor(wakeAt, entry));

  return (
    <>
      <NightTimes bedAt={bedAt} wakeAt={wakeAt} onBed={setBedAt} onWake={setWakeAt} />
      {problem ? <Notice tone="problem" text={problem} /> : null}
      {there === 'health' ? <Notice tone="problem" text={watchHas(store)} /> : there === 'manual' ? <Notice text={REPLACES} /> : null}
      <FieldLabel>How rested did you feel?</FieldLabel>
      <MoodPicker value={rested} onChange={setRested} />
      <FormActions
        onSave={() => onSave({ bedAt, wakeAt, rested })}
        saveDisabled={problem !== null || there === 'health'}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </>
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
    <ThemedText type="labelMedium" themeColor="onSurfaceVariant">
      {parts
        .filter(([, min]) => min > 0)
        .map(([label, min]) => `${label} ${formatSleep(min)}`)
        .join(' · ')}
    </ThemedText>
  );
}

function NightRow({
  night,
  clock,
  from,
  onPress,
  onDelete,
}: {
  night: Night;
  clock: ClockStyle;
  from: string;
  onPress?: () => void;
  onDelete?: () => void;
}) {
  const title = `${formatDayLong(night.date)} · ${formatSleep(night.asleepMin)}`;
  const detail = `${formatClock(night.bedAt, clock)} – ${formatClock(night.wakeAt, clock)}${night.fromHealth ? ` · ${from}` : ''}`;
  return (
    <EntryRow
      title={title}
      supporting={detail}
      leading={night.rested ? <MoodFace mood={night.rested} size={28} /> : <NoFace />}
      onPress={onPress}
      onDelete={onDelete}
      deleteLabel={`Delete ${formatDayLong(night.date)}`}
      readOnly={night.fromHealth}
    />
  );
}

/** A night with no "how rested": a moon in the face's place, so the rows line up. */
function NoFace() {
  const theme = useTheme();
  return (
    <View style={styles.noFace}>
      <Ionicons name="moon-outline" size={22} color={theme.onSurfaceVariant} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: Spacing.one },
  value: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: Spacing.two },
  noFace: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
