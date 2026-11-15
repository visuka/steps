import { describe, expect, it } from '@jest/globals';

import { goalLabelSide } from '../hour-bars-geometry';

const bar = (x: number, y: number, quiet = false) => ({ x, y, width: 6, quiet });

describe('goal pace label', () => {
  it('sits at the right end when nothing reaches it', () => {
    expect(goalLabelSide([bar(100, 60)], 300)).toBe('end');
  });

  it('moves left when an evening bar runs through it', () => {
    expect(goalLabelSide([bar(280, 10)], 300)).toBe('start');
  });

  it('is left out when bars reach it at both ends', () => {
    expect(goalLabelSide([bar(10, 10), bar(280, 10)], 300)).toBeNull();
  });

  it('ignores quiet bars', () => {
    expect(goalLabelSide([bar(280, 10, true)], 300)).toBe('end');
  });
});
