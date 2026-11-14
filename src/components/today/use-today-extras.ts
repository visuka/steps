/** Loads what Today shows besides steps and food: last night's sleep, today's walk, the last 7 days, today's hours, the name. */

import { useEffect, useState } from 'react';

import type { SleepEntry, Walk } from '@/data/types';
import { addDaysToKey, dayKey, formatDayLong } from '@/lib/dates';
import { useApp } from '@/state/app-state';

import { avatarInitial, sleepOf, sleepSpoken, walkOf, walkSpoken, weekOf } from './model';

const NO_HOURS: number[] = new Array<number>(24).fill(0);

/** Last night's sleep, today's walk, the week's steps and today's hours; reloads with the data and on `reload`. */
export function useTodayExtras(reload: number) {
  const { repo, profile, dataVersion, displaySteps } = useApp();
  const today = dayKey(new Date());
  const [sleep, setSleep] = useState<SleepEntry[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);
  const [days, setDays] = useState<{ date: string; steps: number }[]>([]);
  const [hourly, setHourly] = useState<number[]>(NO_HOURS);

  useEffect(() => {
    let live = true;
    Promise.all([
      repo.getSleep(today, today).catch(() => [] as SleepEntry[]),
      repo.getWalks(5).catch(() => [] as Walk[]),
      repo.getDays(addDaysToKey(today, -6), today).catch(() => []),
      repo.getHourly(today).catch(() => NO_HOURS),
    ]).then(([s, w, d, h]) => {
      if (!live) return;
      setSleep(s);
      setWalks(w);
      setDays(d.map((x) => ({ date: x.date, steps: x.steps })));
      setHourly(h.length === 24 ? h : NO_HOURS);
    });
    return () => {
      live = false;
    };
  }, [repo, today, dataVersion, reload]);

  const week = weekOf(days, today, displaySteps);
  const sleepFigure = sleepOf(sleep);
  const walkFigure = walkOf(walks, today, profile.units);
  // Profile has no name field, so the greeting stays "Good morning" until one exists.
  const name: string | null = null;
  return {
    dateLabel: formatDayLong(today),
    name,
    initial: avatarInitial(name),
    distanceUnit: profile.units === 'metric' ? 'km' : 'mi',
    hourly,
    nowHour: new Date().getHours(),
    sleep: sleepFigure,
    sleepSpoken: sleepSpoken(sleepFigure),
    walk: walkFigure,
    walkSpoken: walkSpoken(walkFigure),
    week,
  };
}
