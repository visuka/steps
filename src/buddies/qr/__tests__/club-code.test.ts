import { describe, expect, it } from '@jest/globals';

import { cardAction, cardButton, liveCode, readSavedCodes, scanMessage, scanOutcome, withCode } from '../club-code';

const H = 60 * 60_000;

describe('saved club codes', () => {
  it('reads what kv holds and leaves out broken rows', () => {
    expect(readSavedCodes(null)).toEqual({});
    expect(
      readSavedCodes({
        KBR000000001: { code: 'K7QM2XPA', codeExpiresAt: 5 },
        BAD1: { code: 'nope', codeExpiresAt: 5 },
        BAD2: { code: 'K7QM2XPA' },
        BAD3: 'K7QM2XPA',
      }),
    ).toEqual({ KBR000000001: { code: 'K7QM2XPA', codeExpiresAt: 5 } });
  });

  it('shows a saved code only while 30 minutes or more are left', () => {
    const saved = { K: { code: 'K7QM2XPA', codeExpiresAt: 10 * H } };
    expect(liveCode(saved, 'K', 0)).toEqual(saved.K);
    expect(liveCode(saved, 'K', 10 * H - 30 * 60_000)).toEqual(saved.K);
    expect(liveCode(saved, 'K', 10 * H - 29 * 60_000)).toBeNull();
    expect(liveCode(saved, 'OTHER', 0)).toBeNull();
  });

  it('keeps the new code and drops run-out ones', () => {
    const saved = { A: { code: 'AAAAAAAA', codeExpiresAt: 5 }, B: { code: 'BBBBBBBB', codeExpiresAt: 50 } };
    expect(withCode(saved, 'C', { code: 'CCCCCCCC', codeExpiresAt: 99 }, 10)).toEqual({
      B: { code: 'BBBBBBBB', codeExpiresAt: 50 },
      C: { code: 'CCCCCCCC', codeExpiresAt: 99 },
    });
    expect(withCode(saved, 'B', { code: 'DDDDDDDD', codeExpiresAt: 99 }, 0).B.code).toBe('DDDDDDDD');
  });
});

describe('a scanned club card', () => {
  it('offers what fits where I stand', () => {
    expect(cardAction({ myState: 'none' })).toBe('ask');
    expect(cardAction({ myState: 'invited' })).toBe('join');
    expect(cardAction({ myState: 'asked' })).toBe('asked');
    expect(cardAction({ myState: 'member' })).toBe('open');
    expect(cardButton('ask')).toBe('Ask to join');
    expect(cardButton('join')).toBe('Join');
    expect(cardButton('open')).toBe('Open club');
    expect(cardButton('asked')).toBeNull();
  });
});

describe('what a scan means', () => {
  it('a walker, my own code, a club or something else', () => {
    expect(scanOutcome('neutcraftssteps://w/ravi_walks', 'you_walk')).toEqual({ kind: 'walker', handle: 'ravi_walks' });
    expect(scanOutcome('neutcraftssteps://w/You_Walk', 'you_walk')).toEqual({ kind: 'self' });
    expect(scanOutcome('neutcraftssteps://w/you_walk', null)).toEqual({ kind: 'walker', handle: 'you_walk' });
    expect(scanOutcome('neutcraftssteps://c/K7QM2XPA', 'you_walk')).toEqual({ kind: 'club', code: 'K7QM2XPA' });
    expect(scanOutcome('https://example.com', 'you_walk')).toEqual({ kind: 'other' });
  });

  it('says plainly when a code is no use', () => {
    expect(scanMessage({ kind: 'other' })).toMatch(/isn't a Steps code/);
    expect(scanMessage({ kind: 'self' })).toMatch(/your own code/);
    expect(scanMessage({ kind: 'walker', handle: 'x' })).toBeNull();
    expect(scanMessage({ kind: 'club', code: 'K7QM2XPA' })).toBeNull();
  });
});
