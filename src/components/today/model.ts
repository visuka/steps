/**
 * What every themed Today draws, worked out once: steps and goal, the hero's
 * stats, food, water, last night's sleep, today's walk and the last 7 days.
 * A missing figure is null and each theme draws its empty state; nothing is
 * dropped from the layout. Plain functions, so jest can check them;
 * use-today-extras.ts loads what they work on.
 */

import type { SleepEntry, Walk } from '@/data/types';
import { addDaysToKey, dayKey, parseDayKey } from '@/lib/dates';
import { greetingTitle, initialOf } from '@/components/ui/greeting-style';
import { formatSteps, type Units } from '@/lib/format';
import { walkTitle } from '@/walks/labels';

const KM_PER_MILE = 1.609344;
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** A figure split as the mockups set it: "4.6" and "km". */
export interface Measure {
  value: string;
  unit: string;
}

export interface SleepFigure {
  h: number;
  m: number;
  /** "6 hours 50 minutes", "1 hour", "45 minutes". */
  spoken: string;
}

export interface WalkFigure {
  id: string;
  /** "Morning walk". */
  title: string;
  /** "7:10 am". */
  time: string;
  distance: Measure;
  /** Moving time in whole minutes; null when the walk has none. */
  durationMin: number | null;
  /** Steps counted over the walk; null when they couldn't be read. */
  steps: number | null;
}

export interface WeekDay {
  key: string;
  /** "S", "M"… */
  letter: string;
  name: string;
  steps: number;
  today: boolean;
  /** A day that has not happened yet: an empty track, not tappable. */
  future: boolean;
}

/** One decimal, as every mockup: "4.6 km", "2.3 mi". */
export function distanceOf(meters: number, units: Units): Measure {
  const km = meters / 1000;
  return units === 'metric' ? { value: km.toFixed(1), unit: 'km' } : { value: (km / KM_PER_MILE).toFixed(1), unit: 'mi' };
}

/** "7:10 am". */
export function clockOf(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

export function sleepOf(entries: SleepEntry[]): SleepFigure | null {
  if (!entries.length) return null;
  const min = Math.round(entries.reduce((sum, e) => sum + e.asleepMin, 0));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return { h, m, spoken: sleepWords(h, m) };
}

function plural(n: number, one: string): string {
  return `${n} ${n === 1 ? one : `${one}s`}`;
}

/** "1 hour 1 minute", "6 hours 50 minutes", "45 minutes", "1 hour"; a zero part is left out, 0 and 0 is "0 minutes". */
export function sleepWords(h: number, m: number): string {
  const parts: string[] = [];
  if (h > 0) parts.push(plural(h, 'hour'));
  if (m > 0 || h <= 0) parts.push(plural(m, 'minute'));
  return parts.join(' ');
}

/** Today's latest walk or ride, or null. */
export function walkOf(walks: Walk[], today: string, units: Units): WalkFigure | null {
  const w = walks
    .filter((x) => dayKey(new Date(x.startedAt)) === today)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!w) return null;
  return {
    id: w.id,
    title: walkTitle(w.startedAt, w.activity),
    time: clockOf(w.startedAt),
    distance: distanceOf(w.distanceM, units),
    durationMin: w.movingS > 0 ? Math.max(1, Math.round(w.movingS / 60)) : null,
    steps: w.steps,
  };
}

/** The week that holds today, Monday to Sunday (spec 5.2), today's steps as shown live; days after today are `future`. */
export function weekOf(days: { date: string; steps: number }[], today: string, todaySteps: number): WeekDay[] {
  const by = new Map(days.map((d) => [d.date, d.steps]));
  const sinceMonday = (parseDayKey(today).getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDaysToKey(today, i - sinceMonday);
    const wd = parseDayKey(key).getDay();
    const isToday = key === today;
    const future = key > today;
    return {
      key,
      letter: LETTERS[wd],
      name: WEEKDAY_NAMES[wd],
      steps: isToday ? todaySteps : future ? 0 : (by.get(key) ?? 0),
      today: isToday,
      future,
    };
  });
}

/** "78%" of the goal, whole percent. */
export function percentOf(steps: number, goal: number): number {
  return goal > 0 ? Math.round((steps / goal) * 100) : 0;
}

/**
 * The hero's spoken summary: "6,240 of 8,000 steps, 78%, 1,760 to go. 4.6 kilometres,
 * 52 minutes active." Distance and active minutes are always said, as the hero
 * always shows them (0 with no data); `zeroUnit` is the unit of "0" without a distance.
 */
export function heroSpoken(
  steps: number,
  goal: number,
  distance: Measure | null,
  activeMin: number | null,
  zeroUnit: string = 'km',
): string {
  const toGo = Math.max(0, goal - steps);
  const left = toGo === 0 ? 'goal reached' : `${formatSteps(toGo)} to go`;
  const unit = distance?.unit ?? zeroUnit;
  const n = distance ? Number(distance.value) : 0;
  const has = n > 0;
  const word = unit === 'mi' ? (n === 1 ? 'mile' : 'miles') : n === 1 ? 'kilometre' : 'kilometres';
  const far = `${has ? distance?.value : '0'} ${word}`;
  const min = Math.max(0, Math.round(activeMin ?? 0));
  return `${formatSteps(steps)} of ${formatSteps(goal)} steps, ${percentOf(steps, goal)}%, ${left}. ${far}, ${plural(min, 'minute')} active.`;
}

/** The note under the hero chart when some steps have no time; null when none. */
export function untimedNote(untimedSteps: number | null | undefined): string | null {
  if (!untimedSteps || untimedSteps <= 0) return null;
  return `${formatSteps(untimedSteps)} of today's steps came with no time, so they're in the total but in no hour. Settings → Step check shows why.`;
}

/** The words before the name: "Good morning" before 12, "Good afternoon" before 17, "Good evening" after. */
export function greetingWords(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "Good morning, Ravi"; without a name just "Good morning". */
export function greetingFor(hour: number, name: string | null | undefined): string {
  return greetingTitle(greetingWords(hour), name ?? undefined);
}

/** The avatar letter: the name's first letter, upper case; "" without a name. */
export function avatarInitial(name: string | null | undefined): string {
  return name ? initialOf(name) : '';
}

/** What the Sleep tile says aloud. */
export function sleepSpoken(sleep: SleepFigure | null): string {
  return sleep ? `Sleep, ${sleep.spoken}` : 'Sleep, no data';
}

/** What the walk tile says aloud: "Morning walk, 2.3 km, 32 minutes, 3,120 steps", or "Walk, no walk yet today". */
export function walkSpoken(walk: WalkFigure | null): string {
  if (!walk) return 'Walk, no walk yet today';
  const parts = [walk.title, `${walk.distance.value} ${walk.distance.unit}`];
  if (walk.durationMin != null) parts.push(`${walk.durationMin} ${walk.durationMin === 1 ? 'minute' : 'minutes'}`);
  if (walk.steps != null) parts.push(`${formatSteps(walk.steps)} steps`);
  return parts.join(', ');
}
