import { describe, expect, it } from '@jest/globals';

import { DAY_PALETTES, DAY_PARTS, type DayPalette, dayPartOf, isDayPart } from '@/constants/day-part';

function at(h: number, m: number): Date {
  return new Date(2026, 10, 17, h, m, 0);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('dayPartOf', () => {
  it.each<[number, number, string]>([
    [0, 0, 'dusk'],
    [4, 59, 'dusk'],
    [5, 0, 'dawn'],
    [10, 59, 'dawn'],
    [11, 0, 'noon'],
    [16, 29, 'noon'],
    [16, 30, 'dusk'],
    [23, 59, 'dusk'],
  ])('%i:%i is %s', (h, m, part) => {
    expect(dayPartOf(at(h, m))).toBe(part);
  });

  it('knows its parts', () => {
    expect(DAY_PARTS.every(isDayPart)).toBe(true);
    expect(isDayPart('night')).toBe(false);
    expect(isDayPart(undefined)).toBe(false);
  });
});

describe('DAY_PALETTES', () => {
  const roles: (keyof DayPalette)[] = [
    'bg', 'wash', 'edge', 'newsBg', 'plate', 'muted', 'main', 'onMain', 'card', 'text', 'heroTop', 'heroBottom', 'heroEdge',
    'ringA', 'ringB', 'track', 'food', 'foodLane', 'sleep', 'sleepLane', 'water', 'waterLane',
  ];

  it.each([...DAY_PARTS])('%s has every role as #RRGGBB', (part) => {
    const p = DAY_PALETTES[part];
    expect(Object.keys(p).sort()).toEqual([...roles].sort());
    for (const r of roles) expect(p[r]).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('matches docs/design.md for one value per part', () => {
    expect(DAY_PALETTES.dawn.ringB).toBe('#C2577A');
    expect(DAY_PALETTES.noon.main).toBe('#1D3A5F');
    expect(DAY_PALETTES.dusk.sleep).toBe('#2F7A85');
  });

  it.each([...DAY_PARTS])('%s text is easy to read', (part) => {
    const p = DAY_PALETTES[part];
    for (const ground of [p.bg, p.card, p.heroBottom, p.wash]) {
      expect(contrast(p.text, ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.muted, ground)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(p.onMain, p.main)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.main, p.plate)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.main, p.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.muted, p.newsBg)).toBeGreaterThanOrEqual(4.5);
    // 19 bold is large text: 3:1.
    expect(contrast(p.ringB, p.heroBottom)).toBeGreaterThanOrEqual(3);
  });

  it.each([...DAY_PARTS])('%s marks stand out on a card', (part) => {
    const p = DAY_PALETTES[part];
    for (const mark of [p.food, p.sleep, p.water]) expect(contrast(mark, p.card)).toBeGreaterThanOrEqual(3);
  });
});
