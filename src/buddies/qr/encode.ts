/**
 * A small QR code encoder for the Steps invite codes (no package: the owner's
 * rule). Byte mode, error correction level M, versions 1–6 (up to 106 bytes),
 * the mask with the lowest penalty score, as ISO/IEC 18004. It returns the
 * modules only; the view (components/buddies/qr/qr-code.tsx) draws them with
 * the quiet zone. Pure, tested in __tests__/encode.test.ts.
 *
 * The steps follow the standard: data bits → codewords → Reed–Solomon error
 * correction per block → interleaving → the function patterns (finders,
 * separators, timing, alignment, the dark module) → codeword placement in
 * the zig-zag → each of the 8 masks scored → the best one with its format bits.
 */

export interface QrMatrix {
  /** 1–6. */
  version: number;
  /** Modules on a side: 4 × version + 17. */
  size: number;
  /** 0–7, the mask chosen. */
  mask: number;
  /** modules[row][column]: true is dark. */
  modules: boolean[][];
}

/** Level M, per version: error correction codewords per block, blocks, data codewords per block (ISO 18004 table 9). */
const BLOCKS_M: readonly { ec: number; blocks: number; data: number }[] = [
  { ec: 0, blocks: 0, data: 0 },
  { ec: 10, blocks: 1, data: 16 },
  { ec: 16, blocks: 1, data: 28 },
  { ec: 26, blocks: 1, data: 44 },
  { ec: 18, blocks: 2, data: 32 },
  { ec: 24, blocks: 2, data: 43 },
  { ec: 16, blocks: 4, data: 27 },
];

/** Centres of the alignment patterns per version (ISO 18004 annex E). */
const ALIGN: readonly (readonly number[])[] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

export const MAX_VERSION = 6;

/** Level M's format bits are 00 (L 01, M 00, Q 11, H 10). */
const LEVEL_M = 0;

/** Bytes that fit in a byte-mode code of this version at level M (4 mode bits and an 8-bit count first). */
export function byteCapacity(version: number): number {
  const b = BLOCKS_M[version];
  return Math.floor((b.blocks * b.data * 8 - 12) / 8);
}

/** The text as UTF-8 bytes (Hermes and node both lack nothing here, but this keeps the encoder self-contained). */
export function utf8(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

// ── Reed–Solomon over GF(256), polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D) ──

/** a × b in GF(256). */
export function gfMul(a: number, b: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = ((z << 1) ^ ((z >>> 7) * 0x11d)) & 0xff;
    if ((b >>> i) & 1) z ^= a;
  }
  return z;
}

/**
 * The generator polynomial (x − α^0)(x − α^1)…(x − α^(n−1)), highest power
 * first, without its leading 1: degree 10 gives 216, 194, 159, … 193.
 */
export function rsGenerator(degree: number): number[] {
  const out = new Array<number>(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      out[j] = gfMul(out[j], root);
      if (j + 1 < degree) out[j] ^= out[j + 1];
    }
    root = gfMul(root, 2);
  }
  return out;
}

/** The error correction codewords for one block of data codewords. */
export function rsRemainder(data: readonly number[], generator: readonly number[]): number[] {
  const out = generator.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ (out.shift() as number);
    out.push(0);
    for (let i = 0; i < generator.length; i++) out[i] ^= gfMul(generator[i], factor);
  }
  return out;
}

// ── data ──

/** The smallest version (1–6) that holds this many bytes, or null when none does. */
export function versionFor(byteCount: number): number | null {
  for (let v = 1; v <= MAX_VERSION; v++) if (byteCount <= byteCapacity(v)) return v;
  return null;
}

/** Mode 0100, the 8-bit count, the bytes, the terminator, padding to a byte, then 0xEC 0x11 … to fill. */
export function dataCodewords(bytes: readonly number[], version: number): number[] {
  const b = BLOCKS_M[version];
  const capacity = b.blocks * b.data * 8;
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    out.push(byte);
  }
  return out;
}

/** Each block's data with its error correction, interleaved: data codeword by codeword across blocks, then the error correction the same way. */
export function interleave(data: readonly number[], version: number): number[] {
  const b = BLOCKS_M[version];
  const gen = rsGenerator(b.ec);
  const blocks: number[][] = [];
  const ecs: number[][] = [];
  for (let i = 0; i < b.blocks; i++) {
    const block = data.slice(i * b.data, (i + 1) * b.data);
    blocks.push(block);
    ecs.push(rsRemainder(block, gen));
  }
  const out: number[] = [];
  for (let i = 0; i < b.data; i++) for (const block of blocks) out.push(block[i]);
  for (let i = 0; i < b.ec; i++) for (const ec of ecs) out.push(ec[i]);
  return out;
}

// ── the matrix ──

/** The 15 format bits for level M and this mask: 5 data bits, 10 BCH bits, XOR 101010000010010. */
export function formatBits(mask: number): number {
  const data = (LEVEL_M << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
}

const bit = (value: number, i: number) => ((value >>> i) & 1) !== 0;

class Grid {
  readonly modules: boolean[][];
  readonly fixed: boolean[][];
  constructor(readonly size: number) {
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }
  /** A function module at column x, row y. */
  set(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark;
    this.fixed[y][x] = true;
  }
}

function drawFinder(g: Grid, cx: number, cy: number) {
  // The 7 × 7 finder and its light separator around it.
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= g.size || y >= g.size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      g.set(x, y, d !== 2 && d !== 4);
    }
  }
}

function drawAlignment(g: Grid, cx: number, cy: number) {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) g.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
}

/** The format bits in both copies, and the dark module beside the lower-left finder. */
function drawFormat(g: Grid, mask: number) {
  const bits = formatBits(mask);
  const n = g.size;
  for (let i = 0; i <= 5; i++) g.set(8, i, bit(bits, i));
  g.set(8, 7, bit(bits, 6));
  g.set(8, 8, bit(bits, 7));
  g.set(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) g.set(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) g.set(n - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) g.set(8, n - 15 + i, bit(bits, i));
  g.set(8, n - 8, true);
}

function drawFunctionPatterns(g: Grid, version: number) {
  const n = g.size;
  for (let i = 0; i < n; i++) {
    g.set(6, i, i % 2 === 0);
    g.set(i, 6, i % 2 === 0);
  }
  drawFinder(g, 3, 3);
  drawFinder(g, n - 4, 3);
  drawFinder(g, 3, n - 4);
  const pos = ALIGN[version];
  const last = pos.length - 1;
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      // Not over the three finders.
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      drawAlignment(g, pos[i], pos[j]);
    }
  }
  // Reserve the format areas (redrawn with the real mask later).
  drawFormat(g, 0);
}

/** The codewords' bits in the two-column zig-zag from the bottom right, skipping function modules and the vertical timing column. */
function placeCodewords(g: Grid, codewords: readonly number[]) {
  const n = g.size;
  let i = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? n - 1 - vert : vert;
        if (!g.fixed[y][x] && i < codewords.length * 8) {
          g.modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

/** Whether mask `mask` flips the module at column x, row y. */
export function maskAt(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(g: Grid, mask: number) {
  for (let y = 0; y < g.size; y++) for (let x = 0; x < g.size; x++) if (!g.fixed[y][x] && maskAt(mask, x, y)) g.modules[y][x] = !g.modules[y][x];
}

// ── the penalty score (ISO 18004 7.8.3: N1 3, N2 3, N3 40, N4 10) ──

/**
 * The four penalty rules: runs of 5 or more of one colour in a row or column
 * (3, plus 1 for each extra), 2 × 2 blocks of one colour (3 each), the
 * finder-like 1:1:3:1:1 with 4 light on a side (40 each; outside the symbol
 * counts as light), and every 5 % off half dark (10 each).
 */
export function penalty(modules: readonly (readonly boolean[])[]): number {
  const n = modules.length;
  let score = 0;

  const addHistory = (run: number, history: number[]) => {
    if (history[0] === 0) run += n; // the light border before the first run
    history.pop();
    history.unshift(run);
  };
  const finderLike = (h: readonly number[]) => {
    const u = h[1];
    const core = u > 0 && h[2] === u && h[3] === u * 3 && h[4] === u && h[5] === u;
    return (core && h[0] >= u * 4 && h[6] >= u ? 1 : 0) + (core && h[6] >= u * 4 && h[0] >= u ? 1 : 0);
  };
  const line = (get: (i: number) => boolean) => {
    let color = false;
    let run = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      if (get(i) === color) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score++;
      } else {
        addHistory(run, history);
        if (!color) score += finderLike(history) * 40;
        color = get(i);
        run = 1;
      }
    }
    // The end: close a dark run, then the light border after the symbol.
    if (color) {
      addHistory(run, history);
      run = 0;
    }
    addHistory(run + n, history);
    score += finderLike(history) * 40;
  };
  for (let y = 0; y < n; y++) line((x) => modules[y][x]);
  for (let x = 0; x < n; x++) line((y) => modules[y][x]);

  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
    }
  }

  let dark = 0;
  for (const row of modules) for (const m of row) if (m) dark++;
  const total = n * n;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  score += Math.max(0, k) * 10;
  return score;
}

/**
 * The QR code for `text` (UTF-8, byte mode, level M), in the smallest version
 * that holds it. `mask` forces a mask (tests); otherwise the lowest penalty
 * wins, the first on a tie. Throws when the text is over 106 bytes.
 */
export function encodeQr(text: string, opts: { mask?: number } = {}): QrMatrix {
  const bytes = utf8(text);
  const version = versionFor(bytes.length);
  if (version === null) throw new Error(`QR text too long: ${bytes.length} bytes (at most ${byteCapacity(MAX_VERSION)})`);
  const size = version * 4 + 17;
  const g = new Grid(size);
  drawFunctionPatterns(g, version);
  placeCodewords(g, interleave(dataCodewords(bytes, version), version));

  let mask = opts.mask ?? -1;
  if (mask < 0) {
    let best = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(g, m);
      drawFormat(g, m);
      const p = penalty(g.modules);
      if (p < best) {
        best = p;
        mask = m;
      }
      applyMask(g, m); // undo (XOR)
    }
  }
  applyMask(g, mask);
  drawFormat(g, mask);
  return { version, size, mask, modules: g.modules };
}
