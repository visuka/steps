import { useEffect, useState } from 'react';

import type { Mood, MoodEntry } from '@/data/types';
import { dayKey } from '@/lib/dates';
import { requestNotificationPermission, scheduleMoodCheckIn } from '@/notifications/notify';

import { useApp } from './app-state';

/** Today's mood, shared by the Today card and the Journal. */
export function useMoodToday() {
  const { repo, profile, dataVersion, touch, updateProfile } = useApp();
  const [mood, setMoodState] = useState<MoodEntry | null>(null);
  const todayKey = dayKey(new Date());

  useEffect(() => {
    let live = true;
    repo.getMoods(todayKey, todayKey).then(([m]) => live && setMoodState(m ?? null));
    return () => {
      live = false;
    };
  }, [repo, todayKey, dataVersion]);

  const save = async (entry: MoodEntry) => {
    setMoodState(entry);
    await repo.setMood(entry);
    touch();
  };

  return {
    mood,
    setMood: (m: Mood) => save({ date: todayKey, mood: m, note: mood?.note ?? null, loggedAt: Date.now() }),
    setNote: async (note: string) => {
      if (!mood || (mood.note ?? '') === note.trim()) return;
      await save({ ...mood, note: note.trim() || null });
    },
    reminderOff: !profile.moodCheckIn.enabled,
    /** Resolves false when notifications are blocked. */
    turnOnReminder: async () => {
      if (!(await requestNotificationPermission())) return false;
      await scheduleMoodCheckIn(profile.moodCheckIn.hour);
      await updateProfile({ moodCheckIn: { ...profile.moodCheckIn, enabled: true } });
      return true;
    },
  };
}
