import { describe, expect, it } from '@jest/globals';

import { cleanClubCode, clubLink, clubShareText, linkHandle, parseQrText, spacedCode, walkerLink, walkerShareText } from '../links';

describe('Steps QR links', () => {
  it('builds the walker and club links with nothing else in them', () => {
    expect(walkerLink('@ravi_walks')).toBe('neutcraftssteps://w/ravi_walks');
    expect(clubLink('K7QM2XPA')).toBe('neutcraftssteps://c/K7QM2XPA');
  });

  it('reads a walker link', () => {
    expect(parseQrText('neutcraftssteps://w/ravi_walks')).toEqual({ kind: 'walker', handle: 'ravi_walks' });
    expect(parseQrText('  NEUTCRAFTSSTEPS://W/Ravi_Walks/ ')).toEqual({ kind: 'walker', handle: 'Ravi_Walks' });
    expect(parseQrText('neutcraftssteps:///w/ravi_walks')).toEqual({ kind: 'walker', handle: 'ravi_walks' });
    expect(parseQrText('neutcraftssteps://w/%40ravi_walks')).toEqual({ kind: 'walker', handle: 'ravi_walks' });
  });

  it('reads a club link, cleaning case and dashes', () => {
    expect(parseQrText('neutcraftssteps://c/K7QM2XPA')).toEqual({ kind: 'club', code: 'K7QM2XPA' });
    expect(parseQrText('neutcraftssteps://c/k7qm-2xpa')).toEqual({ kind: 'club', code: 'K7QM2XPA' });
  });

  it('refuses anything else', () => {
    for (const t of [
      null,
      undefined,
      '',
      'https://neutcrafts.in/steps',
      'upi://pay?pa=x@bank',
      'neutcraftssteps://w/ab',
      'neutcraftssteps://w/ravi walks',
      'neutcraftssteps://w/ravi_walks?lat=17.4',
      'neutcraftssteps://w/ravi_walks/extra',
      'neutcraftssteps://w/admin',
      'neutcraftssteps://w/%E0%A4',
      'neutcraftssteps://c/K7QM2XPU',
      'neutcraftssteps://c/K7QM2XP',
      'neutcraftssteps://x/ravi_walks',
      'othersteps://w/ravi_walks',
      'neutcraftssteps://design-preview?theme=e&screen=today',
    ]) {
      expect(parseQrText(t)).toBeNull();
    }
  });

  it('cleans a typed club code', () => {
    expect(cleanClubCode(' k7qm 2xpa ')).toBe('K7QM2XPA');
    expect(cleanClubCode('K7QM-2XPA')).toBe('K7QM2XPA');
    expect(cleanClubCode('K7QM2XPO')).toBeNull();
    expect(cleanClubCode('K7QM2XPAA')).toBeNull();
    expect(spacedCode('K7QM2XPA')).toBe('K7QM 2XPA');
  });

  it('reads a walker ID from a link route param', () => {
    expect(linkHandle('ravi_walks')).toBe('ravi_walks');
    expect(linkHandle('@ravi_walks')).toBe('ravi_walks');
    expect(linkHandle('r')).toBeNull();
    expect(linkHandle(undefined)).toBeNull();
  });

  it('writes the share sheet words', () => {
    expect(walkerShareText('ravi_walks')).toBe('Add me on Steps: @ravi_walks');
    expect(clubShareText('KBR Morning Walkers', 'K7QM2XPA')).toBe(
      'Join KBR Morning Walkers on Steps: neutcraftssteps://c/K7QM2XPA (code K7QM 2XPA, works for 48 hours)',
    );
  });
});
