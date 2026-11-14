import { describe, expect, it } from '@jest/globals';

import { ICON_PARTS, LOCK_BODY } from '../icon-paths';
import { heroColors, midTone, mixHex } from '../hero-colors';
import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

describe('spec icons', () => {
  it('has every icon of spec section 8 plus the lock', () => {
    const names = ['bowl', 'chevron-right', 'chevron-left', 'chevron-down', 'drop', 'plus', 'moon', 'walker', 'today', 'pulse', 'person', 'fish', 'egg', 'onion', 'tomato', 'bottle', 'warning', 'sun', 'clock', 'feet', 'gauge', 'stairs', 'car', 'lock'];
    expect(Object.keys(ICON_PARTS).sort()).toEqual([...names].sort());
    for (const n of names) expect(ICON_PARTS[n as keyof typeof ICON_PARTS].length).toBeGreaterThan(0);
  });
  it('draws 20 dp icons in a 24 box at stroke 1.5', () => {
    expect(CLEAN_SPEC.icon).toMatchObject({ size: 20, viewBox: 24, strokeWidth: 1.5 });
  });
});

// Node's own fs, reached the way src/constants/__tests__/clean-spec.test.ts does.
const node = process as unknown as { getBuiltinModule(id: string): unknown; cwd(): string };
const fs = node.getBuiltinModule('node:fs') as { readFileSync(path: string, encoding: 'utf8'): string };
const spec = fs.readFileSync(`${node.cwd()}/docs/design/spec.md`, 'utf8');

/** `path M...` -> "path d"; `circle cx12 cy8.5 r3.5` -> "circle 12 8.5 3.5"; `rect x y w h rx` -> "rect x y w h rx". */
function parseShapes(cell: string): string[] {
  const out: string[] = [];
  for (const m of cell.matchAll(/`([^`]+)`/g)) {
    const t = m[1];
    const c = /^circle cx(\S+) cy(\S+) r(\S+)$/.exec(t);
    const r = /^rect x(\S+) y(\S+) w(\S+) h(\S+) rx(\S+)$/.exec(t);
    if (t.startsWith('path ')) out.push(`path ${t.slice(5).trim()}`);
    else if (c) out.push(`circle ${c[1]} ${c[2]} ${c[3]}`);
    else if (r) out.push(`rect ${r[1]} ${r[2]} ${r[3]} ${r[4]} ${r[5]}`);
    else throw new Error(`unknown shape: ${t}`);
  }
  return out;
}

function ours(name: keyof typeof ICON_PARTS): string[] {
  const parts = (ICON_PARTS[name] as readonly (string | readonly number[])[]).map((p) =>
    typeof p === 'string' ? `path ${p}` : `circle ${p.join(' ')}`,
  );
  if (name === 'lock') {
    parts.push(`rect ${LOCK_BODY.x} ${LOCK_BODY.y} ${LOCK_BODY.width} ${LOCK_BODY.height} ${LOCK_BODY.rx}`);
  }
  return parts;
}

describe('icon shapes match spec section 8', () => {
  const section = spec.slice(spec.indexOf('## 8. Icons'), spec.indexOf('## 9.'));
  const rows = section
    .split('\n')
    .filter((l) => l.startsWith('| ') && !l.startsWith('| Name'))
    .map((l) => l.split('|').map((c) => c.trim()))
    .map((cells) => ({ name: cells[1].split(' ')[0], shapes: parseShapes(cells[2]) }));
  const lockLine = spec.split('\n').find((l) => l.includes('Lock icon (same style as section 8)')) ?? '';
  rows.push({ name: 'lock', shapes: parseShapes(lockLine.slice(lockLine.indexOf('Lock icon'))) });

  it('lists every icon', () => {
    expect(rows.map((r) => r.name).sort()).toEqual(Object.keys(ICON_PARTS).sort());
  });

  for (const row of rows) {
    it(`draws ${row.name} with exactly the spec shapes`, () => {
      expect(row.shapes.length).toBeGreaterThan(0);
      expect(ours(row.name as keyof typeof ICON_PARTS).sort()).toEqual([...row.shapes].sort());
    });
  }
});

describe('midTone', () => {
  const k = CLEAN_SPEC.colors;
  it('is secondaryContainer (accentMid) in Clean+', () => {
    expect(midTone({ primary: k.accent, surface: k.white, secondaryContainer: k.accentMid })).toBe(k.accentMid);
  });
  it('is a mix of surface and primary elsewhere, even when secondaryContainer equals primary', () => {
    // Look F roles (src/constants/themes/f.ts: primary line 36, surface 56, secondaryContainer 43).
    const f = { primary: '#0E0E0E', surface: '#FFFFFF', secondaryContainer: '#0E0E0E' };
    const m = midTone(f);
    expect(m).toBe(mixHex('#FFFFFF', '#0E0E0E', 0.18));
    expect(m).not.toBe(f.primary);
    expect(m).not.toBe(f.surface);
  });
});

describe('hero colours', () => {
  it('are the spec values in Clean+', () => {
    const k = CLEAN_SPEC.colors;
    expect(heroColors({ primary: k.accent, onPrimary: k.white })).toEqual({
      strong: k.white,
      label: k.onBlue,
      pill: k.heroPill,
      quietBar: k.heroBarQuiet,
      goalLine: k.heroGoalLine,
    });
  });
  it('are mixed from primary and onPrimary in other looks, and stay near the spec mix', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    const k = CLEAN_SPEC.colors;
    const m = heroColors({ primary: '#123456', onPrimary: '#FFFFFF' });
    expect(m.strong).toBe('#FFFFFF');
    expect(m.label).toMatch(/^#[0-9A-F]{6}$/);
    // The mixing ratios reproduce the spec colours to within 6 per channel when applied to the spec blue.
    const near = (a: string, b: string) => [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 6);
    const t = heroColors({ primary: k.accent, onPrimary: '#FFFFFE' });
    expect(near(t.label, k.onBlue)).toBe(true);
    expect(near(t.pill, k.heroPill)).toBe(true);
    expect(near(t.quietBar, k.heroBarQuiet)).toBe(true);
    expect(near(t.goalLine, k.heroGoalLine)).toBe(true);
  });
});
