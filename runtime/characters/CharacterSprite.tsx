import { React } from '../react';
import type { CharacterDefinition, CharacterBox } from './catalog';
import type { CharacterMood } from './types';
import { PixelCharacter } from './PixelCharacter';
import { BitmapSprite } from './BitmapSprite';
import { createCharacterPose, genericMotion, GENERIC_BOUNCE_LIMIT } from './pose';
import { subscribeAnimationFrames, refreshCharacterScheduler, animationInterval, onCharacterMotionChange, isCharacterMotionReduced } from './scheduler';
import { createSvg, createThinkingDots, createSleepSymbol, createAttentionBadge,
  drawThinkingDots, drawSleepSymbol, drawAttentionBadge } from './drawings/helpers';

const FALLBACK_BOX: CharacterBox = [-40, -45, 80, 85];
export interface CharacterSpriteProps {
  definition: CharacterDefinition; mood?: CharacterMood; width: number; height: number;
  look?: number; accent?: string | null; level?: number; still?: boolean; className?: string;
}
export function CharacterSprite({ definition, mood = 'idle', width, height, look = 0,
  accent, level = 0, still = false, className = '' }: CharacterSpriteProps) {
  const reducedMotion = React.useSyncExternalStore(onCharacterMotionChange, isCharacterMotionReduced);
  still = still || reducedMotion;
  const svg = React.useRef<SVGSVGElement>(null);
  const latest = React.useRef({ mood, look, accent, still });
  latest.current = { mood, look, accent, still };
  const box = definition.box ?? FALLBACK_BOX;
  React.useEffect(() => {
    const element = svg.current;
    if (!element || definition.kind !== 'slot' || !definition.puppet) return;
    const top = box[1], right = box[0] + box[2];
    const popGroup = createSvg('g', {}, element);
    const motionGroup = createSvg('g', {}, popGroup);
    const art = createSvg('g', {}, motionGroup);
    const frame = definition.puppet.create(art, ++instanceSeed);
    const decoration = definition.generic ? {
      dots: createThinkingDots(popGroup), sleep: createSleepSymbol(popGroup), attention: createAttentionBadge(popGroup),
    } : null;
    const animator = createCharacterPose(() => latest.current.still);
    const draw = (time: number) => {
      const props = latest.current;
      const { pose, t: elapsed, dt, pop: [sx, sy] } = animator.pose(time, props.mood, props.look, props.accent, element);
      popGroup.setAttribute('transform', `translate(0,30) scale(${sx.toFixed(3)},${sy.toFixed(3)}) translate(0,-30)`);
      if (definition.generic && decoration) {
        const motion = genericMotion(pose.s, time, elapsed);
        const y = Math.max(-GENERIC_BOUNCE_LIMIT, motion.y - pose.poke * 5);
        motionGroup.setAttribute('transform', `translate(0,${(y + 22 * (1 - motion.sy)).toFixed(2)}) rotate(${motion.rot.toFixed(2)}) scale(${motion.sx.toFixed(3)},${motion.sy.toFixed(3)})`);
        drawThinkingDots(decoration.dots, pose.s === 'think', -7, top + 6, time);
        drawSleepSymbol(decoration.sleep, pose.s === 'sleep', right - 15, top + 25, time);
        drawAttentionBadge(decoration.attention, pose.s === 'attn', right - 8, top + 9);
      }
      try { frame.draw(pose, time, elapsed, dt); } catch { /* Preserve isolated drawing failures. */ }
    };
    draw(performance.now());
    const stop = subscribeAnimationFrames(draw, () => animationInterval(latest.current.mood, latest.current.still));
    return () => { stop(); element.replaceChildren(); };
  }, [definition, box]);
  React.useEffect(() => { refreshCharacterScheduler(); }, [mood, still]);

  if (definition.bitmap) return <BitmapSprite definition={definition} mood={mood} width={width} height={height} look={look} accent={accent} level={level} still={still} className={className}/>;

  if (definition.id === 'pixel') {
    const px = Math.max(1, Math.min(6, Math.floor(height * 0.86 / 8), Math.floor(width * 0.92 / 11)));
    return <div data-character="pixel" data-character-mood={mood} className={`grid shrink-0 place-items-center ${className}`} style={{ width, height }}>
      <PixelCharacter mood={mood} px={px} color={mood === 'music' ? accent : undefined} level={level} look={look} still={still}/>
    </div>;
  }
  if (definition.kind !== 'slot') return null;
  const scale = Math.min(height / box[3], width / box[2]) * 0.94;
  const cx = box[0] + box[2] / 2, cy = box[1] + box[3] / 2;
  const viewBox = [cx - width / 2 / scale, cy - height / 2 / scale, width / scale, height / scale];
  return <svg ref={svg} data-ink-art data-character={definition.id} data-character-mood={mood} width={width} height={height}
    viewBox={viewBox.map(value => value.toFixed(2)).join(' ')} className={`shrink-0 ${className}`} aria-hidden/>;
}
let instanceSeed = 0;
