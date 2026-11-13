/**
 * When an entry happened: an exact date and time, never later than now and
 * at most a year back. Shown as "Today, 2:35 pm", "Yesterday, 9:10 am" or
 * "Tue 11 Nov, 8:00 pm", following the phone's 12/24-hour setting.
 */
import { addDays, addDaysToKey, dayKey, startOfDay } from './dates';

/** How far back an entry can be dated. */
export const BACK_DAYS = 365;

/** How the phone shows times. */
export interface ClockStyle {
  /** The phone's 24-hour setting; null when it isn't known, and the locale decides. */
  uses24h: boolean | null;
  /** Sets the order of day and month, e.g. "en-IN" or "en-US". English names, like the rest of the app. */
  locale?: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** The time now, for event handlers; screens use useNow so a render never reads the clock. */
export const timeNow = () => Date.now();

/** The start of the day a year back: the earliest an entry can be dated. */
export function earliestAt(now: number): number {
  return startOfDay(addDays(new Date(now), -BACK_DAYS)).getTime();
}

/** Within a year back and now: a time in the future becomes now. */
export function capAt(ms: number, now: number): number {
  return Math.min(now, Math.max(earliestAt(now), ms));
}

/** The picked day at `current`'s time of day, as the date picker sets it. */
export function onDay(current: number, picked: Date): number {
  const c = new Date(current);
  return new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), c.getHours(), c.getMinutes()).getTime();
}

/** `current`'s day at the picked hour and minute, as the time picker sets it. */
export function atClock(current: number, picked: Date): number {
  const c = new Date(current);
  return new Date(c.getFullYear(), c.getMonth(), c.getDate(), picked.getHours(), picked.getMinutes()).getTime();
}

/** "2:35 pm" or "14:35". */
export function formatClock(ms: number, style: ClockStyle): string {
  const d = new Date(ms);
  if (style.uses24h === null) {
    try {
      return d.toLocaleTimeString(style.locale ?? 'en-GB', { hour: 'numeric', minute: '2-digit' });
    } catch {
      // An unknown locale: the 12-hour clock below.
    }
  }
  if (style.uses24h) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${d.getHours() % 12 || 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'am' : 'pm'}`;
}

/** "Today", "Yesterday", "Tue 11 Nov"; with the year when it isn't this year's. */
export function formatDay(ms: number, now: number, style: ClockStyle): string {
  const d = new Date(ms);
  const today = dayKey(new Date(now));
  const key = dayKey(d);
  if (key === today) return 'Today';
  if (key === addDaysToKey(today, -1)) return 'Yesterday';
  const otherYear = d.getFullYear() !== new Date(now).getFullYear();
  try {
    return new Intl.DateTimeFormat(style.locale ?? 'en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(otherYear ? { year: 'numeric' as const } : {}),
    }).format(d);
  } catch {
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${otherYear ? ` ${d.getFullYear()}` : ''}`;
  }
}

/** "Today, 2:35 pm", "Yesterday, 9:10 am", "Tue 11 Nov, 8:00 pm". */
export function formatWhen(ms: number, now: number, style: ClockStyle): string {
  return `${formatDay(ms, now, style)}, ${formatClock(ms, style)}`;
}

/** formatWhen in the middle of a sentence: "Moved to yesterday, 1:00 pm." */
export function formatWhenInSentence(ms: number, now: number, style: ClockStyle): string {
  const day = formatDay(ms, now, style);
  return `${day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : day}, ${formatClock(ms, style)}`;
}

/** One of the phone's picker dialogs, as DateTimePickerAndroid.open shows it. */
export type OpenPicker = (options: {
  value: Date;
  mode: 'date' | 'time';
  minimumDate?: Date;
  maximumDate?: Date;
  onValueChange: (event: unknown, picked: Date) => void;
}) => void;

/**
 * The date dialog, then the time dialog. Nothing changes until a time is
 * picked too, so backing out of either dialog leaves the entry as it was.
 */
export function pickDateThenTime(open: OpenPicker, value: number, now: number, done: (wanted: number) => void): void {
  open({
    value: new Date(value),
    mode: 'date',
    minimumDate: new Date(earliestAt(now)),
    maximumDate: new Date(now),
    onValueChange: (_event, day) => {
      const dated = onDay(value, day);
      // Follows the phone's 12/24-hour setting when is24Hour is left out.
      open({ value: new Date(dated), mode: 'time', onValueChange: (_e, time) => done(atClock(dated, time)) });
    },
  });
}
