import { describe, expect, it } from '@jest/globals';

import { FAKE_ZEROS } from '@/nutrition/fixes';
import { catalogFood } from '@/nutrition/catalog';
import { NUTRIENTS } from '@/nutrition/nutrients';
import { coverage, dayGlBand, nutrientState, spokenNutrient, type StateContext, valueText } from '@/nutrition/state';
import type { NutrientKey } from '@/nutrition/types';

const ctx = (over: Partial<StateContext> = {}): StateContext => ({
  coverage: 1,
  judged: false,
  sex: 'unspecified',
  weightKg: 65,
  heightCm: 165,
  kcalTarget: 2000,
  ...over,
});
const state = (key: NutrientKey, value: number | undefined, over: Partial<StateContext> = {}) =>
  nutrientState(key, value, ctx(over));

describe('unknown is never zero', () => {
  it('is unknown with no value, and never "ok" or a bar', () => {
    for (const n of NUTRIENTS) {
      const s = state(n.key, undefined, { judged: true });
      expect(s.state).toBe('unknown');
      expect(s.word).toBe('Not known');
      expect(s.bar).toBe(0);
      expect(s.percent).toBeNull();
    }
  });
  it('is unknown when the figure covers under 80% of what was eaten', () => {
    expect(state('vitC', 0, { coverage: 0.79, judged: true }).state).toBe('unknown');
    expect(state('vitC', 200, { coverage: 0.5 }).state).toBe('unknown');
    expect(state('protein', 80, { coverage: 0.6 }).state).toBe('unknown');
  });
  it('says "≥" (at least) between 80% and 100% coverage', () => {
    const s = state('vitC', 45, { coverage: 0.85 });
    expect(s.atLeast).toBe(true);
    expect(valueText('vitC', 45, s)).toBe('≥ 45 mg');
    expect(valueText('vitC', 45, state('vitC', 45))).toBe('45 mg');
  });
  it('removes the catalog zeros that are gaps, not measurements', () => {
    const mutton = catalogFood('mutton')!;
    for (const key of FAKE_ZEROS.mutton) expect(mutton.per100g[key]).toBeUndefined();
    expect(mutton.per100g.iron).toBeGreaterThan(0);
  });
});

describe('so far and low', () => {
  it('is "So far" under the low line until the day is judged', () => {
    const s = state('vitC', 30);
    expect(s.state).toBe('soFar');
    expect(s.word).toBe('So far');
    expect(s.tone).toBe('neutral');
  });
  it('is "Low" under the line on a judged day', () => {
    const s = state('vitC', 30, { judged: true });
    expect(s.state).toBe('low');
    expect(s.word).toBe('Low');
    expect(s.tone).toBe('warning');
  });
  it('reads "Could be higher" for adequate-intake nutrients', () => {
    for (const key of ['vitK', 'potassium', 'omega3', 'vitE', 'fiber'] as NutrientKey[]) {
      expect(state(key, 0.01, { judged: true }).word).toBe('Could be higher');
    }
  });
  it('is "On track" at the low line, any time of day', () => {
    expect(state('vitC', 60).state).toBe('ok');
    expect(state('vitC', 60).word).toBe('On track');
    expect(state('calcium', 800, { judged: true }).state).toBe('ok');
  });
  it('uses personal lines for protein and iron', () => {
    // 65 kg: low line 42.9 g
    expect(state('protein', 42, { judged: true }).state).toBe('low');
    expect(state('protein', 43, { judged: true }).state).toBe('ok');
    expect(state('iron', 12, { judged: true, sex: 'female', age: 30 }).state).toBe('low');
    expect(state('iron', 12, { judged: true, sex: 'female', age: 55 }).state).toBe('ok');
  });
  it('never calls vitamin D low', () => {
    const s = state('vitD', 1, { judged: true });
    expect(s.state).toBe('sun');
    expect(s.word).toBe('Mostly from sunlight');
    expect(s.tone).toBe('neutral');
  });
  it('shows a low-line tick and the real percent, with the bar capped', () => {
    const s = state('vitC', 45, { judged: true });
    expect(s.percent).toBe(50);
    expect(s.lowTick).toBeCloseTo((60 / 90) * 100);
    expect(state('vitC', 270).percent).toBe(300);
    expect(state('vitC', 270).bar).toBe(100);
  });
});

describe('limits and upper intakes', () => {
  it('sodium: on track at 79%, near at 80%, too much at 100%', () => {
    expect(state('sodium', 1580).state).toBe('ok');
    expect(state('sodium', 1600).state).toBe('near');
    expect(state('sodium', 1600).word).toBe('Near the limit');
    expect(state('sodium', 2000).state).toBe('over');
    expect(state('sodium', 2000).word).toBe('Too much');
    expect(state('sodium', 2000).tone).toBe('danger');
  });
  it('cholesterol and caffeine go to "Near" at most', () => {
    expect(state('cholesterol', 373).state).toBe('near'); // two boiled eggs
    expect(state('cholesterol', 100).state).toBe('none');
    expect(state('caffeine', 500).state).toBe('near');
  });
  it('limit bars measure against the limit', () => {
    expect(state('addedSugar', 25).percent).toBe(50);
  });
  it('flags food past an upper intake', () => {
    expect(state('calcium', 2600).state).toBe('over');
    expect(state('iron', 45).state).toBe('over');
  });
  it('gives no verdict on energy, carbs, fat, sugars or alcohol', () => {
    for (const key of ['kcal', 'carbs', 'fat', 'sugars', 'alcohol', 'gl'] as NutrientKey[]) {
      expect(state(key, 5000, { judged: true }).state).toBe('none');
      expect(state(key, 5000, { judged: true }).word).toBe('');
    }
  });
});

describe('numbers only', () => {
  it('gives no Low or Too much words with "My needs are different"', () => {
    expect(state('vitC', 1, { judged: true, plain: true }).state).toBe('plain');
    expect(state('sodium', 5000, { plain: true }).word).toBe('');
    expect(state('vitC', undefined, { plain: true }).state).toBe('unknown');
  });
});

describe('coverage', () => {
  it('is the share of energy from entries with the figure', () => {
    // Paneer has no B12 figure; milk does.
    expect(coverage([{ kcal: 290, calcium: 400 }, { kcal: 150, vitB12: 1.1, calcium: 280 }], 'vitB12')).toBeCloseTo(150 / 440);
    expect(coverage([{ kcal: 290, calcium: 400 }, { kcal: 150, calcium: 280 }], 'calcium')).toBe(1);
  });
  it('catches calorie-only entries', () => {
    expect(coverage([{ kcal: 500 }, { kcal: 500, vitC: 30 }], 'vitC')).toBe(0.5);
  });
  it('is 1 with no energy when something has the figure, else 0', () => {
    expect(coverage([{ kcal: 0, caffeine: 40 }], 'caffeine')).toBe(1);
    expect(coverage([{ kcal: 0 }], 'caffeine')).toBe(0);
    expect(coverage([], 'vitC')).toBe(0);
  });
});

describe('glycemic load band', () => {
  it('shows only on judged days', () => {
    expect(dayGlBand(40, false)).toBeNull();
    expect(dayGlBand(40, true)).toBe('low');
    expect(dayGlBand(130, true)).toBe('high');
    expect(dayGlBand(undefined, true)).toBeNull();
  });
});

describe('spoken label', () => {
  it('reads the amount, the percent and the state', () => {
    expect(spokenNutrient('vitC', 45, state('vitC', 45, { judged: true }))).toBe(
      'Vitamin C, 45 milligrams, 50 percent of daily need, low',
    );
    expect(spokenNutrient('vitC', undefined, state('vitC', undefined))).toBe('Vitamin C, not known');
    expect(spokenNutrient('sodium', 1000, state('sodium', 1000))).toBe('Sodium (salt), 1000 milligrams, 50 percent of the limit, on track');
  });
});
