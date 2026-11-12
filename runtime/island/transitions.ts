import type { IslandMode } from './geometry';

export interface Spring { type: 'spring'; stiffness: number; damping: number; mass: number }
export interface AxisSpring { default: Spring; width: Spring; height: Spring }
export type SizeTransition = Spring | AxisSpring;

export const PLAIN_OPEN: Spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 };
export const PLAIN_FOLDED: Spring = { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 };
export const LIQUID_OPEN: Spring = { type: 'spring', stiffness: 260, damping: 18, mass: 1 };
export const LIQUID_FOLDED: Spring = { type: 'spring', stiffness: 340, damping: 21, mass: 1 };
export const LYRICS_SIZE: Spring = { type: 'spring', stiffness: 220, damping: 30, mass: 1 };

/** Bound overshoot to the same CSS-pixel tolerance for large and small changes. */
export function amplitudeSpring(delta: number, tolerance: number): Spring {
  const overshoot = Math.min(0.113, tolerance / Math.max(delta, 1));
  const ratio = -Math.log(overshoot) / Math.PI;
  const dampingRatio = ratio / Math.sqrt(1 + ratio * ratio);
  return { type: 'spring', stiffness: 340, damping: 2 * Math.sqrt(340) * dampingRatio, mass: 1 };
}

export interface SizeHistory { w: number; h: number; fold: SizeTransition }
export function updateSizeHistory(previous: SizeHistory, w: number, h: number): SizeHistory {
  if (previous.w === w && previous.h === h) return previous;
  return { w, h, fold: { default: LIQUID_FOLDED, width: amplitudeSpring(Math.abs(w - previous.w), 16), height: amplitudeSpring(Math.abs(h - previous.h), 7) } };
}
export function selectSizeTransition(mode: IslandMode, lyrics: boolean, liquid: boolean, folded: SizeTransition): SizeTransition {
  if (mode === 'liveMedia' && lyrics) return LYRICS_SIZE;
  const open = mode === 'expanded' || mode === 'drop' || mode === 'palette';
  return liquid ? open ? LIQUID_OPEN : folded : open ? PLAIN_OPEN : PLAIN_FOLDED;
}
