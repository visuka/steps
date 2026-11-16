/**
 * Today opens Food and Activity, which have no bar buttons. expo-router sends
 * a tab screen that is hidden (href null) or not declared back to Today, which
 * broke build 69: these tests keep every tab screen declared and shown.
 */
import { describe, expect, it } from '@jest/globals';

import { BAR_TABS, OFF_BAR_SCREENS, TAB_SCREENS } from '@/components/tab-routes';
import { type DetailKind, detailRoute } from '@/components/today/today-actions';

// Node's own fs, reached the way clean-spec.test.ts does (the app has no @types/node).
const node = process as unknown as { getBuiltinModule(id: string): unknown; cwd(): string };
const fs = node.getBuiltinModule('node:fs') as {
  readFileSync(path: string, encoding: 'utf8'): string;
  readdirSync(path: string): string[];
  existsSync(path: string): boolean;
};
const ROOT = node.cwd();
const APP = `${ROOT}/src/app`;

/** The tab screens on disk: app/(tabs)/<name>.tsx, without the layout. */
const onDisk = fs
  .readdirSync(`${APP}/(tabs)`)
  .filter((f) => f.endsWith('.tsx') && f !== '_layout.tsx')
  .map((f) => f.replace(/\.tsx$/, ''))
  .sort();

const tabNames = new Set(TAB_SCREENS.map((s) => s.name));

/**
 * Where a path lands, by expo-router's rule: '/' and '/<tab>' are tab screens
 * (shown only if declared and not hidden), anything else a screen file or
 * folder under app/.
 */
function lands(pathname: string): string {
  const first = pathname.split('/').filter(Boolean)[0] ?? 'index';
  if (tabNames.has(first)) return `tab:${first}`;
  if (fs.existsSync(`${APP}/${first}.tsx`) || fs.existsSync(`${APP}/${first}`)) return `screen:${first}`;
  return 'nowhere';
}

describe('tab screens', () => {
  it('declares every screen in app/(tabs), so expo-router never treats one as undeclared and sends it to Today', () => {
    expect([...tabNames].sort()).toEqual(onDisk);
  });

  it('hides none of them: a hidden tab (href null) is sent back to Today, which broke build 69', () => {
    for (const s of TAB_SCREENS) expect(Object.keys(s).sort()).toEqual(['name', 'title']);
    const source = fs.readFileSync(`${ROOT}/src/components/app-tabs.tsx`, 'utf8');
    expect(source).not.toMatch(/href:\s*null/);
  });

  it('keeps Food and Activity as screens, without bar buttons', () => {
    expect(BAR_TABS.map((t) => t.key)).toEqual(['index', 'plus', 'you']);
    expect(OFF_BAR_SCREENS.map((s) => s.name)).toEqual(expect.arrayContaining(['food', 'activity']));
  });
});

describe("Today's taps", () => {
  const kinds: DetailKind[] = ['steps', 'food', 'water', 'sleep', 'walk'];

  it('the Food tile opens the Food screen and the Walk tile the Activity screen', () => {
    expect(lands(detailRoute('food')!.pathname)).toBe('tab:food');
    expect(lands(detailRoute('walk')!.pathname)).toBe('tab:activity');
    expect(detailRoute('walk')!.params).toEqual({ section: 'workouts' });
  });

  it('every tile lands on a real screen', () => {
    for (const k of kinds) expect([k, lands(detailRoute(k)!.pathname)]).not.toEqual([k, 'nowhere']);
  });

  it('Log food, You, news, the walk card and the food chart land on real screens', () => {
    for (const p of ['/food', '/you', '/news', '/walk/record', '/detail/food', '/activity']) {
      expect([p, lands(p)]).not.toEqual([p, 'nowhere']);
    }
  });
});
