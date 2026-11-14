/**
 * What the Food tab shows for a day or a week: the nutrient rows in their
 * groups, each with its state word, the short header of a group ("6 on track
 * · 2 low · 3 not known"), which rows come first, and the high watch-outs
 * among the day's foods. Pure, so jest runs it.
 */
import type { FoodEntry, Profile } from '@/data/types';
import { formatSteps } from '@/lib/format';

import { findFood, gramsFor, type PortionOverrides } from './catalog';
import type { DayIntake } from './gaps';
import { NUTRIENT, nutrientNumber, NUTRIENTS } from './nutrients';
import type { PartialKeys } from './day';
import { AT_LEAST, LIMIT_KEYS, nutrientState, type NutrientState, type NutrientStateKind, spokenNutrient, SHOW_COVERAGE, type StateContext, valueText } from './state';
import { ageIn, dayKcalTarget, needsAreDifferent, type TargetContext } from './targets';
import type { FoodItem, NutrientKey, Nutrients, OwnFood } from './types';
import { watchOuts } from './watch';

export const MACRO_KEYS: readonly NutrientKey[] = ['protein', 'carbs', 'fat', 'fiber'];
/** The four with a red "Too much". */
export const WATCH_KEYS: readonly NutrientKey[] = ['sodium', 'addedSugar', 'satFat', 'transFat'];
export const VITAMIN_KEYS: readonly NutrientKey[] = NUTRIENTS.filter((n) => n.group === 'vitamin').map((n) => n.key);
/** Omega-3 sits at the end of Minerals, as "Other". */
export const MINERAL_KEYS: readonly NutrientKey[] = [...NUTRIENTS.filter((n) => n.group === 'mineral').map((n) => n.key), 'omega3'];

/** The person's side of every state: sex, weight, age, today's energy target, numbers only. */
export interface ViewContext extends TargetContext {
  plain: boolean;
}

export function viewContext(p: Profile, now: Date, activeKcal: number): ViewContext {
  const year = now.getFullYear();
  return {
    sex: p.sex,
    weightKg: p.weightKg,
    heightCm: p.heightCm,
    age: ageIn(p, year),
    kcalTarget: dayKcalTarget(p, activeKcal, year),
    plain: needsAreDifferent(p, year),
  };
}

export interface NutrientRowData {
  key: NutrientKey;
  label: string;
  value: number | undefined;
  coverage: number;
  /** Some ingredient isn't counted yet: the value is "≥". */
  partial: boolean;
  state: NutrientState;
  /** "45 mg · 50%", "62 of 54 g", "≥ 1,200 of 2,000 mg", "Not known". */
  valueText: string;
  /** What TalkBack says for the row. */
  spoken: string;
}

/** "1,009", "45", "1.2": the shown number, with thousands grouped. */
export function amountNumber(key: NutrientKey, value: number): string {
  return value >= 1000 ? formatSteps(value) : nutrientNumber(key, value);
}

/** "62 of 54 g" (macros and limits) or "45 mg · 50%" (vitamins and minerals), "≥" before a floor; "Not known" when unknown. */
export function rowValueText(key: NutrientKey, value: number | undefined, s: NutrientState, style: 'of' | 'percent'): string {
  if (value === undefined || s.state === 'unknown') return valueText(key, value, s);
  const unit = NUTRIENT[key].unit ? ` ${NUTRIENT[key].unit}` : '';
  const least = s.atLeast ? AT_LEAST : '';
  if (style === 'of') {
    const full = LIMIT_KEYS.includes(key) ? s.target.limit : s.target.daily;
    if (full) return `${least}${amountNumber(key, value)} of ${amountNumber(key, full)}${unit}`;
  }
  const amount = `${least}${amountNumber(key, value)}${unit}`;
  return style === 'percent' && s.percent !== null ? `${amount} · ${s.percent}%` : amount;
}

/** One row per key, its state worked out against the person's targets. */
export function nutrientRows(
  keys: readonly NutrientKey[],
  totals: Nutrients,
  coverage: Partial<Record<NutrientKey, number>>,
  ctx: ViewContext,
  /** The day is judged; for a week, per nutrient (weekJudgedFor). */
  judged: boolean | ((key: NutrientKey) => boolean),
  style: 'of' | 'percent',
  /** Keys only partly known (an ingredient not counted yet): shown as "≥", never as complete. */
  partial: PartialKeys = {},
): NutrientRowData[] {
  return keys.map((key) => {
    const cov = coverage[key] ?? 0;
    const isPartial = Boolean(partial[key]);
    const sc: StateContext = {
      ...ctx,
      coverage: cov,
      judged: typeof judged === 'function' ? judged(key) : judged,
      partial: isPartial,
    };
    const value = totals[key];
    const s = nutrientState(key, value, sc);
    return {
      key,
      label: NUTRIENT[key].label,
      value,
      coverage: cov,
      partial: isPartial,
      state: s,
      valueText: rowValueText(key, value, s, style),
      spoken: spokenNutrient(key, value, s),
    };
  });
}

/** Rows a person should see first. */
const ATTENTION: readonly NutrientStateKind[] = ['over', 'low', 'near', 'soFar'];
export const needsAttention = (r: NutrientRowData): boolean => ATTENTION.includes(r.state.state);

const ORDER: readonly NutrientStateKind[] = ['over', 'low', 'near', 'soFar', 'sun', 'unknown', 'ok', 'none', 'plain'];

/** Rows that need a look first (too much, low, near, so far), then the rest; otherwise the usual order. */
export function attentionFirst(rows: NutrientRowData[]): NutrientRowData[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => ORDER.indexOf(a.r.state.state) - ORDER.indexOf(b.r.state.state) || a.i - b.i)
    .map((x) => x.r);
}

/** How many rows a group shows before "Show all". */
export const COLLAPSED_ROWS = 4;

/** The rows shown while a group is collapsed: only those needing a look, at most four. */
export function collapsedRows(rows: NutrientRowData[]): NutrientRowData[] {
  return attentionFirst(rows).filter(needsAttention).slice(0, COLLAPSED_ROWS);
}

const SUMMARY_ORDER: readonly NutrientStateKind[] = ['ok', 'over', 'near', 'low', 'soFar', 'unknown'];
const SUMMARY_WORD: Partial<Record<NutrientStateKind, string>> = {
  ok: 'on track',
  over: 'too much',
  near: 'near the limit',
  soFar: 'so far',
  unknown: 'not known',
};

/**
 * "6 on track · 2 low · 3 not known". Adequate-intake nutrients under their
 * line count as "could be higher", never "low". Null for numbers only.
 */
export function groupSummary(rows: NutrientRowData[]): string | null {
  if (rows.every((r) => r.state.state === 'plain' || r.state.state === 'none')) return null;
  const parts: string[] = [];
  for (const kind of SUMMARY_ORDER) {
    const these = rows.filter((r) => r.state.state === kind);
    if (!these.length) continue;
    if (kind === 'low') {
      const low = these.filter((r) => !NUTRIENT[r.key].ai).length;
      const higher = these.length - low;
      if (low) parts.push(`${low} low`);
      if (higher) parts.push(`${higher} could be higher`);
      continue;
    }
    parts.push(`${these.length} ${SUMMARY_WORD[kind]}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

/** "Over on 3 of 7 days": days with food whose known figure is at or past the limit. */
export function overDays(days: Pick<DayIntake, 'total' | 'coverage'>[], key: NutrientKey): number {
  const limit = NUTRIENT[key].limit;
  if (!limit) return 0;
  return days.filter((d) => (d.coverage[key] ?? 0) >= SHOW_COVERAGE && (d.total[key] ?? 0) >= limit).length;
}

/** "Toor dal (cooked, plain)" → "Toor dal". */
export const shortFoodName = (name: string): string => name.replace(/\s*\([^)]*\)/g, '').trim() || name;

/** "Pickle: high in salt", once per food and flag, for the day's foods with a high watch-out. */
export function highWatchChips(
  entries: FoodEntry[],
  book: { own: OwnFood[]; saved: FoodItem[]; overrides: PortionOverrides },
  max = 4,
): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (!e.foodId || !e.unit || e.quantity === null) continue;
    const food = findFood(e.foodId, book.own, book.saved);
    if (!food) continue;
    for (const w of watchOuts(food, gramsFor(food, e.unit, e.quantity, book.overrides))) {
      if (w.level !== 'high') continue;
      const chip = `${shortFoodName(e.name)}: ${w.text.charAt(0).toLowerCase()}${w.text.slice(1)}`;
      if (!out.includes(chip)) out.push(chip);
    }
  }
  return out.slice(0, max);
}

/** Calories in plain words beside the track, to the nearest 10: "About 300 left", "About 300 over", "About on target". */
export function kcalBalanceText(eaten: number, target: number): string {
  if (Math.abs(target - eaten) < 25) return 'About on target';
  const diff = Math.round((target - eaten) / 10) * 10;
  return diff > 0 ? `About ${formatSteps(diff)} left` : `About ${formatSteps(-diff)} over`;
}
