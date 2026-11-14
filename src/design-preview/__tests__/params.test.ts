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

  it('takes the theme list the notice shows, clean among them', () => {
    expect(THEME_IDS).toEqual(expect.arrayContaining(['clean', 'park', 'a', 'b', 'c', 'd', 'e', 'f']));
    expect(parsePreviewParams({ theme: 'clean', screen: 'today' })).toEqual({ theme: 'clean', screen: 'today' });
  });

  it('takes the detail screen with steps by default, and any of the five kinds', () => {
    expect(PREVIEW_SCREENS).toContain('detail');
    expect(parsePreviewParams({ theme: 'clean', screen: 'detail' })).toEqual({ theme: 'clean', screen: 'detail', kind: 'steps' });
    for (const kind of ['steps', 'active', 'food', 'water', 'sleep']) {
      expect(parsePreviewParams({ theme: 'clean', screen: 'detail', kind })).toEqual({ theme: 'clean', screen: 'detail', kind });
    }
    expect(parsePreviewParams({ theme: 'clean', screen: 'detail', kind: ['water', 'food'] })).toEqual({
      theme: 'clean',
      screen: 'detail',
      kind: 'water',
    });
  });

  it('falls back to steps for an unknown kind, and ignores kind on other screens', () => {
    for (const kind of ['walk', 'Steps', 'sleeping', '', []]) {
      expect(parsePreviewParams({ theme: 'clean', screen: 'detail', kind })).toEqual({ theme: 'clean', screen: 'detail', kind: 'steps' });
    }
    expect(parsePreviewParams({ theme: 'clean', screen: 'today', kind: 'water' })).toEqual({ theme: 'clean', screen: 'today' });
  });

  it('takes the first of repeated params, as expo-router hands them over', () => {
    expect(parsePreviewParams({ theme: ['b', 'c'], screen: ['walk'] })).toEqual({ theme: 'b', screen: 'walk' });
  });

  it('refuses missing, unknown or differently written values rather than guess', () => {
    expect(parsePreviewParams({})).toBeNull();
    expect(parsePreviewParams({ theme: 'd' })).toBeNull();
    expect(parsePreviewParams({ screen: 'today' })).toBeNull();
    expect(parsePreviewParams({ theme: 'g', screen: 'today' })).toBeNull();
    expect(parsePreviewParams({ theme: 'D', screen: 'today' })).toBeNull();
    expect(parsePreviewParams({ theme: 'd', screen: 'Today' })).toBeNull();
    expect(parsePreviewParams({ theme: 'd', screen: 'insights' })).toBeNull();
    expect(parsePreviewParams({ theme: [], screen: 'today' })).toBeNull();
  });
});

describe('preview links', () => {
  it('uses the app scheme from app.json and the route file name', () => {
    expect(SCHEME).toBe('neutcraftssteps');
    expect(PREVIEW_ROUTE).toBe('design-preview');
    expect(previewUrl(SCHEME, { theme: 'd', screen: 'today' })).toBe('neutcraftssteps://design-preview?theme=d&screen=today');
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
    expect(previewUrl(SCHEME, { theme: 'clean', screen: 'detail', kind: 'water' })).toBe(
      'neutcraftssteps://design-preview?theme=clean&screen=detail&kind=water',
    );
    expect(parsePreviewUrl('neutcraftssteps://design-preview?theme=clean&screen=detail&kind=sleep')).toEqual({
      theme: 'clean',
      screen: 'detail',
      kind: 'sleep',
    });
    expect(parsePreviewUrl('neutcraftssteps://design-preview?theme=clean&screen=detail&kind=nope')).toEqual({
      theme: 'clean',
      screen: 'detail',
      kind: 'steps',
    });
  });

  it('takes the triple-slash form, any param order, extra params and the dev client form', () => {
    expect(parsePreviewUrl('neutcraftssteps:///design-preview?screen=walk&theme=f')).toEqual({ theme: 'f', screen: 'walk' });
    expect(parsePreviewUrl('neutcraftssteps://design-preview?theme=a&x=1&screen=food#top')).toEqual({ theme: 'a', screen: 'food' });
    expect(parsePreviewUrl('exp://192.168.1.4:8081/--/design-preview?theme=park&screen=today')).toEqual({
      theme: 'park',
      screen: 'today',
    });
    expect(parsePreviewUrl('neutcraftssteps://design-preview?theme=%63&screen=today')).toEqual({ theme: 'c', screen: 'today' });
  });

  it('is null for no link, other routes and bad params', () => {
    expect(parsePreviewUrl(null)).toBeNull();
    expect(parsePreviewUrl(undefined)).toBeNull();
    expect(parsePreviewUrl('')).toBeNull();
    expect(parsePreviewUrl('design-preview?theme=d&screen=today')).toBeNull();
    expect(parsePreviewUrl('neutcraftssteps://food?add=1')).toBeNull();
    expect(parsePreviewUrl('neutcraftssteps://walk/design-preview?theme=d&screen=today')).toBeNull();
    expect(parsePreviewUrl('neutcraftssteps://design-preview/today?theme=d&screen=today')).toBeNull();
    expect(parsePreviewUrl('exp://192.168.1.4:8081/design-preview?theme=d&screen=today')).toBeNull();
    expect(parsePreviewUrl('neutcraftssteps://design-preview')).toBeNull();
    expect(parsePreviewUrl('neutcraftssteps://design-preview?theme=z&screen=today')).toBeNull();
    expect(parsePreviewUrl('neutcraftssteps://design-preview?theme=d&screen=%E0%A4')).toBeNull();
  });
});
