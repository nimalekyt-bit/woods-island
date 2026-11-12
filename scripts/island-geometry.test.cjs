const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTypeScript } = require('./load-runtime-typescript.cjs');
const sizing = loadTypeScript('runtime/island/sizing.ts');
const geometry = loadTypeScript('runtime/island/geometry.ts');
const transitions = loadTypeScript('runtime/island/transitions.ts');

function fixture(extra = {}) {
  return {
    palette: false, expanded: false, dictating: false, peek: false, recording: false,
    updating: false, downloads: false, mediaLive: false, shelfCount: 0, status: false,
    paletteMeasure: { rows: 0, answer: false }, peekContent: null, tall: false, externalChat: false,
    viewportHeight: 900, homeSize: null, widgets: {}, mediaPill: 'normal', dragOver: false,
    dropZoneCount: 2, devicePixelRatio: 1, ...extra,
  };
}

test('Widget/music geometry matches measurements captured before the migration', () => {
  // Golden values from main 9a3d929: all five views, with faces, slots and status widgets.
  const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/island-sizing.json'), 'utf8'));
  for (const { options, expected } of golden) {
    for (const [name, result] of Object.entries(expected)) assert.deepEqual(sizing[name](options), result, `${name}: ${JSON.stringify(options)}`);
  }
});

test('Character slots preserve aspect ratio with the old minimum and width cap', () => {
  assert.equal(sizing.characterSlotWidth(null), 60);
  assert.equal(sizing.characterSlotWidth([0, 0, 80, 40]), 68);
  assert.equal(sizing.characterSlotWidth([0, 0, 80, 40], 44), 88);
  assert.equal(sizing.characterSlotWidth([0, 0, 200, 20]), 150);
  assert.equal(sizing.characterSlotWidth([0, 0, 200, 20], 44), 194);
  assert.equal(sizing.characterSlotWidth([0, 0, 0, 0], 44), 78);
});

test('Palette, expansion, dictation and alerts retain priority over playback', () => {
  const state = fixture({ palette: true, expanded: true, dictating: true, peek: true, recording: true,
    updating: true, downloads: true, mediaLive: true, shelfCount: 2, status: true });
  const priority = [['palette', 'palette'], ['expanded', 'expanded'], ['dictating', 'liveDictation'],
    ['peek', 'peek'], ['recording', 'liveRecording'], ['updating', 'liveUpdating'],
    ['downloads', 'liveDownloads'], ['mediaLive', 'liveMedia'], ['shelfCount', 'liveShelf'], ['status', 'liveStatus']];
  for (const [flag, mode] of priority) {
    assert.equal(geometry.selectIslandMode(state), mode);
    state[flag] = flag === 'shelfCount' ? 0 : false;
  }
  assert.equal(geometry.selectIslandMode(state), 'idle');
});

test('DPI snapping uses even physical widths and preserves logical heights', () => {
  for (const scale of [1, 1.25, 1.5, 1.75, 2]) {
    const result = geometry.calculateIslandGeometry(fixture({ mediaLive: true, mediaPill: 'title', widgets: { clock: true, timer: 6 }, devicePixelRatio: scale }));
    assert.equal(result.w * scale % 2, 0);
    assert.equal(result.h, 44);
    assert.ok(Math.abs(result.w - sizing.titleMediaSize({ clock: true, timer: 6 })[0]) <= 1 / scale + 1e-9);
  }
  for (const invalid of [0, -1, Infinity, NaN]) assert.equal(sizing.snapWidth(421, invalid), 422);
});

test('Drag overlays retain open dimensions and replace folded dimensions', () => {
  assert.deepEqual(geometry.calculateIslandGeometry(fixture({ dragOver: true })), { mode: 'drop', w: 460, h: 128, wrap: false });
  assert.deepEqual(geometry.calculateIslandGeometry(fixture({ dragOver: true, dropZoneCount: 3 })), { mode: 'drop', w: 620, h: 128, wrap: false });
  assert.deepEqual(geometry.calculateIslandGeometry(fixture({ expanded: true, homeSize: [680, 400], dragOver: true })), { mode: 'drop', w: 680, h: 400, wrap: false });
  assert.deepEqual(geometry.calculateIslandGeometry(fixture({ palette: true, paletteMeasure: { rows: 0, answer: false }, dragOver: true })), { mode: 'drop', w: 640, h: 128, wrap: false });
});

test('Palette rows, external chat viewport and home sizes retain boundaries', () => {
  assert.equal(geometry.paletteHeight(-3, false), 56);
  assert.equal(geometry.paletteHeight(2, false), 148);
  assert.equal(geometry.paletteHeight(20, true), 330);
  assert.equal(geometry.chatHeight(300), 420);
  assert.equal(geometry.chatHeight(600), 540);
  assert.equal(geometry.chatHeight(1500), 780);
  assert.deepEqual(geometry.calculateIslandGeometry(fixture({ expanded: true, homeSize: [600, 342] })), { mode: 'expanded', w: 600, h: 342, wrap: false });
  assert.deepEqual(geometry.calculateIslandGeometry(fixture({ expanded: true, tall: true, externalChat: true, viewportHeight: 600, homeSize: [600, 342] })), { mode: 'expanded', w: 680, h: 540, wrap: false });
});

test('Lyrics wrapping is derived from reserved song width and capped at 680 px', () => {
  const short = geometry.calculateIslandGeometry(fixture({ mediaLive: true, mediaPill: 'lyrics', widgets: { words: 176 } }));
  const long = geometry.calculateIslandGeometry(fixture({ mediaLive: true, mediaPill: 'lyrics', widgets: { words: 1000 } }));
  assert.equal(short.wrap, false); assert.equal(short.h, 44);
  assert.equal(long.wrap, true); assert.equal(long.w, 680); assert.equal(long.h, 44);
  assert.equal(geometry.calculateIslandGeometry(fixture({ mediaLive: true, mediaPill: 'title', widgets: { words: 1000 } })).wrap, false);
  assert.equal(geometry.calculateIslandGeometry(fixture({ mediaPill: 'lyrics', widgets: { words: 1000 } })).wrap, false);
});

test('Alert size handles multiline, Unicode labels and question steps', () => {
  assert.deepEqual(geometry.peekSize({ kind: 'notification' }), [440, 54]);
  assert.deepEqual(geometry.peekSize({ kind: 'notification', noteBody: 'hello' }), [440, 64]);
  assert.deepEqual(geometry.peekSize({ kind: 'notification', noteBody: 'hello\nworld' }), [440, 80]);
  assert.deepEqual(geometry.peekSize({ kind: 'notification', noteBody: 'a'.repeat(49) }), [440, 80]);
  assert.deepEqual(geometry.peekSize({ kind: 'done', label: '🌲'.repeat(25) }), [308, 52]);
  assert.deepEqual(geometry.peekSize({ kind: 'done', label: 'x'.repeat(100) }), [460, 52]);
  const ask = { questions: [{ question: 'Short?', options: [1, 2], multiSelect: false },
    { question: 'x'.repeat(57), options: [1, 2, 3], multiSelect: true }] };
  assert.equal(geometry.agentQuestionHeight(ask), 171);
  assert.equal(geometry.agentQuestionHeight(ask, 1), 268);
  assert.equal(geometry.agentQuestionHeight(ask, 100), 268);
  assert.deepEqual(geometry.peekSize({ kind: 'agentAsk', question: true, questionHeight: 268 }), [500, 268]);
});

test('Spring history changes only with size; lyrics always uses its fixed transition', () => {
  const initial = { w: 150, h: 30, fold: transitions.LIQUID_FOLDED };
  assert.equal(transitions.updateSizeHistory(initial, 150, 30), initial);
  const changed = transitions.updateSizeHistory(initial, 680, 336);
  assert.deepEqual(changed.fold.width, transitions.amplitudeSpring(530, 16));
  assert.deepEqual(changed.fold.height, transitions.amplitudeSpring(306, 7));
  assert.equal(transitions.selectSizeTransition('idle', false, true, changed.fold), changed.fold);
  assert.equal(transitions.selectSizeTransition('expanded', false, true, changed.fold), transitions.LIQUID_OPEN);
  assert.equal(transitions.selectSizeTransition('expanded', false, false, changed.fold), transitions.PLAIN_OPEN);
  assert.equal(transitions.selectSizeTransition('idle', false, false, changed.fold), transitions.PLAIN_FOLDED);
  assert.equal(transitions.selectSizeTransition('liveMedia', true, false, changed.fold), transitions.LYRICS_SIZE);
  assert.equal(transitions.selectSizeTransition('liveMedia', true, true, changed.fold), transitions.LYRICS_SIZE);
  assert.equal(transitions.selectSizeTransition('expanded', true, false, changed.fold), transitions.PLAIN_OPEN);
  assert.ok(transitions.amplitudeSpring(1000, 7).damping > transitions.amplitudeSpring(10, 7).damping);
});
