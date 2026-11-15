import { describe, expect, it } from '@jest/globals';

import { MaxTextScale, scaled, uiScaleFor } from '../ui-scale';

describe('screen scale', () => {
  it('keeps the design at 411 dp and wider, never growing', () => {
    expect(uiScaleFor(411)).toBe(1);
    expect(uiScaleFor(800)).toBe(1);
  });

  it('draws smaller on a 360 dp phone, never below 85%', () => {
    expect(uiScaleFor(360)).toBeCloseTo(0.876, 3);
    expect(uiScaleFor(300)).toBe(0.85);
  });

  it('keeps the design when the width is unknown', () => {
    expect(uiScaleFor(0)).toBe(1);
    expect(uiScaleFor(Number.NaN)).toBe(1);
  });

  it('rounds sizes to half a dp', () => {
    expect(scaled(16, 0.876)).toBe(14);
    expect(scaled(24, 1)).toBe(24);
  });

  it('lets the phone text size grow text a little, not double it', () => {
    expect(MaxTextScale).toBeGreaterThan(1);
    expect(MaxTextScale).toBeLessThanOrEqual(1.2);
  });
});
