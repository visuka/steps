import { describe, expect, it } from '@jest/globals';

import { modulePath, qrLayout } from '../draw';
import { encodeQr } from '../encode';

describe('drawing a QR code', () => {
  it('draws each run of dark modules as one rectangle, inside the quiet zone', () => {
    expect(modulePath([[true, true, false, true], [false, false, false, false]], 4)).toBe('M4 4h2v1h-2zM7 4h1v1h-1z');
    expect(modulePath([[false]], 4)).toBe('');
  });

  it('covers exactly the dark modules of a real code', () => {
    const q = encodeQr('neutcraftssteps://w/ravi_walks');
    const d = modulePath(q.modules, 4);
    const area = [...d.matchAll(/h(\d+)/g)].reduce((s, m) => s + Number(m[1]), 0);
    const dark = q.modules.flat().filter(Boolean).length;
    expect(area).toBe(dark);
  });

  it('uses whole dp per module and never more than the side', () => {
    // Version 3: 29 modules + 8 quiet = 37 across.
    expect(qrLayout(29, 4, 240)).toEqual({ units: 37, unit: 6, px: 222 });
    expect(qrLayout(29, 4, 10)).toEqual({ units: 37, unit: 1, px: 37 });
  });
});
