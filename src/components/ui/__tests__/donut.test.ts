import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { carbsColor, DONUT, donutColors, DONUT_ARC_TOTAL, donutArcs, donutLabel } from '../donut-geometry';

const r1 = (n: number) => Math.round(n * 10) / 10;

describe('donut geometry (spec 5.12)', () => {
  it('uses the spec size, radius and stroke', () => {
    expect(DONUT).toMatchObject({ size: 88, centre: 44, radius: 36, stroke: 10, circumference: 226.2, gap: 3 });
    expect(DONUT_ARC_TOTAL).toBeCloseTo(217.2, 6);
  });

  it('follows the rule for 38/14/22 g', () => {
    const [p, c, f] = donutArcs(38, 14, 22);
    expect([r1(p.len), r1(c.len), r1(f.len)]).toEqual([81.3, 30.0, 105.9]);
    expect([r1(p.offset), r1(c.offset), r1(f.offset)]).toEqual([0, -84.3, -117.3]);
  });

  it('draws no arcs when all macros are 0', () => {
    expect(donutArcs(0, 0, 0)).toEqual([]);
  });

  it('arcs plus gaps fill the circle', () => {
    const [p, c, f] = donutArcs(10, 20, 5);
    expect(p.len + c.len + f.len + 3 * DONUT.gap).toBeCloseTo(DONUT.circumference, 6);
  });

  it('carbs grey on Clean+, outline elsewhere', () => {
    expect(carbsColor({ primary: CLEAN_SPEC.colors.accent, outline: '#123456' })).toBe(CLEAN_SPEC.colors.carbs);
    expect(carbsColor({ primary: '#00FF00', outline: '#123456' })).toBe('#123456');
  });

  it('draws three different arc colours in every look', () => {
    // Roles copied from src/constants/themes/{clean,park,a,b,c,d,e,f}.ts (the colour roles block near the top of
    // each file); those modules import font files jest cannot load.
    const looks: Record<string, { primary: string; outline: string; food: string; food2: string; food3: string }> = {
      clean: { primary: '#1F4FD8', outline: '#5F6673', food: '#C8601F', food2: '#111827', food3: '#1F4FD8' },
      park: { primary: '#1D3024', outline: '#6F7A72', food: '#A3462B', food2: '#6E2A17', food3: '#4A1A0D' },
      a: { primary: '#0F6E64', outline: '#737C84', food: '#0F6E64', food2: '#0A4A43', food3: '#5B636B' },
      b: { primary: '#A3C4A4', outline: '#7A8088', food: '#E0BC86', food2: '#F3DDB8', food3: '#B8935C' },
      c: { primary: '#1F2A44', outline: '#6E675B', food: '#1F2A44', food2: '#5C6B8A', food3: '#8A5A12' },
      d: { primary: '#12361A', outline: '#767A72', food: '#A0521C', food2: '#6E3A10', food3: '#47230A' },
      e: { primary: '#1E4D3A', outline: '#857B6D', food: '#9A4A2B', food2: '#6E5212', food3: '#4E2A1A' },
      f: { primary: '#0E0E0E', outline: '#8A8A8A', food: '#0E0E0E', food2: '#DB4D00', food3: '#6B6B6B' },
    };
    for (const [id, t] of Object.entries(looks)) {
      const colors = donutColors(t).map((c) => c.toUpperCase());
      expect([id, new Set(colors).size]).toEqual([id, 3]);
    }
  });

  it('keeps protein warm, carbs grey and fat accent in Clean+', () => {
    const k = CLEAN_SPEC.colors;
    expect(donutColors({ primary: k.accent, outline: k.muted, food: k.warm, food2: k.ink, food3: k.accent })).toEqual([k.warm, k.carbs, k.accent]);
  });

  it('labels the grams and the total kcal (38 x 4 + 14 x 4 + 22 x 9 = 406)', () => {
    expect(donutLabel(38, 14, 22)).toBe('Protein 38 g, carbs 14 g, fat 22 g, 406 kcal in total');
  });
});
