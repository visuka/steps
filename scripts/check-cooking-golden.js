// Runs the phone's cooking maths (src/nutrition/cooking/cook.ts) on a tables file and a golden file
// given on the command line:  node scripts/check-cooking-golden.js <cooking-c1.json> <golden.json>
// The files are only read, by the jest test src/nutrition/cooking/__tests__/real-golden.test.ts.
// Nothing is copied into this repo; stepsinfra's scripts/check_app_cooking.sh does the same with a
// temporary folder and also checks that this repo is left untouched.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

/* global __dirname */

const [tables, golden] = process.argv.slice(2);
if (!tables || !golden) {
  console.error('usage: node scripts/check-cooking-golden.js <tables.json> <golden.json>');
  process.exit(2);
}
const root = path.resolve(__dirname, '..');
const jest = path.join(root, 'node_modules', 'jest', 'bin', 'jest.js');
const run = spawnSync(
  process.execPath,
  [jest, '--ci', '--no-cache', '--silent', 'src/nutrition/cooking/__tests__/real-golden.test.ts'],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, STEPS_COOKING_TABLES: path.resolve(tables), STEPS_COOKING_GOLDEN: path.resolve(golden) },
  },
);
process.exit(run.status === null ? 1 : run.status);
