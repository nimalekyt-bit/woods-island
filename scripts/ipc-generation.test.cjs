const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('IPC check accepts Windows checkout line endings and still rejects changed types', async () => {
  const parent = path.join(os.tmpdir(), 'woodscorp_obs'); await fs.mkdir(parent, { recursive: true });
  const temp = await fs.mkdtemp(path.join(parent, 'island-ipc-'));
  const root = path.resolve(__dirname, '..');
  try {
    for (const file of ['scripts/generate-ipc.mjs', 'src-tauri/src/lib.rs', 'runtime/ipc/generated.ts']) {
      await fs.mkdir(path.dirname(path.join(temp, file)), { recursive: true });
      await fs.copyFile(path.join(root, file), path.join(temp, file));
    }
    const generated = path.join(temp, 'runtime/ipc/generated.ts');
    const original = (await fs.readFile(generated, 'utf8')).replace(/\r\n/g, '\n');
    const check = () => spawnSync(process.execPath, ['scripts/generate-ipc.mjs', '--check'], { cwd: temp, encoding: 'utf8', windowsHide: true });
    for (const ending of ['\n', '\r\n']) {
      await fs.writeFile(generated, original.replace(/\n/g, ending));
      const result = check(); assert.equal(result.status, 0, result.stderr);
    }
    await fs.writeFile(generated, original.replace('autostart: boolean', 'autostart: string'));
    const drift = check(); assert.notEqual(drift.status, 0); assert.match(drift.stderr, /contracts drifted/);
  } finally {
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(parent));
    await fs.rm(temp, { recursive: true, force: true });
  }
});
