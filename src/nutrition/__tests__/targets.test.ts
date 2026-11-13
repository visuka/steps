import { describe, expect, it } from '@jest/globals';

import { DEFAULT_PROFILE } from '@/data/profile';
import type { Profile } from '@/data/types';
import { restingKcalPerDay } from '@/lib/calories';
import {
  ageIn,
  carbsTarget,
  dayKcalTarget,
  energySplit,
  fatTarget,
  fiberTarget,
  fullDayKcal,
  lowLine,
  needsAreDifferent,
  proteinTarget,
  splitVerdict,
  targetFor,
} from '@/nutrition/targets';

const YEAR = 2026;
const person = (over: Partial<Profile> = {}): Profile => ({ ...DEFAULT_PROFILE, ...over });

describe('energy target', () => {
  const p = person(); // 65 kg, 165 cm, sex not set, age 30: resting 1,453 kcal
  it('adds a fifth of resting energy on a still day', () => {
    expect(restingKcalPerDay(p, YEAR)).toBe(1453);
    expect(dayKcalTarget(p, 0, YEAR)).toBe(1453 + 291);
    expect(dayKcalTarget(p, 120, YEAR)).toBe(1453 + 291);
  });
  it('adds the walking energy when that is more', () => {
    expect(dayKcalTarget(p, 400, YEAR)).toBe(1853);
  });
  it('measures past days against 1.2 × resting', () => {
    expect(fullDayKcal(p, YEAR)).toBe(1744);
  });
});

describe('macro targets', () => {
  it('protein is 0.83 g/kg with a 0.66 g/kg low line', () => {
    expect(proteinTarget({ weightKg: 60, heightCm: 170 })).toEqual({ daily: 50, low: 39.6 });
  });
  it('protein uses the weight at BMI 25 for heavier people', () => {
    // 120 kg at 170 cm counts as 72.25 kg: 60 g, not 100 g.
    expect(proteinTarget({ weightKg: 120, heightCm: 170 })).toEqual({ daily: 60, low: 47.7 });
  });
  it('fibre is 14 g per 1,000 kcal with a 25 g floor, low at two-thirds', () => {
    expect(fiberTarget(1500)).toEqual({ daily: 25, low: 16.7 });
    expect(fiberTarget(2500)).toEqual({ daily: 35, low: 23.3 });
  });
  it('carbs are 55% and fat 30% of energy', () => {
    expect(carbsTarget(2000)).toBe(275);
    expect(fatTarget(2000)).toBe(67);
    expect(targetFor('carbs', { sex: 'female', weightKg: 55, kcalTarget: 2000 })).toEqual({ daily: 275 });
  });
});

describe('low lines', () => {
  it('iron is 15 mg for women under 50, 11 mg otherwise and when sex is not set', () => {
    expect(lowLine('iron', 'female', 30)).toBe(15);
    expect(lowLine('iron', 'female', null)).toBe(15);
    expect(lowLine('iron', 'female', 50)).toBe(11);
    expect(lowLine('iron', 'male', 30)).toBe(11);
    expect(lowLine('iron', 'unspecified', 30)).toBe(11);
  });
  it('magnesium is higher for men, lower when sex is not set', () => {
    expect(lowLine('magnesium', 'male')).toBe(370);
    expect(lowLine('magnesium', 'female')).toBe(310);
    expect(lowLine('magnesium', 'unspecified')).toBe(310);
  });
  it('potassium is two-thirds of the ICMR adequate intake', () => {
    expect(lowLine('potassium', 'unspecified')).toBe(2340);
  });
});

describe('energy split', () => {
  it('adds up to exactly 100', () => {
    for (const n of [
      { carbs: 250, protein: 60, fat: 55 },
      { carbs: 33.3, protein: 33.3, fat: 14.8 },
      { carbs: 10, protein: 1, fat: 3 },
    ]) {
      const s = energySplit(n)!;
      expect(s.carbs + s.protein + s.fat).toBe(100);
    }
  });
  it('is null under 50 kcal', () => {
    expect(energySplit({ carbs: 5, protein: 2, fat: 1 })).toBeNull(); // 37 kcal
    expect(energySplit({})).toBeNull();
  });
  it('is null when a macro is known for under 80% of what was eaten', () => {
    expect(energySplit({ carbs: 250, protein: 60, fat: 55 }, { carbs: 1, protein: 0.7, fat: 1 })).toBeNull();
    expect(energySplit({ carbs: 250, protein: 60, fat: 55 }, { carbs: 1, protein: 0.9, fat: 1 })).not.toBeNull();
  });
  it('judges the balance neutrally', () => {
    expect(splitVerdict({ carbs: 55, protein: 15, fat: 30 })).toBe('balanced');
    expect(splitVerdict({ carbs: 70, protein: 10, fat: 20 })).toBe('more-carbs');
    expect(splitVerdict({ carbs: 50, protein: 12, fat: 38 })).toBe('more-fat');
    expect(splitVerdict({ carbs: 63, protein: 8, fat: 29 })).toBe('less-protein');
  });
});

describe('numbers only', () => {
  it('is on with the switch, or under 18 by birth year', () => {
    expect(needsAreDifferent(person(), YEAR)).toBe(false);
    expect(needsAreDifferent(person({ nutrition: { ...DEFAULT_PROFILE.nutrition, differentNeeds: true } }), YEAR)).toBe(true);
    expect(needsAreDifferent(person({ birthYear: 2010 }), YEAR)).toBe(true);
    expect(needsAreDifferent(person({ birthYear: 2008 }), YEAR)).toBe(false);
    expect(ageIn(person({ birthYear: 1970 }), YEAR)).toBe(56);
  });
});
