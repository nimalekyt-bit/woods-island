const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./load-runtime-typescript.cjs');
const { createIslandInteractions, hasPersistentActivity } = loadTypeScript('runtime/island/interactions.ts');
const { createMediaEventController, COVER_WAIT_MS } = loadTypeScript('runtime/media/events.ts');

function clock() {
  let now = 0;
  const tasks = new Set();
  return {
    tasks,
    schedule(callback, delay) { const task = { at: now + delay, callback }; tasks.add(task); return () => tasks.delete(task); },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...tasks].filter(t => t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        now = next.at; tasks.delete(next); next.callback();
      }
      now = end;
    },
  };
}
function interactionFixture() {
  const time = clock();
  const state = { hovered: false, expanded: false, palette: false, peek: null, dragOver: null,
    pinned: false, holdOpen: false, draggingOut: false, webAiActive: false, asking: false,
    openedBy: null, enteredSinceOpen: false, tab: 'home', dictation: null, recording: null,
    updating: null, downloads: [], mediaLive: false, settings: { openOnHover: true } };
  const calls = [];
  const controller = createIslandInteractions({ getState: () => state,
    setState: patch => Object.assign(state, patch), schedule: time.schedule,
    open(source, tab) { calls.push(['open', source, tab]); Object.assign(state, { expanded: true, openedBy: source, enteredSinceOpen: state.hovered, tab: tab ?? state.tab }); },
    close() { calls.push(['close']); state.expanded = false; },
    openPalette() { calls.push(['openPalette']); state.palette = true; state.expanded = false; },
    closePalette() { calls.push(['closePalette']); state.palette = false; },
  });
  return { state, controller, calls, ...time };
}

test('Hover defaults to 150 ms opening and 350 ms closing; entering cancels collapse', () => {
  const f = interactionFixture(); f.controller.hover(true); f.advance(149); assert.equal(f.state.expanded, false);
  f.advance(1); assert.equal(f.state.expanded, true);
  f.controller.hover(false); f.advance(349); assert.equal(f.state.expanded, true);
  f.controller.hover(true); f.advance(1000); assert.equal(f.state.expanded, true);
  f.controller.hover(false); f.advance(350); assert.equal(f.state.expanded, false);
});
test('Hover remains opt-in and rechecks peek, drop, palette and persistent media at the deadline', () => {
  for (const field of ['peek', 'dragOver', 'palette', 'recording', 'dictation']) {
    const f = interactionFixture(); f.controller.hover(true);
    f.state[field] = field === 'palette' ? true : {}; f.advance(150); assert.equal(f.state.expanded, false, field);
  }
  const f = interactionFixture(); f.state.settings.openOnHover = false;
  f.controller.hover(true); f.advance(1000); assert.equal(f.state.expanded, false);
  f.state.settings = { openOnHover: true, mediaPill: 'player' }; f.state.mediaLive = true;
  assert.equal(hasPersistentActivity(f.state), true);
  f.controller.hover(false); f.controller.hover(true); assert.equal(f.tasks.size, 0);
  f.state.downloads = [{}]; assert.equal(hasPersistentActivity(f.state), false);
});
test('Palette and hotkey toggles cancel pending hover work; tab changes open the requested panel', () => {
  const f = interactionFixture(); f.controller.hover(true); f.controller.togglePalette();
  f.advance(1000); assert.equal(f.state.palette, true); assert.equal(f.state.expanded, false); assert.equal(f.tasks.size, 0);
  f.controller.toggle({ tab: 'controls' }); assert.equal(f.state.palette, false); assert.equal(f.state.tab, 'controls');
  f.controller.toggle({ tab: 'chat' }); assert.equal(f.state.tab, 'chat'); assert.equal(f.state.expanded, true);
  f.controller.toggle({ tab: 'chat' }); assert.equal(f.state.expanded, false);
});
test('Hotkey panels stay open until entered; closing rechecks pin, hold, drag and webAI', () => {
  const fresh = interactionFixture(); fresh.controller.toggle({}); fresh.controller.hover(false);
  fresh.advance(1000); assert.equal(fresh.state.expanded, true);
  fresh.controller.hover(true); fresh.controller.hover(false); fresh.advance(350); assert.equal(fresh.state.expanded, false);
  for (const field of ['pinned', 'holdOpen', 'draggingOut', 'webAiActive', 'palette']) {
    const f = interactionFixture(); f.controller.hover(true); f.advance(150); f.controller.hover(false);
    f.state[field] = true; f.advance(350); assert.equal(f.state.expanded, true, field);
  }
});
test('WebAI release uses the collapse delay; outside click respects asks and pin; dispose cancels all work', () => {
  const f = interactionFixture(); f.state.expanded = true; f.state.openedBy = 'click';
  f.controller.webAiActive(true); f.controller.hover(false); assert.equal(f.tasks.size, 0);
  f.controller.webAiActive(false); f.advance(349); assert.equal(f.state.expanded, true); f.advance(1); assert.equal(f.state.expanded, false);
  f.state.expanded = true; f.state.asking = true; f.controller.outsideClick(); assert.equal(f.state.expanded, true);
  f.state.asking = false; f.state.pinned = true; f.controller.outsideClick(); assert.equal(f.state.expanded, true);
  f.state.pinned = false; f.controller.outsideClick(); assert.equal(f.state.expanded, false);
  f.controller.hover(true); f.controller.dispose(); assert.equal(f.tasks.size, 0);
  const before = JSON.stringify(f.state); f.controller.hover(false); f.controller.toggle({}); f.advance(1000);
  assert.equal(JSON.stringify(f.state), before);
});

function mediaFixture() {
  const time = clock();
  const state = { media: null, live: false, cover: null, accent: null, level: 1 };
  const colors = [];
  const controller = createMediaEventController({ getMedia: () => state.media,
    setMedia: value => { state.media = value; }, setCover: value => { state.cover = value; },
    setAccent: value => { state.accent = value; }, resetLevel: () => { state.level = 0; },
    isLive: () => state.live, setLive: value => { state.live = value; }, schedule: time.schedule,
    extractAccent: cover => new Promise(resolve => colors.push({ cover, resolve })),
  });
  return { state, controller, colors, ...time };
}
const track = (key, playing = true) => ({ key, playing, title: key });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('Cover arriving before metadata is applied; only the latest color request may publish', async () => {
  const f = mediaFixture(); f.controller.cover({ key: 'first', cover: 'image1' }); f.controller.update(track('first'));
  assert.equal(f.state.cover, 'image1'); assert.equal(f.tasks.size, 0);
  f.controller.update(track('second')); f.controller.cover({ key: 'second', cover: 'image2' });
  f.colors[1].resolve('#222222'); await flush(); assert.equal(f.state.accent, '#222222');
  f.colors[0].resolve('#111111'); await flush(); assert.equal(f.state.accent, '#222222');
  f.controller.cover({ key: 'second', cover: null }); assert.equal(f.state.cover, null); assert.equal(f.state.accent, null);
});
test('Missing-cover fallback runs at 4000 ms, is replaced on track change and cancelled by a cover', () => {
  const f = mediaFixture(); f.controller.update(track('first')); f.controller.cover({ key: 'first', cover: 'image' });
  f.controller.update(track('second')); f.advance(3999); assert.equal(f.state.cover, 'image');
  f.advance(1); assert.equal(f.state.cover, null); assert.equal(COVER_WAIT_MS, 4000);
  f.controller.update(track('third')); f.advance(2000); f.controller.update(track('fourth'));
  assert.equal(f.tasks.size, 1); f.controller.cover({ key: 'fourth', cover: 'latest' }); assert.equal(f.tasks.size, 0);
  f.advance(5000); assert.equal(f.state.cover, 'latest');
});
test('Metadata cannot postpone pause collapse; resume cancels it; null/dispose discard deferred work', async () => {
  const f = mediaFixture(); f.controller.update(track('same')); f.controller.cover({ key: 'same', cover: 'image' });
  f.controller.update(track('same', false));
  for (let i = 0; i < 24; i++) { f.advance(100); f.controller.update(track('same', false)); }
  f.advance(100); assert.equal(f.state.live, false);
  f.controller.update(track('same')); f.controller.update(track('same', false)); f.advance(2000);
  f.controller.update(track('same')); f.advance(1000); assert.equal(f.state.live, true);
  f.controller.update(null); assert.equal(f.state.cover, null); assert.equal(f.state.level, 0); assert.equal(f.tasks.size, 0);
  f.colors[0].resolve('#111111'); await flush(); assert.equal(f.state.accent, null);
  f.controller.update(track('last')); f.controller.cover({ key: 'last', cover: 'last' }); f.controller.update(track('last', false));
  f.controller.dispose(); assert.equal(f.tasks.size, 0); const before = JSON.stringify(f.state);
  f.colors[1].resolve('#333333'); f.controller.update(null); await flush(); f.advance(5000);
  assert.equal(JSON.stringify(f.state), before);
});
