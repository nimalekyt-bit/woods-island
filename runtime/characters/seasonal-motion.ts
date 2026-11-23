import type { CharacterPose, DrawingMood } from './types';
export const SEASONAL_IDS = ['snowman', 'frost', 'bullfinch', 'ginger', 'deer'] as const;
export type SeasonalId = typeof SEASONAL_IDS[number];
export const seasonalBeat = (time: number) => Math.max(0, Math.sin((time % 545) / 545 * Math.PI)) ** 2;
export function seasonalArm(mood: DrawingMood, time: number, elapsed: number, side: number) {
  return mood === 'music' ? side * (Math.sin(time / 545 * Math.PI + (side > 0 ? Math.PI : 0)) * 22 - 6)
    : mood === 'done' ? side * -(38 + Math.sin(elapsed / 120) * 10)
    : mood === 'attn' ? side * -14 : mood === 'sleep' ? side * 16 : side * Math.sin(time / 1300) * 4;
}
export function seasonalFrame(id: SeasonalId, pose: CharacterPose, time: number, elapsed: number) {
  const beat = seasonalBeat(time), sleeping = pose.s === 'sleep', celebrating = pose.s === 'done';
  return {
    armLeft: seasonalArm(pose.s, time, elapsed, 1), armRight: seasonalArm(pose.s, time, elapsed, -1),
    hat: sleeping ? 16 : pose.s === 'music' ? -10 + beat * 6 : -10,
    carrot: pose.lx >= 0 ? 1 : -1,
    pom: pose.s === 'music' ? -3 * beat : celebrating ? -4 * Math.abs(Math.sin(elapsed / 160)) : sleeping ? 3 : Math.sin(time / 900) * .8,
    wing: celebrating ? Math.sin(elapsed / 55) * 22 : pose.s === 'music' ? -beat * 10 : 0,
    beak: pose.s === 'music' ? 2.2 * beat : pose.s === 'attn' ? 2 : 0,
    tail: pose.s === 'music' ? -beat * 12 : sleeping ? 6 : Math.sin(time / 1500) * 3,
    antlers: pose.s === 'music' ? Math.sin(time / 545 * Math.PI) * 5 : Math.sin(time / 1600) * 1.5,
    ears: pose.s === 'attn' ? 18 : pose.blink < 1 ? 10 : 0,
    accent: pose.s === 'idle' || sleeping ? id === 'snowman' ? '#56836c' : id === 'deer' ? '#d4b369' : '#eee9df' : pose.c,
  };
}
