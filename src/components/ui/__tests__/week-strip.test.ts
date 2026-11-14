import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { midTone } from '../hero-colors';
import { dayHitSlop, fillHeight, selectedTrack, WEEK_STYLE, weekDayLabel } from '../week-strip-style';

describe('week strip style', () => {
  it('equals spec 5.2', () => {
    expect(WEEK_STYLE.dayWidth).toBe(40);
    expect(WEEK_STYLE.dayMinHeight).toBe(60);
    expect(WEEK_STYLE.dayRadius).toBe(12);
    expect(WEEK_STYLE.gap).toBe(8);
    expect(WEEK_STYLE.trackWidth).toBe(8);
    expect(WEEK_STYLE.trackHeight).toBe(24);
    expect(WEEK_STYLE.trackRadius).toBe(4);
    expect(WEEK_STYLE.todayWeight).toBe('500');
  });

  it('reaches 48 dp in both directions', () => {
    const s = dayHitSlop();
    expect(WEEK_STYLE.dayWidth + 2 * s.horizontal).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
    expect(WEEK_STYLE.dayMinHeight + 2 * s.vertical).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
  });

  it('clamps the fill to 0..1 of the track', () => {
    expect(fillHeight(0.5)).toBe(12);
    expect(fillHeight(1.4)).toBe(24);
    expect(fillHeight(-1)).toBe(0);
    expect(fillHeight(null)).toBe(0);
  });

  it('takes the spec selected track in Clean+ and a mix elsewhere', () => {
    const clean = { primary: '#1F4FD8', primaryContainer: '#E8EEFC', secondaryContainer: '#DCE4FA' };
    expect(selectedTrack(clean)).toBe(CLEAN_SPEC.colors.selectedTrack);
    expect(selectedTrack({ ...clean, primary: '#112233' })).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('keeps the track, the fill and the day box apart in every look', () => {
    // Roles copied from src/constants/themes/{clean,park,a..f}.ts (primary, primaryContainer, secondaryContainer,
    // surface); those modules import font files jest cannot load. Look F has secondaryContainer equal to primary.
    const looks: Record<string, { primary: string; primaryContainer: string; secondaryContainer: string; surface: string }> = {
      clean: { primary: '#1F4FD8', primaryContainer: '#E8EEFC', secondaryContainer: '#DCE4FA', surface: '#FFFFFF' },
      park: { primary: '#1D3024', primaryContainer: '#D3E3D2', secondaryContainer: '#CFE2CE', surface: '#F4F6F0' },
      a: { primary: '#0F6E64', primaryContainer: '#DDEFEB', secondaryContainer: '#DDEFEB', surface: '#F6F7F8' },
      b: { primary: '#A3C4A4', primaryContainer: '#2F3D32', secondaryContainer: '#2F3D32', surface: '#121417' },
      c: { primary: '#1F2A44', primaryContainer: '#E3E6EE', secondaryContainer: '#EADCC4', surface: '#F7F4EE' },
      d: { primary: '#12361A', primaryContainer: '#CDEBC6', secondaryContainer: '#CDEBC6', surface: '#FFFFFF' },
      e: { primary: '#1E4D3A', primaryContainer: '#E3EDE7', secondaryContainer: '#D6E6DC', surface: '#F5F1EA' },
      f: { primary: '#0E0E0E', primaryContainer: '#EDEDED', secondaryContainer: '#0E0E0E', surface: '#FFFFFF' },
    };
    for (const [id, t] of Object.entries(looks)) {
      const mid = midTone(t);
      const today = selectedTrack(t);
      expect([id, mid === t.primary]).toEqual([id, false]);
      expect([id, mid === t.primaryContainer]).toEqual([id, false]);
      expect([id, today === t.primary]).toEqual([id, false]);
      expect([id, today === t.primaryContainer]).toEqual([id, false]);
    }
  });

  it('builds the accessibility label', () => {
    expect(weekDayLabel('Mon', 0.9, false)).toBe('Mon, 90 percent of goal');
    expect(weekDayLabel('Sat', 0.78, true)).toBe('Sat, today, 78 percent of goal');
    expect(weekDayLabel('Sun', null, false)).toBe('Sun, no data');
  });
});
