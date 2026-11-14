import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { avatarHitSlop, GREETING_STYLE, greetingTitle, initialOf } from '../greeting-style';

describe('greeting style', () => {
  it('equals spec 5.1', () => {
    expect(GREETING_STYLE.minHeight).toBe(48);
    expect(GREETING_STYLE.avatar).toBe(40);
    expect(GREETING_STYLE.avatarRadius).toBe(20);
    expect(GREETING_STYLE.initialWeight).toBe('500');
  });

  it('lifts the avatar to a 48 dp target', () => {
    expect(GREETING_STYLE.avatar + 2 * avatarHitSlop()).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
  });

  it('builds the title and initial', () => {
    expect(greetingTitle('Good morning', 'Ravi')).toBe('Good morning, Ravi');
    expect(greetingTitle('Good morning', ' ')).toBe('Good morning');
    expect(initialOf(' ravi')).toBe('R');
    expect(initialOf('')).toBe('');
  });
});
