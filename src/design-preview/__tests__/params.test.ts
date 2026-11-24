import { describe, expect, it } from '@jest/globals';

import { THEME_IDS } from '@/constants/themes/types';

import { parsePreviewParams, parsePreviewUrl, PREVIEW_ROUTE, PREVIEW_SCREENS, previewUrl } from '../params';

const SCHEME = (require('../../../app.json') as { expo: { scheme: string } }).expo.scheme;

describe('parsePreviewParams', () => {
  it('takes every theme with every screen', () => {
    for (const theme of THEME_IDS) {
      for (const screen of PREVIEW_SCREENS) {
        expect(parsePreviewParams({ theme, screen })).toEqual(screen === 'detail' ? { theme, screen, kind: 'steps' } : { theme, screen });
      }
    }
  });

  it('takes the one look, Calm and large (e)', () => {
    expect(THEME_IDS).toEqual(['e']);
    expect(parsePreviewParams({ theme: 'e', screen: 'today' })).toEqual({ theme: 'e', screen: 'today' });
  });

  it('takes the detail screen with steps by default, and any of the five kinds', () => {
    expect(PREVIEW_SCREENS).toContain('detail');
    expect(PREVIEW_SCREENS).toContain('plus');
    expect(parsePreviewParams({ theme: 'e', screen: 'detail' })).toEqual({ theme: 'e', screen: 'detail', kind: 'steps' });
    for (const kind of ['steps', 'active', 'food', 'water', 'sleep']) {
      expect(parsePreviewParams({ theme: 'e', screen: 'detail', kind })).toEqual({ theme: 'e', screen: 'detail', kind });
    }
    expect(parsePreviewParams({ theme: 'e', screen: 'detail', kind: ['water', 'food'] })).toEqual({
      theme: 'e',
      screen: 'detail',
      kind: 'water',
    });
  });

  it('falls back to steps for an unknown kind, and ignores kind on other screens', () => {
    for (const kind of ['walk', 'Steps', 'sleeping', '', []]) {
      expect(parsePreviewParams({ theme: 'e', screen: 'detail', kind })).toEqual({ theme: 'e', screen: 'detail', kind: 'steps' });
    }
    expect(parsePreviewParams({ theme: 'e', screen: 'today', kind: 'water' })).toEqual({ theme: 'e', screen: 'today' });
  });

  it('has the club screens, and opens the club on the tab the link names', () => {
    for (const screen of ['clubs', 'club-new', 'club', 'club-admin', 'club-join']) expect(PREVIEW_SCREENS).toContain(screen);
    for (const seg of ['chat', 'walks', 'goals', 'board']) {
      expect(parsePreviewParams({ theme: 'e', screen: 'club', seg })).toEqual({ theme: 'e', screen: 'club', seg });
    }
    expect(parsePreviewParams({ theme: 'e', screen: 'club', seg: 'Board' })).toEqual({ theme: 'e', screen: 'club' });
    expect(parsePreviewParams({ theme: 'e', screen: 'club-admin', seg: 'board' })).toEqual({ theme: 'e', screen: 'club-admin' });
    const p = { theme: 'e', screen: 'club', seg: 'board' } as const;
    expect(previewUrl(SCHEME, p)).toBe('neutcraftssteps://design-preview?theme=e&screen=club&seg=board');
    expect(parsePreviewUrl(previewUrl(SCHEME, p))).toEqual(p);
  });

  it('has the QR screens, which read their own code and qr params', () => {
    for (const screen of ['buddies-qr', 'qr-scan']) expect(PREVIEW_SCREENS).toContain(screen);
    expect(parsePreviewParams({ theme: 'e', screen: 'qr-scan', code: 'K7QM2XPA' })).toEqual({ theme: 'e', screen: 'qr-scan' });
  });

  it('has the plan screens, and opens Plan a walk with the safety tips on tips=1', () => {
    for (const screen of ['plan', 'plan-new']) expect(PREVIEW_SCREENS).toContain(screen);
    expect(parsePreviewParams({ theme: 'e', screen: 'plan-new', tips: '1' })).toEqual({ theme: 'e', screen: 'plan-new', tips: true });
    expect(parsePreviewParams({ theme: 'e', screen: 'plan-new', tips: 'yes' })).toEqual({ theme: 'e', screen: 'plan-new' });
    expect(parsePreviewParams({ theme: 'e', screen: 'plan', tips: '1' })).toEqual({ theme: 'e', screen: 'plan' });
    const p = { theme: 'e', screen: 'plan-new', tips: true } as const;
    expect(previewUrl(SCHEME, p)).toBe('neutcraftssteps://design-preview?theme=e&screen=plan-new&tips=1');
    expect(parsePreviewUrl(previewUrl(SCHEME, p))).toEqual(p);
  });

  it('takes the first of repeated params, as expo-router hands them over', () => {
    expect(parsePreviewParams({ theme: ['e', 'd'], screen: ['walk'] })).toEqual({ theme: 'e', screen: 'walk' });
  });

  it('refuses missing, unknown or differently written values rather than guess', () => {
    expect(parsePreviewParams({})).toBeNull();
    expect(parsePreviewParams({ theme: 'e' })).toBeNull();
    expect(parsePreviewParams({ screen: 'today' })).toBeNull();
    expect(parsePreviewParams({ theme: 'g', screen: 'today' })).toBeNull();
    expect(parsePreviewParams({ theme: 'D', screen: 'today' })).toBeNull();
    expect(parsePreviewParams({ theme: 'e', screen: 'Today' })).toBeNull();
    expect(parsePreviewParams({ theme: 'e', screen: 'journal' })).toBeNull();
    expect(parsePreviewParams({ theme: [], screen: 'today' })).toBeNull();
  });
});

describe('preview links', () => {
  it('uses the app scheme from app.json and the route file name', () => {
    expect(SCHEME).toBe('neutcraftssteps');
    expect(PREVIEW_ROUTE).toBe('design-preview');
    expect(previewUrl(SCHEME, { theme: 'e', screen: 'today' })).toBe('neutcraftssteps://design-preview?theme=e&screen=today');
  });

  it('reads back every link it makes', () => {
    for (const theme of THEME_IDS) {
      for (const screen of PREVIEW_SCREENS) {
        const kind = screen === 'detail' ? ('steps' as const) : undefined;
        const expected = kind ? { theme, screen, kind } : { theme, screen };
        expect(parsePreviewUrl(previewUrl(SCHEME, expected))).toEqual(expected);
      }
    }
  });

  it('makes and reads the detail link with its kind', () => {
    expect(previewUrl(SCHEME, { theme: 'e', screen: 'detail', kind: 'water' })).toBe(
      'neutcraftssteps://design-preview?theme=e&screen=detail&kind=water',
    );
    expect(parsePreviewUrl('neutcraftssteps://design-preview?theme=e&screen=detail&kind=sleep')).toEqual({
      theme: 'e',
      screen: 'detail',
      kind: 'sleep',
    });
    expect(parsePreviewUrl('neutcraftssteps://design-preview?theme=e&screen=detail&kind=nope')).toEqual({
      theme: 'e',
      screen: 'detail',
      kind: 'steps',
    });
  });

  it('takes the triple-slash form, any param order, extra params and the dev client form', () => {
    expect(parsePreviewUrl('neutcraftssteps:///design-preview?screen=walk&theme=e')).toEqual({ theme: 'e', screen: 'walk' });
    expect(parsePreviewUrl('neutcraftssteps://design-preview?theme=e&x=1&screen=food#top')).toEqual({ theme: 'e', screen: 'food' });
    expect(parsePreviewUrl('exp://192.168.1.4:8081/--/design-preview?theme=e&screen=today')).toEqual({
      theme: 'e',
      screen: 'today',
    });
    expect(parsePreviewUrl('neutcraftssteps://design-preview?theme=%65&screen=today')).toEqual({ theme: 'e', screen: 'today' });
  });

  it('is null for no link, other routes and bad params', () => {
    expect(parsePreviewUrl(null)).toBeNull();
    expect(parsePreviewUrl(undefined)).toBeNull();
    expect(parsePreviewUrl('')).toBeNull();
    expect(parsePreviewUrl('design-preview?theme=e&screen=today')).toBeNull();
    expect(parsePreviewUrl('neutcraftssteps://food?add=1')).toBeNull();
    expect(parsePreviewUrl('neutcraftssteps://walk/design-preview?theme=e&screen=today')).toBeNull();
    expect(parsePreviewUrl('neutcraftssteps://design-preview/today?theme=e&screen=today')).toBeNull();
    expect(parsePreviewUrl('exp://192.168.1.4:8081/design-preview?theme=e&screen=today')).toBeNull();
    expect(parsePreviewUrl('neutcraftssteps://design-preview')).toBeNull();
    expect(parsePreviewUrl('neutcraftssteps://design-preview?theme=z&screen=today')).toBeNull();
    expect(parsePreviewUrl('neutcraftssteps://design-preview?theme=e&screen=%E0%A4')).toBeNull();
  });
});

describe('the food screen opened for editing (T15)', () => {
  it('takes edit=1 on the food screen only', () => {
    expect(parsePreviewParams({ theme: 'e', screen: 'food', edit: '1' })).toEqual({ theme: 'e', screen: 'food', edit: true });
    expect(parsePreviewParams({ theme: 'e', screen: 'food', edit: '0' })).toEqual({ theme: 'e', screen: 'food' });
    expect(parsePreviewParams({ theme: 'e', screen: 'today', edit: '1' })).toEqual({ theme: 'e', screen: 'today' });
  });
  it('round-trips through the link', () => {
    const url = previewUrl('neutcraftssteps', { theme: 'e', screen: 'food', edit: true });
    expect(url).toBe('neutcraftssteps://design-preview?theme=e&screen=food&edit=1');
    expect(parsePreviewUrl(url)).toEqual({ theme: 'e', screen: 'food', edit: true });
  });
});

describe('the food screen as the person\'s own version (T15)', () => {
  it('takes mine=1 on the food screen, and round-trips', () => {
    expect(parsePreviewParams({ theme: 'e', screen: 'food', mine: '1' })).toEqual({ theme: 'e', screen: 'food', mine: true });
    expect(parsePreviewParams({ theme: 'e', screen: 'walk', mine: '1' })).toEqual({ theme: 'e', screen: 'walk' });
    const url = previewUrl('neutcraftssteps', { theme: 'e', screen: 'food', mine: true });
    expect(url).toBe('neutcraftssteps://design-preview?theme=e&screen=food&mine=1');
    expect(parsePreviewUrl(url)).toEqual({ theme: 'e', screen: 'food', mine: true });
  });
});

describe('the part of the day (T18)', () => {
  it('takes part=dawn|noon|dusk on any screen, and round-trips', () => {
    expect(parsePreviewParams({ theme: 'e', screen: 'today', part: 'dawn' })).toEqual({ theme: 'e', screen: 'today', part: 'dawn' });
    expect(parsePreviewParams({ theme: 'e', screen: 'detail', part: 'dusk' })).toEqual({ theme: 'e', screen: 'detail', kind: 'steps', part: 'dusk' });
    const url = previewUrl('neutcraftssteps', { theme: 'e', screen: 'today', part: 'noon' });
    expect(url).toBe('neutcraftssteps://design-preview?theme=e&screen=today&part=noon');
    expect(parsePreviewUrl(url)).toEqual({ theme: 'e', screen: 'today', part: 'noon' });
  });

  it('ignores an unknown part', () => {
    expect(parsePreviewParams({ theme: 'e', screen: 'today', part: 'night' })).toEqual({ theme: 'e', screen: 'today' });
  });
});
