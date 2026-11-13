/**
 * Water: a suggested daily target, extra on hot or active days, what counts
 * as drinking, and when a gentle reminder is fair. Pure, so jest runs it.
 *
 * The suggestion is 30 ml per kg, between 1.5 and 3 L, 2 L when the weight
 * isn't known: ICMR-NIN DGI 2024 says about 2 L a day including drinks, EFSA
 * 2010 about 1.6 L (women) and 2.0 L (men) from drinks, the NHS 6–8 glasses.
 * All three assume moderate temperatures; the heat extra is our own rule.
 */
import type { FoodEntry, LogEntry, Profile, WaterSettings } from '@/data/types';
import { addDaysToKey, parseDayKey } from '@/lib/dates';
import { formatTemp, formatWater, type Units } from '@/lib/format';
import { findFood, gramsFor, type PortionOverrides } from '@/nutrition/catalog';
import type { FoodItem, OwnFood } from '@/nutrition/types';

const ROUND_ML = 250;
export const SUGGEST_MIN_ML = 1500;
export const SUGGEST_MAX_ML = 3000;
export const SUGGEST_DEFAULT_ML = 2000;
const ML_PER_KG = 30;

/** 30 ml per kg rounded to 250 ml, 1.5–3 L; 2 L without a weight. 55 kg → 1750, 65 → 2000, 80 → 2500. */
export function suggestWaterMl(kg: number | null | undefined): number {
  if (!kg || kg <= 0) return SUGGEST_DEFAULT_ML;
  const ml = Math.round((ML_PER_KG * kg) / ROUND_ML) * ROUND_ML;
  return Math.min(SUGGEST_MAX_ML, Math.max(SUGGEST_MIN_ML, ml));
}

/** "From your weight, 65 kg", or "A common starting point" when the weight isn't really theirs. */
export function suggestionBasis(weightKg: number, weightKnown: boolean, units: Units): string {
  if (!weightKnown) return 'A common starting point';
  const w = units === 'metric' ? `${Math.round(weightKg)} kg` : `${Math.round(weightKg * 2.2046226)} lb`;
  return `From your weight, ${w}`;
}

/** 750 ml at 40 °C or more, 500 at 35, 250 at 30; nothing cooler or unknown. */
export function heatExtraMl(tempMaxC: number | null | undefined): number {
  if (tempMaxC === null || tempMaxC === undefined || !Number.isFinite(tempMaxC)) return 0;
  if (tempMaxC >= 40) return 750;
  if (tempMaxC >= 35) return 500;
  if (tempMaxC >= 30) return 250;
  return 0;
}

/** Steps above this earn extra water. A fixed figure, so a low goal doesn't earn extras a high goal hides. */
export const STEPS_EXTRA_FROM = 7000;
const STEPS_EXTRA_EVERY = 3000;

/** 250 ml per full 3,000 steps above 7,000, at most 500 ml. */
export function stepsExtraMl(steps: number | null | undefined): number {
  if (!steps || steps <= STEPS_EXTRA_FROM) return 0;
  return Math.min(500, Math.floor((steps - STEPS_EXTRA_FROM) / STEPS_EXTRA_EVERY) * 250);
}

/** Extras together never add more than this… */
export const EXTRAS_MAX_ML = 1500;
/** …nor take the total past this. The person's own target is never cut. */
export const TOTAL_MAX_ML = 4000;

/** The Stepper's range: down to 500 ml when a doctor sets a limit (dialysis limits can be under 1 L). */
export function stepperRange(doctorLimit: boolean): { min: number; max: number; step: number } {
  return { min: doctorLimit ? 500 : 1000, max: 5000, step: ROUND_ML };
}

export interface WaterTarget {
  /** The day's figure: a goal, or with doctorLimit a ceiling. */
  ml: number;
  base: number;
  heat: number;
  steps: number;
  /** "2.0 L + 0.5 L for heat (37°C)". */
  label: string;
  /** No target saved yet: working against the suggestion. */
  suggested: boolean;
  /** doctorLimit: show "1.2 of 1.5 L limit", never "Target reached", never a push to fill up. */
  limit: boolean;
}

export interface TargetOptions {
  /** The day's highest temperature, from repo.getWeather(today). */
  tempMaxC?: number | null;
  steps?: number | null;
  /** True when the weight is the person's (Profile.weightSet, or any weight log). */
  weightKnown?: boolean;
  /** "Numbers only" (needsAreDifferent): no suggestion, no extras. */
  numbersOnly?: boolean;
}

/**
 * Today's target, or null when there is none to show: "numbers only" or a
 * doctor's limit without a saved figure (the suggestion is hidden then).
 */
export function waterTarget(profile: Pick<Profile, 'water' | 'weightKg' | 'weightSet' | 'units'>, opts: TargetOptions = {}): WaterTarget | null {
  const w = profile.water;
  const noSuggestion = w.doctorLimit || opts.numbersOnly;
  if (w.targetMl === null && noSuggestion) return null;
  const known = opts.weightKnown ?? profile.weightSet;
  const base = w.targetMl ?? suggestWaterMl(known ? profile.weightKg : null);
  const extrasOn = w.extras && !noSuggestion;
  let heat = extrasOn ? heatExtraMl(opts.tempMaxC) : 0;
  let steps = extrasOn ? stepsExtraMl(opts.steps) : 0;
  // Cap the extras (1.5 L, and 4 L in all) by trimming steps first, then heat.
  const room = Math.max(0, Math.min(EXTRAS_MAX_ML, TOTAL_MAX_ML - base));
  if (heat + steps > room) {
    steps = Math.max(0, Math.min(steps, room - heat));
    heat = Math.min(heat, room - steps);
  }
  const label = targetLabel({ base, heat, steps }, opts.tempMaxC ?? null, profile.units);
  return { ml: base + heat + steps, base, heat, steps, label, suggested: w.targetMl === null, limit: w.doctorLimit };
}

/** "2.0 L", "2.25 L", "0.5 L"; "68 fl oz" in imperial (formatWater). */
export function formatLitres(ml: number, units: Units): string {
  if (units !== 'metric') return formatWater(ml, units);
  return `${litres(ml)} L`;
}

function litres(ml: number): string {
  const l = Math.round(ml / 10) / 100;
  return Number.isInteger(l * 10) ? l.toFixed(1) : l.toFixed(2);
}

/** "2.0 L + 0.5 L for heat (37°C) + 0.25 L for steps". */
export function targetLabel(t: { base: number; heat: number; steps: number }, tempMaxC: number | null, units: Units): string {
  const parts = [formatLitres(t.base, units)];
  if (t.heat) parts.push(`${formatLitres(t.heat, units)} for heat${tempMaxC !== null ? ` (${formatTemp(tempMaxC, units)})` : ''}`);
  if (t.steps) parts.push(`${formatLitres(t.steps, units)} for steps`);
  return parts.join(' + ');
}

/** "1.25 of 2.25 L", "1.2 of 1.5 L limit", "42 of 76 fl oz". */
export function waterProgressText(drunkMl: number, target: Pick<WaterTarget, 'ml' | 'limit'>, units: Units): string {
  const text =
    units === 'metric'
      ? `${litres(drunkMl)} of ${litres(target.ml)} L`
      : `${Math.round(drunkMl / 29.5735)} of ${formatWater(target.ml, units)}`;
  return target.limit ? `${text} limit` : text;
}

/** Food ids that are drinks without being in the 'drink' category. */
export const DRINK_IDS: readonly string[] = ['milk', 'milk-toned', 'milk-buffalo', 'buttermilk-plain'];

/** True for a food whose grams count as ml of drinking: drinks (tea, coffee, chaas, lassi…) and milk; never alcohol. */
export function isDrink(food: FoodItem): boolean {
  if ((food.per100g.alcohol ?? 0) > 0) return false;
  return food.category === 'drink' || DRINK_IDS.includes(food.id);
}

/**
 * Ml of drinks among food entries (grams as ml). Calorie-only entries can't
 * be told apart and don't count; neither does anything with alcohol.
 */
export function drinkMl(entries: FoodEntry[], own: OwnFood[], overrides: PortionOverrides, saved: FoodItem[] = []): number {
  let ml = 0;
  for (const e of entries) {
    if (!e.foodId || !e.unit || e.quantity === null) continue;
    const food = findFood(e.foodId, own, saved);
    if (!food || !isDrink(food)) continue;
    ml += gramsFor(food, e.unit, e.quantity, overrides);
  }
  return Math.round(ml);
}

/** Times of drink entries, for "no drink in the last 90 minutes". */
export function drinkTimes(entries: FoodEntry[], own: OwnFood[], saved: FoodItem[] = []): number[] {
  return entries
    .filter((e) => {
      if (!e.foodId) return false;
      const food = findFood(e.foodId, own, saved);
      return food !== null && isDrink(food);
    })
    .map((e) => e.loggedAt);
}

/** Water logged in [from, to), ml. */
export function waterBetween(logs: Pick<LogEntry, 'loggedAt' | 'value'>[], fromMs: number, toMs: number): number {
  return logs.reduce((a, l) => (l.loggedAt >= fromMs && l.loggedAt < toMs ? a + l.value : a), 0);
}

export interface WaterProgress {
  /** Water plus drinks. */
  totalMl: number;
  /** 0–1+, of the target. */
  fraction: number;
  /** Whole glasses drunk, rounded down. */
  glasses: number;
  /** Glasses in the target, rounded up. */
  glassesTarget: number;
}

export function waterProgress(waterMl: number, drinksMl: number, targetMl: number, glassMl: number): WaterProgress {
  const totalMl = waterMl + drinksMl;
  return {
    totalMl,
    fraction: targetMl > 0 ? totalMl / targetMl : 0,
    glasses: Math.floor(totalMl / glassMl),
    glassesTarget: Math.ceil(targetMl / glassMl),
  };
}

// ── reminders ────────────────────────────────────────────────────────────

/** kv waterReminders: today's reminders, plus what carries over between days. */
export interface WaterReminderLog {
  day: string;
  /** Reminder times today. */
  sent: number[];
  /** Reminders in a row with no drink logged within 60 minutes. */
  ignoredStreak: number;
  /** "No more reminders today". */
  snoozed: boolean;
  /** The target as it was when reached today: it stays reached, extras frozen. */
  reached: WaterTarget | null;
  /** The last reminder whose answer (a drink within 60 min or not) isn't settled yet. */
  open: number | null;
  /** Days a reminder went out, last 7. */
  remindedDays: string[];
  /** Reminders paused after 3 reminded days with nothing logged; cleared by any drink. */
  pausedSince: number | null;
  /** "Reminders paused" was said once. */
  pauseTold: boolean;
  lastSentAt: number | null;
}

export const emptyReminderLog = (day: string): WaterReminderLog => ({
  day,
  sent: [],
  ignoredStreak: 0,
  snoozed: false,
  reached: null,
  open: null,
  remindedDays: [],
  pausedSince: null,
  pauseTold: false,
  lastSentAt: null,
});

/** A new day keeps the streak, the pause and the history; today's counts start again. */
export function rollLog(log: WaterReminderLog | null, day: string): WaterReminderLog {
  if (!log) return emptyReminderLog(day);
  const base = { ...emptyReminderLog(day), ...log };
  if (base.day === day) return base;
  return { ...base, day, sent: [], snoozed: false, reached: null };
}

const MIN = 60_000;
/** A reminder is ignored when nothing is logged within this long. */
export const IGNORED_AFTER_MS = 60 * MIN;
export const REMIND_GAP_MS = 2 * 60 * MIN;
export const RECENT_DRINK_MS = 90 * MIN;
export const MAX_REMINDERS = 3;
/** After this many ignored in a row, one a day. */
export const IGNORED_STREAK_CAP = 3;
/** Reminded days in a row with nothing logged before reminders pause. */
export const PAUSE_AFTER_DAYS = 3;

/** Settles the open reminder (drank within 60 min or not) and the pause, given every drink and water time. */
export function settleLog(log: WaterReminderLog, drinkAt: number[], now: number, today: string): WaterReminderLog {
  let next = { ...log };
  if (next.open !== null) {
    const open = next.open;
    const answered = drinkAt.some((t) => t >= open && t <= open + IGNORED_AFTER_MS);
    if (answered) next = { ...next, open: null, ignoredStreak: 0 };
    else if (now - open >= IGNORED_AFTER_MS) next = { ...next, open: null, ignoredStreak: next.ignoredStreak + 1 };
  }
  if (next.pausedSince !== null) {
    const since = next.pausedSince;
    if (drinkAt.some((t) => t >= since)) next = { ...next, pausedSince: null, pauseTold: false, ignoredStreak: 0 };
  } else if (shouldPause(next, drinkAt, today)) {
    next = { ...next, pausedSince: now, pauseTold: false };
  }
  return next;
}

/** The last 3 days all had reminders and nothing logged, and nothing is logged today either. */
function shouldPause(log: WaterReminderLog, drinkAt: number[], today: string): boolean {
  const days = Array.from({ length: PAUSE_AFTER_DAYS }, (_, i) => addDaysToKey(today, -(i + 1)));
  if (!days.every((day) => log.remindedDays.includes(day))) return false;
  const from = parseDayKey(days[days.length - 1]).getTime();
  return !drinkAt.some((t) => t >= from);
}

export interface ReminderState {
  now: Date;
  settings: WaterSettings;
  /** Today's target (WaterTarget.ml); null when there is none. */
  targetMl: number | null;
  /** Water plus drinks today. */
  drunkMl: number;
  /** Target reached earlier today (sticky). */
  reached: boolean;
  /** Last water log or drink entry, any day. */
  lastDrinkAt: number | null;
  /** Rolled to today and settled. */
  log: WaterReminderLog;
  /** "Numbers only". */
  numbersOnly?: boolean;
}

/** Elapsed share of the reminder window, 0–1. */
export function windowFraction(now: Date, fromHour: number, untilHour: number): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), fromHour).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), untilHour).getTime();
  if (end <= start) return 0;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

/** True only when every gate holds (see the nutrition spec, plus the pause after 3 quiet days). */
export function waterReminderDue(s: ReminderState): boolean {
  const { settings: w, now, log } = s;
  if (!w.remind || w.doctorLimit || s.numbersOnly || w.targetMl === null || s.targetMl === null) return false;
  const hour = now.getHours();
  if (hour < w.fromHour + 1 || hour >= w.untilHour) return false;
  if (s.reached || s.drunkMl >= s.targetMl) return false;
  const expected = s.targetMl * windowFraction(now, w.fromHour, w.untilHour);
  if (!(s.drunkMl < 0.8 * expected) || expected - s.drunkMl < w.glassMl) return false;
  const t = now.getTime();
  if (s.lastDrinkAt !== null && t - s.lastDrinkAt < RECENT_DRINK_MS) return false;
  if (log.lastSentAt !== null && t - log.lastSentAt < REMIND_GAP_MS) return false;
  const cap = log.ignoredStreak >= IGNORED_STREAK_CAP ? 1 : MAX_REMINDERS;
  if (log.sent.length >= cap) return false;
  if (log.snoozed || log.pausedSince !== null) return false;
  return true;
}

/** The log after a reminder went out. */
export function noteReminderSent(log: WaterReminderLog, now: number): WaterReminderLog {
  const remindedDays = [...new Set([...log.remindedDays, log.day])].sort().slice(-7);
  return { ...log, sent: [...log.sent, now], open: now, lastSentAt: now, remindedDays };
}

/**
 * Once reached, the day's extras freeze: more steps or heat later don't move
 * the target. "Reached" is still worked out from the total each time, so
 * undoing the glass that reached it un-reaches it, and a new base target
 * (Settings, the sheet, a new weight) drops the frozen one.
 */
export function stickyTarget(
  target: WaterTarget,
  totalMl: number,
  log: WaterReminderLog,
): { target: WaterTarget; reached: boolean; log: WaterReminderLog } {
  const frozen = log.reached && !target.limit && log.reached.base === target.base ? log.reached : null;
  if (frozen) return { target: frozen, reached: totalMl >= frozen.ml, log };
  const cleared = log.reached ? { ...log, reached: null } : log;
  if (target.limit) return { target, reached: false, log: cleared };
  if (totalMl >= target.ml) return { target, reached: true, log: { ...log, reached: target } };
  return { target, reached: false, log: cleared };
}
