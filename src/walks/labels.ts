import type { PartChoice, Walk, WalkPart } from '@/data/types';
import { dayKey, formatDayLong } from '@/lib/dates';
import type { WalkActivity, WalkPoint } from '@/lib/walk';
import { isCounted } from '@/lib/walk-totals';

import type { WalkMode } from './recorder.types';

/**
 * "Morning walk", "Evening cycle ride"… by start time. Rides say "cycle":
 * in India a "bike ride" usually means a motorbike.
 */
export function walkTitle(startedAt: number, activity: WalkActivity = 'walk'): string {
  const h = new Date(startedAt).getHours();
  const what = activity === 'ride' ? 'cycle ride' : 'walk';
  if (h >= 5 && h < 12) return `Morning ${what}`;
  if (h >= 12 && h < 17) return `Afternoon ${what}`;
  if (h >= 17 && h < 21) return `Evening ${what}`;
  return `Night ${what}`;
}

/** "Thu, 30 Oct · 6:10 pm". */
export function walkWhen(startedAt: number): string {
  const time = new Date(startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${formatDayLong(dayKey(new Date(startedAt)))} · ${time}`;
}

/** The record screen's title: "Walking", "Indoor walk · Home", "Cycling", "Indoor cycling". */
export function recordingTitle(mode: Pick<WalkMode, 'activity' | 'indoorNow' | 'place'> | null): string {
  if (!mode) return 'Walking';
  if (mode.activity === 'ride') return mode.indoorNow ? 'Indoor cycling' : 'Cycling';
  if (!mode.indoorNow) return 'Walking';
  return mode.place ? `Indoor walk · ${mode.place.name}` : 'Indoor walk';
}

/** Walks only (not rides): for "N walks", "most start around" and similar. */
export function onlyWalks<T extends Pick<Walk, 'activity'>>(walks: T[]): T[] {
  return walks.filter((w) => (w.activity ?? 'walk') === 'walk');
}

/** "12 walks · 4 cycle rides", "1 walk", "" for none. */
export function walksCount(walks: Pick<Walk, 'activity'>[]): string {
  const rides = walks.filter((w) => w.activity === 'ride').length;
  const on = walks.length - rides;
  const parts: string[] = [];
  if (on) parts.push(`${on} ${on === 1 ? 'walk' : 'walks'}`);
  if (rides) parts.push(`${rides} ${rides === 1 ? 'cycle ride' : 'cycle rides'}`);
  return parts.join(' · ');
}

/**
 * The answers a part's card offers, first the likeliest.
 * Vehicle in a walk: Add to walk (keep) / Remove / It was cycling (cycle).
 * Cycling or unsure: On foot (keep) / Cycling (cycle) / Vehicle (remove).
 * In a ride: Keep / Remove.
 */
export function partAnswers(part: Pick<WalkPart, 'kind'>, activity: WalkActivity = 'walk'): PartChoice[] {
  if (activity === 'ride') return ['keep', 'remove'];
  if (part.kind === 'vehicle') return ['keep', 'remove', 'cycle'];
  return ['keep', 'cycle', 'remove'];
}

/** The fixes to draw: the main route and counted parts (dashed grey for the rest is the map's choice). */
export function countedRoute(points: WalkPoint[], parts: Pick<WalkPart, 'ord' | 'choice' | 'defaultKeep'>[]): WalkPoint[] {
  const counted = new Set(parts.filter(isCounted).map((p) => p.ord));
  return points.filter((p) => p.part == null || counted.has(p.part));
}

/** Whether a time falls in one of a walk's ranges (weak GPS, from steps, indoor). */
export function inRanges(t: number, ranges: [number, number][] | undefined): boolean {
  return !!ranges?.some(([a, b]) => t >= a && t <= b);
}
