import type { DrawingMood } from '../types';

export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
export const MOOD_COLORS: Record<DrawingMood, string> = {
  idle: '#F1EFE8', music: '#F0997B', think: '#AFA9EC',
  done: '#97C459', attn: '#EF9F27', sleep: '#5F5E5A',
};
export function createSvg<Tag extends keyof SVGElementTagNameMap>(tag: Tag,
  attributes: Record<string, string | number>, parent?: SVGElement): SVGElementTagNameMap[Tag] {
  const element = document.createElementNS(SVG_NAMESPACE, tag);
  for (const attribute in attributes) element.setAttribute(attribute, String(attributes[attribute]));
  parent?.appendChild(element);
  return element;
}
export function roundedPath(cx: number, cy: number, width: number, height: number): string {
  const radius = Math.min(width, height) / 2;
  const left = cx - width / 2, top = cy - height / 2;
  const horizontal = width - 2 * radius, vertical = height - 2 * radius;
  return `M${left + radius},${top}h${horizontal}a${radius},${radius} 0 0 1 ${radius},${radius}v${vertical}a${radius},${radius} 0 0 1 -${radius},${radius}h-${horizontal}a${radius},${radius} 0 0 1 -${radius},-${radius}v-${vertical}a${radius},${radius} 0 0 1 ${radius},-${radius}z`;
}
export type EyeShape = 'happy' | 'closed' | 'wide' | 'open';
export function drawEye(eye: SVGPathElement, x: number, y: number, shape: EyeShape,
  blink: number, color: string, width: number, height: number): void {
  const stroke = (path: string) => {
    eye.setAttribute('d', path);
    eye.setAttribute('fill', 'none');
    eye.setAttribute('stroke', color);
    eye.setAttribute('stroke-width', String(Math.max(1.4, width * 0.42)));
    eye.setAttribute('stroke-linecap', 'round');
  };
  if (shape === 'happy') return stroke(`M${x - width * 0.8},${y + 1.2} Q${x},${y - width} ${x + width * 0.8},${y + 1.2}`);
  if (shape === 'closed') return stroke(`M${x - width * 0.8},${y} Q${x},${y + width * 0.6} ${x + width * 0.8},${y}`);
  eye.setAttribute('fill', color);
  eye.setAttribute('stroke', 'none');
  const scale = shape === 'wide' ? 1.25 : 1;
  eye.setAttribute('d', roundedPath(x, y, width * scale, Math.max(1.2, height * scale * blink)));
}
export function moodEyeShape(mood: DrawingMood): EyeShape {
  return mood === 'music' || mood === 'done' ? 'happy' : mood === 'sleep' ? 'closed' : mood === 'attn' ? 'wide' : 'open';
}
export function polar(radius: number, angleDegrees: number): [number, number] {
  const angle = angleDegrees * Math.PI / 180;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}
export function createThinkingDots(parent: SVGElement): SVGCircleElement[] {
  return [0, 1, 2].map(() => createSvg('circle', { r: 2, fill: '#AFA9EC' }, parent));
}
export function drawThinkingDots(dots: SVGCircleElement[], visible: boolean, x: number, y: number, timeMs: number): void {
  dots.forEach((dot, index) => {
    dot.style.display = visible ? '' : 'none';
    dot.setAttribute('cx', String(x + index * 7));
    dot.setAttribute('cy', (y - Math.max(0, Math.sin(timeMs / 180 - index * 0.9)) * 3).toFixed(1));
  });
}
export function createSleepSymbol(parent: SVGElement): SVGTextElement {
  const symbol = createSvg('text', { 'font-size': 10, 'font-family': 'sans-serif', fill: '#888780' }, parent);
  symbol.textContent = 'z';
  return symbol;
}
export function drawSleepSymbol(symbol: SVGTextElement, visible: boolean, x: number, y: number, timeMs: number): void {
  symbol.style.display = visible ? '' : 'none';
  const phase = timeMs / 1800 % 1;
  symbol.setAttribute('x', (x + phase * 8).toFixed(1));
  symbol.setAttribute('y', (y - phase * 18).toFixed(1));
  symbol.setAttribute('opacity', (1 - phase).toFixed(2));
}
export function createAttentionBadge(parent: SVGElement): SVGGElement {
  const badge = createSvg('g', {}, parent);
  createSvg('circle', { r: 7, fill: '#EF9F27' }, badge);
  createSvg('rect', { x: -1.2, y: -4.6, width: 2.4, height: 5.6, rx: 1.2, fill: '#412402' }, badge);
  createSvg('circle', { cy: 3.3, r: 1.3, fill: '#412402' }, badge);
  return badge;
}
export function drawAttentionBadge(badge: SVGGElement, visible: boolean, x: number, y: number): void {
  badge.style.display = visible ? '' : 'none';
  badge.setAttribute('transform', `translate(${x},${y})`);
}
