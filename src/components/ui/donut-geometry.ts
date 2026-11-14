/** The macro donut (spec 5.12) as plain numbers. */

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';
import type { ColorScheme } from '@/constants/tokens';

const F = CLEAN_SPEC.sizes.foodHero;

export const DONUT = {
  size: F.donut,
  centre: F.donut / 2,
  radius: F.donutRadius,
  stroke: F.donutStroke,
  gap: F.donutGap,
  circumference: 226.2,
  kcalPerGram: { protein: 4, carbs: 4, fat: 9 },
} as const;

/** Total arc length once the three gaps are taken out: 226.2 - 3 x 3 = 217.2. */
export const DONUT_ARC_TOTAL = DONUT.circumference - 3 * DONUT.gap;

export interface DonutArc {
  len: number;
  offset: number;
}

/** Spec 5.12 rule: arc = macro kcal / sum of kcal x 217.2; offsets 0, -(P+3), -(P+3+C+3). All zero: no arcs. */
export function donutArcs(protein: number, carbs: number, fat: number): DonutArc[] {
  const k = DONUT.kcalPerGram;
  const kcal = [Math.max(0, protein) * k.protein, Math.max(0, carbs) * k.carbs, Math.max(0, fat) * k.fat];
  const sum = kcal[0] + kcal[1] + kcal[2];
  if (!(sum > 0)) return [];
  const [p, c, f] = kcal.map((v) => (v / sum) * DONUT_ARC_TOTAL);
  return [
    { len: p, offset: 0 },
    { len: c, offset: -(p + DONUT.gap) },
    { len: f, offset: -(p + DONUT.gap + c + DONUT.gap) },
  ];
}

type DonutTheme = Pick<ColorScheme, 'primary' | 'outline' | 'food' | 'food2' | 'food3'>;

/**
 * The three arcs (protein, carbs, fat). Clean+: warm food, the spec's carbs
 * grey, the accent. Every other look: its food, food2 and food3 roles, which
 * are pairwise different in every look (primary can equal food, so it is not
 * used there).
 */
export function donutColors(theme: DonutTheme): [string, string, string] {
  if (theme.primary.toUpperCase() === CLEAN_SPEC.colors.accent) {
    return [theme.food, carbsColor(theme), theme.primary];
  }
  return [theme.food, theme.food2, theme.food3];
}

/** The carbs grey has no theme role: the spec's grey on Clean+, the outline role on the other looks. */
export function carbsColor(theme: Pick<ColorScheme, 'primary' | 'outline'>): string {
  return theme.primary.toUpperCase() === CLEAN_SPEC.colors.accent ? CLEAN_SPEC.colors.carbs : theme.outline;
}

export function donutLabel(protein: number, carbs: number, fat: number): string {
  const kcal = Math.round(protein * DONUT.kcalPerGram.protein + carbs * DONUT.kcalPerGram.carbs + fat * DONUT.kcalPerGram.fat);
  return `Protein ${Math.round(protein)} g, carbs ${Math.round(carbs)} g, fat ${Math.round(fat)} g, ${kcal} kcal in total`;
}
