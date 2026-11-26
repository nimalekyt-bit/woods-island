// Check rendered pixels, not merely DOM presence or computed text colors.
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');

function rgbaPng(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8); assert([2, 6].includes(bytes[25])); assert.equal(bytes[28], 0);
  const channels = bytes[25] === 6 ? 4 : 3, chunks = [];
  for (let p = 8; p < bytes.length;) {
    const size = bytes.readUInt32BE(p);
    if (bytes.toString('ascii', p + 4, p + 8) === 'IDAT') chunks.push(bytes.subarray(p + 8, p + 8 + size));
    p += size + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * channels, decoded = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; assert(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x, a = x >= channels ? decoded[index - channels] : 0, b = y ? decoded[index - stride] : 0, c = y && x >= channels ? decoded[index - stride - channels] : 0;
      decoded[index] = (raw[y * (stride + 1) + 1 + x] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]) & 255;
    }
  }
  if (channels === 4) return { width, height, pixels: decoded };
  const pixels = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) { decoded.copy(pixels, p * 4, p * 3, p * 3 + 3); pixels[p * 4 + 3] = 255; }
  return { width, height, pixels };
}

// Self-contained so the same measurement runs inside Chromium and WebView2.
function readWebAiPaintRects() {
  const selectors = ['.webai-eyebrow', '.webai-service-title', '.webai-state-copy>p', '.webai-resume>span', '.webai-mode-current', '.webai-provider-mark>[data-provider-icon]'];
  const base = getComputedStyle(document.querySelector('[data-web-ai-content]')).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number);
  return { width: innerWidth, height: innerHeight, theme: document.documentElement.dataset.theme, rects: selectors.map(selector => {
    const node = document.querySelector(selector), rect = node.getBoundingClientRect(), style = getComputedStyle(node);
    const channels = style.color.match(/[\d.]+/g).map(Number), alpha = channels[3] ?? 1;
    return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height, text: node.textContent,
      color: channels.slice(0, 3).map((c, i) => c * alpha + base[i] * (1 - alpha)), image: node.tagName === 'IMG', graphic: node.hasAttribute('data-provider-icon'),
      visibility: style.visibility, opacity: style.opacity,
      ancestors: (()=>{const result=[];for(let p=node;p;p=p.parentElement)result.push({tag:p.tagName,class:p.className,ready:p.dataset.preferencesReady,visibility:getComputedStyle(p).visibility});return result;})() };
  }) };
}

function assertWebAiPaint(bytes, geometry, label) {
  const shot = rgbaPng(bytes), sx = shot.width / geometry.width, sy = shot.height / geometry.height;
  return geometry.rects.map(rect => {
    let ink = 0;
    for (let y = Math.max(0, Math.ceil(rect.y * sy)); y < Math.min(shot.height, Math.floor((rect.y + rect.height) * sy)); y++) {
      for (let x = Math.max(0, Math.ceil(rect.x * sx)); x < Math.min(shot.width, Math.floor((rect.x + rect.width) * sx)); x++) {
        const p = (y * shot.width + x) * 4, rgb = [...shot.pixels.subarray(p, p + 3)];
        const match = rect.image ? Math.max(...rgb) - Math.min(...rgb) > 40 : rgb.every((c, i) => Math.abs(c - rect.color[i]) < 35);
        if (match && shot.pixels[p + 3] > 240) ink++;
      }
    }
    const minimum = Math.ceil((rect.image || rect.graphic ? 80 : Math.max(12, rect.text.trim().length * 2)) * sx * sy);
    assert(ink >= minimum, `${label} ${rect.selector}: missing rendered ink (${ink} < ${minimum}); visibility=${rect.visibility}, opacity=${rect.opacity}`);
    return { selector: rect.selector, ink, minimum };
  });
}
module.exports = { assertWebAiPaint, readWebAiPaintRects };
