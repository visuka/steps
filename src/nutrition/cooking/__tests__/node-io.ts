/** Node's fs and environment for the golden tests, reached the way clean-spec.test.ts does (the app has no @types/node). */
const node = process as unknown as {
  getBuiltinModule(id: string): unknown;
  cwd(): string;
  env: Record<string, string | undefined>;
};
const fs = node.getBuiltinModule('node:fs') as { readFileSync(path: string, encoding: 'utf8'): string };

export const readText = (path: string): string => fs.readFileSync(path, 'utf8');
export const readJson = (path: string): unknown => JSON.parse(readText(path));
export const env = (name: string): string | undefined => node.env[name];
/** This folder, from the repo root jest runs in. */
export const testsDir = (): string => `${node.cwd()}/src/nutrition/cooking/__tests__`;
