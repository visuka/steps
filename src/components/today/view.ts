/**
 * What the Clean+ Today (today-clean.tsx) is handed: the figures, already
 * formatted, the taps, and the pieces drawn the same way for everyone (a walk in
 * progress, the one-time appearance note, the cards under the tiles, the
 * premium card). Every look shares this one Today.
 *
 * Contract with `src/app/(tabs)/index.tsx`, every field read by today-clean.tsx:
 *  - dateLabel, steps, goal, pct, stepsSpoken (the hero's whole spoken summary,
 *    distance and active minutes included), distance, activeMin, details
 *  - name (string | null: the greeting's name; Profile has no name field yet, so null)
 *  - initial (avatar letter, "" without a name)
 *  - distanceUnit ('km' | 'mi', for the "0 km" of an empty day)
 *  - hourly (24 numbers: steps per hour of today), nowHour (0 to 23, the current hour)
 *  - food { text, target, share, partial, spoken }
 *  - water { glasses, of, spoken }
 *  - sleep, sleepSpoken; walk, walkSpoken
 *  - week (Monday to Sunday of this week)
 *  - on: food, water, addGlass, sleep, walk, steps (hero opens the steps
 *    detail), premium (a locked tile was tapped), profile, calendar(dayKey?)
 *    (a tapped week-strip day)
 *  - slots: walking, note(style), below (the untimed-steps note, mood check-in,
 *    goal suggestion, weather offer: what follows the tiles), locked (the
 *    premium card, drawn under the four locked tiles)
 * The screen frame (page colour, side gutter) is passed beside it as TodayFrameLook.
 */

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type { Measure, SleepFigure, WalkFigure, WeekDay } from './model';

export interface TodayView {
  /** "Sat, 14 Nov". */
  dateLabel: string;
  /** The greeting's name; null = "Good morning" alone. */
  name: string | null;
  /** The avatar letter ("" without a name). */
  initial: string;
  steps: number;
  goal: number;
  /** Whole percent of the goal. */
  pct: number;
  /** The hero's spoken summary: "6,240 of 8,000 steps, 78%, 1,760 to go. 4.6 kilometres, 52 minutes active." */
  stepsSpoken: string;
  distance: Measure | null;
  /** 'km' or 'mi': the unit of "0 km" when there is no distance yet. */
  distanceUnit: string;
  activeMin: number | null;
  /** Steps in each hour of today, 24 numbers. */
  hourly: number[];
  /** The current hour, 0 to 23: later hours draw quiet. */
  nowHour: number;
  /** Premium: the four tiles with their figures. Free: the steps hero, the walk card, four locked tiles and the premium card. */
  details: boolean;
  food: {
    /** "1,280", "≥ 1,280" when part of a food isn't counted yet. */
    text: string;
    /** "1,900": the day's energy. */
    target: string;
    share: number;
    /** Part of a food isn't counted yet. */
    partial: boolean;
    spoken: string;
  };
  water: {
    glasses: number;
    /** The glasses target, or null when there's none (or it is a doctor's limit). */
    of: number | null;
    spoken: string;
  };
  sleep: SleepFigure | null;
  /** "Sleep, 6 hours 50 minutes" or "Sleep, no data". */
  sleepSpoken: string;
  walk: WalkFigure | null;
  /** "Morning walk, 2.3 km, 32 minutes, 3,120 steps" or "Walk, no walk yet today". */
  walkSpoken: string;
  week: WeekDay[];
  on: {
    food(): void;
    water(): void;
    addGlass(): void;
    sleep(): void;
    walk(): void;
    /** The hero: the steps detail. */
    steps(): void;
    /** A Premium-locked tile was tapped: bring up the premium card. */
    premium(): void;
    profile(): void;
    /** A week-strip day was tapped: open that day (its key, "2026-11-14"). */
    calendar(dayKey?: string): void;
  };
  slots: {
    /** A walk being recorded: the 72 dp card between the hero and the tiles. */
    walking: ReactNode;
    /** The one-time appearance note, placed with `style`; draws nothing once seen. */
    note(style?: StyleProp<ViewStyle>): ReactNode;
    /** Under the note: the untimed-steps note, the mood check-in, goal suggestion and weather offer. */
    below: ReactNode;
    /** The premium card, under the locked tiles for the free app. */
    locked: ReactNode;
  };
}

/** How the screen sits: its page colour (Today's root background) and side gutter (the theme's, passed in by the screen). */
export interface TodayFrameLook {
  background: string;
  gutter: number;
}
