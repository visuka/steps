import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { clampShare, NUTRIENT_STYLE, nutrientLabel } from '../nutrient-style';

describe('nutrient row style (spec 5.10)', () => {
  it('equals the spec numbers', () => {
    expect(NUTRIENT_STYLE.minHeight).toBe(28);
    expect(NUTRIENT_STYLE.gap).toBe(12);
    expect(NUTRIENT_STYLE.nameWidth).toBe(CLEAN_SPEC.sizes.nutrientRow.nameWidth);
    expect(NUTRIENT_STYLE.nameWidth).toBe(140);
    expect(NUTRIENT_STYLE.valueWidth).toBe(88);
    expect(NUTRIENT_STYLE.pillGap).toBe(8);
    expect(NUTRIENT_STYLE.barHeight).toBe(4);
    expect(NUTRIENT_STYLE.barRadius).toBe(2);
  });

  it('clamps the share', () => {
    expect(clampShare(-0.2)).toBe(0);
    expect(clampShare(0.93)).toBe(0.93);
    expect(clampShare(1.7)).toBe(1);
    expect(clampShare(NaN)).toBe(0);
  });

  it('builds the spoken label', () => {
    expect(nutrientLabel('Calcium', '>= 210 mg', 0.21)).toBe('Calcium, >= 210 mg, 21 percent of daily need');
    expect(nutrientLabel('Sodium', '>= 1,850 mg', 0.93, true)).toBe('Sodium, >= 1,850 mg, 93 percent of daily need, high');
    expect(nutrientLabel('Iron', '>= 3.1 mg', 1.4)).toContain('100 percent');
  });
});
