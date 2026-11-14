import { describe, expect, it } from '@jest/globals';

import { HERO_STYLE } from '../progress-hero-style';

describe('hero plate style', () => {
  it('equals spec 5.3', () => {
    expect(HERO_STYLE.radius).toBe(24);
    expect(HERO_STYLE.padding).toBe(24);
  });
});
