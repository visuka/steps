import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, TextField } from '@/components/controls';
import { MoodPicker, moodEmoji, moodLabel } from '@/components/mood-picker';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { DaySummary, Mood, MoodEntry } from '@/data/types';
import { addDaysToKey, dayKey, formatDayLong } from '@/lib/dates';
import { formatSteps } from '@/lib/format';
import { useMoodToday } from '@/state/use-mood';
import { useApp } from '@/state/app-state';

const HISTORY_DAYS = 14;

export function MoodLog() {
  const { repo, dataVersion } = useApp();
  const { mood, setMood, setNote, reminderOff, turnOnReminder } = useMoodToday();
  const [note, setNoteText] = useState(mood?.note ?? '');
  const [loadedNote, setLoadedNote] = useState(mood?.note ?? null);
  const [history, setHistory] = useState<{ entry: MoodEntry; day: DaySummary | undefined }[]>([]);
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
      const to = addDaysToKey(todayKey, -1);
      const [moods, days] = await Promise.all([repo.getMoods(from, to), repo.getDays(from, to)]);
      const byDate = new Map(days.map((d) => [d.date, d]));
      if (live) setHistory(moods.reverse().map((entry) => ({ entry, day: byDate.get(entry.date) })));
    })();
    return () => {
      live = false;
    };
  }, [repo, todayKey, dataVersion]);

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
        {history.length === 0 ? (
          <ThemedText themeColor="textSecondary">No moods logged yet.</ThemedText>
        ) : (
          history.map(({ entry, day }) => (
            <View key={entry.date} style={styles.entry}>
              <Text style={styles.emoji}>{moodEmoji(entry.mood)}</Text>
              <View style={styles.entryText}>
                <ThemedText>
                  {formatDayLong(entry.date)} · {moodLabel(entry.mood)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {day ? `${formatSteps(day.steps)} steps` : 'No steps recorded'}
                  {entry.note ? ` · ${entry.note}` : ''}
                </ThemedText>
              </View>
            </View>
          ))
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  entryText: { flex: 1, gap: Spacing.half },
  emoji: { fontSize: 26, lineHeight: 32 },
});
