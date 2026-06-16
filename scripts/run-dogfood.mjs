import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vitestBin = resolve(root, 'node_modules/vitest/vitest.mjs');
const result = spawnSync(process.execPath, [vitestBin, 'run', 'src/test/dogfoodGithubFullScan.test.ts'], {
  stdio: 'inherit',
  cwd: root,
  env: {
    ...process.env,
    SHIPSEAL_LIVE_DOGFOOD: '1',
  },
});

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
