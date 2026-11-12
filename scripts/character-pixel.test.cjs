const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { loadTypeScript } = require('./load-runtime-typescript.cjs');
const golden = require('./fixtures/character-pixel.json');
const { pixelLayout, pixelPath, pixelHop, PIXEL_COLORS, PIXEL_INTERVALS, PIXEL_EXTRA_COLORS } = loadTypeScript('runtime/characters/pixel-layout.ts');

test('All pixel moods/steps/blinks/look directions preserve 288 legacy SVG frames', () => {
  const frames = [];
  for (const mood of Object.keys(golden.colors)) for (let step = 0; step < 6; step++) for (const blink of [false, true]) for (const look of [-1, 0, 1]) {
    const layout = pixelLayout(mood, { step, blink, look });
    frames.push({ mood, step, blink, look, body: pixelPath(layout.body), extra: pixelPath(layout.extra), hop: pixelHop(mood, step, .31) });
  }
  assert.equal(frames.length, golden.cases);
  assert.equal(createHash('sha256').update(JSON.stringify(frames)).digest('hex'), golden.sha256);
  assert.deepEqual(PIXEL_COLORS, golden.colors); assert.deepEqual(PIXEL_INTERVALS, golden.intervals); assert.deepEqual(PIXEL_EXTRA_COLORS, golden.extraColors);
});
test('Pixel audio hop clamps the measured level; sleep marks and still paths are stable', () => {
  assert.equal(pixelHop('music', 0, 0), 0); assert.equal(pixelHop('music', 0, 100), 2);
  assert.equal(pixelHop('idle', 0, 1), 0);
  const sleeping = pixelLayout('sleep', { step: 0, blink: false, look: 0 });
  assert(sleeping.extra.every(pixel => pixel[2] === .5));
  assert.equal(pixelPath(sleeping.extra), pixelPath(pixelLayout('sleep', { step: 0, blink: true, look: 1 }).extra));
});
