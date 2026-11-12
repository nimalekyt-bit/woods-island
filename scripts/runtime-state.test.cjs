const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Pure production policies run directly, without a browser or a second implementation.
function loadTypeScript(relative) {
  const file = path.resolve(__dirname, '..', relative);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const compiledModule = new Module(file);
  compiledModule.filename = file;
  compiledModule.paths = Module._nodeModulePaths(path.dirname(file));
  compiledModule._compile(compiled, file);
  return compiledModule.exports;
}
const { createMediaActivityTracker, PAUSED_MEDIA_GRACE_MS } = loadTypeScript('runtime/media/activity.ts');
const { hasLiquidIsland, selectCharacter, resolveCharacter } = loadTypeScript('runtime/characters/selection.ts');
const { createCharacterCatalog } = loadTypeScript('runtime/characters/catalog.ts');

function fixture() {
  let now = 0, live = false, playing = false;
  const tasks = new Set();
  const tracker = createMediaActivityTracker({
    isLive: () => live, isPlaying: () => playing, setLive: value => { live = value; },
    schedule: (callback, delay) => {
      const task = { at: now + delay, callback }; tasks.add(task);
      return () => tasks.delete(task);
    },
  });
  return {
    tracker, tasks, get live() { return live; },
    update(value) { playing = value?.playing === true; tracker.update(value); },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...tasks].filter(task => task.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        now = next.at; tasks.delete(next); next.callback();
      }
      now = end;
    },
  };
}

test('Repeated paused metadata cannot postpone the 2500 ms collapse', () => {
  const f = fixture(); f.update({ playing: true }); f.update({ playing: false });
  for (let i = 0; i < 24; i++) { f.advance(100); f.update({ playing: false }); assert.equal(f.live, true); assert.equal(f.tasks.size, 1); }
  f.advance(99); assert.equal(f.live, true);
  f.advance(1); assert.equal(f.live, false); assert.equal(PAUSED_MEDIA_GRACE_MS, 2500);
  f.update({ playing: false }); assert.equal(f.tasks.size, 0);
});
test('Resume cancels the old deadline; the next pause gets its own grace period', () => {
  const f = fixture(); f.update({ playing: true }); f.update({ playing: false }); f.advance(1800);
  f.update({ playing: true }); assert.equal(f.tasks.size, 0); f.advance(1000); assert.equal(f.live, true);
  f.update({ playing: false }); f.advance(2499); assert.equal(f.live, true); f.advance(1); assert.equal(f.live, false);
});
test('Missing media and disposal cancel timers; paused startup stays folded', () => {
  const f = fixture(); f.update({ playing: false }); assert.equal(f.tasks.size, 0); assert.equal(f.live, false);
  f.update({ playing: true }); f.update({ playing: false }); f.update(null); assert.equal(f.live, false); assert.equal(f.tasks.size, 0);
  f.update({ playing: true }); f.update({ playing: false }); f.tracker.dispose(); assert.equal(f.tasks.size, 0);
  f.advance(3000); assert.equal(f.live, true);
});
test('No character keeps a plain island even when liquidWith is enabled', () => {
  for (const all of [false, true]) for (const liquidWith of [false, true]) assert.equal(hasLiquidIsland('none', liquidWith, all), false);
  assert.equal(hasLiquidIsland('liquid', false, true), true);
  assert.equal(hasLiquidIsland('pixel', true, true), true);
  assert.equal(hasLiquidIsland('pixel', false, true), false);
});
test('Music character applies only during playback; pause restores idle selection', () => {
  const settings = { character: 'none', characterMusic: 'liquid' };
  assert.equal(selectCharacter(settings, true, true), 'liquid');
  assert.equal(selectCharacter(settings, true, false), 'none');
  assert.equal(resolveCharacter('hamster', true), 'hamster');
  assert.equal(resolveCharacter('hamster', false), 'liquid');
});
test('Catalog accepts an additional procedural character with localized metadata', () => {
  const drawing = { id: 'fixture-owl', name: 'Сова', desc: 'Смотрит на курсор', face: true };
  const catalog = createCharacterCatalog({ creatures: [drawing], things: [], renderers: {}, language: () => 'ru' });
  assert.equal(catalog.find('fixture-owl').puppet, drawing);
  assert.equal(catalog.find('fixture-owl').face, true);
  assert.equal(catalog.find('none').kind, 'none');
  assert.throws(() => createCharacterCatalog({ creatures: [{ ...drawing, id: 'none' }], things: [], renderers: {}, language: () => 'ru' }), /duplicate/i);
});
