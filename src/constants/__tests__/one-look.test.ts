/**
 * The look lives in one place (themes/plain.ts → themes/e.ts and the shared
 * pieces). Owner, 18 Nov 2026: a look change must reach every screen without
 * editing screens one by one. These checks fail when a screen draws its own.
 */
import { describe, expect, it } from '@jest/globals';

// Node's fs and path, typed here: the app's tsconfig has no Node types.
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = require('fs') as {
  readdirSync(p: string): string[];
  readFileSync(p: string, e: 'utf8'): string;
  statSync(p: string): { isDirectory(): boolean };
};
const { join, relative, sep } = require('path') as { join(...p: string[]): string; relative(a: string, b: string): string; sep: string };

const SRC = join(__dirname, '..', '..');

function screenFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : screenFiles(path);
    return name.endsWith('.tsx') ? [path] : [];
  });
}

const FILES = screenFiles(SRC).map((p) => ({ file: relative(SRC, p).split(sep).join('/'), text: readFileSync(p, 'utf8') }));

describe('one look for every screen', () => {
  it('draws no old underlined text box (every box takes PLAIN_FIELD)', () => {
    const bad = FILES.filter((f) => /borderBottomColor:\s*theme\.onSurfaceVariant/.test(f.text)).map((f) => f.file);
    expect(bad).toEqual([]);
  });

  it('writes no colour by hand outside the theme, the plain kit and the widget', () => {
    const allowed = /^(components\/plain\/|widget\/|app\/design-preview|components\/today\/time-of-day-parts|components\/ui\/navigation-bar)/;
    const bad = FILES.filter((f) => !allowed.test(f.file) && /['"]#[0-9A-Fa-f]{6}['"]/.test(f.text)).map((f) => f.file);
    expect(bad).toEqual([]);
  });
});
