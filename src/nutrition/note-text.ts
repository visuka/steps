/**
 * The words of gap notes and the weekly summary. Short, plain and kind: no
 * medical claims, and a doctor mentioned only where it matters. A test scans
 * these and every nutrient's `why` for words the app must never use.
 */
import type { Diet } from '@/data/types';

import { type Sources, sourcesFor, sourcesSentence, type SourceOptions } from './diet';
import type { GapNote } from './gaps';
import { NUTRIENT } from './nutrients';
import { SPLIT_TEXT, type SplitVerdict } from './targets';

export const NOTE_FOOTER = 'Based on what you logged. Food logs miss things.';
export const DOCTOR_LINE = 'If that worries you, a doctor can tell you whether anything is worth checking.';

export interface GapNoteText {
  /** "Vitamin C has been on the low side lately." */
  title: string;
  /** "It helps heal cuts and take up iron." */
  why: string;
  sources: Sources;
  /** "Good sources: Guava, Orange, Tomato" or the plain line; null when there's neither. */
  sourcesLine: string | null;
  footer: string;
  /** Third note in 6 weeks only. */
  doctor: string | null;
  /** The whole note in one short paragraph, for a notification. */
  body: string;
}

/** "Helps heal cuts" → "It helps heal cuts". */
function itLine(why: string): string {
  return `It ${why.charAt(0).toLowerCase()}${why.slice(1)}`;
}

export function noteTitle(note: Pick<GapNote, 'key' | 'kind'>): string {
  const info = NUTRIENT[note.key];
  if (info.ai) return `${info.label} could be higher lately.`;
  return note.kind === 'week' ? `${info.label} has been on the low side for two weeks.` : `${info.label} has been on the low side lately.`;
}

export function gapNoteText(note: GapNote, diet: Diet | null, opts: SourceOptions = {}): GapNoteText {
  const info = NUTRIENT[note.key];
  const sources = sourcesFor(note.key, diet, opts);
  const title = noteTitle(note);
  const why = `${itLine(info.why).replace(/\.$/, '')}.`;
  const sourcesLine = sources.foods.length
    ? `Good sources: ${sources.foods.map((f) => f.label).join(', ')}`
    : sources.line;
  const plenty = sources.foods.length ? `${sourcesSentence(sources.foods)} have plenty.` : (sources.line ?? '');
  const doctor = note.doctor ? DOCTOR_LINE : null;
  const body = [title, why, plenty, doctor].filter(Boolean).join(' ');
  return { title, why, sources, sourcesLine, footer: NOTE_FOOTER, doctor, body };
}

/** The water reminder: never the whole shortfall, just where they are. */
export function waterReminderLine(progress: string): string {
  return `Time for a glass of water. You're at ${progress}.`;
}

export interface WeekFacts {
  judgedDays: number;
  /** Null when there's no water target to meet (doctor's limit, numbers only, water locked). */
  waterMetDays: number | null;
  /** Vitamins and minerals on track for the week, of those known; null for numbers only. */
  onTrack: { ok: number; known: number } | null;
  split: SplitVerdict | null;
}

/** At most 3 short facts for the Sunday summary. */
export function weeklySummaryText(f: WeekFacts): { title: string; body: string } {
  const facts = [`Full food days: ${f.judgedDays} of 7.`];
  if (f.waterMetDays !== null) facts.push(`Water target met on ${f.waterMetDays} of 7 days.`);
  if (f.onTrack && f.onTrack.known > 0) facts.push(`${f.onTrack.ok} of ${f.onTrack.known} vitamins and minerals on track.`);
  else if (f.split) facts.push(`Energy: ${SPLIT_TEXT[f.split].toLowerCase()}.`);
  return { title: 'Your week', body: facts.slice(0, 3).join(' ') };
}

/** What the lock screen shows for the private nutrition and weekly channels. */
export const PRIVATE_TITLE = { nutrition: 'A note about your food', weekly: 'Your week' } as const;
