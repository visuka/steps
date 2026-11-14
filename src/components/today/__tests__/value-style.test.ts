import { describe, expect, it } from '@jest/globals';

import { lockedTileModel, sleepTile, walkTile } from '../today-layout';
import { tileValueStyle } from '../value-style';

describe('Today tile value style (spec 10.2)', () => {
  it('sleep with no data and no walk today pick a muted value', () => {
    expect(tileValueStyle('sleep', sleepTile(null, 'Sleep, no data'))).toBe('mutedValue');
    expect(tileValueStyle('walk', walkTile(null, 'Walk, no walk yet today'))).toBe('muted');
  });

  it('a locked tile draws "Premium" muted, whatever its kind', () => {
    for (const kind of ['food', 'water', 'sleep', 'walk'] as const) {
      expect(tileValueStyle(kind, lockedTileModel(kind))).toBe('muted');
    }
  });

  it('every other state keeps the default value', () => {
    expect(tileValueStyle('sleep', { value: '6 h 50' })).toBe('default');
    expect(tileValueStyle('walk', { value: '2.3', pill: '32 min' })).toBe('default');
    expect(tileValueStyle('food', { value: '—' })).toBe('default');
    expect(tileValueStyle('water', { value: '0' })).toBe('default');
  });
});
