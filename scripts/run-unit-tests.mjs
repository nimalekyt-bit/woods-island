import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptsDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const tests = readdirSync(scriptsDir)
  .filter((name) => /\.test\.(cjs|mjs)$/.test(name))
  .sort()
  .map((name) => join(scriptsDir, name));

if (tests.length === 0) {
  console.error('No unit test files found in scripts/');
  process.exit(1);
}

console.log(`Running ${tests.length} unit test files in parallel...`);
const result = spawnSync(process.execPath, ['--test', ...tests], {
  stdio: 'inherit',
  windowsHide: true,
});

process.exit(result.status ?? 1);
