import { describe, expect, it } from '@jest/globals';

import {
  byteCapacity,
  dataCodewords,
  encodeQr,
  formatBits,
  gfMul,
  interleave,
  maskAt,
  penalty,
  type QrMatrix,
  rsGenerator,
  rsRemainder,
  utf8,
  versionFor,
} from '../encode';

// Node's fs and path, typed here: the app's tsconfig has no Node types.
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync(p: string): Uint8Array };
const { join } = require('path') as { join(...p: string[]): string };

describe('Reed–Solomon', () => {
  it('multiplies in GF(256) with 0x11D', () => {
    expect(gfMul(0, 77)).toBe(0);
    expect(gfMul(1, 77)).toBe(77);
    // α^7 × α = α^8 = 0x1D (the field's polynomial folded back in).
    expect(gfMul(0x80, 2)).toBe(0x1d);
    expect(gfMul(3, 7)).toBe(9);
  });

  it('builds the published generator polynomials (ISO 18004 annex A)', () => {
    expect(rsGenerator(7)).toEqual([127, 122, 154, 164, 11, 68, 117]);
    expect(rsGenerator(10)).toEqual([216, 194, 159, 111, 199, 94, 95, 113, 157, 193]);
  });

  it('gives the well-known error correction of HELLO WORLD at 1-M', () => {
    // The 16 data codewords of "HELLO WORLD" (alphanumeric) in a 1-M symbol, and its 10 EC codewords.
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(rsRemainder(data, rsGenerator(10))).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });
});

describe('data codewords', () => {
  it('knows the byte capacity of versions 1–6 at level M', () => {
    expect([1, 2, 3, 4, 5, 6].map(byteCapacity)).toEqual([14, 26, 42, 62, 84, 106]);
    expect(versionFor(14)).toBe(1);
    expect(versionFor(15)).toBe(2);
    expect(versionFor(106)).toBe(6);
    expect(versionFor(107)).toBeNull();
  });

  it('writes mode, count, bytes, terminator and the EC 11 padding', () => {
    expect(dataCodewords(utf8('hello'), 1)).toEqual([0x40, 0x56, 0x86, 0x56, 0xc6, 0xc6, 0xf0, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec]);
  });

  it('encodes UTF-8 for any script', () => {
    expect(utf8('A')).toEqual([0x41]);
    expect(utf8('é')).toEqual([0xc3, 0xa9]);
    expect(utf8('అ')).toEqual([0xe0, 0xb0, 0x85]);
    expect(utf8('😀')).toEqual([0xf0, 0x9f, 0x98, 0x80]);
  });

  it('interleaves the blocks of version 4 (2 blocks of 32 + 18)', () => {
    const data = Array.from({ length: 64 }, (_, i) => i);
    const out = interleave(data, 4);
    expect(out).toHaveLength(100);
    expect(out.slice(0, 4)).toEqual([0, 32, 1, 33]);
    const ec1 = rsRemainder(data.slice(0, 32), rsGenerator(18));
    const ec2 = rsRemainder(data.slice(32), rsGenerator(18));
    expect(out.slice(64, 68)).toEqual([ec1[0], ec2[0], ec1[1], ec2[1]]);
  });
});

describe('format bits', () => {
  it('matches the published table for level M', () => {
    const table = [
      '101010000010010',
      '101000100100101',
      '101111001111100',
      '101101101001011',
      '100010111111001',
      '100000011001110',
      '100111110010111',
      '100101010100000',
    ];
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((m) => formatBits(m).toString(2).padStart(15, '0'))).toEqual(table);
  });
});

/** The format bits as drawn, read back from the copy round the top-left finder and from the split copy. */
function readFormat(q: QrMatrix): [number, number] {
  const m = (x: number, y: number) => (q.modules[y][x] ? 1 : 0);
  const n = q.size;
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i <= 5; i++) a[i] = m(8, i);
  a[6] = m(8, 7);
  a[7] = m(8, 8);
  a[8] = m(7, 8);
  for (let i = 9; i < 15; i++) a[i] = m(14 - i, 8);
  for (let i = 0; i < 8; i++) b[i] = m(n - 1 - i, 8);
  for (let i = 8; i < 15; i++) b[i] = m(8, n - 15 + i);
  const value = (bits: number[]) => bits.reduce((v, x, i) => v | (x << i), 0);
  return [value(a), value(b)];
}

function finderAt(q: QrMatrix, x0: number, y0: number): boolean {
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      if (q.modules[y0 + dy][x0 + dx] !== (d !== 2)) return false;
    }
  }
  return true;
}

describe('the matrix', () => {
  const link = 'neutcraftssteps://w/ravi_walks';

  it('picks the smallest version and its size', () => {
    expect(encodeQr('hi').version).toBe(1);
    expect(encodeQr('hi').size).toBe(21);
    const q = encodeQr(link);
    expect(q.version).toBe(3);
    expect(q.size).toBe(29);
    expect(q.modules).toHaveLength(29);
    expect(q.modules.every((r) => r.length === 29)).toBe(true);
    // The longest walker link (a 20-character ID) and a club link fit version 3.
    expect(encodeQr('neutcraftssteps://w/abcdefghij0123456789').version).toBe(3);
    expect(encodeQr('neutcraftssteps://c/K7QM2XPA').version).toBe(3);
    expect(() => encodeQr('x'.repeat(107))).toThrow();
  });

  it('draws the three finders, the timing lines and the dark module', () => {
    const q = encodeQr(link);
    const n = q.size;
    expect(finderAt(q, 0, 0)).toBe(true);
    expect(finderAt(q, n - 7, 0)).toBe(true);
    expect(finderAt(q, 0, n - 7)).toBe(true);
    for (let i = 8; i < n - 8; i++) {
      expect(q.modules[6][i]).toBe(i % 2 === 0);
      expect(q.modules[i][6]).toBe(i % 2 === 0);
    }
    expect(q.modules[n - 8][8]).toBe(true);
    // The separators are light.
    for (let i = 0; i < 8; i++) {
      expect(q.modules[7][i]).toBe(false);
      expect(q.modules[i][7]).toBe(false);
      expect(q.modules[7][n - 1 - i]).toBe(false);
      expect(q.modules[n - 8][i]).toBe(false);
    }
  });

  it('draws the alignment pattern of version 3 at (22, 22)', () => {
    const q = encodeQr(link);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) expect(q.modules[22 + dy][22 + dx]).toBe(Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  });

  it('writes the chosen mask in both format copies', () => {
    for (const mask of [0, 3, 7]) {
      const q = encodeQr(link, { mask });
      expect(q.mask).toBe(mask);
      expect(readFormat(q)).toEqual([formatBits(mask), formatBits(mask)]);
    }
  });

  it('chooses the mask with the lowest penalty', () => {
    for (const text of [link, 'neutcraftssteps://c/K7QM2XPA', 'hello']) {
      const q = encodeQr(text);
      const scores = [0, 1, 2, 3, 4, 5, 6, 7].map((m) => penalty(encodeQr(text, { mask: m }).modules));
      expect(penalty(q.modules)).toBe(Math.min(...scores));
      expect(scores.indexOf(Math.min(...scores))).toBe(q.mask);
    }
  });

  it('masks by the standard formulas (column x, row y)', () => {
    expect(maskAt(0, 0, 0)).toBe(true);
    expect(maskAt(0, 1, 0)).toBe(false);
    expect(maskAt(1, 5, 2)).toBe(true);
    expect(maskAt(2, 3, 1)).toBe(true);
    expect(maskAt(3, 1, 2)).toBe(true);
    expect(maskAt(4, 3, 2)).toBe(true);
    expect(maskAt(5, 6, 1)).toBe(true);
    expect(maskAt(6, 1, 1)).toBe(true);
    expect(maskAt(6, 1, 3)).toBe(false);
    expect(maskAt(7, 0, 0)).toBe(true);
  });
});

describe('penalty', () => {
  const grid = (f: (x: number, y: number) => boolean) => Array.from({ length: 21 }, (_, y) => Array.from({ length: 21 }, (_, x) => f(x, y)));

  it('scores a checkerboard 0 and an empty square by every rule', () => {
    expect(penalty(grid((x, y) => (x + y) % 2 === 0))).toBe(0);
    // Runs: 42 lines of 21 (3 + 16 each) = 798; 2 × 2 blocks: 400 × 3 = 1200; all light: 9 × 10 = 90.
    expect(penalty(grid(() => false))).toBe(798 + 1200 + 90);
  });

  it('counts a finder-like 1:1:3:1:1 run with light beside it', () => {
    const row = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0].map(Boolean);
    const plain = [0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0].map(Boolean);
    const withPattern = grid((x, y) => (y === 10 ? row[x] : (x + y) % 2 === 0));
    const without = grid((x, y) => (y === 10 ? plain[x] : (x + y) % 2 === 0));
    expect(penalty(withPattern) - penalty(without)).toBeGreaterThanOrEqual(40);
  });
});

/**
 * A real decoder reads the codes back: zxing-wasm (ZXing-C++), which is in
 * node_modules for expo-camera's web scanner (barcode-detector). Not an app
 * dependency; skipped if it ever goes away.
 */
const reader = (() => {
  try {
    const z = require('zxing-wasm/reader');
    const wasm = join(__dirname, '../../../../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm');
    z.prepareZXingModule({ overrides: { wasmBinary: readFileSync(wasm) }, fireImmediately: true });
    return z as { readBarcodes: (img: unknown, o: unknown) => Promise<{ text: string; ecLevel: string; version: string }[]> };
  } catch {
    return null;
  }
})();

class FakeImageData {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number,
  ) {}
}

async function decode(q: QrMatrix) {
  const scale = 4;
  const quiet = 4;
  const n = (q.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(n * n * 4).fill(255);
  for (let y = 0; y < q.size; y++) {
    for (let x = 0; x < q.size; x++) {
      if (!q.modules[y][x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const p = (((y + quiet) * scale + dy) * n + (x + quiet) * scale + dx) * 4;
          data[p] = data[p + 1] = data[p + 2] = 0;
        }
      }
    }
  }
  (globalThis as { ImageData?: unknown }).ImageData = FakeImageData;
  const found = await reader!.readBarcodes(new FakeImageData(data, n, n), { formats: ['QRCode'] });
  return found[0];
}

(reader ? describe : describe.skip)('round trip through a decoder', () => {
  it('reads back walker and club links, long and non-Latin text', async () => {
    const texts = [
      'neutcraftssteps://w/ravi_walks',
      'neutcraftssteps://w/abcdefghij0123456789',
      'neutcraftssteps://c/K7QM2XPA',
      'hi',
      'రేపు ఉదయం 6 గంటలకు',
      'x'.repeat(62),
      'y'.repeat(84),
      'z'.repeat(106),
    ];
    for (const text of texts) {
      const q = encodeQr(text);
      const r = await decode(q);
      expect(r?.text).toBe(text);
      expect(r?.ecLevel).toBe('M');
      expect(r?.version).toBe(String(q.version));
    }
  });

  it('reads back every mask', async () => {
    for (let mask = 0; mask < 8; mask++) {
      const r = await decode(encodeQr('neutcraftssteps://c/K7QM2XPA', { mask }));
      expect(r?.text).toBe('neutcraftssteps://c/K7QM2XPA');
    }
  });
});
