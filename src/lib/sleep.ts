/**
 * Sleep from Apple Health / Health Connect and from the person's own entries.
 * Watches report sleep as stage segments, often from more than one app for
 * the same night; these helpers turn them into nights without counting any
 * time twice.
 */
import type { Mood, SleepEntry, SleepStages } from '@/data/types';

import { dayKey, parseDayKey } from './dates';

export type SleepStage = 'inBed' | 'asleep' | 'light' | 'deep' | 'rem' | 'awake';

export interface SleepSegment {
  /** Record id in the health store. */
  id: string;
  start: number;
  end: number;
  stage: SleepStage;
  /** The app that wrote it. */
  source: string;
}

export interface SleepSession {
  id: string;
  start: number;
  end: number;
  asleepMin: number;
  stages: SleepStages | null;
}

/** Segments further apart than this are separate sleeps: a nap, then the night. */
const SESSION_GAP_MS = 60 * 60_000;
/** Less than this is a doze or a stray record, not sleep worth showing. */
const MIN_SESSION_MIN = 15;

const ASLEEP: SleepStage[] = ['asleep', 'light', 'deep', 'rem'];

const minutes = (ms: number) => Math.round(ms / 60_000);
const ofStage = (segs: SleepSegment[], stages: SleepStage[]) => segs.filter((s) => stages.includes(s.stage));

/** Time covered by the intervals, counting overlaps once. */
export function unionMs(intervals: { start: number; end: number }[]): number {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let total = 0;
  let start = 0;
  let end = -Infinity;
  for (const i of sorted) {
    if (i.start > end) {
      if (end > -Infinity) total += end - start;
      start = i.start;
      end = i.end;
    } else if (i.end > end) {
      end = i.end;
    }
  }
  return end > -Infinity ? total + end - start : total;
}

/** Groups segments into sleeps, each taken from the one app that saw the most of it. */
export function sleepSessions(segments: SleepSegment[]): SleepSession[] {
  const sorted = segments.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
  const clusters: SleepSegment[][] = [];
  let clusterEnd = -Infinity;
  for (const s of sorted) {
    if (s.start - clusterEnd > SESSION_GAP_MS) clusters.push([]);
    clusters[clusters.length - 1].push(s);
    clusterEnd = Math.max(clusterEnd, s.end);
  }
  return clusters.flatMap((c) => {
    const session = fromBestSource(c);
    return session.asleepMin >= MIN_SESSION_MIN ? [session] : [];
  });
}

function fromBestSource(cluster: SleepSegment[]): SleepSession {
  const bySource = new Map<string, SleepSegment[]>();
  for (const s of cluster) bySource.set(s.source, [...(bySource.get(s.source) ?? []), s]);
  // A phone's "in bed" and a watch's stages often cover the same night; prefer
  // whichever saw the most actual sleep, then the most time overall.
  let best: SleepSegment[] = [];
  let bestAsleep = -1;
  let bestAll = -1;
  for (const segs of bySource.values()) {
    const asleep = unionMs(ofStage(segs, ASLEEP));
    const all = unionMs(segs);
    if (asleep > bestAsleep || (asleep === bestAsleep && all > bestAll)) {
      best = segs;
      bestAsleep = asleep;
      bestAll = all;
    }
  }
  // Apps that only know time in bed (a phone's bedtime schedule) count it all as sleep.
  const asleepMs = bestAsleep || unionMs(ofStage(best, ['inBed']));
  const staged = best.some((s) => s.stage === 'light' || s.stage === 'deep' || s.stage === 'rem');
  return {
    id: best[0].id,
    start: Math.min(...best.map((s) => s.start)),
    end: Math.max(...best.map((s) => s.end)),
    asleepMin: minutes(asleepMs),
    stages: staged
      ? {
          awake: minutes(unionMs(ofStage(best, ['awake']))),
          light: minutes(unionMs(ofStage(best, ['light']))),
          deep: minutes(unionMs(ofStage(best, ['deep']))),
          rem: minutes(unionMs(ofStage(best, ['rem']))),
        }
      : null,
  };
}

/** Sessions as stored rows, each counted toward the morning it ended on. */
export function toSleepEntries(sessions: SleepSession[], now: number): SleepEntry[] {
  return sessions.map((s) => ({
    id: `health:${s.id}`,
    date: dayKey(new Date(s.end)),
    startAt: s.start,
    endAt: s.end,
    asleepMin: s.asleepMin,
    rested: null,
    source: 'health',
    healthId: s.id,
    stages: s.stages,
    updatedAt: now,
  }));
}

export interface Night {
  /** The morning the sleep ended on. */
  date: string;
  asleepMin: number;
  bedAt: number;
  wakeAt: number;
  rested: Mood | null;
  /** True when the times came from a watch or app rather than the person's own entry. */
  fromHealth: boolean;
  stages: SleepStages | null;
}

/**
 * One row per morning. A watch's record wins for the times (naps that day
 * add to the total); the person's own entry adds how rested they felt.
 */
export function nightsByDate(entries: SleepEntry[]): Night[] {
  const byDate = new Map<string, SleepEntry[]>();
  for (const e of entries) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const nights: Night[] = [];
  for (const [date, list] of byDate) {
    const health = list.filter((e) => e.source === 'health');
    const manual = list.find((e) => e.source === 'manual') ?? null;
    if (health.length) {
      const main = health.reduce((a, b) => (b.asleepMin > a.asleepMin ? b : a));
      nights.push({
        date,
        asleepMin: health.reduce((s, e) => s + e.asleepMin, 0),
        bedAt: main.startAt,
        wakeAt: main.endAt,
        rested: manual?.rested ?? null,
        fromHealth: true,
        stages: main.stages,
      });
    } else if (manual) {
      nights.push({
        date,
        asleepMin: manual.asleepMin,
        bedAt: manual.startAt,
        wakeAt: manual.endAt,
        rested: manual.rested,
        fromHealth: false,
        stages: null,
      });
    }
  }
  return nights.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Steps in an hour that mean someone was up and about, not just a trip to the bathroom. */
const UP_STEPS = 100;
const DEFAULT_BED_HOUR = 23;
const DEFAULT_WAKE_MIN = 6 * 60 + 30;
const QUARTER_MS = 15 * 60_000;

/**
 * A starting point for logging a night: bed after the last busy hour of the
 * evening, up at the first busy hour of the morning, else 23:00 to 06:30.
 * Steps only say when the phone was moving, so the person adjusts from here.
 */
export function guessSleepWindow(
  date: string,
  eveningHourly: number[] | null,
  morningHourly: number[] | null,
  now: number,
): { bedAt: number; wakeAt: number } {
  const morning = parseDayKey(date);
  const at = (hourFromMorningMidnight: number) =>
    new Date(morning.getFullYear(), morning.getMonth(), morning.getDate(), 0, hourFromMorningMidnight * 60).getTime();

  // Hours from 21:00 the evening before (−3) to 02:00 (2), relative to the morning's midnight.
  let lastBusy: number | null = null;
  for (let h = -3; h <= 2; h++) {
    const steps = h < 0 ? eveningHourly?.[24 + h] : morningHourly?.[h];
    if ((steps ?? 0) >= UP_STEPS) lastBusy = h;
  }
  let bedAt = at(lastBusy === null ? DEFAULT_BED_HOUR - 24 : lastBusy + 1);

  let firstBusy: number | null = null;
  for (let h = 4; h <= 11 && firstBusy === null; h++) if ((morningHourly?.[h] ?? 0) >= UP_STEPS) firstBusy = h;
  let wakeAt = at(firstBusy === null ? DEFAULT_WAKE_MIN / 60 : firstBusy);
  // Logging early in the morning: they're up now at the latest.
  wakeAt = Math.min(wakeAt, Math.floor(now / QUARTER_MS) * QUARTER_MS);

  if (wakeAt - bedAt < 2 * 3_600_000) {
    bedAt = at(DEFAULT_BED_HOUR - 24);
    wakeAt = Math.max(bedAt + 2 * 3_600_000, Math.min(at(DEFAULT_WAKE_MIN / 60), Math.floor(now / QUARTER_MS) * QUARTER_MS));
  }
  return { bedAt, wakeAt };
}

/** "7 h 20 min", "45 min". */
export function formatSleep(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
}
