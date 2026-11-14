import { describe, expect, it } from '@jest/globals';

import { isFoodResultCovering, setFoodResultCovering } from '../food-result-cover';

describe('food result cover', () => {
  it('is on while any layer is up, and never counts below zero', () => {
    expect(isFoodResultCovering()).toBe(false);
    setFoodResultCovering(true);
    setFoodResultCovering(true);
    setFoodResultCovering(false);
    expect(isFoodResultCovering()).toBe(true);
    setFoodResultCovering(false);
    expect(isFoodResultCovering()).toBe(false);
    setFoodResultCovering(false);
    setFoodResultCovering(true);
    expect(isFoodResultCovering()).toBe(true);
    setFoodResultCovering(false);
  });
});
