const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./load-runtime-typescript.cjs');
const { attachedCharacterLayout, attachedVisualInsets } = loadTypeScript('runtime/characters/attached-layout.ts');
const { tailDrawing } = loadTypeScript('runtime/characters/drawings/creatures.ts');

function tailFixture() {
  class SvgNode {
    constructor(tag) { this.tag = tag; this.attributes = {}; this.style = {}; this.children = []; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    appendChild(child) { this.children.push(child); return child; }
  }
  global.document = { createElementNS: (_ns, tag) => new SvgNode(tag) };
  const root = new SvgNode('g');
  const frame = tailDrawing.create(root, 0);
  return { frame, path: root.children[0], tip: root.children[1] };
}

// The convex hull covers the complete cubic/quadratic path, not only its ends.
function tailPaintBounds(fixture) {
  const coordinates = fixture.path.attributes.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const halfStroke = Number(fixture.path.attributes['stroke-width']) / 2;
  const xs = coordinates.filter((_value, index) => index % 2 === 0);
  const ys = coordinates.filter((_value, index) => index % 2 === 1);
  const x = Number(fixture.tip.attributes.cx), y = Number(fixture.tip.attributes.cy), r = Number(fixture.tip.attributes.r);
  return { left: Math.min(...xs.map(value => value - halfStroke), x - r),
    right: Math.max(...xs.map(value => value + halfStroke), x + r),
    top: Math.min(...ys.map(value => value - halfStroke), y - r),
    bottom: Math.max(...ys.map(value => value + halfStroke), y + r) };
}

test('Attached SVG expansion preserves 1:1 artwork, anchor and pill size at 100/200%', () => {
  for (const zoom of [1, 2]) for (const [width, height] of [[150, 30], [268, 32], [680, 336], [680, 780]]) {
    for (const id of ['tail', 'legs']) {
      const layout = attachedCharacterLayout(id, width, height);
      assert.equal(layout.width / layout.viewBox[2], 1);
      assert.equal(layout.height / layout.viewBox[3], 1);
      assert.equal(layout.viewBox[0], -width / 2);
      assert.deepEqual(layout.translate, [id === 'tail' ? width / 2 - 60 : 0, height - 30]);
      // Real CSS zoom/DPI multiplies the preserved coordinates and reserved area equally.
      assert.equal(layout.width * zoom, (width + attachedVisualInsets(id).right) * zoom);
      assert.equal(layout.height * zoom, (height + attachedVisualInsets(id).bottom) * zoom);
    }
  }
  assert.deepEqual(attachedVisualInsets('none'), { right: 0, bottom: 0 });
});

test('Tail paint including stroked curves and tip fits the expanded SVG in every mood/size/scale', () => {
  const fixture = tailFixture();
  for (const mood of ['idle', 'music', 'think', 'done', 'attn', 'sleep']) {
    for (let index = 0; index < 360; index++) {
      fixture.frame.draw({ s: mood, c: '#fedcba', lx: 0, ly: 0, blink: 1, poke: index % 11 / 10, h: 30, face: true },
        1000 + index * 37, index * 37, .037);
      const paint = tailPaintBounds(fixture);
      for (const zoom of [1, 2]) for (const [width, height] of [[150, 30], [268, 32], [680, 336], [680, 780]]) {
        const layout = attachedCharacterLayout('tail', width, height);
        const [tx, ty] = layout.translate;
        const actual = { left: (paint.left + tx + width / 2) * zoom, top: (paint.top + ty) * zoom,
          right: (paint.right + tx + width / 2) * zoom, bottom: (paint.bottom + ty) * zoom };
        assert(actual.left >= 0 && actual.top >= 0, `${mood}: artwork starts outside SVG`);
        assert(actual.right <= layout.width * zoom && actual.bottom <= layout.height * zoom,
          `${mood}: ${JSON.stringify({ actual, layout, zoom })}`);
      }
    }
  }
});

test('Legacy native 28px right/30px bottom padding clips a real tail frame', () => {
  const fixture = tailFixture();
  fixture.frame.draw({ s: 'done', c: '#fedcba', lx: 0, ly: 0, blink: 1, poke: 1, h: 30, face: true },
    Math.PI / 2 * 70, 0, .016);
  const paint = tailPaintBounds(fixture);
  assert(paint.right - 60 > 28, 'Fixture must reproduce clipped right side');
  assert(paint.bottom - 30 > 30, 'Fixture must reproduce clipped bottom');
  assert(paint.right - 60 < attachedVisualInsets('tail').right);
  assert(paint.bottom - 30 < attachedVisualInsets('tail').bottom);
});
