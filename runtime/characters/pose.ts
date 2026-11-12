import { getCursor, normalizedLook } from './cursor';
import { MOOD_COLORS } from './drawings/helpers';
import type { CursorPoint } from './cursor';
import type { CharacterMood, CharacterPose, DrawingMood } from './types';

export function drawingMood(mood: CharacterMood): DrawingMood {
  return mood === 'happy' || mood === 'eat' ? 'done' : mood === 'sad' ? 'attn' : mood;
}

export interface PoseState {
  mood: CharacterMood | null;
  since: number;
  poke: number;
  blinkAt: number;
  lx: number;
  ly: number;
  sy: number;
  vsy: number;
  last: number;
}
export interface PoseFrame {
  pose: CharacterPose;
  t: number;
  dt: number;
  pop: [number, number];
}
export interface PoseDependencies {
  random?: () => number;
  cursor?: () => CursorPoint | null;
}
type CharacterElement = Pick<Element, 'getBoundingClientRect'>;

/** Frame time is explicit; random and cursor sources can be injected for deterministic checks. */
export function createCharacterPose(still: () => boolean, dependencies: PoseDependencies = {}) {
  const random = dependencies.random ?? Math.random;
  const cursor = dependencies.cursor ?? getCursor;
  const state: PoseState = { mood: null, since: 0, poke: -1e9, blinkAt: 0, lx: 0, ly: 0, sy: 1, vsy: 0, last: 0 };
  return {
    st: state,
    pose(time: number, mood: CharacterMood, look: number, accent: string | null | undefined, element?: CharacterElement | null): PoseFrame {
      const dt = Math.min(0.05, state.last ? (time - state.last) / 1e3 : 0.016);
      state.last = time;
      if (state.mood !== mood) {
        if (state.mood !== null) { state.poke = time; state.vsy -= 3.4; }
        state.mood = mood;
        state.since = time;
      }
      const drawing = drawingMood(mood);
      let targetX = look * 3, targetY = 0;
      const point = cursor();
      if (point && element && !still()) {
        const bounds = element.getBoundingClientRect();
        [targetX, targetY] = normalizedLook(point.x - (bounds.left + bounds.width / 2), point.y - (bounds.top + bounds.height / 2));
      }
      if (drawing === 'think') { targetX = 0; targetY = -2; }
      state.lx += (targetX - state.lx) * Math.min(1, dt * 10);
      state.ly += (targetY - state.ly) * Math.min(1, dt * 10);

      let blink = 1;
      state.blinkAt ||= time + 1200 + random() * 2500;
      if (time > state.blinkAt) {
        const elapsed = time - state.blinkAt;
        blink = elapsed < 70 ? 1 - elapsed / 70 : elapsed < 140 ? (elapsed - 70) / 70 : 1;
        if (elapsed > 140) state.blinkAt = time + 2500 + random() * 3500;
      }
      const sincePoke = (time - state.poke) / 1e3;
      const poke = sincePoke < 0.6 ? Math.sin(sincePoke / 0.6 * Math.PI) : 0;
      state.vsy += (-190 * (state.sy - 1) - 11 * state.vsy) * dt;
      state.sy += state.vsy * dt;
      const scaleY = Math.max(0.7, Math.min(1.3, state.sy));
      return {
        pose: { s: drawing, c: mood === 'sad' ? '#ff6b6b' : drawing === 'music' && accent ? accent : MOOD_COLORS[drawing],
          lx: state.lx, ly: state.ly, blink, poke, h: 30, face: true },
        t: time - state.since, dt, pop: [1 + (1 - scaleY) * 0.8, scaleY],
      };
    },
  };
}

export const GENERIC_BOUNCE_LIMIT = 9;
export interface GenericMotion { y: number; sx: number; sy: number; rot: number }
export function genericMotion(mood: DrawingMood, time: number, sinceMood: number): GenericMotion {
  let y = Math.sin(time / 900) * 2, sx = 1, sy = 1, rot = 0;
  if (mood === 'music') {
    const beat = time % 545 / 545;
    const compression = Math.max(0, 1 - beat * 4);
    y = -Math.abs(Math.sin(beat * Math.PI)) * 6;
    sy = 1 - 0.1 * compression;
    sx = 1 + 0.08 * compression;
    rot = Math.sin(time / 545 * Math.PI) * 5;
  }
  if (mood === 'done') {
    const seconds = sinceMood / 1e3;
    const decay = Math.exp(-seconds * 1.4);
    const bounce = Math.abs(Math.sin(seconds * Math.PI * 1.7));
    y = -bounce * GENERIC_BOUNCE_LIMIT * decay;
    const compression = (1 - bounce) ** 8 * decay;
    sy = 1 - 0.2 * compression;
    sx = 1 + 0.15 * compression;
  }
  if (mood === 'attn') rot = sinceMood % 1400 < 300 ? Math.sin(sinceMood / 25) * 6 : 0;
  if (mood === 'sleep') { y = 3; sy = 1 + 0.035 * Math.sin(time / 1100); sx = 1 - 0.02 * Math.sin(time / 1100); }
  return { y, sx, sy, rot };
}
