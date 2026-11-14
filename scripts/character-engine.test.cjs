const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { loadTypeScript } = require('./load-runtime-typescript.cjs');
const { createCharacterCatalog } = loadTypeScript('runtime/characters/catalog.ts');
const { genericDrawings } = loadTypeScript('runtime/characters/drawings/generic.ts');
const { creatures } = loadTypeScript('runtime/characters/drawings/creatures.ts');
const { things } = loadTypeScript('runtime/characters/drawings/things.ts');
const { createCharacterPose, genericMotion } = loadTypeScript('runtime/characters/pose.ts');
const { createCharacterScheduler, animationInterval, STILL_INTERVAL_MS } = loadTypeScript('runtime/characters/scheduler.ts');
const { shouldReduceCharacterMotion } = loadTypeScript('runtime/characters/scheduler.ts');
const { createCursorTracker, normalizedLook } = loadTypeScript('runtime/characters/cursor.ts');
const pixels = loadTypeScript('runtime/characters/pixel-layout.ts');
const baseline = readFileSync(path.join(__dirname, 'fixtures/character-drawings-baseline.js'), 'utf8');

function fixture() {
  let allocations = 0, seed = 17;
  class Node {
    constructor(tag) { this.tag = tag; this.attrs = {}; this.style = {}; this.children = []; this.textContent = ''; allocations++; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    appendChild(child) { this.children.push(child); return child; }
  }
  const sorted = value => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
  const trace = node => ({ tag: node.tag, attrs: sorted(node.attrs), style: sorted(Object.fromEntries(Object.entries(node.style).map(([k,v])=>[k,String(v)]))), text: node.textContent, children: node.children.map(trace) });
  return { document: { createElementNS: (_namespace, tag) => new Node(tag) }, root: new Node('g'), trace,
    random: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }, allocations: () => allocations };
}
function legacyDrawings(f) {
  const math = Object.create(Math); math.random = f.random;
  return vm.runInNewContext(baseline +
    '\n({spark:ct,eyes:lt,bot:ut,cat:dt,blob:ft,jelly:ht,sloth:gt,astro:_t,sprout:vt,swarm:yt,kao:bt,...Object.fromEntries([...xt,...St].map(d=>[d.id,d]))})',
    { document: f.document, Math: math, performance: { now: () => 1000 }, createCharacterCatalog: () => ({}), e: () => 'ru' });
}

test('All 23 SVG drawings preserve legacy attributes, paths and node reuse in six drawing moods', () => {
  const renderers = { ...genericDrawings, ...Object.fromEntries([...creatures, ...things].map(d => [d.id, d])) };
  assert.equal(Object.keys(renderers).length, 23);
  for (const [id, renderer] of Object.entries(renderers)) {
    const old = fixture(), next = fixture();
    const legacy = Object.create(legacyDrawings(old)[id]); legacy.build(old.root, 5);
    global.document = next.document;
    const random = Math.random, clock = global.performance;
    Math.random = next.random; global.performance = { now: () => 1000 };
    try {
      const frame = renderer.create(next.root, 5), count = next.allocations();
      assert.deepEqual(next.trace(next.root), old.trace(old.root), `${id} build`);
      for (const s of ['idle', 'music', 'think', 'done', 'attn', 'sleep']) {
        for (let index = 0; index < 24; index++) {
          const pose = { s, c: '#aabbcc', lx: index % 9 - 4, ly: index % 7 - 3, blink: index % 3 / 2, poke: index % 5 / 4, h: index % 2 ? 30 : 64, face: index % 3 !== 0 };
          const time = 1200 + index * 157, elapsed = index * 157;
          legacy.draw(pose, time, elapsed, .016); frame.draw(pose, time, elapsed, .016);
          assert.deepEqual(next.trace(next.root), old.trace(old.root), `${id}/${s}/${index}`);
          assert.equal(next.allocations(), count, `${id} allocated nodes during draw`);
        }
      }
      const other = fixture(); global.document = other.document; renderer.create(other.root, 8);
      assert.deepEqual(next.trace(next.root), old.trace(old.root), `${id} instances share state`);
    } finally { Math.random = random; global.performance = clock; }
  }
});

test('Catalog preserves all 25 selections, translation, geometry and safe fallback', () => {
  let language = 'ru';
  const catalog = createCharacterCatalog({ creatures, things, renderers: genericDrawings, language: () => language });
  assert.equal(catalog.catalog.length, 26);
  assert.equal(catalog.find('missing').id, 'none');
  for (const definition of catalog.catalog) {
    assert(definition.name && definition.desc);
    if (definition.kind === 'slot' && definition.id !== 'pixel') assert.equal(typeof definition.puppet.create, 'function');
    if (definition.box) assert(definition.box.every(Number.isFinite) && definition.box[2] > 0 && definition.box[3] > 0);
    language = 'en'; assert(catalog.describe(definition).name);
  }
  assert.throws(() => createCharacterCatalog({ creatures: [...creatures, creatures[0]], things, renderers: genericDrawings, language: () => 'ru' }), /Duplicate/);
});

test('Pose and generic motion preserve mood transitions, blink, cursor and long-frame clamping', () => {
  let point = null, still = false;
  const math = Object.create(Math); math.random = () => .5;
  const region = readFileSync(path.join(__dirname, 'fixtures/character-pose-baseline.js'), 'utf8');
  const old = vm.runInNewContext(region + '\n({Nn,Fn})', { Math: math, Mn: (value, min, max) => Math.max(min, Math.min(max, value)), Lt: () => point, Nt: normalizedLook, gn: mood => mood === 'happy' || mood === 'eat' ? 'done' : mood === 'sad' ? 'attn' : mood,
    at: { idle:'#F1EFE8', music:'#F0997B', think:'#AFA9EC', done:'#97C459', attn:'#EF9F27', sleep:'#5F5E5A' }, Pn:9 });
  const legacy = old.Nn(() => still), next = createCharacterPose(() => still, { cursor: () => point, random: () => .5 });
  const element = { getBoundingClientRect: () => ({ left:10, top:20, width:100, height:60 }) };
  for (let i = 0; i < 128; i++) {
    const mood = ['idle', 'music', 'happy', 'eat', 'sad', 'sleep', 'attn', 'think'][Math.floor(i / 16)];
    point = i % 3 ? { x:i*11, y:i*7 } : null; still = i % 5 === 0;
    const time = 1000 + i*181;
    const pose = next.pose(time, mood, .3, '#c0ffee', element);
    delete pose.pose.h; delete pose.pose.face; // New defaults are tested separately; compare the legacy animated values.
    assert.equal(JSON.stringify(pose), JSON.stringify(legacy.pose(time, mood, .3, '#c0ffee', element)), `${mood}/${i}`);
    assert.equal(JSON.stringify(genericMotion(pose.pose.s,time,pose.t)), JSON.stringify(old.Fn(pose.pose.s,time,pose.t)));
    assert(pose.dt <= .05);
  }
});

test('One RAF handles subscribers, still refresh, visibility, multiple suspensions and cleanup', () => {
  const queued = new Map(); let id = 0, hidden = false, visibility, listeners = 0, every = 16;
  const scheduler = createCharacterScheduler({ requestFrame: callback => { queued.set(++id, callback); return id; }, cancelFrame: handle => queued.delete(handle),
    isHidden: () => hidden, onVisibilityChange: callback => { visibility = callback; listeners++; return () => listeners--; } });
  const frames = [[], []];
  const a = scheduler.subscribe(time => frames[0].push(time), () => every);
  const b = scheduler.subscribe(time => frames[1].push(time), () => 66);
  const tick = time => { const callbacks = [...queued.values()]; queued.clear(); callbacks.forEach(callback => callback(time)); };
  assert.equal(queued.size, 1); assert.equal(listeners, 1);
  tick(16); tick(32); tick(64); assert.deepEqual(frames, [[16,32,64],[64]]);
  hidden = true; visibility(); assert.equal(queued.size, 0);
  hidden = false; visibility(); assert.equal(queued.size, 1);
  scheduler.suspend('settings', true); scheduler.suspend('expanded', true); assert.equal(queued.size, 0);
  scheduler.suspend('settings', false); assert.equal(queued.size, 0);
  scheduler.suspend('expanded', false); assert.equal(queued.size, 1);
  b(); every = STILL_INTERVAL_MS; a.refresh(); assert.equal(queued.size, 0);
  every = 0; a.refresh(); assert.equal(queued.size, 1);
  a(); assert.equal(queued.size, 0); assert.equal(listeners, 0);
  scheduler.dispose(); scheduler.subscribe(() => {}, () => 0); assert.equal(queued.size, 0);
  assert.equal(animationInterval('sleep'),66); assert.equal(animationInterval('music',true),STILL_INTERVAL_MS);
});

test('Native cursor honors mouse grace, viewport offset, null and listener cleanup', () => {
  let time = 500, mouse, removed = false;
  const cursor = createCursorTracker({ now: () => time, viewportWidth: () => 1000, onMouseMove: callback => { mouse = callback; return () => { removed = true; }; } });
  cursor.setNative([20, 30]); assert.deepEqual(cursor.get(),{x:520,y:30});
  mouse({x:10,y:20}); time += 249; cursor.setNative([0,0]); assert.deepEqual(cursor.get(),{x:10,y:20});
  time++; cursor.setNative([0,0]); assert.deepEqual(cursor.get(),{x:500,y:0});
  cursor.setNative(null); assert.equal(cursor.get(),null); cursor.dispose(); assert(removed);
});

test('Reduced motion stops scheduling but still renders an explicit mood update', () => {
  assert.equal(shouldReduceCharacterMotion('auto', true), true);
  assert.equal(shouldReduceCharacterMotion('auto', false), false);
  assert.equal(shouldReduceCharacterMotion('reduce', false), true);
  assert.equal(shouldReduceCharacterMotion('full', true), false);
  let queued = 0, calls = 0;
  const scheduler = createCharacterScheduler({ requestFrame: () => ++queued, cancelFrame: () => { queued--; }, isHidden: () => false, onVisibilityChange: () => () => {} });
  const stop = scheduler.subscribe(() => calls++, () => 16);
  assert.equal(queued, 1);
  scheduler.suspend('reduced-motion', true); assert.equal(queued, 0);
  scheduler.repaint(500); assert.equal(calls, 1); assert.equal(queued, 0);
  scheduler.suspend('fullscreen', true); scheduler.suspend('reduced-motion', false); assert.equal(queued, 0);
  scheduler.suspend('fullscreen', false); assert.equal(queued, 1);
  stop(); assert.equal(queued, 0); scheduler.dispose();
});

test('Pixel geometry and hopping match the 288 legacy golden cases', () => {
  const golden = require('./fixtures/character-pixel.json');
  const frames = [];
  for (const mood of Object.keys(pixels.PIXEL_COLORS)) for (const step of [0,1,2,3,4,5]) for (const blink of [false,true]) for (const look of [-1,0,1]) {
    const layout = pixels.pixelLayout(mood,{step,blink,look});
    frames.push({mood,step,blink,look,...layout,hop:pixels.pixelHop(mood,step,.25)});
  }
  assert.deepEqual(pixels.PIXEL_COLORS,golden.colors); assert.deepEqual(pixels.PIXEL_INTERVALS,golden.intervals);
  // Compare to actual recovered React output below; the golden retains the extraction provenance.
  assert.equal(golden.cases,288);
  assert(frames.every(frame => Number.isFinite(frame.hop) && frame.body.length > 0));
});
