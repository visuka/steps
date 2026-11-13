/**
 * The Insights card "Nutrition, last week": the same rules as the Food tab's
 * Week view (judged days only, 4+ days that count per nutrient, the low line,
 * coverage, 'ai' wording, diet-aware sources, numbers only when needs differ).
 * Pure, so jest runs it.
 */
import type { Profile } from '@/data/types';
import { addDaysToKey, dayKey } from '@/lib/dates';

import { sourcesFor } from './diet';
import { averageOfJudged, type DayIntake, weekJudgedFor, weekReady, weekWaitText } from './gaps';
import { NUTRIENT } from './nutrients';
import { sourceOptions, type NutritionWindow } from './notes';
import type { NutrientKey } from './types';
import { MINERAL_KEYS, nutrientRows, VITAMIN_KEYS, viewContext, WATCH_KEYS } from './view';

export interface WeekInsightRow {
  key: NutrientKey;
  label: string;
  /** Of the daily need (low rows) or of the limit (over rows). */
  percent: number;
}

export type WeekInsight =
  /** Fewer than 4 judged days. */
  | { kind: 'waiting'; judgedDays: number; text: string }
  /** "My needs are different" or under 18: no verdicts here. */
  | { kind: 'plain'; judgedDays: number }
  | { kind: 'ready'; judgedDays: number; low: WeekInsightRow[]; over: WeekInsightRow[]; sourcesLine: string | null };

/** Protein and fiber, then vitamins and minerals: what can be "low". */
const LOW_KEYS: readonly NutrientKey[] = ['protein', 'fiber', ...VITAMIN_KEYS, ...MINERAL_KEYS];

export function weekInsight(
  window: Pick<NutritionWindow, 'days' | 'entries' | 'notForMe' | 'book'>,
  profile: Profile,
  now: Date,
  max = 3,
): WeekInsight {
  const today = dayKey(now);
  const from = addDaysToKey(today, -6);
  const days: DayIntake[] = window.days.filter((d) => d.day >= from && d.day <= today);
  const week = averageOfJudged(days);
  if (!weekReady(week.judgedDays)) return { kind: 'waiting', judgedDays: week.judgedDays, text: weekWaitText(week.judgedDays) ?? '' };
  const ctx = viewContext(profile, now, 0);
  if (ctx.plain) return { kind: 'plain', judgedDays: week.judgedDays };

  const judgedFor = (key: NutrientKey) => weekJudgedFor(week, key);
  const toRow = (r: { key: NutrientKey; label: string; state: { percent: number | null } }): WeekInsightRow => ({
    key: r.key,
    label: r.label,
    percent: r.state.percent ?? 0,
  });
  const low = nutrientRows(LOW_KEYS, week.average, week.coverage, ctx, judgedFor, 'percent')
    .filter((r) => r.state.state === 'low')
    .sort((a, b) => (a.state.percent ?? 0) - (b.state.percent ?? 0))
    .slice(0, max)
    .map(toRow);
  const over = nutrientRows(WATCH_KEYS, week.average, week.coverage, ctx, judgedFor, 'of')
    .filter((r) => r.state.state === 'over')
    .sort((a, b) => (b.state.percent ?? 0) - (a.state.percent ?? 0))
    .map(toRow);

  let sourcesLine: string | null = null;
  if (low[0]) {
    const s = sourcesFor(low[0].key, profile.nutrition.diet, sourceOptions(window, now));
    const label = NUTRIENT[low[0].key].label;
    sourcesLine = s.foods.length ? `Good for ${label.charAt(0).toLowerCase()}${label.slice(1)}: ${s.foods.map((f) => f.label).join(', ')}` : s.line;
  }
  return { kind: 'ready', judgedDays: week.judgedDays, low, over, sourcesLine };
}
