import { useEffect, useState } from 'react';

import { confirmDelete } from '@/components/confirm';
import { TextField } from '@/components/controls';
import { EditPanel, EntryList, EntryRow, FormActions } from '@/components/journal/entry-parts';
import { MoodFace, MoodPicker, moodLabel } from '@/components/mood-picker';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Notice, SectionHeader, Why } from '@/components/ui';
import { WhenField } from '@/components/when-field';
import { saveMood } from '@/data/entries';
import type { DaySummary, Mood, MoodEntry } from '@/data/types';
import { useClockStyle } from '@/hooks/use-clock-style';
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
      <Card
        title="How are you feeling today?"
        right={<Why title="Why log mood?" text="After a week or so, Insights shows how your mood and your walking line up." />}>
        <MoodPicker value={mood?.mood ?? null} onChange={(m: Mood) => setMood(m)} />
        {mood ? (
          <TextField
            label="Note"
            value={note}
            onChangeText={setNoteText}
            onEndEditing={() => setNote(note)}
            placeholder="Anything behind it? (optional)"
            multiline
          />
        ) : null}
        {mood && reminderOff ? (
          <Button variant="tonal" icon="notifications-outline" label="Remind me each evening" onPress={turnOnReminder} />
        ) : null}
      </Card>

      <SectionHeader title="Last two weeks" action={editing ? undefined : { label: 'Add a day', onPress: addEarlier }} />
      {editing?.kind === 'new' ? (
        <EntryList>
          <EditPanel title="A mood for an earlier day">
            <MoodForm
              initialAt={editing.at}
              replaces={has}
              onSave={(after) => save(null, after)}
              onCancel={() => setEditing(null)}
            />
          </EditPanel>
        </EntryList>
      ) : null}
      {shown.length === 0 ? (
        <EmptyState icon="happy-outline" title="No moods logged yet" hint="Pick a face above to start." />
      ) : (
        <EntryList>
          {shown.map(({ entry, day }) => {
            const when = entry.date === todayKey ? 'Today' : formatDayLong(entry.date);
            if (editing?.kind === 'entry' && editing.date === entry.date) {
              return (
                <EditPanel key={entry.date} title="Change this mood">
                  <MoodForm
                    entry={entry}
                    initialAt={entry.loggedAt}
                    replaces={(date) => date !== entry.date && has(date)}
                    onSave={(after) => save(entry, after)}
                    onCancel={() => setEditing(null)}
                    onDelete={() => askRemove(entry)}
                  />
                </EditPanel>
              );
            }
            return (
              <EntryRow
                key={entry.date}
                leading={<MoodFace mood={entry.mood} size={28} />}
                title={`${when} · ${moodLabel(entry.mood)}`}
                supporting={`${formatClock(entry.loggedAt, clock)} · ${day ? `${formatSteps(day.steps)} steps` : 'No steps recorded'}${
                  entry.note ? ` · ${entry.note}` : ''
                }`}
                onPress={() => {
                  setListNote(null);
                  setEditing({ kind: 'entry', date: entry.date });
                }}
                onDelete={() => askRemove(entry)}
                deleteLabel={`Delete the mood for ${formatDayLong(entry.date)}`}
              />
            );
          })}
        </EntryList>
      )}
      {listNote ? <Notice tone={listNote.problem ? 'problem' : 'info'} text={listNote.text} /> : null}
      {shown.length && !editing ? (
        <ThemedText type="bodySmall" themeColor="onSurfaceVariant">
          Tap a day to change its mood. Missed one? Tap Add a day.
        </ThemedText>
      ) : null}
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
      {replaces(day) ? <Notice text="That day already has a mood. Saving replaces it." /> : null}
      <FormActions
        onSave={() => mood !== null && onSave({ mood, note: note.trim() || null, loggedAt: at })}
        saveDisabled={mood === null}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </>
  );
}
