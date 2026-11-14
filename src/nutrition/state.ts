/**
 * The state of one nutrient bar: what colour, what word. Unknown is never
 * drawn as zero, a day is only called "low" once it is judged (more food
 * could still come), and the state is always a word, never colour alone.
 */
import { NUTRIENT, nutrientNumber } from './nutrients';
import { type Target, type TargetContext, targetFor } from './targets';
import type { NutrientKey, Nutrients } from './types';
import { type GlBand, glBand } from './watch';

export type NutrientStateKind =
  /** Not logged, or known for under 80% of what was eaten: an empty track with "Not known". */
  | 'unknown'
  /** At or over the limit (sodium, added sugar, saturated and trans fat) or the upper intake. */
  | 'over'
  /** 80% of a limit or more. */
  | 'near'
  /** At or above the low line, or comfortably under a limit. */
  | 'ok'
  /** Under the low line on a day that isn't judged yet. */
  | 'soFar'
  /** Under the low line on a judged day or week. */
  | 'low'
  /** Vitamin D under the line: it comes mostly from sunlight, so neutral. */
  | 'sun'
  /** "My needs are different": numbers only. */
  | 'plain'
  /** No verdict for this nutrient (energy, carbs, fat, sugars, alcohol, glycemic load, or cholesterol and caffeine under 80%). */
  | 'none';

/** Theme colour for the bar fill. muted = an empty track. */
export type NutrientTone = 'muted' | 'neutral' | 'accent' | 'warning' | 'danger';

export interface NutrientState {
  state: NutrientStateKind;
  tone: NutrientTone;
  /** The state word to show beside the bar; '' for none and plain. */
  word: string;
  /** Percent of the full bar (daily need, or the limit for limit nutrients), real; null when unknown or no target. */
  percent: number | null;
  /** Bar length, 0–100. Always 0 when unknown: the track is drawn empty. */
  bar: number;
  /** Where to draw the low-line tick, 0–100, when there is one. */
  lowTick: number | null;
  /** Known for 80–99% of what was eaten, or some ingredient isn't counted yet: show "≥ 45 mg". */
  atLeast: boolean;
  target: Target;
}

/** Shown in red when over the limit. Cholesterol and caffeine go to "Near" at most. */
export const RED_LIMITS: readonly NutrientKey[] = ['sodium', 'addedSugar', 'satFat', 'transFat'];
/** Limit nutrients with a verdict. */
export const LIMIT_KEYS: readonly NutrientKey[] = ['sodium', 'addedSugar', 'satFat', 'transFat', 'cholesterol', 'caffeine'];
/** Shown as amounts, with no verdict. */
const NO_VERDICT: readonly NutrientKey[] = ['kcal', 'carbs', 'fat', 'sugars', 'alcohol', 'gl'];

/** Coverage needed to show a value at all. */
export const SHOW_COVERAGE = 0.8;

const WORD: Record<NutrientStateKind, string> = {
  unknown: 'Not known',
  over: 'Too much',
  near: 'Near the limit',
  ok: 'On track',
  soFar: 'So far',
  low: 'Low',
  sun: 'Mostly from sunlight',
  plain: '',
  none: '',
};

const TONE: Record<NutrientStateKind, NutrientTone> = {
  unknown: 'muted',
  over: 'danger',
  near: 'warning',
  ok: 'accent',
  soFar: 'neutral',
  low: 'warning',
  sun: 'neutral',
  plain: 'neutral',
  none: 'neutral',
};

export interface StateContext extends TargetContext {
  /** Share of the day's (or week's) energy whose food has a figure for this nutrient (coverage()). */
  coverage: number;
  /** The day is judged ("That's all for today", or late on a full day), or the week has 4+ judged days. */
  judged: boolean;
  /** "My needs are different" or under 18: numbers only. */
  plain?: boolean;
  /** Some ingredient of the food isn't counted yet: the value is a floor ("≥"), never complete. */
  partial?: boolean;
}

/** The word for a floor under the low line: it may well be enough once everything is counted. */
export const PARTIAL_WORD = 'Not all counted';
/** The short note wherever a "≥" figure is shown. */
export const PARTIAL_NOTE = 'Some ingredients not counted yet';

/** The first rule that applies wins (see the nutrition spec). */
export function nutrientState(key: NutrientKey, value: number | undefined, ctx: StateContext): NutrientState {
  const info = NUTRIENT[key];
  const target = targetFor(key, ctx);
  const full = LIMIT_KEYS.includes(key) ? target.limit : target.daily;
  const lowTick = full && target.low !== undefined && !LIMIT_KEYS.includes(key) ? Math.min(100, (target.low / full) * 100) : null;
  const make = (state: NutrientStateKind, word = WORD[state]): NutrientState => {
    const known = state !== 'unknown' && value !== undefined;
    const percent = known && full ? Math.round((value / full) * 100) : null;
    return {
      state,
      tone: TONE[state],
      word,
      percent,
      bar: percent === null ? 0 : Math.max(0, Math.min(100, percent)),
      lowTick,
      atLeast: known && (ctx.coverage < 1 || Boolean(ctx.partial)),
      target,
    };
  };

  // 1. Unknown is never zero.
  if (value === undefined || !(ctx.coverage >= SHOW_COVERAGE)) return make('unknown');
  if (ctx.plain) return make('plain');
  if (NO_VERDICT.includes(key)) return make('none');

  // 2. Limits: more food can only add, so these show at any time.
  if (LIMIT_KEYS.includes(key) && target.limit) {
    const red = RED_LIMITS.includes(key);
    if (red && value >= target.limit) return make('over');
    if (value >= 0.8 * target.limit) return make('near');
    return make(red ? 'ok' : 'none');
  }

  // 3. Past the tolerable upper intake.
  if (info.upper !== undefined && value >= info.upper) return make('over');

  // 4. Reached the low line: stays reached, whatever else is eaten.
  if (target.low === undefined) return make('none');
  if (value >= target.low) return make('ok');

  // 5. Under the line. A floor under it says nothing yet: an ingredient isn't counted.
  if (key === 'vitD') return make('sun');
  if (ctx.partial) return make('soFar', PARTIAL_WORD);
  if (!ctx.judged) return make('soFar');
  return make('low', info.ai ? 'Could be higher' : WORD.low);
}

/**
 * Share of energy from entries that have a figure for `key`: what was eaten
 * that we can count it in. 1 when nothing has energy but something has the
 * key (water-like drinks), 0 when nothing has it.
 */
export function coverage(entries: Nutrients[], key: NutrientKey): number {
  let total = 0;
  let known = 0;
  let any = false;
  for (const n of entries) {
    const kcal = n.kcal ?? 0;
    total += kcal;
    if (n[key] !== undefined) {
      known += kcal;
      any = true;
    }
  }
  if (total <= 0) return any ? 1 : 0;
  return known / total;
}

/** coverage() for every key at once. */
export function coverageAll(entries: Nutrients[]): Partial<Record<NutrientKey, number>> {
  const out: Partial<Record<NutrientKey, number>> = {};
  for (const key of Object.keys(NUTRIENT) as NutrientKey[]) out[key] = coverage(entries, key);
  return out;
}

const UNIT_SPOKEN: Record<string, string> = { mg: 'milligrams', 'µg': 'micrograms', g: 'grams', kcal: 'calories', '': '' };

/** Before a figure that is only a floor: "≥ 45 mg". Screen readers get "at least" (spokenNutrient). */
export const AT_LEAST = '≥ ';

/** "45 mg", or "≥ 45 mg" when part of the food has no figure; "Not known" when unknown. */
export function valueText(key: NutrientKey, value: number | undefined, s: NutrientState): string {
  if (value === undefined || s.state === 'unknown') return 'Not known';
  const unit = NUTRIENT[key].unit;
  const text = unit ? `${nutrientNumber(key, value)} ${unit}` : nutrientNumber(key, value);
  return s.atLeast ? `${AT_LEAST}${text}` : text;
}

/** For TalkBack: "Vitamin C, 45 milligrams, 50 percent of daily need, low". */
export function spokenNutrient(key: NutrientKey, value: number | undefined, s: NutrientState): string {
  const info = NUTRIENT[key];
  if (value === undefined || s.state === 'unknown') return `${info.label}, not known`;
  const amount = `${s.atLeast ? 'at least ' : ''}${nutrientNumber(key, value)}${UNIT_SPOKEN[info.unit] ? ` ${UNIT_SPOKEN[info.unit]}` : ''}`;
  const of = LIMIT_KEYS.includes(key) ? 'of the limit' : 'of daily need';
  const parts = [info.label, amount];
  if (s.percent !== null) parts.push(`${s.percent} percent ${of}`);
  if (s.word) parts.push(s.word.toLowerCase());
  return parts.join(', ');
}

/** The day's glycemic-load band, on judged days only: in the morning a day always reads "Low". */
export function dayGlBand(value: number | undefined, judged: boolean): GlBand | null {
  return judged && value !== undefined ? glBand(value, 'day') : null;
}
