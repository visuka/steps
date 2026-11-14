/**
 * The Clean+ Today's numbers and wording as pure functions (spec 5.1 to 5.7,
 * 10.2): hero text, week shares, tile models in every state, widths on wider
 * phones. No theme import, so jest can check them; today-clean.tsx only draws.
 */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import { formatSteps } from '@/lib/format';

import type { Measure, SleepFigure, WalkFigure, WeekDay } from './model';

const S = CLEAN_SPEC;

export const TODAY_LAYOUT = {
  /** Between the greeting, week strip, hero, walk card and tiles (spec 7). */
  blockGap: S.space.s16,
  /** Row and column gap of the tiles grid. */
  tileGap: S.sizes.tile.gap,
  /** Spec 7: Today starts 24 below the status bar. */
  topPadding: S.space.s24,
  sideMargin: S.space.sideMargin,
  hero: {
    radius: S.radius.hero,
    padding: S.sizes.hero.padding,
    /** A minimum: grows with large text. */
    minHeight: S.sizes.hero.height,
    /** Height of the "Steps" row. */
    headRowHeight: 20,
    /** "Steps" row to the number row. */
    numberGap: S.space.s4,
    /** Gap between the big number and "of 8,000". */
    ofGap: S.space.s8,
    /** Number row to the chart. */
    chartGap: S.space.s12,
    /** Chart to the axis labels. */
    axisGap: S.space.s4,
  },
  tile: {
    pipHeight: S.sizes.tile.pipHeight,
    pipGap: S.sizes.tile.pipGap,
    pipRadius: S.radius.bar,
    /** The plus circle sits over the header's right end. */
    plusSize: S.icon.circle,
    plusInset: S.sizes.tile.padding,
  },
  /** The sleep bar is full at this many minutes (8 h). */
  sleepGoalMin: 8 * 60,
} as const;

/** The four axis labels under the hero chart, hours 0, 6, 12, 18 (spec 5.3). */
export const AXIS_LABELS = ['12 am', '6', '12 pm', '6'] as const;

/** Content width: the screen (capped at `max`) minus the side margins either side. */
export function contentWidth(screenWidth: number, gutter: number = S.space.sideMargin, max: number = Infinity): number {
  return Math.max(0, Math.min(screenWidth, max) - 2 * gutter);
}

/** One tile's width: the content width shared by two columns with the gap (163 at 390, 173.5 at 411). */
export function tileWidth(content: number, gap: number = S.sizes.tile.gap): number {
  return (content - gap) / 2;
}

/** The hour chart's width: the content width less the hero's padding both sides (294 at 390). */
export function heroChartWidth(content: number): number {
  return Math.max(0, content - 2 * S.sizes.hero.padding);
}

export function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/** "4.6 km · 52 min active"; with no data "0 km · 0 min active" (spec 10.2). */
export function heroRight(distance: Measure | null, activeMin: number | null, zeroUnit: string = 'km'): string {
  const km = distance && Number(distance.value) > 0 ? `${distance.value} ${distance.unit}` : `0 ${distance?.unit ?? zeroUnit}`;
  return `${km} · ${Math.max(0, Math.round(activeMin ?? 0))} min active`;
}

/** The hero pill: the real share, "112%" over the goal. */
export function heroPill(pct: number): string {
  return `${Math.max(0, Math.round(pct))}%`;
}

/** "6,240" and "of 8,000". */
export function heroNumbers(steps: number, goal: number): { value: string; of: string } {
  return { value: formatSteps(Math.max(0, steps)), of: `of ${formatSteps(goal)}` };
}

export interface StripDay {
  label: string;
  share: number | null;
  /** After today: an empty track, no tap. */
  future?: boolean;
}

/**
 * The week strip: share of the goal clamped to 0..1; null for a past day with no
 * steps (empty track, spoken "no data"); today with 0 steps is a 0 share; a day
 * after today is `future` (empty track, no tap).
 */
export function weekShares(week: readonly WeekDay[], goal: number): StripDay[] {
  return week.map((d) => ({
    label: d.name.slice(0, 3),
    share: d.steps <= 0 && !d.today ? null : goal > 0 ? clamp01(d.steps / goal) : 0,
    future: d.future,
  }));
}

/** Index of today's column in the week, or -1. */
export function selectedDay(week: readonly WeekDay[]): number {
  return week.findIndex((d) => d.today);
}

export interface PipState {
  total: number;
  filled: number;
}

/**
 * The Water tile's eight pips. With a glasses target: the share of it, rounded,
 * but at least one once a glass is drunk; without one, the glasses themselves
 * (up to eight). Over the target all eight are filled.
 */
export function pipsFor(glasses: number, of: number | null, total: number = S.sizes.tile.pips): PipState {
  const g = Math.max(0, glasses);
  if (!of || of <= 0) return { total, filled: Math.min(g, total) };
  const filled = Math.min(total, Math.round((g / of) * total));
  return { total, filled: g > 0 ? Math.max(1, filled) : 0 };
}

/** "5" and "of 8 glasses"; without a target "5" and "glasses" ("glass" for one). */
export function waterValue(glasses: number, of: number | null): Measure {
  const g = Math.max(0, glasses);
  if (of && of > 0) return { value: String(g), unit: `of ${of} ${of === 1 ? 'glass' : 'glasses'}` };
  return { value: String(g), unit: g === 1 ? 'glass' : 'glasses' };
}

/** "6 h 50" and "min"; with no data "—" and no unit. */
export function sleepValue(sleep: SleepFigure | null): { value: string; unit?: string } {
  return sleep ? { value: `${sleep.h} h ${sleep.m}`, unit: 'min' } : { value: '—' };
}

export type TileTrailing = 'chevron' | 'plus' | 'pill';

export interface TileModel {
  label: string;
  value: string;
  unit?: string;
  trailing: TileTrailing;
  /** Walk tile: the pill text. */
  pill?: string;
  /** Walk tile: the line under the value. */
  note?: string;
  /** Premium-locked tile (spec 10.3): grey lock circle, "Premium" muted. */
  locked?: boolean;
  /** Bar fill 0..1 (food, sleep); undefined = no bar. */
  share?: number;
  /** Water tile. */
  pips?: PipState;
  spoken: string;
}

export interface FoodInput {
  text: string;
  target: string;
  share: number;
  partial?: boolean;
  spoken: string;
}

/** Food: "1,280" of "1,900 kcal"; nothing logged "0" with an empty track; over the goal the fill stops at full. */
export function foodTile(food: FoodInput): TileModel {
  const base = food.text.trim() || '0';
  const value = food.partial && !base.startsWith('≥') ? `≥ ${base}` : base;
  return {
    label: 'Food',
    value,
    unit: `of ${food.target} kcal`,
    trailing: 'chevron',
    share: clamp01(food.share),
    spoken: food.spoken,
  };
}

/** The four tiles in the order drawn. */
export const TILE_KINDS = ['food', 'water', 'sleep', 'walk'] as const;
export type TileKind = (typeof TILE_KINDS)[number];

const TILE_LABEL: Record<TileKind, string> = { food: 'Food', water: 'Water', sleep: 'Sleep', walk: 'Walk' };

/** The Premium-locked tile (spec 10.3): same label, the value "Premium", a chevron; no bar, pips or pill. */
export function lockedTileModel(kind: TileKind): TileModel {
  const label = TILE_LABEL[kind];
  return { label, value: 'Premium', trailing: 'chevron', locked: true, spoken: `${label}, Premium` };
}

export function waterTile(water: { glasses: number; of: number | null; spoken: string }): TileModel {
  const v = waterValue(water.glasses, water.of);
  return {
    label: 'Water',
    value: v.value,
    unit: v.unit,
    trailing: 'plus',
    pips: pipsFor(water.glasses, water.of),
    spoken: water.spoken,
  };
}

export function sleepTile(sleep: SleepFigure | null, spoken: string): TileModel {
  const v = sleepValue(sleep);
  const minutes = sleep ? sleep.h * 60 + sleep.m : 0;
  return {
    label: 'Sleep',
    value: v.value,
    unit: v.unit,
    trailing: 'chevron',
    share: clamp01(minutes / TODAY_LAYOUT.sleepGoalMin),
    spoken,
  };
}

/** "32 min · 3,120 steps"; one part when the other is unknown; null when both are. */
export function walkNote(walk: WalkFigure): string | undefined {
  const parts: string[] = [];
  if (walk.durationMin != null) parts.push(`${walk.durationMin} min`);
  if (walk.steps != null) parts.push(`${formatSteps(walk.steps)} steps`);
  return parts.length ? parts.join(' · ') : undefined;
}

/** Walk: with a walk today its title, distance, time pill and note; without, "Walk" / "No walk yet" and a chevron. */
export function walkTile(walk: WalkFigure | null, spoken: string): TileModel {
  if (!walk) return { label: 'Walk', value: 'No walk yet', trailing: 'chevron', spoken };
  return {
    label: walk.title,
    value: walk.distance.value,
    unit: walk.distance.unit,
    trailing: 'pill',
    pill: walk.time,
    note: walkNote(walk),
    spoken,
  };
}
