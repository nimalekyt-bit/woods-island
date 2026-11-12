import { React } from '../react';
import type { CharacterMood } from './types';
import { getCursor } from './cursor';
import { subscribeAnimationFrames } from './scheduler';
import { mountLiquidIsland, type LiquidAudio, type LiquidOptions } from './liquid';

export interface LiquidIslandProps {
  mood: CharacterMood; accent?: string | null; ears?: boolean; round?: boolean; rain?: boolean;
  tint?: string | null; scaled?: boolean; readAudio: () => LiquidAudio;
}
export function LiquidIsland({ mood, accent, ears = false, round = false, rain = false,
  tint = null, scaled = false, readAudio }: LiquidIslandProps) {
  const svg = React.useRef<SVGSVGElement>(null);
  const options = React.useRef<LiquidOptions>({ mood, accent, ears, round, rain, scaled });
  options.current = { mood, accent, ears, round, rain, scaled };
  const audio = React.useRef(readAudio); audio.current = readAudio;
  const fill = tint ? `color-mix(in srgb, ${tint} 30%, var(--color-island))` : 'var(--color-island)';
  const currentFill = React.useRef(fill); currentFill.current = fill;
  const engine = React.useRef<ReturnType<typeof mountLiquidIsland> | null>(null);
  React.useEffect(() => { engine.current?.updateFill(fill); }, [fill]);
  React.useEffect(() => {
    const root = svg.current;
    if (!root?.parentElement) return;
    const mounted = mountLiquidIsland(root, {
      options: () => options.current, audio: () => audio.current(), cursor: getCursor,
    }, currentFill.current);
    engine.current = mounted;
    const unsubscribe = subscribeAnimationFrames(mounted.draw, mounted.interval);
    return () => { unsubscribe(); engine.current = null; mounted.dispose(); };
  }, []);
  return <svg ref={svg} data-character="liquid" data-character-mood={mood} className="pointer-events-none absolute top-0 left-0 overflow-visible" aria-hidden/>;
}
