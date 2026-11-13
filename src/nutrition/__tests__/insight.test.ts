import { describe, expect, it } from '@jest/globals';

import { DEFAULT_PROFILE, mergeProfile } from '@/data/profile';
import { addDaysToKey } from '@/lib/dates';
import type { DayIntake } from '@/nutrition/gaps';
import { weekInsight } from '@/nutrition/insight';
import type { Nutrients } from '@/nutrition/types';

const TODAY = '2026-11-13';
const NOW = new Date(2026, 10, 13, 12);

const day = (ago: number, total: Nutrients, judged = true, cov: Partial<Record<keyof Nutrients, number>> = {}): DayIntake => ({
  day: addDaysToKey(TODAY, -ago),
  total: { kcal: 1800, ...total },
  coverage: { ...Object.fromEntries(Object.keys({ kcal: 0, ...total }).map((k) => [k, 1])), ...cov },
  judged,
  kcal: 1800,
  entries: 5,
});
const win = (days: DayIntake[]) => ({ days, entries: [], notForMe: [], book: { own: [], overrides: {}, saved: [] } });
const veg = mergeProfile(DEFAULT_PROFILE, { nutrition: { diet: 'veg' } });

describe('Insights nutrition, last week', () => {
  it('waits for 4 full days; tea-only and fasting days are not counted', () => {
    const w = weekInsight(win([day(1, { vitB12: 0.3 }), day(2, { vitB12: 0.3 }), day(3, { vitB12: 0.3 }), day(4, { kcal: 70 }, false)]), veg, NOW);
    expect(w).toMatchObject({ kind: 'waiting', judgedDays: 3 });
  });
  it('calls B12 low for a vegetarian and suggests only vegetarian foods', () => {
    const w = weekInsight(win([1, 2, 3, 4].map((a) => day(a, { vitB12: 0.3, vitC: 120 }))), veg, NOW);
    expect(w.kind).toBe('ready');
    if (w.kind !== 'ready') return;
    expect(w.low.map((l) => l.key)).toEqual(['vitB12']);
    expect(w.sourcesLine).toBeTruthy();
    expect(w.sourcesLine).not.toMatch(/fish|mackerel|chicken|egg|mutton/i);
  });
  it('treats a missing figure as unknown, never as low', () => {
    // B12 not known for most of what was eaten (paneer dishes): no verdict.
    const w = weekInsight(win([1, 2, 3, 4].map((a) => day(a, { vitB12: 0.3 }, true, { vitB12: 0.5 }))), veg, NOW);
    expect(w.kind === 'ready' && w.low.some((l) => l.key === 'vitB12')).toBe(false);
  });
  it('shows numbers only when needs are different', () => {
    const p = mergeProfile(veg, { nutrition: { differentNeeds: true } });
    expect(weekInsight(win([1, 2, 3, 4].map((a) => day(a, { vitB12: 0.3 }))), p, NOW).kind).toBe('plain');
  });
});
