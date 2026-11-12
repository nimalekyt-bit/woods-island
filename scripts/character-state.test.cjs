const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { loadTypeScript } = require('./load-runtime-typescript.cjs');
const { createCharacterScheduler, animationInterval, STILL_INTERVAL_MS } = loadTypeScript('runtime/characters/scheduler.ts');
const { createCursorTracker, normalizedLook } = loadTypeScript('runtime/characters/cursor.ts');
const { createCharacterPose, drawingMood, genericMotion } = loadTypeScript('runtime/characters/pose.ts');

function schedulerFixture() {
  let hidden = false, nextHandle = 0, visibilityListener = null, removedListeners = 0;
  const frames = new Map();
  const scheduler = createCharacterScheduler({
    requestFrame: callback => { const handle = ++nextHandle; frames.set(handle, callback); return handle; },
    cancelFrame: handle => frames.delete(handle), isHidden: () => hidden,
    onVisibilityChange: callback => { visibilityListener = callback; return () => { visibilityListener = null; removedListeners++; }; },
  });
  return {
    scheduler, frames,
    get listener() { return visibilityListener; }, get removedListeners() { return removedListeners; },
    visibility(value) { hidden = value; visibilityListener?.(); },
    frame(time) { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); },
  };
}

test('One RAF shares the original 16/66/0 cadence between animated characters', () => {
  const f = schedulerFixture(), idle = [], sleep = [], music = [];
  const cancelIdle = f.scheduler.subscribe(time => idle.push(time), () => animationInterval('idle'));
  const cancelSleep = f.scheduler.subscribe(time => sleep.push(time), () => animationInterval('sleep'));
  const cancelMusic = f.scheduler.subscribe(time => music.push(time), () => animationInterval('music'));
  assert.equal(f.frames.size, 1);
  for (let time = 16; time <= 128; time += 16) { f.frame(time); assert.equal(f.frames.size, 1); }
  assert.deepEqual(idle, [16, 32, 48, 64, 80, 96, 112, 128]);
  assert.deepEqual(sleep, [64, 128]); assert.deepEqual(music, idle);
  cancelIdle(); cancelMusic(); assert.equal(f.frames.size, 1);
  cancelSleep(); assert.equal(f.frames.size, 0); assert.equal(f.listener, null); assert.equal(f.removedListeners, 1);
});

test('Hidden windows and multiple suspend reasons cancel RAF until all guards clear', () => {
  const f = schedulerFixture(); let calls = 0;
  f.visibility(true);
  const cancel = f.scheduler.subscribe(() => calls++, () => 0);
  assert.equal(f.frames.size, 0);
  f.visibility(false); assert.equal(f.frames.size, 1);
  f.scheduler.suspend('fullscreen', true); assert.equal(f.frames.size, 0);
  f.scheduler.suspend('tucked', true); f.scheduler.suspend('fullscreen', false); assert.equal(f.frames.size, 0);
  f.scheduler.suspend('tucked', false); assert.equal(f.frames.size, 1);
  f.visibility(true); assert.equal(f.frames.size, 0); f.frame(1000); assert.equal(calls, 0);
  f.visibility(false); f.frame(1016); assert.equal(calls, 1);
  cancel(); assert.equal(f.frames.size, 0);
});

test('Still characters request no RAF and explicitly wake when props change', () => {
  const f = schedulerFixture(); let still = true, calls = 0;
  const cancel = f.scheduler.subscribe(() => calls++, () => animationInterval('idle', still));
  assert.equal(STILL_INTERVAL_MS, 1e9); assert.equal(f.frames.size, 0);
  still = false; cancel.refresh(); assert.equal(f.frames.size, 1);
  f.frame(16); assert.equal(calls, 1);
  still = true; cancel.refresh(); assert.equal(f.frames.size, 0);
  f.frame(32); assert.equal(calls, 1);
  cancel(); cancel(); assert.equal(f.removedListeners, 1);
});

test('Last unsubscribe during a frame and scheduler disposal leave no loop or listener', () => {
  const f = schedulerFixture(); let cancel;
  cancel = f.scheduler.subscribe(() => cancel(), () => 0);
  f.frame(16); assert.equal(f.frames.size, 0); assert.equal(f.listener, null);
  f.scheduler.subscribe(() => {}, () => 0); assert.equal(f.frames.size, 1);
  f.scheduler.dispose(); assert.equal(f.frames.size, 0); assert.equal(f.listener, null);
  f.scheduler.refresh(); f.scheduler.subscribe(() => {}, () => 0); assert.equal(f.frames.size, 0);
});

test('Cursor tracking preserves the 250 ms native fallback and removes its mouse listener', () => {
  let now = 249, listener, removed = 0;
  const cursor = createCursorTracker({ now: () => now, viewportWidth: () => 1000,
    onMouseMove: callback => { listener = callback; return () => { listener = null; removed++; }; } });
  cursor.setNative([10, 30]); assert.equal(cursor.get(), null);
  now = 250; cursor.setNative([10, 30]); assert.deepEqual(cursor.get(), { x: 510, y: 30 });
  now = 1000; listener({ x: 75, y: 80 });
  now = 1249; cursor.setNative([10, 30]); assert.deepEqual(cursor.get(), { x: 75, y: 80 });
  now = 1250; cursor.setNative([10, 30]); assert.deepEqual(cursor.get(), { x: 510, y: 30 });
  cursor.setNative(null); assert.equal(cursor.get(), null);
  cursor.dispose(); assert.equal(removed, 1); assert.equal(listener, null);
});

test('Normalized look follows the original ±4/±3 ellipse and near-cursor proportions', () => {
  assert.deepEqual(normalizedLook(60, 37.5), [2, 1.5]);
  assert.deepEqual(normalizedLook(240, 0), [4, 0]);
  assert.deepEqual(normalizedLook(0, -150), [0, -3]);
  for (const [dx, dy] of [[120, 75], [10000, -20000], [-240, -150]]) {
    const [x, y] = normalizedLook(dx, dy);
    assert.ok(Math.abs((x / 4) ** 2 + (y / 3) ** 2 - 1) < 1e-12);
  }
});

test('Pose blink timings and mood poke retain exact boundaries with injected random', () => {
  const pose = createCharacterPose(() => false, { random: () => 0, cursor: () => null });
  const first = pose.pose(1000, 'idle', 0, null);
  assert.equal(first.dt, 0.016); assert.equal(first.pose.poke, 0); assert.equal(pose.st.blinkAt, 2200);
  assert.equal(pose.pose(2235, 'idle', 0, null).pose.blink, 0.5);
  assert.equal(pose.pose(2270, 'idle', 0, null).pose.blink, 0);
  assert.equal(pose.pose(2305, 'idle', 0, null).pose.blink, 0.5);
  assert.equal(pose.pose(2340, 'idle', 0, null).pose.blink, 1); assert.equal(pose.st.blinkAt, 2200);
  pose.pose(2341, 'idle', 0, null); assert.equal(pose.st.blinkAt, 4841);
  const changed = pose.pose(2500, 'music', 0, '#abc');
  assert.equal(changed.pose.c, '#abc'); assert.equal(changed.t, 0);
  assert.equal(pose.pose(2800, 'music', 0, null).pose.poke, 1);
  assert.equal(pose.pose(3100, 'music', 0, null).pose.poke, 0);
  assert.equal(pose.pose(4000, 'sad', 0, '#abc').pose.c, '#ff6b6b');
  assert.equal(drawingMood('happy'), 'done'); assert.equal(drawingMood('eat'), 'done'); assert.equal(drawingMood('sad'), 'attn');
});

test('Pose smooths cursor look, holds the think gaze and clamps frame time/pop', () => {
  const bounds = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
  const tracking = createCharacterPose(() => false, { random: () => 1, cursor: () => ({ x: 170, y: 50 }) });
  const frame = tracking.pose(1000, 'idle', 0, null, bounds);
  assert.equal(frame.pose.lx, 0.64); assert.equal(frame.pose.ly, 0);
  assert.equal(frame.pose.h, 30); assert.equal(frame.pose.face, true);
  const thinking = createCharacterPose(() => false, { random: () => 1, cursor: () => ({ x: 170, y: 50 }) }).pose(1000, 'think', 1, null, bounds);
  assert.equal(thinking.pose.lx, 0); assert.equal(thinking.pose.ly, -0.32);
  const still = createCharacterPose(() => true, { random: () => 1, cursor: () => ({ x: 170, y: 50 }) }).pose(1000, 'idle', 0.5, null, bounds);
  assert.equal(still.pose.lx, 0.24);
  assert.equal(tracking.pose(10000, 'music', 0, null).dt, 0.05);
  tracking.st.sy = 10;
  assert.equal(tracking.pose(10016, 'music', 0, null).pop[1], 1.3);
});

test('Generic motion preserves music beat, decaying celebration, attention and sleep', () => {
  assert.deepEqual(genericMotion('music', 0, 0), { y: -0, sx: 1.08, sy: 0.9, rot: 0 });
  assert.deepEqual(genericMotion('done', 0, 0), { y: -0, sx: 1.15, sy: 0.8, rot: 0 });
  assert.deepEqual(genericMotion('sleep', 0, 0), { y: 3, sx: 1, sy: 1, rot: 0 });
  assert.equal(genericMotion('attn', 400, 350).rot, 0);
  assert.equal(genericMotion('music', 545, 545).sx, 1.08);
  const settled = genericMotion('done', 10000, 10000);
  assert.ok(Math.abs(settled.y) < 0.00001);
  assert.ok(Math.abs(settled.sx - 1) < 0.00001);
});

test('4096 deterministic pose frames match the legacy engine before TASK-1421', () => {
  // Captured from 98838df:island-store.js Nn, with the same frame/input stream.
  const moods = ['idle', 'music', 'think', 'happy', 'eat', 'attn', 'sad', 'sleep'];
  const bounds = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 80, height: 40 }) };
  let point = null, still = false, seed = 42;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const rows = [];
  for (let scenario = 0; scenario < 16; scenario++) {
    const pose = createCharacterPose(() => still, { random, cursor: () => point });
    for (let frame = 0; frame < 256; frame++) {
      const time = 1000 + frame * (scenario % 2 ? 66 : 16) + (frame > 128 ? 5000 : 0);
      const mood = moods[(Math.floor(frame / 32) + scenario) % moods.length];
      point = scenario % 3 ? { x: frame % 5 * 75, y: frame % 3 * 50 } : null;
      still = scenario % 4 === 0;
      const next = pose.pose(time, mood, (frame % 7 - 3) / 3, frame % 3 ? '#123abc' : null, bounds);
      // h/face are new explicit defaults, while all animated values retain parity.
      delete next.pose.h; delete next.pose.face;
      rows.push(next);
    }
  }
  assert.equal(createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    'd623b0ca4be43077dac9bf5bcf709c29b79bf85d335bf7c490ac55da6dce661b');
});
