import type { CharacterMood } from './types';

export type Pixel = [x: number, y: number, size?: number];
export interface PixelFrame { step: number; blink: boolean; look: number }
export const PIXEL_COLORS: Record<CharacterMood, string> = {
  idle: '#D97757', eat: '#D97757', sleep: '#9A5642', music: '#F0997B',
  think: '#8ea2ff', happy: '#5fe0a0', attn: '#fcd34d', sad: '#ff6b6b',
};
export const PIXEL_INTERVALS: Record<CharacterMood, number> = {
  idle: 0, attn: 0, sad: 0, music: 380, think: 320, eat: 180, happy: 220, sleep: 900,
};
export const PIXEL_EXTRA_COLORS: Partial<Record<CharacterMood, string>> = {
  attn: '#fcd34d', sleep: 'var(--color-ink-3)',
};
const BODY_ROWS = ['..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX'];
const FEET_ROWS = ['X.XX.X.XX.X', 'XX.X.X.X.XX'];
const SLEEP_MARK: Pixel[] = [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]];

function pixelRect(left: number, right: number, top: number, bottom: number): Pixel[] {
  const pixels: Pixel[] = [];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) pixels.push([x, y]);
  return pixels;
}
function cutoutPixels(mood: CharacterMood, frame: PixelFrame): Pixel[] {
  const look = mood === 'idle' || mood === 'attn' ? frame.look : 0;
  const cutouts: Pixel[] = [];
  const eyes = (shape: (x: number) => Pixel[]) => cutouts.push(...shape(2 + look), ...shape(7 + look));
  if (mood === 'happy' || mood === 'music' || mood === 'eat') cutouts.push([1, 4], [2, 3], [3, 4], [7, 4], [8, 3], [9, 4]);
  else if (mood === 'sleep' || frame.blink) eyes(x => pixelRect(x, x + 1, 4, 4));
  else if (mood === 'sad') cutouts.push([2, 3], [3, 4], [7, 4], [8, 3]);
  else if (mood === 'attn') eyes(x => pixelRect(x, x + 1, 2, 4));
  else { const y = mood === 'think' ? 2 : 3; eyes(x => pixelRect(x, x + 1, y, y + 1)); }
  if (mood === 'eat') cutouts.push(...(frame.step % 2 === 0 ? pixelRect(4, 6, 5, 6) : pixelRect(4, 6, 6, 6)));
  if (mood === 'sad') cutouts.push([4, 6], [5, 5], [6, 6]);
  return cutouts;
}

export function pixelLayout(mood: CharacterMood, frame: PixelFrame): { body: Pixel[]; extra: Pixel[] } {
  const holes = new Set(cutoutPixels(mood, frame).map(([x, y]) => `${x},${y}`));
  const feet = mood === 'music' || mood === 'think' || mood === 'happy' ? FEET_ROWS[frame.step % 2] : FEET_ROWS[0];
  const body: Pixel[] = [];
  [...BODY_ROWS, feet].forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === 'X' && !holes.has(`${x},${y}`)) body.push([x, y]);
  });
  const extra: Pixel[] = [];
  if (mood === 'think') [3, 5, 7].slice(0, frame.step % 4).forEach(x => extra.push([x, -2]));
  else if (mood === 'attn') extra.push([12, 0], [12, 1], [12, 2], [12, 4]);
  else if (mood === 'sleep') {
    const rise = (frame.step % 3) * 0.5;
    SLEEP_MARK.forEach(([x, y]) => extra.push([10 + x * 0.5, -1 + y * 0.5 - rise, 0.5]));
  }
  return { body, extra };
}
export function pixelHop(mood: CharacterMood, step: number, level: number): number {
  return mood === 'happy' ? [0, 1, 2, 1][step % 4] : mood === 'music' ? Math.round(Math.min(1, level * 2.2) * 2) : 0;
}
export function pixelPath(pixels: Pixel[]): string {
  return pixels.map(([x, y, size = 1]) => `M${x},${y}h${size}v${size}h-${size}z`).join('');
}
