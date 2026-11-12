import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rust = await readFile(resolve(root, 'src-tauri/src/lib.rs'), 'utf8');
const commands = /tauri::generate_handler!\[([\s\S]*?)\]/.exec(rust)[1].match(/\b\w+\b/g);
function split(value) {
  let depth = 0, start = 0, items = [];
  for (let i = 0; i < value.length; i++) {
    if ('<(['.includes(value[i])) depth++;
    if ('>)]'.includes(value[i])) depth--;
    if (value[i] === ',' && depth === 0) { items.push(value.slice(start, i).trim()); start = i + 1; }
  }
  return [...items, value.slice(start).trim()].filter(Boolean);
}
function type(value) {
  value = value.trim();
  if (value === '()') return 'void';
  if (value === 'String' || value === '&str') return 'string';
  if (value === 'bool') return 'boolean';
  if (/^[uf i]\d+$/.test(value)) return 'number';
  if (value === 'Value') return 'JsonValue';
  const generic = /^(Option|Vec|Result)<([\s\S]*)>$/.exec(value);
  if (generic) {
    const inner = split(generic[2]);
    if (generic[1] === 'Option') return `${type(inner[0])} | null`;
    if (generic[1] === 'Vec') return `Array<${type(inner[0])}>`;
    return type(inner[0]);
  }
  throw new Error(`Unsupported Rust IPC type: ${value}`);
}
const signatures = {};
for (const name of commands) {
  const signature = new RegExp(`\\bfn\\s+${name}\\s*\\(([^]*?)\\)\\s*(?:->\\s*([^]*?))?\\s*\\{`).exec(rust);
  if (!signature) throw new Error(`Missing signature: ${name}`);
  const params = split(signature[1]).flatMap(param => {
    const colon = param.indexOf(':');
    const key = param.slice(0, colon).trim(), value = param.slice(colon + 1).trim();
    if (value.includes('tauri::State') || value === 'AppHandle') return [];
    return [{ name: key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), optional: value.startsWith('Option<'), type: type(value) }];
  });
  signatures[name] = { params, result: type(signature[2] || '()') };
}
const defaults = JSON.parse(/serde_json::from_str\(r###"([^]*?)"###\)/.exec(rust)[1]);
const settings = Object.entries(defaults).map(([name, value]) => {
  const t = Array.isArray(value) ? 'string[]' : typeof value;
  if (!['boolean', 'number', 'string', 'string[]'].includes(t)) throw new Error(`Untyped setting: ${name}`);
  return `  ${name}: ${t};`;
}).join('\n');
const entries = Object.entries(signatures).map(([name, { params, result }]) => {
  const args = params.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join('; ');
  return `  ${name}: { args: { ${args} }; result: ${result} };`;
}).join('\n');
const code = `// Generated from registered Rust command signatures and default_settings. Do not edit.\nexport type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };\nexport interface Settings {\n${settings}\n}\nexport interface RustCommands {\n${entries}\n}\n`;
const destination = resolve(root, 'runtime/ipc/generated.ts');
await mkdir(dirname(destination), { recursive: true });
if (process.argv.includes('--check')) {
  if (await readFile(destination, 'utf8') !== code) throw new Error('IPC contracts drifted. Run pnpm generate:ipc.');
} else await writeFile(destination, code);
export { signatures, root };
console.log(`Rust IPC contracts: ${commands.length} commands, ${Object.keys(defaults).length} settings.`);
