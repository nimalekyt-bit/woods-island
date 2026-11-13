import { createReadStream } from 'node:fs';
import { constants, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyWindowsIcons } from './verify-windows-icons.mjs';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const tauriRoot = join(root, 'src-tauri');
const target = process.env.CARGO_TARGET_DIR ? resolve(process.env.CARGO_TARGET_DIR) : join(tauriRoot, 'target');
const release = join(target, 'release');
const executable = join(release, 'woods-island.exe');
const overlayPath = join(tauriRoot, 'tauri.installer.conf.json');
// pnpm's existing package links are resolved before checking the tool's path.
const cliPath = await realpath(join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'));
const output = join(root, 'dist-installer');
const args = process.argv.slice(2);
let expectedSha256 = process.env.WOODS_INSTALLER_EXPECTED_SHA256;
let checkOnly = false;
let configOnly = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--expected-sha256') expectedSha256 = args[++index];
  else if (args[index] === '--check') checkOnly = true;
  else if (args[index] === '--check-config') configOnly = true;
  else throw new Error(`Unknown argument: ${args[index]}`);
}

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

async function safeProjectPath(path) {
  const full = resolve(path);
  const within = relative(root, full);
  requireThat(within !== '' && !within.startsWith(`..${sep}`) && within !== '..' && !isAbsolute(within), `Path outside project: ${full}`);
  let part = root;
  for (const segment of within.split(sep)) {
    part = join(part, segment);
    try {
      const entry = await lstat(part);
      requireThat(!entry.isSymbolicLink(), `Reparse/symlink path is forbidden: ${part}`);
      requireThat((await realpath(part)).toLowerCase() === resolve(part).toLowerCase(), `Redirected path is forbidden: ${part}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return full;
}

function merge(base, overlay) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? merge(base[key] ?? {}, value) : value;
  }
  return result;
}

async function fingerprint(name, source) {
  await safeProjectPath(source);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(source)) hash.update(chunk);
  const info = await stat(source);
  requireThat(info.isFile() && info.size > 0, `Missing/empty component: ${source}`);
  return { name, source, bytes: info.size, sha256: hash.digest('hex') };
}

function run(file, arguments_, env = process.env, inherit = false) {
  const result = spawnSync(file, arguments_, {
    cwd: root, windowsHide: true, env,
    ...(inherit ? { stdio: 'inherit' } : { encoding: 'utf8' }),
  });
  requireThat(!result.error && result.status === 0,
    `${file} failed (${result.status ?? result.error?.message}): ${result.stderr ?? ''}`);
  return result.stdout?.trim() ?? '';
}

async function checkVersion(version) {
  const found = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '(Get-Item -LiteralPath $env:WOODS_INSTALLER_EXE -ErrorAction Stop).VersionInfo.ProductVersion'],
    { ...process.env, WOODS_INSTALLER_EXE: executable });
  requireThat(found === version, `Executable version ${found || 'unavailable'} != package ${version}; build and accept the fresh EXE first`);
}

function verifyNsisPayload(script, components) {
  const normalize = value => value.replace(/[\\/]+/g, '\\').toLowerCase();
  const mainPath = script.match(/^!define MAINBINARYSRCPATH "([^"]+)"\r?$/m)?.[1];
  requireThat(mainPath && normalize(mainPath) === normalize(executable), 'Generated NSIS main EXE path differs from accepted EXE');
  const installSection = script.match(/^Section Install\r?\n([\s\S]*?)^SectionEnd\r?$/m)?.[1];
  requireThat(installSection, 'Generated NSIS Install section is missing');
  const fileLines = installSection.split(/\r?\n/).filter(line => /^\s*File\s/.test(line));
  requireThat(fileLines.filter(line => line.trim() === 'File "${MAINBINARYSRCPATH}"').length === 1,
    'Generated NSIS main EXE copy command is unexpected');
  const packaged = fileLines.filter(line => line.trim() !== 'File "${MAINBINARYSRCPATH}"').map(line => {
    const match = line.match(/^\s*File \/a "\/oname=([^"]+)" "([^"]+)"\s*$/);
    requireThat(match, `Unexpected NSIS payload statement: ${line}`);
    return [normalize(match[1]), normalize(resolve(match[2]))];
  });
  const expected = components.slice(1).map(([name, source]) => [normalize(name), normalize(resolve(source))]);
  requireThat(packaged.length === expected.length && expected.every(([name, source]) =>
    packaged.some(([actualName, actualSource]) => name === actualName && source === actualSource)),
    'Generated NSIS payload differs from manifest allowlist; do not publish');
}

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const base = JSON.parse(await readFile(join(tauriRoot, 'tauri.conf.json'), 'utf8'));
const overlay = JSON.parse(await readFile(overlayPath, 'utf8'));
const config = merge(base, overlay);
const version = packageJson.version;
const cargo = await readFile(join(tauriRoot, 'Cargo.toml'), 'utf8');
const cargoPackage = cargo.match(/^\[package\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1];
const cargoVersion = cargoPackage?.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
requireThat(/^\d+\.\d+\.\d+$/.test(version), 'Installer requires a stable numeric package version');
requireThat(config.version === version && cargoVersion === version, 'package.json, Cargo.toml and tauri.conf.json versions must match');
requireThat(config.productName === 'Woods Island' && config.identifier === 'com.woods.island', 'Unexpected application identity');
requireThat(!config.build.beforeBundleCommand, 'beforeBundleCommand must be empty: packaging must not rebuild the accepted EXE');
await safeProjectPath(target);
requireThat(!config.mainBinaryName || config.mainBinaryName === 'woods-island', 'Do not rename the accepted binary');
requireThat(config.bundle.active && JSON.stringify(config.bundle.targets) === '["nsis"]', 'Only NSIS packaging is supported');
requireThat(config.bundle.useLocalToolsDir === true && config.bundle.createUpdaterArtifacts === false, 'Local tool cache and disabled updater artifacts are required');
requireThat(!config.bundle.externalBin?.length, 'External binaries must be explicitly audited before packaging');
requireThat(config.bundle.windows.nsis.installMode === 'currentUser', 'Installer must use currentUser');
requireThat(config.bundle.windows.webviewInstallMode.type === 'downloadBootstrapper'
  && config.bundle.windows.webviewInstallMode.silent === true, 'WebView2 downloadBootstrapper/silent is required');
requireThat(config.bundle.windows.allowDowngrades === false, 'Downgrade protection must be enabled');
requireThat(config.bundle.windows.nsis.compression === 'lzma', 'Use LZMA compression');
requireThat(!config.bundle.windows.nsis.template, 'Custom NSIS templates require a separate payload audit');
requireThat(config.bundle.windows.nsis.installerHooks === 'windows/installer-hooks.nsh', 'Use the audited Woods Island uninstall hooks');
requireThat(JSON.stringify(config.bundle.windows.nsis.languages) === '["Russian","English"]'
  && config.bundle.windows.nsis.displayLanguageSelector === true, 'Russian/English language selector is required');
const resourceMap = {
  'resources/bin/ffmpeg.exe': 'bin/ffmpeg.exe',
  'resources/bin/ffprobe.exe': 'bin/ffprobe.exe',
  'resources/bin/LICENSE': 'bin/LICENSE',
  'resources/bin/FFMPEG_PROVENANCE.md': 'bin/FFMPEG_PROVENANCE.md',
  '../LICENSE': 'LICENSE',
  '../THIRD_PARTY_NOTICES.md': 'THIRD_PARTY_NOTICES.md',
};
requireThat(config.bundle.resources && !Array.isArray(config.bundle.resources)
  && Object.keys(config.bundle.resources).length === Object.keys(resourceMap).length
  && Object.entries(resourceMap).every(([source, destination]) => config.bundle.resources[source] === destination),
  'Installer resources differ from the exact allowlist');
for (const path of [target, output, overlayPath, cliPath, ...Object.keys(resourceMap).map(path => resolve(tauriRoot, path)),
  resolve(tauriRoot, config.bundle.licenseFile), ...config.bundle.icon.map(path => resolve(tauriRoot, path)),
  ...['installerIcon', 'uninstallerIcon', 'installerHooks'].flatMap(key => config.bundle.windows.nsis[key]
    ? [resolve(tauriRoot, config.bundle.windows.nsis[key])] : [])]) {
  await safeProjectPath(path);
}
for (const [source] of Object.entries(resourceMap)) {
  requireThat((await stat(resolve(tauriRoot, source))).isFile(), `Resource is not a file: ${source}`);
}
if (configOnly) {
  console.log(`Installer configuration verified for ${version}; no build or bundle was run`);
  process.exit(0);
}
requireThat(process.platform === 'win32' && process.arch === 'x64', 'Installer packaging requires Windows x64');
requireThat(/^[a-fA-F0-9]{64}$/.test(expectedSha256 ?? ''), 'Supply --expected-sha256 <accepted EXE SHA256> or WOODS_INSTALLER_EXPECTED_SHA256');
expectedSha256 = expectedSha256.toLowerCase();
await checkVersion(version);
const binaryNames = (await readdir(join(tauriRoot, 'src', 'bin'))).filter(name => name.endsWith('.rs'))
  .map(name => `${name.slice(0, -3)}.exe`).sort();
requireThat(JSON.stringify(binaryNames) === '["woods-island-pet-import.exe"]', 'Cargo helper binary set changed; audit payload before packaging');
const components = [
  ['woods-island.exe', executable],
  ...binaryNames.map(name => [name, join(release, name)]),
  ...Object.entries(resourceMap).map(([source, name]) => [name, resolve(tauriRoot, source)]),
];
for (const program of ['ffmpeg.exe', 'ffprobe.exe']) run(join(tauriRoot, 'resources', 'bin', program), ['-version']);
const before = await Promise.all(components.map(([name, source]) => fingerprint(name, source)));
const buildInputs = [join(root, 'package.json'), join(tauriRoot, 'Cargo.toml'), join(tauriRoot, 'tauri.conf.json'),
  overlayPath, resolve(tauriRoot, config.bundle.windows.nsis.installerHooks), resolve(tauriRoot, 'icons/icon.ico')];
const inputsBefore = await Promise.all(buildInputs.map(source => fingerprint(relative(root, source), source)));
requireThat(before[0].sha256 === expectedSha256, `EXE SHA256 ${before[0].sha256} != accepted ${expectedSha256}`);
const nativeIconProofs = await Promise.all(components.slice(0, 1 + binaryNames.length)
  .map(([, source]) => verifyWindowsIcons(source, join(tauriRoot, 'icons', 'icon.ico'))));
if (checkOnly) {
  console.log(`Installer preflight verified: ${version}, ${before.length} payload files, EXE ${expectedSha256}; no bundle was run`);
  process.exit(0);
}

await mkdir(await safeProjectPath(join(root, '.qa-temp')), { recursive: true });
const scratch = await mkdtemp(join(root, '.qa-temp', 'installer-packaging-'));
await safeProjectPath(scratch);
const bundleArgs = [cliPath, 'bundle', '--bundles', 'nsis', '--config', overlayPath, '--ci', '--no-binary-patching', '--no-sign'];
const buildStarted = Date.now();
console.log(`Bundling ${version} from accepted EXE ${expectedSha256}; TEMP/TMP: ${scratch}`);
run(process.execPath, bundleArgs, { ...process.env, TEMP: scratch, TMP: scratch }, true);
await checkVersion(version);
const after = await Promise.all(components.map(([name, source]) => fingerprint(name, source)));
const inputsAfter = await Promise.all(buildInputs.map(source => fingerprint(relative(root, source), source)));
requireThat(after.every((file, index) => file.sha256 === before[index].sha256 && file.bytes === before[index].bytes),
  'A payload component changed during packaging; do not publish this installer');
requireThat(inputsAfter.every((file, index) => file.sha256 === inputsBefore[index].sha256),
  'Configuration changed during packaging; do not publish this installer');
const nsisSource = join(release, 'nsis', 'x64', 'installer.nsi');
await safeProjectPath(nsisSource);
verifyNsisPayload(await readFile(nsisSource, 'utf8'), components);
const bundled = join(release, 'bundle', 'nsis', `Woods Island_${version}_x64-setup.exe`);
await safeProjectPath(bundled);
requireThat((await stat(bundled)).mtimeMs >= buildStarted - 2000, 'Bundler output is stale');
const installerIconProof = await verifyWindowsIcons(bundled, join(tauriRoot, 'icons', 'icon.ico'));
const artifactName = `Woods-Island-${version}-windows-x64-Setup.exe`;
const artifact = await fingerprint(artifactName, bundled);
await mkdir(await safeProjectPath(output), { recursive: true });
const runOutput = await mkdtemp(join(output, `${version}-`));
await safeProjectPath(runOutput);
const destination = join(runOutput, artifactName);
await copyFile(bundled, destination, constants.COPYFILE_EXCL);
const copied = await fingerprint(artifactName, destination);
requireThat(copied.sha256 === artifact.sha256 && copied.bytes === artifact.bytes, 'Copied installer does not match bundle');
await writeFile(`${destination}.sha256`, `${copied.sha256}  ${artifactName}\n`, { flag: 'wx' });
await writeFile(join(runOutput, `Woods-Island-${version}-windows-x64-Setup.manifest.json`), JSON.stringify({
  version, platform: 'windows-x64', generatedAt: new Date().toISOString(),
  installer: { name: copied.name, bytes: copied.bytes, sha256: copied.sha256 },
  files: after.map(({ source, ...file }) => file),
  buildInputs: inputsAfter.map(({ source, ...file }) => file),
  installMode: 'currentUser', webviewInstallMode: 'downloadBootstrapper',
  webviewNetworkRequiredIfMissing: true, signed: false, binaryPatching: false,
  generatedNsisPayloadVerified: true,
  nativeAndInstallerIconsVerified: true,
  iconProofs: [...nativeIconProofs, installerIconProof].map(({ executable, ...proof }) => proof),
  cliVersion: JSON.parse(await readFile(join(dirname(cliPath), 'package.json'), 'utf8')).version,
  acceptance: 'Packaging integrity only; installation/native acceptance is recorded separately',
}, null, 2) + '\n', { flag: 'wx' });
console.log(`Installer created: ${destination}\nSHA256: ${copied.sha256}\nAccepted EXE unchanged: ${expectedSha256}`);
