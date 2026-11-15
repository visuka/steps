import { describe, expect, it } from '@jest/globals';

import { ADD_KEY, ADD_LABEL, ADD_ROWS, addTarget } from '../add-sheet-rows';

describe('the Add sheet', () => {
  it('is called Add, and is not Log food', () => {
    expect(ADD_LABEL).toBe('Add');
    expect(ADD_KEY).toBe('add');
  });

  it('lists Sleep, Mood, Weight, Blood pressure, Water and Start walk, in that order', () => {
    expect(ADD_ROWS.map((r) => r.label)).toEqual(['Sleep', 'Mood', 'Weight', 'Blood pressure', 'Water', 'Start walk']);
  });

  it('gives every row an icon and a spoken label, and has no Food row (Food has its own tab)', () => {
    for (const row of ADD_ROWS) {
      expect(row.icon).toBeTruthy();
      expect(row.accessibilityLabel.length).toBeGreaterThan(0);
    }
    expect(ADD_ROWS.some((r) => /food/i.test(r.label))).toBe(false);
    expect(new Set(ADD_ROWS.map((r) => r.key)).size).toBe(ADD_ROWS.length);
  });

  it('opens the Journal with the part named, for each journal row', () => {
    const parts: Record<string, string> = { sleep: 'sleep', mood: 'mood', weight: 'weight', bp: 'bp', water: 'water' };
    for (const [key, section] of Object.entries(parts)) {
      expect(addTarget(key as 'sleep', 1000)).toEqual({ pathname: '/journal', params: { section, n: '1000' } });
    }
  });

  it('carries a fresh value each time, so the Journal re-selects the part', () => {
    const a = addTarget('sleep', 1);
    const b = addTarget('sleep', 2);
    expect(a).not.toEqual(b);
  });

  it('opens the walk start for Start walk', () => {
    expect(addTarget('walk', 5)).toEqual({ pathname: '/walk/record' });
  });

  it('only names Journal parts the Journal screen knows', () => {
    const known = ['sleep', 'heart', 'bp', 'weight', 'water', 'mood'];
    for (const row of ADD_ROWS) {
      const t = addTarget(row.key, 1);
      if (t.pathname === '/journal') expect(known).toContain(t.params.section);
    }
  });
});
