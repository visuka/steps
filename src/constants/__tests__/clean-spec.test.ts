/**
 * Keeps clean-spec.ts, docs/design/spec.md and the approved mockup
 * docs/design/clean-plus.html telling the same story (T2).
 */

import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '../themes/clean-spec';

// Node's own fs, reached the way walk-rows.test.ts does (the app has no @types/node).
const node = process as unknown as { getBuiltinModule(id: string): unknown; cwd(): string };
const fs = node.getBuiltinModule('node:fs') as { readFileSync(path: string, encoding: 'utf8'): string };
const ROOT = node.cwd();
const html = fs.readFileSync(`${ROOT}/docs/design/clean-plus.html`, 'utf8');
const spec = fs.readFileSync(`${ROOT}/docs/design/spec.md`, 'utf8');
const specLower = spec.toLowerCase();

const css = html.slice(html.indexOf('<style'), html.indexOf('</style>'));

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!m) throw new Error(`no CSS rule for ${selector}`);
  return m[1];
}

function norm(hex: string): string {
  const h = hex.toUpperCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
}

describe('clean-spec vs the mockup', () => {
  it(':root variables equal the typed colours', () => {
    const root = /:root\s*\{([^}]*)\}/.exec(css)![1];
    const vars = [...root.matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)];
    const seen = new Set<string>();
    for (const [, name, value] of vars) {
      const key = CLEAN_SPEC.cssVars[name as keyof typeof CLEAN_SPEC.cssVars];
      if (name === '--sh') {
        expect(value.replace(/\s+/g, '')).toBe(CLEAN_SPEC.shadow.card.replace(/\s+/g, ''));
        continue;
      }
      expect(key).toBeDefined();
      expect(norm(value.trim())).toBe(CLEAN_SPEC.colors[key as keyof typeof CLEAN_SPEC.colors]);
      seen.add(name);
    }
    expect([...seen].sort()).toEqual(Object.keys(CLEAN_SPEC.cssVars).sort());
  });

  it('type classes match size, line height, weight and letter spacing', () => {
    for (const t of [
      CLEAN_SPEC.type.caption,
      CLEAN_SPEC.type.body,
      CLEAN_SPEC.type.value,
      CLEAN_SPEC.type.title,
      CLEAN_SPEC.type.display,
    ]) {
      const body = rule(`.${t.css}`);
      expect(body).toContain(`font-size:${t.size}px`);
      expect(body).toContain(`line-height:${t.lineHeight}px`);
      const w = /font-weight:(\d+)/.exec(body);
      if (w) expect(Number(w[1])).toBe(t.weight);
    }
    expect(rule('.s52')).toContain('letter-spacing:-.02em');
    expect(CLEAN_SPEC.type.display.letterSpacing).toBeCloseTo(-0.02 * 52, 2);
    expect(rule('.med')).toContain(`font-weight:${CLEAN_SPEC.weights.medium}`);
    expect(rule('.light')).toContain(`font-weight:${CLEAN_SPEC.weights.light}`);
  });

  it('component sizes and radii match their rules', () => {
    const S = CLEAN_SPEC.sizes;
    const R = CLEAN_SPEC.radius;
    expect(rule('.circ')).toContain(`width:${CLEAN_SPEC.icon.circle}px`);
    expect(rule('.circ')).toContain(`border-radius:${R.circle}px`);
    expect(rule('.card')).toContain(`border-radius:${R.card}px`);
    expect(rule('.tile')).toContain(`border-radius:${R.tile}px`);
    expect(rule('.tile')).toContain(`padding:${S.tile.padding}px`);
    expect(rule('.tile')).toContain(`height:${S.tile.height}px`);
    expect(rule('.pill')).toContain(`height:${S.pill.height}px`);
    expect(rule('.pill')).toContain(`border-radius:${R.pill}px`);
    expect(rule('.bar')).toContain(`height:${S.bar.height}px`);
    expect(rule('.bar')).toContain(`border-radius:${R.bar}px`);
    expect(rule('.nav')).toContain(`height:${S.nav.height}px`);
    expect(rule('.nav')).toContain(`padding:0 ${S.nav.sidePadding}px`);
    expect(rule('.nav span')).toContain(`width:${S.nav.slot}px`);
    expect(rule('.fab')).toContain(`width:${S.nav.fab}px`);
    expect(rule('.fab')).toContain(`border-radius:${R.fab}px`);
    expect(rule('.fab')).toContain(CLEAN_SPEC.shadow.fab.replace(/, /g, ','));
    expect(rule('.btn')).toContain(`height:${S.button.height}px`);
    expect(rule('.btn')).toContain(`border-radius:${R.button}px`);
    expect(rule('.day')).toContain(`width:${S.week.dayWidth}px`);
    expect(rule('.day')).toContain(`height:${S.week.dayHeight}px`);
    expect(rule('.day')).toContain(`border-radius:${R.dayChip}px`);
    expect(rule('.day b')).toContain(`width:${S.week.trackWidth}px`);
    expect(rule('.day b')).toContain(`height:${S.week.trackHeight}px`);
    expect(rule('.ing')).toContain(`height:${S.ingredientRow.height}px`);
    expect(rule('.nut')).toContain(`height:${S.nutrientRow.height}px`);
    expect(rule('.nut .n')).toContain(`width:${S.nutrientRow.nameWidth}px`);
    expect(rule('.nut .v')).toContain(`width:${S.nutrientRow.valueWidth}px`);
    expect(rule('.phone')).toContain(`width:${S.phoneWidth}px`);
    expect(rule('.phone')).toContain(`height:${S.phoneHeight}px`);
  });

  it('every hex colour in the mockup is in the typed colours', () => {
    const known = new Set(Object.values(CLEAN_SPEC.colors).map(norm));
    const used = new Set([...html.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map((m) => norm(m[0])));
    const unknown = [...used].filter((h) => !known.has(h));
    expect(unknown).toEqual([]);
  });

  it('the shadow in :root is the typed card shadow', () => {
    expect(html.replace(/\s+/g, '')).toContain(CLEAN_SPEC.shadow.card.replace(/\s+/g, ''));
    expect(html.replace(/\s+/g, '')).toContain(CLEAN_SPEC.shadow.segment.replace(/\s+/g, ''));
  });
});

describe('spec.md covers the mockup', () => {
  it('mentions every CSS class', () => {
    const classes = new Set<string>();
    for (const m of css.matchAll(/\.([a-z][a-z0-9-]*)/g)) classes.add(m[1]);
    for (const m of html.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach((c: string) => classes.add(c));
    const missing = [...classes].filter((c) => !spec.includes(`.${c}`));
    expect(missing).toEqual([]);
  });

  it('mentions every hex colour', () => {
    const used = new Set([...html.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toUpperCase()));
    const missing = [...used].filter((h) => !specLower.includes(h.toLowerCase()));
    expect(missing).toEqual([]);
  });

  it('mentions every typed colour', () => {
    for (const hex of Object.values(CLEAN_SPEC.colors)) {
      expect(specLower).toContain(hex.toLowerCase());
    }
  });
});
