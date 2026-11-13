import { useCallback, useEffect, useState } from 'react';

import { addDaysToKey, dayKey } from '@/lib/dates';
import type { SourceOptions } from '@/nutrition/diet';
import { averageOfJudged, type DayIntake, type DayMark, type JudgedAverage } from '@/nutrition/gaps';
import {
  type CachedNote,
  dismissGapNote,
  loadNutritionWindow,
  markDay,
  type NutritionWindow,
  setNotForMe,
  sourceOptions,
  todayGapNote,
} from '@/nutrition/notes';
import { fullDayKcal } from '@/nutrition/targets';
import { type ViewContext, viewContext } from '@/nutrition/view';

import { useApp } from './app-state';

/** Two weeks and today: what a gap note needs; the week is the last 7 of them. */
const WINDOW_DAYS = 15;

export interface NutritionData {
  todayKey: string;
  /** Today's food, or null when nothing is logged yet. */
  today: DayIntake | null;
  /** Today is judged ("That's all for today" on a real day, or from 23:00). */
  judgedToday: boolean;
  mark: DayMark | null;
  /** The last 7 days with food, oldest first. */
  weekDays: DayIntake[];
  week: JudgedAverage;
  note: CachedNote | null;
  sources: SourceOptions;
  ctx: ViewContext;
  fullKcal: number;
  window: NutritionWindow;
}

/**
 * The Food tab's nutrition: today, the week of judged days, the one gap note
 * and the food-source options, read once per change of the food log.
 */
export function useNutrition() {
  const { repo, profile, today: todayRow, dataVersion } = useApp();
  const [win, setWin] = useState<NutritionWindow | null>(null);
  const [note, setNote] = useState<CachedNote | null>(null);
  const [version, setVersion] = useState(0);
  const todayKey = dayKey(new Date());

  useEffect(() => {
    let live = true;
    (async () => {
      const now = new Date();
      const w = await loadNutritionWindow(repo, profile, now, WINDOW_DAYS);
      const n = await todayGapNote(repo, profile, now, w).catch(() => null);
      if (!live) return;
      setWin(w);
      setNote(n);
    })();
    return () => {
      live = false;
    };
  }, [repo, profile, dataVersion, version, todayKey]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const markToday = useCallback(
    async (mark: DayMark | null) => {
      await markDay(repo, dayKey(new Date()), mark);
      reload();
    },
    [repo, reload],
  );
  const dismissNote = useCallback(async () => {
    await dismissGapNote(repo);
    setNote((n) => (n ? { ...n, dismissed: true } : n));
  }, [repo]);
  const notForMe = useCallback(
    async (foodId: string, off = true) => {
      await setNotForMe(repo, foodId, off);
      reload();
    },
    [repo, reload],
  );

  let data: NutritionData | null = null;
  if (win) {
    const now = new Date();
    const from = addDaysToKey(todayKey, -6);
    const weekDays = win.days.filter((d) => d.day >= from && d.day <= todayKey);
    const today = win.days.find((d) => d.day === todayKey) ?? null;
    const active = todayRow?.date === todayKey ? todayRow.activeKcal : 0;
    data = {
      todayKey,
      today,
      judgedToday: today?.judged ?? false,
      mark: win.marks[todayKey] ?? null,
      weekDays,
      week: averageOfJudged(weekDays),
      note,
      sources: sourceOptions(win, now),
      ctx: viewContext(profile, now, active),
      fullKcal: fullDayKcal(profile, now.getFullYear()),
      window: win,
    };
  }
  return { data, markToday, dismissNote, notForMe };
}
