// Signs the already-accepted installer. The private key is supplied by the release environment.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, basename, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installer = resolve(process.argv[2] || 'missing-installer');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('A stable release version is required');
const name = `Woods-Island-${version}-windows-x64-Setup.exe`;
if (basename(installer) !== name) throw Error('Installer filename/version mismatch');
const manifest = JSON.parse(await readFile(installer.replace(/\.exe$/, '.manifest.json'), 'utf8'));
const bytes = await readFile(installer);
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (manifest.version !== version || manifest.installer.sha256 !== sha256 || manifest.installer.bytes !== bytes.length)
  throw Error('Installer does not match its accepted packaging manifest');
if (!process.env.TAURI_SIGNING_PRIVATE_KEY && !process.env.TAURI_SIGNING_PRIVATE_KEY_PATH)
  throw Error('Release signing key is not configured');
const sign = spawnSync(process.execPath, [join(root, 'node_modules/@tauri-apps/cli/tauri.js'), 'signer', 'sign', '--app-version', version, installer],
  { cwd: root, env: process.env, windowsHide: true, encoding: 'utf8' });
if (sign.error || sign.status !== 0) throw Error('Installer signing failed; no update manifest was published');
const signature = (await readFile(`${installer}.sig`, 'utf8')).trim();
if (!signature || (await stat(`${installer}.sig`)).size > 4096) throw Error('Unexpected signature file');
const signedText = Buffer.from(signature, 'base64').toString('utf8');
if (!signedText.split(/\r?\n/).some(line => line.startsWith('trusted comment:') && line.split('\t').includes(`version:${version}`)))
  throw Error('The signature is not bound to the release version');
const config = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
if (config.plugins?.updater?.requireSignedVersion !== true) throw Error('Signed versions must be required');
const update = {
  version, notes: 'Обновления из приложения, восстановление профиля, оптимизация и диагностика. / In-app updates, profile recovery, performance and diagnostics.',
  pub_date: new Date().toISOString(),
  platforms: { 'windows-x86_64': {
    signature, url: `https://github.com/nimalekyt-bit/woods-island/releases/download/v${version}/${name}`,
  } },
};
await writeFile(join(dirname(installer), 'latest.json'), JSON.stringify(update, null, 2) + '\n');
console.log(`Signed update manifest prepared for ${version}; installer SHA256 ${sha256}`);
