import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { confirmDelete } from '@/components/confirm';
import { Button, TextField } from '@/components/controls';
import { MoodPicker, moodEmoji, moodLabel } from '@/components/mood-picker';
import { ThemedText } from '@/components/themed-text';
import { WhenField } from '@/components/when-field';
import { Spacing } from '@/constants/theme';
import { saveMood } from '@/data/entries';
import type { DaySummary, Mood, MoodEntry } from '@/data/types';
import { useClockStyle } from '@/hooks/use-clock-style';
import { useTheme } from '@/hooks/use-theme';
import { addDays, addDaysToKey, dayKey, formatDayLong } from '@/lib/dates';
import { formatSteps } from '@/lib/format';
import { BACK_DAYS, capAt, formatClock } from '@/lib/when';
import { useMoodToday } from '@/state/use-mood';
import { useApp } from '@/state/app-state';

const HISTORY_DAYS = 14;

interface Note {
  text: string;
  problem: boolean;
}

/** Which mood is open for changes: one from the list (by day), or a new one for an earlier day. */
type Editing = { kind: 'entry'; date: string } | { kind: 'new'; at: number };

export function MoodLog() {
  const { repo, dataVersion, touch } = useApp();
  const theme = useTheme();
  const clock = useClockStyle();
  const { mood, setMood, setNote, reminderOff, turnOnReminder } = useMoodToday();
  const [note, setNoteText] = useState(mood?.note ?? '');
  const [loadedNote, setLoadedNote] = useState(mood?.note ?? null);
  const [history, setHistory] = useState<{ entry: MoodEntry; day: DaySummary | undefined }[]>([]);
  /** Every day of the last year with a mood, so saving onto an older day says it replaces that day's. */
  const [moodDays, setMoodDays] = useState<string[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [listNote, setListNote] = useState<Note | null>(null);
  /** Deleted days, off the list before the next read. */
  const [gone, setGone] = useState<string[]>([]);
  const todayKey = dayKey(new Date());

  // Pick up the saved note once it loads, without overwriting typing.
  if ((mood?.note ?? null) !== loadedNote) {
    setLoadedNote(mood?.note ?? null);
    setNoteText(mood?.note ?? '');
  }

  useEffect(() => {
    let live = true;
    (async () => {
      const from = addDaysToKey(todayKey, -HISTORY_DAYS);
      // Today too, so today's mood can be changed or deleted like the rest.
      const [year, days] = await Promise.all([
        repo.getMoods(addDaysToKey(todayKey, -BACK_DAYS), todayKey),
        repo.getDays(from, todayKey),
      ]);
      const byDate = new Map(days.map((d) => [d.date, d]));
      const moods = year.filter((m) => m.date >= from);
      if (!live) return;
      setMoodDays(year.map((m) => m.date));
      setHistory(moods.reverse().map((entry) => ({ entry, day: byDate.get(entry.date) })));
    })();
    return () => {
      live = false;
    };
  }, [repo, todayKey, dataVersion]);

  const shown = history.filter((h) => !gone.includes(h.entry.date));
  const has = (date: string) => moodDays.includes(date) && !gone.includes(date);

  const save = async (before: MoodEntry | null, after: Omit<MoodEntry, 'date'>) => {
    setListNote(null);
    try {
      const entry = await saveMood(repo, before, after);
      setGone((g) => g.filter((d) => d !== entry.date));
      setEditing(null);
      if (entry.date < addDaysToKey(todayKey, -HISTORY_DAYS)) {
        setListNote({ text: `Saved for ${formatDayLong(entry.date)}. Only the last two weeks are listed here.`, problem: false });
      }
    } catch {
      setListNote({ text: "Couldn't save that. Please try again.", problem: true });
    }
    touch();
  };

  const remove = async (entry: MoodEntry) => {
    setGone((g) => [...g, entry.date]);
    setEditing(null);
    setListNote(null);
    try {
      await repo.deleteMood(entry.date);
    } catch {
      setGone((g) => g.filter((d) => d !== entry.date));
      setListNote({ text: "Couldn't delete that mood. Please try again.", problem: true });
    }
    touch();
  };

  const askRemove = (entry: MoodEntry) => confirmDelete('mood', () => remove(entry));

  /** A day with no mood yet; yesterday at this time to start, since today has the card above. */
  const addEarlier = () => {
    setListNote(null);
    const now = new Date();
    setEditing({ kind: 'new', at: capAt(addDays(now, -1).setHours(now.getHours(), now.getMinutes(), 0, 0), now.getTime()) });
  };

  return (
    <>
      <Card title="How are you feeling today?">
        <MoodPicker value={mood?.mood ?? null} onChange={(m: Mood) => setMood(m)} />
        {mood ? (
          <TextField
            label="Note"
            value={note}
            onChangeText={setNoteText}
            onEndEditing={() => setNote(note)}
            placeholder="Anything behind it? Sleep, work, a good walk… (optional)"
            multiline
          />
        ) : null}
        {mood && reminderOff ? <Button kind="secondary" label="Remind me each evening" onPress={turnOnReminder} /> : null}
        <ThemedText type="small" themeColor="textSecondary">
          After a week or so, Insights shows how your mood and your walking line up.
        </ThemedText>
      </Card>

      <Card title="Last two weeks">
        {editing?.kind === 'new' ? (
          <View style={[styles.editing, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">A mood for an earlier day</ThemedText>
            <MoodForm
              initialAt={editing.at}
              replaces={has}
              onSave={(after) => save(null, after)}
              onCancel={() => setEditing(null)}
            />
          </View>
        ) : null}
        {shown.length === 0 ? (
          <ThemedText themeColor="textSecondary">No moods logged yet.</ThemedText>
        ) : (
          shown.map(({ entry, day }) =>
            editing?.kind === 'entry' && editing.date === entry.date ? (
              <View key={entry.date} style={[styles.editing, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold">Change this mood</ThemedText>
                <MoodForm
                  entry={entry}
                  initialAt={entry.loggedAt}
                  replaces={(date) => date !== entry.date && has(date)}
                  onSave={(after) => save(entry, after)}
                  onCancel={() => setEditing(null)}
                  onDelete={() => askRemove(entry)}
                />
              </View>
            ) : (
              <Pressable
                key={entry.date}
                onPress={() => {
                  setListNote(null);
                  setEditing({ kind: 'entry', date: entry.date });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${entry.date === todayKey ? 'Today' : formatDayLong(entry.date)}, ${moodLabel(entry.mood)}. Tap to change or delete it.`}
                style={styles.entry}>
                <Text style={styles.emoji}>{moodEmoji(entry.mood)}</Text>
                <View style={styles.entryText}>
                  <ThemedText>
                    {entry.date === todayKey ? 'Today' : formatDayLong(entry.date)} · {moodLabel(entry.mood)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatClock(entry.loggedAt, clock)} · {day ? `${formatSteps(day.steps)} steps` : 'No steps recorded'}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => askRemove(entry)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete the mood for ${formatDayLong(entry.date)}`}
                  hitSlop={10}>
                  <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
                </Pressable>
              </Pressable>
            ),
          )
        )}
        {listNote ? (
          <ThemedText type="small" themeColor="textSecondary" style={listNote.problem ? { color: theme.danger } : undefined}>
            {listNote.text}
          </ThemedText>
        ) : null}
        {!editing ? (
          <>
            {shown.length ? (
              <ThemedText type="small" themeColor="textSecondary">
                Tap a day to change its mood or delete it.
              </ThemedText>
            ) : null}
            <Button kind="secondary" label="Missed a day? Add a mood for it" onPress={addEarlier} />
          </>
        ) : null}
      </Card>
    </>
  );
}

/** A day's mood, note and time: filled in to change one, or blank for a new one. */
function MoodForm({
  entry,
  initialAt,
  replaces,
  onSave,
  onCancel,
  onDelete,
}: {
  entry?: MoodEntry;
  initialAt: number;
  /** Whether that day already has a mood, which saving replaces. */
  replaces: (date: string) => boolean;
  onSave: (after: Omit<MoodEntry, 'date'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [mood, setMood] = useState<Mood | null>(entry?.mood ?? null);
  const [note, setNote] = useState(entry?.note ?? '');
  const [at, setAt] = useState(initialAt);
  // A time left as it was keeps the mood's own day (lib/entries.ts saveMood).
  const day = entry && at === entry.loggedAt ? entry.date : dayKey(new Date(at));

  return (
    <>
      <MoodPicker value={mood} onChange={setMood} />
      <TextField label="Note" value={note} onChangeText={setNote} placeholder="Anything behind it? (optional)" multiline />
      <WhenField value={at} onChange={setAt} />
      {replaces(day) ? (
        <ThemedText type="small" themeColor="textSecondary">
          That day already has a mood; saving replaces it.
        </ThemedText>
      ) : null}
      <Button
        label="Save"
        onPress={() => mood !== null && onSave({ mood, note: note.trim() || null, loggedAt: at })}
        disabled={mood === null}
      />
      <Button kind="secondary" label="Cancel" onPress={onCancel} />
      {onDelete ? <Button kind="danger" label="Delete this mood" onPress={onDelete} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  entryText: { flex: 1, gap: Spacing.half },
  emoji: { fontSize: 26, lineHeight: 32 },
  editing: { gap: Spacing.three, borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: Spacing.three },
});
