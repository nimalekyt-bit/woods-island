const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTypeScript } = require('./load-runtime-typescript.cjs');
const { spriteState, timedSpriteFrame, spritePosition, lookCell, codexLookCell,
  validateSprite, createBitmapTimeline, CODEX_IDS } = loadTypeScript('runtime/characters/bitmap.ts');
const metadata = require('../runtime/characters/approved-bitmap.json');
const codexTiming = require('../runtime/characters/codex-timing.json');
const { approvedDefinitions } = loadTypeScript('runtime/characters/approved.ts');
const { createCharacterCatalog } = loadTypeScript('runtime/characters/catalog.ts');

test('Approved bitmap sheets contain every mapped mood, anchored gaze and eight animation rows', () => {
  const moods = ['idle', 'music', 'think', 'happy', 'eat', 'attn', 'sad', 'sleep'];
  assert.equal(metadata.length, 11);
  assert.ok(metadata.some(pet => pet.id === 'iskorka-cat'));
  assert.ok(!metadata.some(pet => pet.id === 'stardust-beetle'));
  for (const pet of metadata) {
    const spec = validateSprite(pet.bitmap);
    assert.equal(Object.keys(spec.animations).length, 8, pet.id);
    for (const mood of moods) {
      const state = spriteState(mood, 'woods');
      assert.ok(spec.animations[state], pet.id + ':' + mood);
      const timeline = createBitmapTimeline(spec, () => 0);
      const first = timeline.frame(0, mood);
      assert.equal(first.state, state);
      const seen = new Set();
      for (let time = 0; time < 2200; time += 25) {
        const result = timeline.frame(time, mood);
        seen.add(result.frame.columnIndex);
        assert.equal(result.frame.rowIndex, spec.animations[result.renderState].frames[0].rowIndex);
        if (result.frame.lookGroup) {
          assert.ok(spec.look.groups[result.frame.lookGroup]);
          assert.ok(result.frame.lookOffset);
        }
        if (['sleep', 'poke'].includes(state)) assert.equal(result.frame.lookGroup, null);
      }
      assert.ok(seen.size > 1, pet.id + ':' + mood + ' must animate');
    }
    const dir = path.resolve(__dirname, '../runtime/characters/assets', pet.id);
    for (const suffix of ['atlas', 'body-atlas', 'look-atlas']) {
      const bytes = fs.readFileSync(path.join(dir, `${pet.id}-${suffix}.png`));
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      const format = suffix === 'look-atlas' ? spec.look : spec;
      assert.equal(bytes.readUInt32BE(16), format.frameWidth * format.columns);
      assert.equal(bytes.readUInt32BE(20), format.frameHeight * format.rows);
    }
  }
});

test('Idle automatically plays the full blink once and returns to its original timeline', () => {
  for (const { id, bitmap: spec } of metadata) {
    const timeline = createBitmapTimeline(spec, () => 0), blinkFrames = new Set();
    let ended = false, began = false, repeated = false;
    for (let time = 0; time <= 5000; time += 10) {
      const result = timeline.frame(time, 'idle');
      if (result.renderState === 'blink') {
        if (ended) repeated = true;
        began = true; blinkFrames.add(result.frame.columnIndex);
        assert.equal(result.frame.lookGroup, null, id + ' full blink must hide gaze overlay');
      } else if (began) ended = true;
    }
    assert.equal(blinkFrames.size, spec.animations.blink.frames.length, id);
    assert.ok(ended && repeated, id + ' recurring autonomous blink');
  }
});

test('A mood change cancels blinking; sleeping and still previews never run an idle blink', () => {
  const spec = metadata[0].bitmap;
  const timeline = createBitmapTimeline(spec, () => 0);
  for (let time = 0; time <= 1220; time += 20) timeline.frame(time, 'idle');
  assert.equal(timeline.frame(1240, 'idle').renderState, 'blink');
  assert.equal(timeline.frame(1260, 'sleep').renderState, 'sleep');
  assert.equal(timeline.frame(1280, 'music').renderState, 'music');
  assert.equal(timeline.frame(1300, 'idle').renderState, 'idle');
  const frozen = createBitmapTimeline(spec, () => 0);
  let first;
  for (let time = 0; time < 10000; time += 50) {
    const result = frozen.frame(time, 'idle', true);
    first ??= result.frame;
    assert.deepEqual(result.frame, first); assert.equal(result.renderState, 'idle');
  }
  const asleep = createBitmapTimeline(spec, () => 0);
  for (let time = 0; time < 10000; time += 50) assert.equal(asleep.frame(time, 'sleep').renderState, 'sleep');
  assert.equal(asleep.frame(10000, 'idle').renderState, 'idle');
});

test('Sheet sampling respects unequal durations, non-loop endings and gaze directions', () => {
  const frames = [{rowIndex:0,columnIndex:0,durationMs:20},{rowIndex:0,columnIndex:1,durationMs:80}];
  assert.equal(timedSpriteFrame({frames,loop:true},19).columnIndex, 0);
  assert.equal(timedSpriteFrame({frames,loop:true},20).columnIndex, 1);
  assert.equal(timedSpriteFrame({frames,loop:true},100).columnIndex, 0);
  assert.equal(timedSpriteFrame({frames,loop:false},1000).columnIndex, 1);
  assert.deepEqual(lookCell(-1,-1,6), {columnIndex:0,rowIndex:6});
  assert.deepEqual(lookCell(0,0,6), {columnIndex:1,rowIndex:7});
  assert.deepEqual(lookCell(1,1,6), {columnIndex:2,rowIndex:8});
  const compass = new Set();
  for (let direction = 0; direction < 16; direction++) {
    const angle = direction * Math.PI / 8;
    const cell = codexLookCell(Math.sin(angle), -Math.cos(angle));
    assert.ok(cell.rowIndex >= 9 && cell.rowIndex < 11); compass.add(`${cell.rowIndex}:${cell.columnIndex}`);
    assert.match(spritePosition(cell, {columns:8,rows:11}), /% /);
  }
  assert.equal(compass.size,16);
  for (const mood of ['idle','music','think','happy','eat','attn','sad','sleep']) assert.ok(codexTiming[spriteState(mood,'codex')]);
  assert.equal(spriteState('sleep','codex'),'waiting');
  for (const invalid of [{...metadata[0].bitmap,rows:0}, {...metadata[0].bitmap,animations:{idle:{frames:[{rowIndex:999,columnIndex:0,durationMs:1}],loop:true}}}]) {
    assert.throws(() => validateSprite(invalid));
  }
});

test('All eleven Woods additions and nine optional Codex metadata entries have English descriptions', () => {
  assert.equal(approvedDefinitions.length,20); assert.equal(CODEX_IDS.length,9);
  const catalog = createCharacterCatalog({creatures:[],things:[],renderers:{},language:()=> 'en',additions:approvedDefinitions});
  for (const pet of approvedDefinitions) {
    const label = catalog.describe(pet);
    assert.ok(label.name && label.desc); assert.doesNotMatch(label.name + label.desc, /[А-Яа-яЁё]/, pet.id);
  }
  for (const pet of approvedDefinitions.filter(pet => pet.group === 'codex')) {
    assert.equal(pet.bitmap.source,'codex');
    assert.ok(CODEX_IDS.includes(pet.bitmap.file));
    assert.match(catalog.describe(pet).desc,/imported locally/);
  }
  const files = fs.readdirSync(path.resolve(__dirname,'../runtime/characters/assets'),{recursive:true});
  assert.ok(files.every(file => !/codex|\.webp$/i.test(file)), 'Codex artwork must remain outside production assets');
});
