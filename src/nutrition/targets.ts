/**
 * The person's own daily targets: energy from their resting burn and activity,
 * protein from their weight, carbs, fat and fibre from the energy target, and
 * the "low" line for each vitamin and mineral. Every line is for a healthy,
 * non-pregnant adult, so "My needs are different" (and anyone under 18) gets
 * numbers only.
 */
import type { Profile, Sex } from '@/data/types';
import { DEFAULT_AGE, restingKcalPerDay } from '@/lib/calories';

import { NUTRIENT } from './nutrients';
import type { NutrientKey, Nutrients } from './types';

type Body = Pick<Profile, 'weightKg' | 'heightCm' | 'sex' | 'birthYear'>;

/** Age in `year`, or null when the birth year isn't set. */
export function ageIn(p: Pick<Profile, 'birthYear'>, year: number): number | null {
  return p.birthYear ? year - p.birthYear : null;
}

/** Numbers only, no verdicts: "My needs are different" is on, or the person is under 18. */
export function needsAreDifferent(p: Pick<Profile, 'birthYear' | 'nutrition'>, year: number): boolean {
  const age = ageIn(p, year);
  return p.nutrition.differentNeeds || (age !== null && age < 18);
}

/**
 * Today's energy target: resting energy plus what was burned walking, or a
 * fifth of resting energy for ordinary moving about, whichever is more.
 */
export function dayKcalTarget(p: Body, activeKcal: number, year: number): number {
  const r = restingKcalPerDay(p, year);
  return r + Math.max(Math.round(activeKcal), Math.round(0.2 * r));
}

/** A whole day's energy for a lightly active day: what past days are measured against. */
export function fullDayKcal(p: Body, year: number): number {
  return Math.round(1.2 * restingKcalPerDay(p, year));
}

/** Weight at BMI 25 for the height: protein is not scaled up for weight above that. */
export function proteinWeightKg(p: Pick<Profile, 'weightKg' | 'heightCm'>): number {
  const m = p.heightCm / 100;
  return Math.min(p.weightKg, 25 * m * m);
}

/** ICMR-NIN 2020: RDA 0.83 g/kg, EAR 0.66 g/kg, on weight capped at BMI 25. */
export function proteinTarget(p: Pick<Profile, 'weightKg' | 'heightCm'>): { daily: number; low: number } {
  const kg = proteinWeightKg(p);
  return { daily: Math.round(0.83 * kg), low: Math.round(0.66 * kg * 10) / 10 };
}

/** DGI 2024: carbs about 55% of energy (4 kcal/g). Shown without a verdict. */
export const carbsTarget = (kcal: number): number => Math.round((0.55 * kcal) / 4);

/** DGI 2024: fat about 30% of energy (9 kcal/g). Shown without a verdict. */
export const fatTarget = (kcal: number): number => Math.round((0.3 * kcal) / 9);

/** 14 g per 1,000 kcal, never under 25 g. An adequate intake; the low line is two-thirds of it. */
export function fiberTarget(kcal: number): { daily: number; low: number } {
  const daily = Math.round(Math.max(25, (14 * kcal) / 1000));
  return { daily, low: Math.round(((daily * 2) / 3) * 10) / 10 };
}

/** Iron's higher line is a premenopausal need. */
const IRON_HIGH_LINE_UNTIL_AGE = 50;

/** The low line for a vitamin or mineral, for this sex and age (null age = the app's default age). */
export function lowLine(key: NutrientKey, sex: Sex, age: number | null = null): number | undefined {
  const n = NUTRIENT[key];
  if (sex === 'female' && n.lowFemale !== undefined) {
    if (key === 'iron' && (age ?? DEFAULT_AGE) >= IRON_HIGH_LINE_UNTIL_AGE) return n.low;
    return n.lowFemale;
  }
  if (sex === 'male' && n.lowMale !== undefined) return n.lowMale;
  return n.low;
}

/** What a full bar, and the low line, mean for one nutrient for this person. */
export interface Target {
  /** The full bar: the person's own figure for energy and macros, the daily value otherwise. */
  daily?: number;
  /** Below this: "Low" / "Could be higher" on a judged day. */
  low?: number;
  /** Limit nutrients: the most per day. */
  limit?: number;
}

export interface TargetContext {
  sex: Sex;
  weightKg: number;
  /** For protein's BMI-25 cap; the app's default height when left out. */
  heightCm?: number;
  /** For iron's line. */
  age?: number | null;
  /** The day's energy target: carbs, fat and fibre follow it. 2,000 when left out. */
  kcalTarget?: number;
}

const DEFAULT_KCAL = 2000;
const DEFAULT_HEIGHT_CM = 165;

export function targetFor(key: NutrientKey, ctx: TargetContext): Target {
  const kcal = ctx.kcalTarget ?? DEFAULT_KCAL;
  const n = NUTRIENT[key];
  switch (key) {
    case 'kcal':
      return { daily: kcal };
    case 'protein':
      return proteinTarget({ weightKg: ctx.weightKg, heightCm: ctx.heightCm ?? DEFAULT_HEIGHT_CM });
    case 'carbs':
      return { daily: carbsTarget(kcal) };
    case 'fat':
      return { daily: fatTarget(kcal) };
    case 'fiber':
      return fiberTarget(kcal);
    default:
      return { daily: n.daily, low: lowLine(key, ctx.sex, ctx.age ?? null), limit: n.limit };
  }
}

export interface EnergySplit {
  carbs: number;
  protein: number;
  fat: number;
}

/** Below this much energy from the three, a split means nothing. */
const MIN_SPLIT_KCAL = 50;

/**
 * Percent of energy from carbs, protein and fat (4/4/9 kcal per gram), adding
 * up to 100. Null under 50 kcal, or when any of the three is known for less
 * than 80% of what was eaten (`coverage`, from state.ts).
 */
export function energySplit(n: Nutrients, coverage?: Partial<Record<NutrientKey, number>>): EnergySplit | null {
  if (coverage && (['carbs', 'protein', 'fat'] as const).some((k) => (coverage[k] ?? 0) < 0.8)) return null;
  const kcal = { carbs: (n.carbs ?? 0) * 4, protein: (n.protein ?? 0) * 4, fat: (n.fat ?? 0) * 9 };
  const total = kcal.carbs + kcal.protein + kcal.fat;
  if (total < MIN_SPLIT_KCAL) return null;
  // Largest remainder, so the three always add up to exactly 100.
  const keys = ['carbs', 'protein', 'fat'] as const;
  const raw = keys.map((k) => (kcal[k] / total) * 100);
  const out = raw.map(Math.floor);
  const order = raw.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
  for (let left = 100 - out.reduce((a, b) => a + b, 0), j = 0; left > 0; left--, j++) out[order[j].i] += 1;
  return { carbs: out[0], protein: out[1], fat: out[2] };
}

/** DGI 2024 bands. */
export const BALANCED_SPLIT = { carbs: [45, 65], proteinMin: 10, fat: [20, 30] } as const;

export type SplitVerdict = 'balanced' | 'more-carbs' | 'more-fat' | 'less-fat' | 'less-carbs' | 'less-protein';

/** Judged on the week only. The first band missed, carbs first. */
export function splitVerdict(s: EnergySplit): SplitVerdict {
  if (s.carbs > BALANCED_SPLIT.carbs[1]) return 'more-carbs';
  if (s.fat > BALANCED_SPLIT.fat[1]) return 'more-fat';
  if (s.protein < BALANCED_SPLIT.proteinMin) return 'less-protein';
  if (s.carbs < BALANCED_SPLIT.carbs[0]) return 'less-carbs';
  if (s.fat < BALANCED_SPLIT.fat[0]) return 'less-fat';
  return 'balanced';
}

/** One neutral line for the Week tab. */
export const SPLIT_TEXT: Record<SplitVerdict, string> = {
  balanced: 'Balanced',
  'more-carbs': 'More energy from carbs than usual',
  'more-fat': 'More energy from fat than usual',
  'less-protein': 'Less energy from protein than usual',
  'less-carbs': 'Less energy from carbs than usual',
  'less-fat': 'Less energy from fat than usual',
};
