export type CharacterMood = 'idle' | 'music' | 'think' | 'happy' | 'eat' | 'attn' | 'sad' | 'sleep';
export type DrawingMood = 'idle' | 'music' | 'think' | 'done' | 'attn' | 'sleep';
export interface CharacterPose {
  s: DrawingMood;
  c: string;
  lx: number;
  ly: number;
  blink: number;
  poke: number;
  h: number;
  face: boolean;
}
export interface DrawingFrame {
  draw(pose: CharacterPose, timeMs: number, elapsedMs: number, dtSeconds: number): void;
}
export interface Drawing {
  create(parent: SVGElement, seed: number): DrawingFrame;
}
export interface DrawnCharacter extends Drawing {
  id: string;
  name: string;
  desc: string;
  face?: boolean;
  outside?: boolean;
  pillScale?: number;
}
