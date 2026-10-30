/**
 * Day keys are local calendar dates ('YYYY-MM-DD'). Steps belong to the day
 * in the phone's time zone at the moment they were taken.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Calendar-safe across daylight-saving changes, unlike adding 24h of milliseconds. */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function addDaysToKey(key: string, n: number): string {
  return dayKey(addDays(parseDayKey(key), n));
}

/** Whole calendar days from a to b (b later = positive). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function todayKey(now = new Date()): string {
  return dayKey(now);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekdayShort(key: string): string {
  return WEEKDAYS[parseDayKey(key).getDay()];
}

export function monthShort(monthIndex: number): string {
  return MONTHS[monthIndex];
}

export function formatDayLong(key: string): string {
  const d = parseDayKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
