/**
 * Time series for the hourly detail screens (app/detail/[kind].tsx), as pure
 * functions: no React, no theme, no I/O. A "point" is one thing at one time
 * (a food's kcal, a glass's ml, a step bucket's steps).
 *
 * A day is a calendar date ('YYYY-MM-DD') in a time zone: either a fixed
 * offset in minutes east of UTC (India +330, a whole-hour zone +60, New York
 * -300) or a function from an instant to its offset (deviceZone, ianaZone), so
 * daylight-saving days work. Every point is placed by the zone's real wall
 * clock at that instant: a day has 23, 24 or 25 hours, and the chart's 24
 * slots are wall-clock hours. The repeated hour on a fall-back day adds to its
 * wall hour; the skipped hour on a spring-forward day stays 0.
 */

import { addDaysToKey } from '@/lib/dates';
import { groupThousands, hourRange } from '@/components/ui/hour-bars-geometry';

export type SeriesKind = 'steps' | 'active' | 'food' | 'water' | 'sleep';
export const SERIES_KINDS: readonly SeriesKind[] = ['steps', 'active', 'food', 'water', 'sleep'];

/** The route's `kind` param; anything else (including 'walk', which has its own screen) is null. */
export function parseKind(raw: string | string[] | undefined): SeriesKind | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return SERIES_KINDS.find((k) => k === v) ?? null;
}

export interface SeriesPoint {
  /** Epoch ms. */
  at: number;
  value: number;
}

const MIN_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
export const HOURS = 24;
export const QUARTERS_PER_HOUR = 4;
export const QUARTERS = HOURS * QUARTERS_PER_HOUR;

/** Minutes east of UTC: fixed, or looked up for an instant (daylight saving). */
export type Zone = number | ((at: number) => number);

const offsetAt = (zone: Zone, at: number): number => (typeof zone === 'number' ? zone : zone(at));

/** The phone's own zone, from the device clock (Date's local methods). */
export const deviceZone: (at: number) => number = (at) => -new Date(at).getTimezoneOffset();

/** An IANA zone ('Europe/Paris') by Intl, for tests and for zones other than the phone's. */
export function ianaZone(timeZone: string): (at: number) => number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  return (at) => {
    const whole = Math.floor(at / 1000) * 1000;
    const get: Record<string, number> = {};
    for (const part of fmt.formatToParts(new Date(whole))) if (part.type !== 'literal') get[part.type] = +part.value;
    return Math.round((Date.UTC(get.year, get.month - 1, get.day, get.hour, get.minute, get.second) - whole) / MIN_MS);
  };
}

/** The instant as wall-clock time in the zone, read with the UTC getters. */
const wallMs = (at: number, zone: Zone): number => at + offsetAt(zone, at) * MIN_MS;

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDayKey(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = DAY_KEY.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Wall-clock midnight of the day as a UTC-getter time. */
function wallMidnight(day: string): number {
  const m = DAY_KEY.exec(day);
  if (!m) throw new Error(`bad day key: ${day}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

/** Epoch ms of the day's first instant (its wall-clock midnight, or the first instant after it when the zone skips midnight). */
export function dayStartMs(day: string, zone: Zone): number {
  const wall = wallMidnight(day);
  if (typeof zone === 'number') return wall - zone * MIN_MS;
  const before = offsetAt(zone, wall - DAY_MS);
  const after = offsetAt(zone, wall + DAY_MS);
  const hits = [wall - before * MIN_MS, wall - after * MIN_MS].filter((u) => wallMs(u, zone) === wall);
  return hits.length > 0 ? Math.min(...hits) : wall - before * MIN_MS;
}

/** Epoch ms where the day ends (the next day's start). */
export function dayEndMs(day: string, zone: Zone): number {
  return dayStartMs(addDaysToKey(day, 1), zone);
}

/** Sums `points` into `slots` slots of `slotMs` of wall-clock time; points outside the day are left out. */
function bucket(points: readonly SeriesPoint[], day: string, zone: Zone, slots: number, slotMs: number): number[] {
  const wallStart = wallMidnight(day);
  const out = new Array<number>(slots).fill(0);
  for (const p of points) {
    if (!Number.isFinite(p.at) || !Number.isFinite(p.value)) continue;
    const rel = wallMs(p.at, zone) - wallStart;
    if (rel < 0 || rel >= DAY_MS) continue;
    out[Math.floor(rel / slotMs)] += p.value;
  }
  return out;
}

/** 24 sums by wall-clock hour, hour 0 (midnight to 1 am) to hour 23. 23:59:59.999 is in hour 23; the next 00:00 is not in this day. */
export function bucketByHour(points: readonly SeriesPoint[], day: string, zone: Zone): number[] {
  return bucket(points, day, zone, HOURS, HOUR_MS);
}

/** 96 sums, quarter 0 (00:00 to 00:15) to 95; quarters 4h to 4h+3 make up hour h. */
export function bucketBy15Min(points: readonly SeriesPoint[], day: string, zone: Zone): number[] {
  return bucket(points, day, zone, QUARTERS, 15 * MIN_MS);
}

/** The wall-clock hour (0 to 23) of an instant in the zone: the chart's "now" slot. */
export function wallHour(at: number, zone: Zone): number {
  return new Date(wallMs(at, zone)).getUTCHours();
}

/** The four quarters of one hour out of the day's 96. */
export function quartersOfHour(quarters: readonly number[], hour: number): number[] {
  return Array.from({ length: QUARTERS_PER_HOUR }, (_, q) => quarters[hour * QUARTERS_PER_HOUR + q] ?? 0);
}

/** Logs (any order) that fall inside [start, end). */
export function logsInRange<T extends { loggedAt: number }>(logs: readonly T[], start: number, end: number): T[] {
  return logs.filter((l) => l.loggedAt >= start && l.loggedAt < end);
}

/** A newest-first read of `limit` logs may have stopped short of `start`: true when a bigger read is needed. */
export function needsMoreLogs(logs: readonly { loggedAt: number }[], limit: number, start: number): boolean {
  return logs.length >= limit && logs.every((l) => l.loggedAt >= start);
}

export interface TimedBucket {
  start: number;
  end: number;
  steps: number;
}

/** Steps of a step-source bucket belong to the slot it starts in. */
export function stepPoints(buckets: readonly TimedBucket[]): SeriesPoint[] {
  return buckets.filter((b) => b.steps > 0).map((b) => ({ at: b.start, value: b.steps }));
}

/**
 * Minutes per hour spent at `activeCadence` steps a minute or more, from
 * buckets (ask the source for 1-minute buckets): the same rule as the day's
 * active minutes (lib/metrics summarizeBuckets), the minutes counted in the
 * hour the bucket starts in.
 */
export function activePoints(buckets: readonly TimedBucket[], activeCadence: number): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const b of buckets) {
    if (b.steps <= 0) continue;
    const minutes = Math.max((b.end - b.start) / MIN_MS, 1);
    if (b.steps / minutes >= activeCadence) out.push({ at: b.start, value: minutes });
  }
  return out;
}

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/**
 * Active minutes have no minute data: the source gave no buckets, or the hours
 * came out all zero while the day's stored total says there was activity.
 */
export function activeMinutesMissing(
  buckets: readonly TimedBucket[] | null,
  hours: readonly number[],
  storedActiveMin: number | null,
): boolean {
  if (buckets === null || buckets.length === 0) return true;
  return sum(hours) <= 0 && (storedActiveMin ?? 0) > 0;
}

/** The previous or next day, never after today. Null when there is no such day. */
export function shiftDay(day: string, delta: 1 | -1, today: string): string | null {
  const next = addDaysToKey(day, delta);
  return next > today ? null : next;
}

/** Days kept at minute detail by the sync (sync/engine DETAIL_DAYS); older days have hourly totals only. */
export function hasMinuteData(daysAgo: number, detailDays: number): boolean {
  return daysAgo >= 0 && daysAgo < detailDays;
}

/** A bar's share of the tallest (0 to 1); 0 when everything is 0. */
export function share(value: number, max: number): number {
  return max > 0 && value > 0 ? Math.min(1, value / max) : 0;
}

/** Clock text for a quarter of an hour: hour 7, quarter 2 -> '7:30 am'. */
export function quarterClock(hour: number, quarter: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mm = String(quarter * 15).padStart(2, '0');
  return `${h12}:${mm} ${hour < 12 ? 'am' : 'pm'}`;
}

/** '7:05 am' for an epoch time in the zone. */
export function clockAt(at: number, zone: Zone): string {
  const wall = new Date(wallMs(at, zone));
  const h = wall.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(wall.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** 95 -> '1 h 35 min'; 45 -> '45 min'; 120 -> '2 h'. */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

/** The chart's spoken summary for any kind: the total is the sum of the bars. */
export function seriesLabel(what: string, unit: string, hours: readonly number[]): string {
  const total = sum(hours);
  if (total <= 0) return `${what} by hour: none`;
  const busiest = hours.indexOf(Math.max(...hours));
  return `${what} by hour: ${groupThousands(total)} ${unit} in total, busiest hour ${hourRange(busiest)} with ${groupThousands(hours[busiest])}`;
}
