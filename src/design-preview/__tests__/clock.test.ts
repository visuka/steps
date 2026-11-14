import { describe, expect, it } from '@jest/globals';

import { installPreviewClock } from '../clock';
import { previewLaunch } from '../launch';
import { SAMPLE_NOW } from '../sample';

describe('previewLaunch', () => {
  it('is no preview where there is no native linking module (jest)', () => {
    expect(previewLaunch()).toBeNull();
  });
});

// This file's own global Date is shifted for the rest of it.
describe('installPreviewClock', () => {
  it('makes now read as the sample day, still ticking, and leaves given times alone', () => {
    const before = Date.now();
    installPreviewClock(SAMPLE_NOW);
    expect(Math.abs(Date.now() - SAMPLE_NOW)).toBeLessThan(5_000);
    expect(Math.abs(new Date().getTime() - SAMPLE_NOW)).toBeLessThan(5_000);
    expect(new Date().getDate()).toBe(14);
    expect(new Date(before).getTime()).toBe(before);
    expect(new Date(2024, 0, 2).getFullYear()).toBe(2024);
    expect(new Date('2020-05-06T00:00:00Z').getTime()).toBe(Date.UTC(2020, 4, 6));
    expect(new Date() instanceof Date).toBe(true);
    expect(typeof (Date as unknown as () => string)()).toBe('string');
  });
});
