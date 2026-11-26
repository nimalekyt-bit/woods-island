const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { loadTypeScript } = require('./load-runtime-typescript.cjs');
const { mountLiquidIsland, measureLiquidIslands, LIQUID_SPECTRUM_BOTTOM } = loadTypeScript('runtime/characters/liquid.ts');
const { readLiquidContour } = loadTypeScript('runtime/characters/liquid-contour.ts');
const { createEnvelope, updateEnvelope, smoothLiquidPath, liquidBottomAt } = loadTypeScript('runtime/characters/liquid-geometry.ts');
const oldRegion = readFileSync(path.join(__dirname, 'fixtures/liquid-baseline.js'), 'utf8');
const moods = ['idle', 'music', 'think', 'happy', 'eat', 'attn', 'sad', 'sleep'];

// DOM-independent SVG trace: preserve every attribute/path/transform/style and
// node count, with fixed clocks/randomness. Native browser clipping is tested
// separately by the Windows acceptance suite.
function fixture() {
  const state = { now: 1000, width: 150, height: 30, left: 10, top: 8,
    options: { mood: 'idle', accent: null, ears: false, round: false, rain: false, scaled: false, smoothCorners: false },
    audio: { level: 0, bands: [], bandsAt: 1000, liquidSpectrum: false }, cursor: null };
  let allocations = 0, seed = 617;
  class Node {
    constructor(tag) { this.tag = tag; this.attrs = {}; this.style = {}; this.children = []; this.parentElement = null; allocations++; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    closest(selector) { const attribute=/^\[([^\]]+)\]$/.exec(selector)?.[1];for(let node=this;node;node=node.parentElement){if(attribute&&Object.hasOwn(node.attrs,attribute))return node;}return null; }
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    replaceChildren() { this.children.forEach(child => { child.parentElement = null; }); this.children = []; }
    remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = null; }
    getBoundingClientRect() { return { left: state.left, top: state.top, width: state.width, height: state.height }; }
    querySelector(selector) { return selector.includes('liquid-clip') ? clip : selector.includes('liquid-squash') ? squash : null; }
  }
  const parent = new Node('div'), svg = parent.appendChild(new Node('svg'));
  parent.setAttribute('data-island','');
  const clip = new Node('div'), squash = new Node('div');
  const document = { createElementNS: (_namespace, tag) => new Node(tag) };
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const sorted = value => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
  const snapshot = node => ({ tag: node.tag, attrs: sorted(node.attrs), style: sorted(node.style), children: node.children.map(snapshot) });
  return { state, svg, clip, squash, document, random,
    trace: () => ({ svg: snapshot(svg), clip: sorted(clip.style), squash: sorted(squash.style) }),
    allocations: () => allocations };
}
function oldEngine(f) {
  const refs = [], effects = [];
  let refIndex = 0, draw, interval;
  const math = Object.create(Math); math.random = f.random;
  const context = { document: f.document, Math: math, z: 'http://www.w3.org/2000/svg', Float32Array,
    performance: { now: () => f.state.now }, getComputedStyle: () => ({ width: String(f.state.width), height: String(f.state.height) }),
    Lt: () => f.state.cursor,
    useIslandStore: { getState: () => ({ ...f.state.audio, settings: { liquidSpectrum: f.state.audio.liquidSpectrum } }) },
    Sn: (callback, every) => { draw = callback; interval = every; return () => {}; },
    ReactRuntime: { useRef(initial) { const at = refIndex++; return refs[at] ??= { current: at === 0 ? f.svg : initial }; },
      useEffect(callback) { effects.push(callback); } }, jsxRuntime: { jsx: () => null } };
  const exports = vm.runInNewContext(oldRegion + '\n({mr,pr,createEnvelope:rr,updateEnvelope:or})', context);
  exports.mr(f.state.options); effects[0](); const dispose = effects[1]();
  return { draw, interval, dispose, measure: exports.pr, ...exports,
    updateOptions() { refs[1].current = { ...f.state.options }; },
  };
}
function newEngine(f) {
  global.document = f.document;
  global.getComputedStyle = () => ({ width: String(f.state.width), height: String(f.state.height) });
  return mountLiquidIsland(f.svg, { options: () => f.state.options, audio: () => f.state.audio,
    cursor: () => f.state.cursor, now: () => f.state.now, random: f.random }, 'var(--color-island)');
}
function apply(a, b, patch) {
  for (const f of [a, b]) {
    if (patch.options) Object.assign(f.state.options, patch.options);
    if (patch.audio) Object.assign(f.state.audio, patch.audio);
    if ('cursor' in patch) f.state.cursor = patch.cursor;
    for (const key of ['now', 'width', 'height']) if (key in patch) f.state[key] = patch[key];
  }
}

test('Measured silence keeps the SVG calm after zero audio events stop repeating', () => {
  const f=fixture();f.state.options.mood='music';f.state.audio={level:0,bands:Array(8).fill(0),bandsAt:1000,liquidSpectrum:true};
  const engine=newEngine(f);
  for(let i=0;i<1500;i++){f.state.now+=16;engine.draw(f.state.now);}
  const paths=[];
  for(let i=0;i<120;i++){f.state.now+=16;engine.draw(f.state.now);paths.push(f.svg.children.find(node=>node.tag==='path').attrs.d);}
  assert.equal(new Set(paths).size,1,'Deduplicated silence must not restart the synthetic beat or repaint the SVG');
  f.state.audio={...f.state.audio,level:.2,bands:[.7,.2,.1,.4,.8,.1,.3,.6],bandsAt:f.state.now};
  for(let i=0;i<20;i++){f.state.now+=16;f.state.audio.bandsAt=f.state.now;engine.draw(f.state.now);}
  assert.notEqual(f.svg.children.find(node=>node.tag==='path').attrs.d,paths[0],'A real signal must resume the spectrum');
  engine.dispose();
});

test('Measured music contours track bass and treble positions and settle inside the native paint allowance', () => {
  const f=fixture();
  f.state.width=420;f.state.height=44;f.state.options={...f.state.options,mood:'music',smoothCorners:true};
  f.state.audio={level:0,bands:Array(8).fill(0),bandsAt:1000,liquidSpectrum:true};
  const engine=newEngine(f);
  const render=(bands,frames)=>{
    f.state.audio.bands=bands;
    for(let i=0;i<frames;i++){
      f.state.audio.bandsAt=f.state.now+=16;
      engine.draw(f.state.now);
    }
    return readLiquidContour(f.svg.parentElement);
  };
  const strongest=contour=>contour.points.reduce((peak,point)=>point[1]>peak[1]?point:peak);
  const bass=strongest(render([.7,.92,0,0,0,0,0,0],45));
  const treble=strongest(render([0,0,0,0,0,0,.92,.7],45));
  assert(bass[0]<-30&&treble[0]>30,'Strongest lobe follows the frequency position');
  assert(bass[1]-44>10&&treble[1]-44>10,'Music has clear visual depth');
  for(const peak of [bass,treble])assert(peak[1]-44<LIQUID_SPECTRUM_BOTTOM);
  const balanced=render([.3,.3,.3,.3,.85,.3,.3,.3],45);
  const strongestDepth=strongest(balanced)[1]-44;
  const surroundingDepth=Math.max(...balanced.points.filter(([x])=>x< -50||x>115).map(([,y])=>y-44));
  assert(strongestDepth>2*surroundingDepth,'A prominent frequency must stand out without lifting the entire rim');
  const calm=render(Array(8).fill(0),120);
  assert(Math.abs(strongest(calm)[1]-44)<0.1);
  engine.dispose();
});

test('Liquid SVG engine preserves paths, particles, spectrum and clips for all moods', () => {
  const legacy = fixture(), current = fixture(), old = oldEngine(legacy), next = newEngine(current);
  assert.deepEqual(current.trace(), legacy.trace());
  let time = 1000;
  for (const mood of moods) {
    apply(legacy, current, { options: { mood, ears: mood === 'eat', round: mood === 'sleep', rain: mood === 'idle' },
      audio: { level: 0.65, bands: [0.1, 0.4, 0.9, 0.2], liquidSpectrum: true },
      cursor: { x: 84, y: 60 } });
    old.updateOptions();
    for (let frame = 0; frame < 90; frame++) {
      time += 16;
      apply(legacy, current, { now: time, audio: { bandsAt: time, level: 0.2 + frame % 9 / 12 } });
      old.draw(time); next.draw(time);
      assert.deepEqual(current.trace(), legacy.trace(), `${mood} frame ${frame}`);
      assert.equal(current.allocations(), legacy.allocations(), `${mood} allocation parity`);
      assert.equal(next.interval(), old.interval());
    }
  }
  next.dispose(); old.dispose(); assert.deepEqual(current.trace(), legacy.trace());
});
test('Liquid resize, collapse recovery, scaled measurements and remeasure preserve SVG output', () => {
  const legacy = fixture(), current = fixture(), old = oldEngine(legacy), next = newEngine(current);
  const dimensions = [[680, 336], [680, 100], [420, 44], [150, 30], [268, 32], [340, 60], [640, 330]];
  let time = 1000;
  for (const [width, height] of dimensions) {
    time += 16; apply(legacy, current, { now: time, width, height, options: { scaled: true, mood: 'music', accent: '#ffffff' } });
    old.updateOptions(); old.measure(); measureLiquidIslands();
    assert.deepEqual(current.trace(), legacy.trace());
    for (let frame = 0; frame < 65; frame++) {
      time += 16; apply(legacy, current, { now: time }); old.draw(time); next.draw(time);
      assert.deepEqual(current.trace(), legacy.trace(), `${width}x${height} frame ${frame}`);
    }
  }
  next.dispose(); old.dispose();
});
test('Static liquid frames reuse SVG nodes and dispose unregisters native measurements', () => {
  const f = fixture(), engine = newEngine(f), initial = f.allocations();
  for (let time = 1016; time < 2000; time += 16) { f.state.now = time; engine.draw(time); }
  assert.equal(f.allocations(), initial);
  engine.updateFill('#aabbcc'); assert.equal(f.svg.children[1].children[1].style.stopColor, '#aabbcc');
  engine.dispose(); assert.equal(f.svg.children.length, 0);
  const prior = f.trace(); f.state.width = 600; measureLiquidIslands(); assert.deepEqual(f.trace(), prior);
});
test('Liquid envelope retains legacy attack, stale-audio decay and transient detection', () => {
  const f = fixture(), old = oldEngine(f), state = createEnvelope(), legacy = old.createEnvelope();
  const samples = [0, 0.01, 0.2, 0.9, 0.3, 0.4, ...Array(120).fill(0.4), 0, 0.8];
  let time = 0;
  for (const sample of samples) {
    time += 16;
    assert.equal(JSON.stringify(updateEnvelope(state, sample, time, .016)), JSON.stringify(old.updateEnvelope(legacy, sample, time, .016)));
    assert.equal(JSON.stringify(state), JSON.stringify(legacy));
  }
  old.dispose();
  assert.equal(smoothLiquidPath([[0, 1], [1, 3], [2, 5]]), '0.0,1.0 Q1.0,3.0 1.5,4.0 L2.0,5.0');
  assert.equal(liquidBottomAt(0, 150, 30), 30); assert.equal(liquidBottomAt(75, 150, 30), 15);
});
test('Current liquid outline uses true quarter-circle corners and confines the wave to their inner endpoints', () => {
  const f=fixture();f.state.options.smoothCorners=true;f.state.options.round=true;
  const engine=newEngine(f),body=f.svg.children[2];
  for(const [width,height] of [[150,30],[268,32],[680,336],[420,44]]) {
    f.state.width=width;f.state.height=height;engine.draw(f.state.now+=16);
    const radius=Math.min(height/2,height>60?32:26),half=width/2,side=height-radius;
    assert(body.attrs.d.includes(`A${radius.toFixed(2)},${radius.toFixed(2)} 0 0 1 ${(half-radius).toFixed(2)},${height.toFixed(2)} L${(half-radius).toFixed(1)},${height.toFixed(1)}`),'Right side joins its quarter circle before any wave point');
    assert(body.attrs.d.includes(`A${radius.toFixed(2)},${radius.toFixed(2)} 0 0 1 ${(-half).toFixed(2)},${side.toFixed(2)}`),'Left corner ends tangent to the vertical side');
    assert(!body.attrs.d.includes('NaN'));
  }
  f.state.width=680;f.state.height=336;f.state.options.mood='happy';let clipped=false;
  for(let frame=0;frame<240;frame++) {
    engine.draw(f.state.now+=16);
    if(f.clip.style.clipPath) {
      clipped=true;
      assert.match(f.clip.style.clipPath,/ A32\.0,32\.0 /,'Clipped content keeps the same rounded corners');
      assert(!/NaN|Infinity/.test(f.clip.style.clipPath));
    }
  }
  assert(clipped,'Celebration recovery must exercise the actual content clip');
  engine.dispose();
});

test('Rain stops creating particles during sleep and existing falling drops finish their bounded lifecycle', () => {
  const f=fixture();f.state.options.rain=true;f.state.options.smoothCorners=true;
  const engine=newEngine(f);
  for(let frame=0;frame<500&&!f.svg.children[0].children.length;frame++)engine.draw(f.state.now+=16);
  assert(f.svg.children[0].children.length>0,'Rain fixture must first create real falling drops');
  f.state.options.mood='sleep';const allocated=f.allocations();
  for(let frame=0;frame<500;frame++)engine.draw(f.state.now+=16);
  assert.equal(f.allocations(),allocated,'Sleeping island must create no new rain drops');
  assert.equal(f.svg.children[0].children.length,0,'Prior rain drops must fully disappear');
  engine.dispose();
});
