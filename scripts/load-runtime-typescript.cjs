const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const cache = new Map();

// Evaluate the pure production TS modules and their relative imports. Runtime
// type checking is still performed by pnpm build; no duplicated policy here.
function loadTypeScript(relative) {
  const file = path.resolve(__dirname, '..', relative);
  if (cache.has(file)) return cache.get(file).exports;
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file,
  }).outputText;
  const loaded = new Module(file);
  loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  const nativeRequire = loaded.require.bind(loaded);
  loaded.require = request => {
    if (request.startsWith('.')) {
      const candidate = path.resolve(path.dirname(file), request);
      const typed = candidate.endsWith('.ts') ? candidate : candidate + '.ts';
      if (fs.existsSync(typed)) return loadTypeScript(typed);
    }
    return nativeRequire(request);
  };
  cache.set(file, loaded);
  loaded._compile(compiled, file);
  return loaded.exports;
}
module.exports = { loadTypeScript };
