import { describe, expect, it } from '@jest/globals';

import { geohash } from '../geohash';

describe('geohash', () => {
  it('matches the server for a few cities', () => {
    expect(geohash(12.9716, 77.5946)).toBe('tdr1v');
    expect(geohash(17.385, 78.4867)).toBe('tepff');
    expect(geohash(28.6139, 77.209)).toBe('ttnfu');
    expect(geohash(-23.55, -46.63)).toBe('6gyf4');
  });
});
