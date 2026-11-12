import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(project, 'dist');
const validateOnly = process.argv.includes('--check');

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesIn(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

const files = await filesIn(source);
const paths = new Set(files.map(file => resolve(file)));
const requiredEntries = ['index.html', 'settings.html', 'overlay.html', 'editor.html'];
for (const entry of requiredEntries) {
  if (!paths.has(join(source, entry))) throw new Error(`Missing runtime entry: ${entry}`);
}

function checkReference(from, reference) {
  if (/^(?:https?:|data:|#)/.test(reference)) return;
  const local = reference.split(/[?#]/)[0];
  const resolved = resolve(local.startsWith('/') ? source : dirname(from), local.replace(/^\//, ''));
  if (!resolved.startsWith(source + sep) || !paths.has(resolved)) {
    throw new Error(`Broken runtime resource in ${relative(source, from)}: ${reference}`);
  }
}

const manifest = [];
const invoked = new Set();
const decoder = new TextDecoder('utf-8', { fatal: true });
for (const file of files) {
  const bytes = await readFile(file);
  manifest.push({ path: relative(source, file).replaceAll('\\', '/'), bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex') });
  if (!/\.(?:js|css|html)$/.test(file)) continue;
  const text = decoder.decode(bytes);
  if (text.includes('\uFFFD')) throw new Error(`Damaged UTF-8 text: ${relative(source, file)}`);
  if (file.endsWith('.js')) {
    const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (check.status !== 0) throw new Error(check.stderr || `Invalid JavaScript: ${file}`);
    for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\()([`"'])([^`"']+)\1/g)) {
      if (/^(?:\.{1,2}\/|\/)/.test(match[2])) checkReference(file, match[2]);
    }
    for (const match of text.matchAll(/__TAURI_INTERNALS__\.invoke\(([`"'])([a-z][a-z0-9_]*)\1/g)) invoked.add(match[2]);
  } else if (file.endsWith('.html')) {
    for (const match of text.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/g)) {
      checkReference(file, match[1]);
    }
  } else {
    for (const match of text.matchAll(/url\(\s*["']?([^\s)"']+)["']?\s*\)/g)) {
      checkReference(file, match[1]);
    }
  }
}

const backend = await readFile(join(project, 'src-tauri', 'src', 'lib.rs'), 'utf8');
const handler = /tauri::generate_handler!\[([\s\S]*?)\]/.exec(backend)?.[1] ?? '';
const registered = new Set(handler.match(/\b[a-z][a-z0-9_]*\b/g) ?? []);
const missing = [...invoked].filter(command => !registered.has(command));
if (missing.length) throw new Error(`Runtime IPC commands are not registered: ${missing.join(', ')}`);

const runtimeFiles = await filesIn(join(project, 'runtime'));
for (const file of runtimeFiles.filter(file => /\.(ts|tsx|js)$/.test(file))) {
  const code = await readFile(file, 'utf8');
  const calls = file.endsWith('legacy-api.ts') ? /\bT\(([\x22'`])([a-z][a-z0-9_]*)\1/g : /__TAURI_INTERNALS__\.invoke\(([\x22'`])([a-z][a-z0-9_]*)\1/g;
  for (const match of code.matchAll(calls)) {
    if (!registered.has(match[2])) throw new Error('Unregistered source IPC: ' + match[2]);
    invoked.add(match[2]);
  }
}
if (!validateOnly) {
  const pkg = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
  await writeFile(join(source, 'runtime-manifest.json'), JSON.stringify({
    version: pkg.version, runtimeSource: 'runtime', compiler: 'Vite + TypeScript',
    commands: [...invoked].sort(),
    files: manifest.filter(file => file.path !== 'runtime-manifest.json').sort((a, b) => a.path.localeCompare(b.path)),
  }, null, 2) + '\n', 'utf8');
}
console.log(`Runtime ${validateOnly ? 'validated' : 'built'}: ${files.length} resources, ${invoked.size} registered IPC commands, UTF-8 and JS syntax verified.`);

