import type { CharacterMood } from './types';
import { advanceLiquidWave, createEnvelope, gaussian, liquidBottomAt, LIQUID_POINTS,
  smoothLiquidPath, updateEnvelope, type LiquidPoint } from './liquid-geometry';

export interface LiquidOptions {
  mood: CharacterMood; accent?: string | null; ears: boolean; round: boolean; rain: boolean; scaled: boolean;
}
export interface LiquidAudio {
  level: number; bands: readonly number[]; bandsAt: number; liquidSpectrum: boolean;
}
export interface LiquidPorts {
  options: () => LiquidOptions;
  audio: () => LiquidAudio;
  cursor: () => { x: number; y: number } | null;
  now?: () => number;
  random?: () => number;
}
interface Drop {
  x: number; y: number; vy: number; r: number; g: SVGGElement;
  age: number; mode: 'fall' | 'orbit' | 'home';
}
const measuredIslands = new Set<() => void>();
export function measureLiquidIslands() { measuredIslands.forEach(measure => measure()); }
const rimColors: Record<CharacterMood, string> = {
  idle: 'var(--liquid-rim, rgb(255 255 255 / 0.22))', music: '#F0997B', think: '#AFA9EC',
  happy: '#97C459', attn: '#EF9F27', sad: '#ff6b6b', eat: '#85B7EB', sleep: '#5F5E5A',
};
const namespace = 'http://www.w3.org/2000/svg';
function element<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string>, parent: SVGElement): SVGElementTagNameMap[K] {
  const node = document.createElementNS(namespace, tag);
  for (const name in attributes) node.setAttribute(name, attributes[name]);
  parent.appendChild(node);
  return node;
}

/** Each mounted island owns its arrays and SVG nodes; frame updates mutate them. */
export function mountLiquidIsland(svg: SVGSVGElement, ports: LiquidPorts, initialFill: string) {
  const parent = svg.parentElement;
  if (!parent) throw new Error('Liquid island needs a parent');
  const now = ports.now ?? (() => performance.now()), random = ports.random ?? Math.random;
  const dropLayer = element('g', {}, svg);
  const gradientId = `liquid-${random().toString(36).slice(2)}`;
  const gradient = element('linearGradient', { id: gradientId, gradientUnits: 'userSpaceOnUse', x1: '0', x2: '0', y1: '0', y2: '30' }, svg);
  const stop = (offset: string, color: string) => {
    const node = element('stop', { offset }, gradient);
    node.style.stopColor = color;
    node.style.transition = 'stop-color 0.45s ease';
    return node;
  };
  stop('0.35', 'var(--color-island)');
  const tintStop = stop('1', initialFill);
  const body = element('path', {}, svg);
  body.style.fill = `url(#${gradientId})`; body.style.stroke = 'var(--island-edge, transparent)';
  const rim = element('path', { fill: 'none', 'stroke-width': '1.8', 'stroke-linecap': 'round' }, svg);
  const displacement = new Float32Array(LIQUID_POINTS), velocity = new Float32Array(LIQUID_POINTS), target = new Float32Array(LIQUID_POINTS);
  let width = 150, height = 30, previousHeight = 30, previousWidth = 150, previousHeightVelocity = 0;
  let resizeUntil = 0, mood = ports.options().mood, moodSince = now(), lastFrame = 0;
  let happyDrop = false, eaten = false, lastIdleImpulse = 0, lastRainDrop = 0;
  let shrinking = false, collapsedAt = -1e9, thinkingDrop: Drop | null = null;
  let drops: Drop[] = [];
  const envelope = createEnvelope();
  const spikeStrengths = new Float32Array(Math.ceil(LIQUID_POINTS / 7)).fill(1);
  const bandLevels = new Float32Array(spikeStrengths.length);
  let spectrumBlend = 0;
  const radius = () => Math.min(height / 2, height > 60 ? 32 : 26);
  const bottomAt = (x: number) => liquidBottomAt(x, width, height);
  const xAt = (index: number) => -width / 2 + index / 89 * width;
  const taperAt = (index: number) => Math.sin(Math.PI * index / 89) ** 0.7;
  const impulse = (x: number, strength: number, spread: number) => {
    for (let index = 0; index < LIQUID_POINTS; index++) velocity[index] += strength * gaussian((xAt(index) - x) / spread) * taperAt(index);
  };
  const createDrop = (x: number, y: number, vy: number, r: number): Drop => {
    const group = element('g', {}, dropLayer);
    const circle = element('circle', { r: String(r) }, group);
    circle.style.fill = 'var(--color-island)'; circle.style.stroke = 'var(--island-edge, transparent)';
    element('circle', { r: String(Math.max(1, r * 0.28)), cx: String(-r * 0.35), cy: String(-r * 0.35), fill: '#FFFFFF', opacity: '0.4' }, group);
    const drop: Drop = { x, y, vy, r, g: group, age: 0, mode: 'fall' };
    drops.push(drop); return drop;
  };
  const measure = () => {
    const rect = parent.getBoundingClientRect();
    if (ports.options().scaled) {
      const style = getComputedStyle(parent); width = parseFloat(style.width); height = parseFloat(style.height);
    } else { width = rect.width; height = rect.height; }
    svg.setAttribute('width', width.toFixed(2)); svg.setAttribute('height', (height + 120).toFixed(1));
    svg.setAttribute('viewBox', `${(-width / 2).toFixed(2)} 0 ${width.toFixed(2)} ${(height + 120).toFixed(1)}`);
    return rect;
  };
  const clip = parent.querySelector<HTMLElement>(':scope > [data-liquid-clip]');
  const squash = clip?.querySelector<HTMLElement>(':scope > [data-liquid-squash]') ?? null;
  let clipApplied = false, squashApplied = false, gradientHeight = 30;
  const applyContentShape = (points: LiquidPoint[], halfWidth: number, sideHeight: number) => {
    if (!clip) return;
    let upward = 0, center = 0, count = 0;
    for (let index = 0; index < LIQUID_POINTS; index++) {
      upward = Math.max(upward, -displacement[index]);
      if (index > LIQUID_POINTS * 0.15 && index < LIQUID_POINTS * 0.85) { center += displacement[index]; count++; }
    }
    center /= count;
    if (upward > 5) {
      const path = smoothLiquidPath(points.map(([x, y]): LiquidPoint => [x + halfWidth, y]).reverse());
      clip.style.clipPath = `path("M0,0 H${(2 * halfWidth).toFixed(1)} L${(2 * halfWidth).toFixed(1)},${sideHeight.toFixed(1)} L${path} L0,${sideHeight.toFixed(1)} Z")`;
      clipApplied = true;
    } else if (clipApplied) { clip.style.clipPath = ''; clipApplied = false; }
    if (!squash) return;
    const narrow = Math.max(0, Math.min(1, (90 - height) / 42));
    const depression = center < -3 ? center * Math.min(1, (-center - 3) / 4) : 0;
    const scale = depression < 0 && narrow > 0 ? 1 + depression / Math.max(height, 1) * narrow : 1;
    if (scale < 1) { squash.style.transform = `scaleY(${scale.toFixed(3)})`; squashApplied = true; }
    else if (squashApplied) { squash.style.transform = ''; squashApplied = false; }
  };
  const renderShape = () => {
    const points: LiquidPoint[] = [];
    for (let index = 0; index < LIQUID_POINTS; index++) { const x = xAt(index); points.push([x, bottomAt(x) + displacement[index]]); }
    const curveRadius = radius(), halfWidth = width / 2, sideHeight = Math.max(0, height - curveRadius);
    const options = ports.options();
    const ears = options.ears ? Math.min(14, sideHeight) : 0;
    const round = options.round && ears === 0 ? curveRadius : 0, top = options.ears ? -2 : 0;
    const format = (value: number) => value.toFixed(2);
    body.setAttribute('d', `M${format(-halfWidth - ears + round)},${top} H${format(halfWidth + ears - round)}`
      + (top < 0 ? ' V0' : '')
      + (ears > 0 ? ` A${format(ears)},${format(ears)} 0 0 0 ${format(halfWidth)},${format(ears)}` : '')
      + (round > 0 ? ` A${format(round)},${format(round)} 0 0 1 ${format(halfWidth)},${format(round)}` : '')
      + ` L${format(halfWidth)},${format(sideHeight)} L${smoothLiquidPath(points.slice().reverse())}`
      + ` L${format(-halfWidth)},${format(sideHeight)}`
      + (ears > 0 ? ` L${format(-halfWidth)},${format(ears)} A${format(ears)},${format(ears)} 0 0 0 ${format(-halfWidth - ears)},0` : '')
      + (round > 0 ? ` L${format(-halfWidth)},${format(round)} A${format(round)},${format(round)} 0 0 1 ${format(-halfWidth + round)},0` : '') + ' Z');
    rim.setAttribute('d', 'M' + smoothLiquidPath(points.slice(4, 86).map(([x, y]): LiquidPoint => [x, y - 2.2])));
    if (height !== gradientHeight) { gradient.setAttribute('y2', format(height)); gradientHeight = height; }
    applyContentShape(points, halfWidth, sideHeight);
  };
  const draw = (timeMs: number) => {
    const dt = Math.min(0.05, lastFrame ? (timeMs - lastFrame) / 1e3 : 0.016); lastFrame = timeMs;
    const options = ports.options(), nextMood = options.mood;
    if (nextMood !== mood) {
      mood = nextMood; moodSince = timeMs; happyDrop = eaten = false;
      if (mood === 'music') impulse(0, -120, 80);
    }
    const elapsed = timeMs - moodSince, bounds = measure();
    const heightVelocity = (height - previousHeight) / Math.max(dt, 0.004);
    if (!shrinking && heightVelocity < -300 && height < previousHeight) shrinking = true;
    else if (shrinking && heightVelocity > -40) { shrinking = false; collapsedAt = height < 70 ? timeMs : timeMs - 620 * 0.45; }
    const recovering = shrinking || timeMs - collapsedAt < 620;
    const restored = shrinking ? 0 : Math.min(1, Math.max(0, (timeMs - collapsedAt - 620 * 0.45) / (620 * 0.55)));
    const sizeImpulse = Math.max(-140, Math.min(140, -(heightVelocity - previousHeightVelocity) * 0.45));
    if (Math.abs(sizeImpulse) > 0.5) for (let index = 1; index < 89; index++) velocity[index] += sizeImpulse * taperAt(index);
    if (Math.abs(height - previousHeight) > 0.3 || Math.abs(width - previousWidth) > 0.3) resizeUntil = timeMs + 400;
    previousHeightVelocity = heightVelocity; previousHeight = height; previousWidth = width;
    let volumeEnvelope = 0, heard = 0;
    const audio = ports.audio();
    if (mood === 'music') {
      const signal = updateEnvelope(envelope, audio.level, timeMs, dt); volumeEnvelope = signal.env; heard = signal.heard;
      if (signal.hit) for (let index = 0; index < spikeStrengths.length; index++) spikeStrengths[index] = 0.5 + 0.5 * random();
    }
    const bands = mood === 'music' && audio.liquidSpectrum && audio.bands.length > 1 && now() - audio.bandsAt < 700 ? audio.bands : null;
    spectrumBlend += (+!!bands - spectrumBlend) * (1 - Math.exp(-dt / 0.2));
    for (let index = 0; index < bandLevels.length; index++) {
      let level = 0;
      if (bands) {
        const position = bandLevels.length > 1 ? (index / (bandLevels.length - 1)) ** 1.2 * (bands.length - 1) : 0;
        const low = Math.floor(position), high = Math.min(bands.length - 1, low + 1);
        level = bands[low] + (bands[high] - bands[low]) * (position - low);
      }
      bandLevels[index] += (level - bandLevels[index]) * (1 - Math.exp(-dt / (level > bandLevels[index] ? 0.02 : 0.11)));
    }
    const cursor = ports.cursor();
    const pointer = cursor ? { x: cursor.x - (bounds.left + width / 2), y: cursor.y - bounds.top } : null;
    for (let index = 0; index < LIQUID_POINTS; index++) {
      const x = xAt(index), taper = taperAt(index);
      let amplitude = 0;
      if (mood === 'idle') amplitude = 2.5 * Math.sin(index * 0.12 + timeMs / 1100);
      if (mood === 'music') {
        const beat = 0.25 + 0.75 * Math.max(0, Math.sin(timeMs / 545 * Math.PI)) ** 2;
        const envelopeLevel = beat + (volumeEnvelope - beat) * heard;
        const variation = 1 + (spikeStrengths[Math.floor(index / 7)] - 1) * heard;
        const offset = index % 7 - 3, spike = Math.max(0, 1 - Math.abs(offset) / 3.5);
        const signal = envelopeLevel * variation;
        const combined = signal + (0.1 + 0.9 * bandLevels[Math.floor(index / 7)] - signal) * spectrumBlend;
        const edgeDistance = Math.min(index, 89 - index) - 4;
        const edge = Math.max(0, Math.min(1, edgeDistance / 6)), smoothEdge = edge * edge * (3 - 2 * edge);
        amplitude = Math.min(30, height * 0.9) * combined * spike * spike * (1 + (smoothEdge - 1) * spectrumBlend);
      }
      if (mood === 'think') amplitude = 4 * Math.sin(index * 0.32 - timeMs / 130);
      if (mood === 'happy') amplitude = elapsed < 520 ? 18 * Math.min(1, elapsed / 520) * gaussian(x / 26) : 0;
      if (mood === 'attn' || mood === 'sad') {
        const offset = index % 5 - 2, spike = Math.max(0, 1 - Math.abs(offset) / 2.5);
        amplitude = (10 + 3 * Math.sin(timeMs / 30 + index)) * spike * spike;
      }
      if (mood === 'eat') amplitude = elapsed < 700 ? 12 * Math.min(1, elapsed / 700) * gaussian(x / 24) : 0;
      if (mood === 'sleep') amplitude = 10 * taper ** 2 + 1.2 * Math.sin(timeMs / 1500);
      if (pointer && mood !== 'sleep' && pointer.y > height * 0.6 && Math.abs(pointer.x) < width / 2 + 60)
        amplitude += 22 * Math.exp(-Math.max(0, pointer.y - height) / 140) * gaussian((x - pointer.x) / 40);
      target[index] = amplitude * taper * restored;
    }
    const spiky = !recovering && (mood === 'music' || mood === 'attn' || mood === 'sad');
    advanceLiquidWave(displacement, velocity, target, height, dt, spiky ? 80 : 700, spiky ? 420 : mood === 'sleep' ? 40 : 70, spiky ? 30 : 6);
    if (mood === 'happy' && elapsed >= 520 && !happyDrop) {
      happyDrop = true; createDrop(0, height + 12, 40, Math.min(7, height * 0.22)); impulse(0, -240, 20);
    }
    if (mood === 'eat' && elapsed >= 700 && !eaten) { eaten = true; impulse(0, -360, 22); }
    if (mood === 'idle' && timeMs - lastIdleImpulse > 3600) { lastIdleImpulse = timeMs; impulse((random() - 0.5) * width * 0.6, -120, 16); }
    if (mood === 'idle' && options.rain && timeMs - lastRainDrop > 1500 + random() * 900) {
      lastRainDrop = timeMs; createDrop((random() - 0.5) * width * 0.7, height + 4, 26, 2.3);
    }
    if (mood === 'think' && !thinkingDrop) { thinkingDrop = createDrop(0, height + 20, 0, 4); thinkingDrop.mode = 'orbit'; }
    else if (mood !== 'think' && thinkingDrop) { thinkingDrop.mode = 'home'; thinkingDrop = null; }
    drops = drops.filter(drop => {
      drop.age += dt;
      if (drop.mode === 'orbit') { const phase = timeMs / 650; drop.x = Math.cos(phase) * width * 0.32; drop.y = height + 20 + Math.sin(phase * 2) * 6; }
      else if (drop.mode === 'fall') {
        drop.vy += 520 * dt; drop.y += drop.vy * dt;
        if (mood === 'happy' && drop.age > 0.5) drop.mode = 'home';
        if (drop.r < 4) drop.g.setAttribute('opacity', Math.max(0, 1 - drop.age / 1.3).toFixed(2));
        if ((drop.r < 4 && drop.age > 1.3) || drop.y > height + 120 || drop.age > 3) { drop.g.remove(); return false; }
      } else {
        drop.vy += (-60 * (drop.y - (bottomAt(drop.x) - 2)) - 5 * drop.vy) * dt;
        drop.y += drop.vy * dt;
        if (drop.y < bottomAt(drop.x) + drop.r * 0.6 || drop.age > 4) { impulse(drop.x, -300, 18); drop.g.remove(); return false; }
      }
      drop.g.setAttribute('transform', `translate(${drop.x.toFixed(1)},${drop.y.toFixed(1)})`); return true;
    });
    renderShape();
    rim.style.stroke = mood === 'music' && options.accent ? options.accent : rimColors[mood];
    rim.setAttribute('opacity', mood === 'sleep' ? '0.35' : mood === 'attn' ? (0.5 + 0.4 * Math.abs(Math.sin(timeMs / 120))).toFixed(2) : '0.75');
  };
  const measureChanged = () => { const beforeWidth = width, beforeHeight = height; measure(); if (width !== beforeWidth || height !== beforeHeight) renderShape(); };
  measuredIslands.add(measureChanged);
  draw(now());
  return {
    draw,
    updateFill(fill: string) { tintStop.style.stopColor = fill; },
    interval() { return now() < resizeUntil ? 0 : ports.options().mood === 'sleep' ? 50 : ports.options().mood === 'idle' ? 16 : 0; },
    dispose() { measuredIslands.delete(measureChanged); svg.replaceChildren(); if (clip) clip.style.clipPath = ''; if (squash) squash.style.transform = ''; },
  };
}
