import { describe, expect, it } from '@jest/globals';

import { COOK_METHODS, isCookMethod, methodChoices, methodLabel, OFFERED_METHODS, takesMethod } from '../methods';
import type { IngredientProfile } from '../types';
import { FAKE_PROFILES as P } from './fake-tables';

describe('cooking methods', () => {
  it('offers the eleven plain choices of the plan, in order, with their labels', () => {
    expect(OFFERED_METHODS.map(methodLabel)).toEqual([
      'Raw / salad',
      'Boiled',
      'Boiled, water drained',
      'Pressure cooked',
      'Steamed',
      'In a curry / gravy',
      'Tadka / stir-fried',
      'Shallow fried (pan / tawa)',
      'Deep fried',
      'Roasted / baked',
      'Grilled / tandoor',
    ]);
  });

  it('knows every server method and nothing else', () => {
    expect(COOK_METHODS).toHaveLength(14);
    expect(isCookMethod('pressure-cooked')).toBe(true);
    expect(isCookMethod('dried')).toBe(false);
    expect(isCookMethod('fried')).toBe(false);
    expect(isCookMethod(3)).toBe(false);
  });

  it('shows soaked, sprouted or unknown only to a row that already has it', () => {
    expect(methodChoices()).toEqual([...OFFERED_METHODS]);
    expect(methodChoices('boiled')).toEqual([...OFFERED_METHODS]);
    expect(methodChoices('sprouted')).toEqual([...OFFERED_METHODS, 'sprouted']);
    expect(methodChoices('unknown')).toEqual([...OFFERED_METHODS, 'unknown']);
  });

  it('offers no method for salt, spices, water or oil', () => {
    expect(takesMethod(P.potato)).toBe(true);
    for (const key of ['salt', 'water', 'oil', 'oil-b']) expect(takesMethod(P[key])).toBe(false);
    expect(takesMethod({ kind: 'food', noMethod: true } as IngredientProfile)).toBe(false);
  });
});
