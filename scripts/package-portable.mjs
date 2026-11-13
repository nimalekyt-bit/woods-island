import { copyFile, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { verifyWindowsIcons } from './verify-windows-icons.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist-portable');
const source = join(root, 'src-tauri', 'resources', 'bin');
const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const executable = join(process.env.CARGO_TARGET_DIR ? resolve(process.env.CARGO_TARGET_DIR) : join(root, 'src-tauri', 'target'), 'release', 'woods-island.exe');
const versionCheck = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
  '(Get-Item -LiteralPath $env:WOODS_PACKAGE_EXE -ErrorAction Stop).VersionInfo.ProductVersion'], {
  windowsHide: true, encoding: 'utf8', env: { ...process.env, WOODS_PACKAGE_EXE: executable },
});
if (versionCheck.status !== 0 || versionCheck.stdout.trim() !== version) {
  throw new Error(`Executable version ${versionCheck.stdout.trim() || 'unavailable'} does not match package ${version}; rebuild before packaging`);
}
await verifyWindowsIcons(executable, join(root, 'src-tauri', 'icons', 'icon.ico'));
const assets = [
  ['woods-island.exe', executable],
  ...['ffmpeg.exe', 'ffprobe.exe', 'LICENSE', 'FFMPEG_PROVENANCE.md'].map(name => [`bin/${name}`, join(source, name)]),
  ['LICENSE', join(root, 'LICENSE')],
  ['THIRD_PARTY_NOTICES.md', join(root, 'THIRD_PARTY_NOTICES.md')],
];
for (const program of ['ffmpeg.exe', 'ffprobe.exe']) {
  const check = spawnSync(join(source, program), ['-version'], { windowsHide: true, encoding: 'utf8' });
  if (check.status !== 0) throw new Error(`${program} failed verification: ${check.stderr || check.error}`);
}
const verified = await Promise.all(assets.map(async ([name, file]) => {
  const bytes = await readFile(file);
  return { name, file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}));
if (resolve(output) !== join(root, 'dist-portable')) throw new Error('Unsafe portable output');
await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'bin'), { recursive: true });
for (const asset of verified) await copyFile(asset.file, join(output, asset.name));
await writeFile(join(output, 'README.txt'),
  `Woods Island ${version} — Windows x64\r\n\r\nЗапуск: woods-island.exe. Папка bin нужна для MP4/GIF записи.\r\n` +
  'Настройки и данные: %APPDATA%\\woods-island. Для ИИ и диктовки укажи свой ключ или локальный сервер в настройках.\r\n' +
  'Для запуска требуется Microsoft Edge WebView2 Runtime.\r\n' +
  'Яндекс Музыка Mod требует отдельного Woods connector.\r\n' +
  'Обновления и сообщения об ошибках: https://github.com/nimalekyt-bit/woods-island\r\n', 'utf8');
await writeFile(join(output, 'manifest.json'), JSON.stringify({
  version,
  files: verified.map(({ file, ...asset }) => asset),
}, null, 2) + '\n');
console.log(`Portable package created: ${output} (${verified.length} verified files)`);
