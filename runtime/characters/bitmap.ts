import type { CharacterMood } from './types';

export interface SpriteFormat { frameWidth: number; frameHeight: number; columns: number; rows: number }
export interface SpriteFrame { rowIndex: number; columnIndex: number; durationMs: number; lookGroup?: string | null; lookOffset?: { x: number; y: number } }
export interface SpriteAnimation { frames: SpriteFrame[]; loop: boolean }
export interface SpriteLook extends SpriteFormat {
  file: string; baseFile: string; states: string[]; groups: Record<string, { rowOffset: number }>;
}
export interface BitmapDefinition extends SpriteFormat {
  source: 'woods' | 'codex'; file: string; animations: Record<string, SpriteAnimation>;
  look?: SpriteLook; lookDirections?: number;
}
export const CODEX_IDS = ['codex', 'dewey', 'fireball', 'hoots', 'rocky', 'seedy', 'stacky', 'bsod', 'null-signal'] as const;
export type CodexId = typeof CODEX_IDS[number];
export function spriteState(mood: CharacterMood, source: BitmapDefinition['source']): string {
  return source === 'woods'
    ? ({idle:'idle',music:'music',think:'think',happy:'happy',eat:'poke',attn:'attention',sad:'attention',sleep:'sleep'}[mood])
    : ({idle:'idle',music:'running',think:'review',happy:'jumping',eat:'waving',attn:'failed',sad:'failed',sleep:'waiting'}[mood]);
}
export function timedSpriteFrame(animation: SpriteAnimation, elapsedMs: number, still = false): SpriteFrame {
  const duration = animation.frames.reduce((sum, frame) => sum + frame.durationMs, 0);
  if (!animation.frames.length || duration <= 0) throw Error('Empty sprite animation');
  let elapsed = still ? 0 : Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  elapsed = animation.loop ? elapsed % duration : Math.min(elapsed, duration - 1);
  for (const frame of animation.frames) { if (elapsed < frame.durationMs) return frame; elapsed -= frame.durationMs; }
  return animation.frames[animation.frames.length - 1];
}
/** A character owns its animation clock; sleeping and reactions never inherit a pending blink. */
export function createBitmapTimeline(definition: BitmapDefinition, random: () => number = Math.random) {
  let lastTime: number | undefined, clock = 0, epoch = 0, previousState = '';
  let blinkAt = 0, blinkStarted: number | undefined;
  const blink = definition.source === 'woods' ? definition.animations.blink : undefined;
  const blinkDuration = blink?.frames.reduce((sum, frame) => sum + frame.durationMs, 0) ?? 0;
  function nextBlink(first: boolean) {
    const sample = Math.max(0, Math.min(1, random()));
    return clock + (first ? 1200 + sample * 2500 : 2500 + sample * 3500);
  }
  return {
    frame(timeMs: number, mood: CharacterMood, still = false) {
      const time = Number.isFinite(timeMs) ? timeMs : lastTime ?? 0;
      const delta = lastTime === undefined ? 0 : Math.min(50, Math.max(0, time - lastTime));
      lastTime = time;
      if (!still) clock += delta;
      const state = spriteState(mood, definition.source);
      if (state !== previousState) {
        epoch = clock; previousState = state; blinkStarted = undefined; blinkAt = nextBlink(true);
      }
      // The blink sheet has a resting body pose. Keep music and reactions on
      // their own sheet instead of flashing that resting pose mid-animation.
      if (blink && state === 'idle' && !still) {
        if (blinkStarted !== undefined && clock - blinkStarted >= blinkDuration) {
          blinkStarted = undefined; blinkAt = nextBlink(false);
        }
        if (blinkStarted === undefined && clock >= blinkAt) blinkStarted = clock;
      } else blinkStarted = undefined;
      const renderState = blinkStarted === undefined ? state : 'blink';
      const animation = definition.animations[renderState] ?? definition.animations.idle;
      const elapsed = blinkStarted === undefined ? clock - epoch : clock - blinkStarted;
      return { state, renderState, frame: timedSpriteFrame(animation, elapsed, still), delta };
    },
  };
}
export function spritePosition(frame: Pick<SpriteFrame, 'rowIndex' | 'columnIndex'>, format: SpriteFormat): string {
  return `${format.columns === 1 ? 0 : frame.columnIndex / (format.columns - 1) * 100}% ${format.rows === 1 ? 0 : frame.rowIndex / (format.rows - 1) * 100}%`;
}
export function lookCell(x: number, y: number, rowOffset = 0) {
  const columnIndex = x < -.24 ? 0 : x > .24 ? 2 : 1;
  const rowIndex = rowOffset + (y < -.24 ? 0 : y > .24 ? 2 : 1);
  return { columnIndex, rowIndex };
}
export function codexLookCell(x: number, y: number) {
  const angle = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
  const direction = Math.round(angle / 22.5) % 16;
  return { columnIndex: direction % 8, rowIndex: 9 + Math.floor(direction / 8) };
}
export function validateSprite(definition: BitmapDefinition) {
  for (const format of [definition, ...(definition.look ? [definition.look] : [])]) {
    if (![format.frameWidth, format.frameHeight, format.columns, format.rows].every(n => Number.isInteger(n) && n > 0 && n <= 4096)) throw Error('Invalid sprite grid');
  }
  for (const animation of Object.values(definition.animations)) {
    if (!animation.frames.length || animation.frames.length > 128) throw Error('Invalid frame count');
    for (const frame of animation.frames) {
      if (!Number.isInteger(frame.rowIndex) || !Number.isInteger(frame.columnIndex) || frame.rowIndex < 0 || frame.rowIndex >= definition.rows || frame.columnIndex < 0 || frame.columnIndex >= definition.columns || !Number.isFinite(frame.durationMs) || frame.durationMs <= 0 || frame.durationMs > 10000) throw Error('Invalid sprite frame');
    }
  }
  if (definition.look) {
    for (const group of Object.values(definition.look.groups)) if (!Number.isInteger(group.rowOffset) || group.rowOffset < 0 || group.rowOffset + 2 >= definition.look.rows) throw Error('Invalid gaze group');
    for (const animation of Object.values(definition.animations)) for (const frame of animation.frames) {
      if (frame.lookGroup && !definition.look.groups[frame.lookGroup]) throw Error('Unknown gaze group');
      if (frame.lookOffset && (!Number.isInteger(frame.lookOffset.x) || !Number.isInteger(frame.lookOffset.y) || Math.abs(frame.lookOffset.x) > 16 || Math.abs(frame.lookOffset.y) > 16)) throw Error('Invalid gaze offset');
    }
  }
  return definition;
}
