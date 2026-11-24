import { describe, expect, it } from '@jest/globals';

import { keepTogether, keepTogetherChildren } from '../text-breaks';

const N = ' ';

describe('keepTogether', () => {
  it('binds a number to its noun', () => {
    expect(keepTogether('Needs 3 meals out and 3 home-made')).toBe(`Needs 3${N}meals out and 3${N}home-made`);
  });
  it('binds short time and unit words to the word before', () => {
    expect(keepTogether('30 min · Every day')).toBe(`30${N}min${N}· Every${N}day`);
    expect(keepTogether('by 7:00 am')).toBe(`by 7:00${N}am`);
  });
  it('lets a line break only after the separator dot', () => {
    expect(keepTogether('Necklace Road · 17 members')).toBe(`Necklace Road${N}· 17${N}members`);
  });
  it('leaves longer words that only start with a unit alone', () => {
    expect(keepTogether('a few minutes, most days')).toBe('a few minutes, most days');
  });
});

describe('keepTogetherChildren', () => {
  it('joins strings and numbers into one run', () => {
    expect(keepTogetherChildren([41, ' steps so far'])).toBe(`41${N}steps so far`);
  });
  it('leaves elements alone', () => {
    const el = { type: 'x' };
    const kids = ['a ', el];
    expect(keepTogetherChildren(kids as never)).toBe(kids);
  });
});
