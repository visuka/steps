import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { Card } from '@/components/card';
import { confirmDelete } from '@/components/confirm';
import { Button } from '@/components/controls';
import { ConnectHealth } from '@/components/journal/connect-health';
import { MoodPicker, moodEmoji } from '@/components/mood-picker';
import { ThemedText } from '@/components/themed-text';
import { WhenField } from '@/components/when-field';
import { Spacing } from '@/constants/theme';
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

const REPLACES = 'That morning already has a night you logged; saving replaces it.';
const watchHas = (store: string) => `That morning already has a night from ${store}. Pick another date.`;

/** The morning a night counts toward; a wake-up time left as it was keeps the night's own. */
const morningFor = (wakeAt: number, entry: SleepEntry | null) =>
  entry && wakeAt === entry.endAt ? entry.date : nightOf(wakeAt);

export function SleepLog() {
  const { repo, dataVersion, touch } = useApp();
  const theme = useTheme();
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
      <Card title="Last night">
        {watchNight ? (
          <>
            <ThemedText style={styles.big}>{formatSleep(watchNight.asleepMin)}</ThemedText>
            <ThemedText themeColor="textSecondary">
              {formatClock(watchNight.bedAt, clock)} to {formatClock(watchNight.wakeAt, clock)}, from {store}
            </ThemedText>
            {watchNight.stages ? <StageLine stages={watchNight.stages} /> : null}
          </>
        ) : bedAt !== null && wakeAt !== null ? (
          <NightTimes
            bedAt={bedAt}
            wakeAt={wakeAt}
            onBed={(v) => setDraft((d) => ({ ...d, bedAt: v }))}
            onWake={(v) => setDraft((d) => ({ ...d, wakeAt: v }))}
          />
        ) : null}
        {problem ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {problem}
          </ThemedText>
        ) : null}
        {clash === 'health' ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {watchHas(store)}
          </ThemedText>
        ) : clash === 'manual' ? (
          <ThemedText type="small" themeColor="textSecondary">
            {REPLACES}
          </ThemedText>
        ) : null}
        {saved && morningOf !== today ? (
          <ThemedText type="small" themeColor="textSecondary">
            This saves a night for the morning of {formatDayLong(morningOf)}. Last night stays as it is.
          </ThemedText>
        ) : null}

        <ThemedText type="smallBold">How rested do you feel?</ThemedText>
        <MoodPicker value={rested} onChange={(m) => setDraft((d) => ({ ...d, rested: m }))} />

        {!saved || changed ? (
          <Button
            label={saved && morningOf === today ? 'Save changes' : 'Save'}
            onPress={save}
            disabled={!watchNight && (bedAt === null || wakeAt === null || problem !== null || clash === 'health')}
          />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Saved. Change anything above to update it.
          </ThemedText>
        )}
        {cardNote ? <NoteText note={cardNote} /> : null}
        {!watchNight && !saved ? (
          <ThemedText type="small" themeColor="textSecondary">
            Times are a guess from when your phone stopped and started moving. Tap a time to change its date or time.
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
            {[...nights].reverse().map((n) => {
              const own = n.fromHealth ? null : manualOn(n.date);
              if (own && editing === own.id) {
                return (
                  <View key={n.date} style={[styles.editing, { borderColor: theme.backgroundSelected }]}>
                    <ThemedText type="smallBold">Change this night</ThemedText>
                    <NightForm
                      entry={own}
                      clash={(morning) => nightClash(all, morning, own.id)}
                      store={store}
                      onSave={(night) => change(own, night)}
                      onCancel={() => setEditing(null)}
                      onDelete={() => askRemove(own)}
                    />
                  </View>
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
                  color={theme.textSecondary}
                />
              );
            })}
          </>
        )}
        {listNote ? <NoteText note={listNote} /> : null}
        {nights.some((n) => !n.fromHealth) && !editing ? (
          <ThemedText type="small" themeColor="textSecondary">
            Tap a night you logged to change it or delete it.
          </ThemedText>
        ) : null}
        {nights.some((n) => n.fromHealth) ? (
          <ThemedText type="small" themeColor="textSecondary">
            Nights from {store} can only be changed in the app that made them.
          </ThemedText>
        ) : null}
      </Card>
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
        <ThemedText themeColor="textSecondary">About {formatSleep((wakeAt - bedAt) / 60_000)} of sleep.</ThemedText>
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
  const theme = useTheme();
  const [bedAt, setBedAt] = useState(entry.startAt);
  const [wakeAt, setWakeAt] = useState(entry.endAt);
  const [rested, setRested] = useState<Mood | null>(entry.rested);
  const problem = checkNight(bedAt, wakeAt, Infinity);
  const there = clash(morningFor(wakeAt, entry));

  return (
    <>
      <NightTimes bedAt={bedAt} wakeAt={wakeAt} onBed={setBedAt} onWake={setWakeAt} />
      {problem ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {problem}
        </ThemedText>
      ) : null}
      {there === 'health' ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {watchHas(store)}
        </ThemedText>
      ) : there === 'manual' ? (
        <ThemedText type="small" themeColor="textSecondary">
          {REPLACES}
        </ThemedText>
      ) : null}
      <ThemedText type="smallBold">How rested did you feel?</ThemedText>
      <MoodPicker value={rested} onChange={setRested} />
      <Button
        label="Save"
        onPress={() => onSave({ bedAt, wakeAt, rested })}
        disabled={problem !== null || there === 'health'}
      />
      <Button kind="secondary" label="Cancel" onPress={onCancel} />
      <Button kind="danger" label="Delete this night" onPress={onDelete} />
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
    <ThemedText type="small" themeColor="textSecondary">
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
  color,
}: {
  night: Night;
  clock: ClockStyle;
  from: string;
  onPress?: () => void;
  onDelete?: () => void;
  color: string;
}) {
  const title = `${formatDayLong(night.date)} · ${formatSleep(night.asleepMin)}${night.rested ? ` ${moodEmoji(night.rested)}` : ''}`;
  const detail = `${formatClock(night.bedAt, clock)} to ${formatClock(night.wakeAt, clock)}${night.fromHealth ? ` · from ${from}` : ''}`;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}, ${detail}.${onPress ? ' Tap to change or delete it.' : ''}`}
      style={styles.night}>
      <View style={styles.nightText}>
        <ThemedText>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel={`Delete ${formatDayLong(night.date)}`} hitSlop={10}>
          <Ionicons name="trash-outline" size={20} color={color} />
        </Pressable>
      ) : null}
    </Pressable>
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
  big: { fontSize: 32, lineHeight: 40, fontWeight: 700, fontVariant: ['tabular-nums'] },
  night: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  nightText: { flex: 1, gap: Spacing.half },
  editing: { gap: Spacing.three, borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: Spacing.three },
});
