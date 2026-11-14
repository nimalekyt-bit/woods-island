import { React } from '../react';
import type { CharacterMood } from './types';
import { pixelLayout, pixelHop, pixelPath, PIXEL_COLORS, PIXEL_INTERVALS, PIXEL_EXTRA_COLORS } from './pixel-layout';
import { isCharacterMotionReduced, onCharacterMotionChange } from './scheduler';

const pageHidden = () => document.hidden;
const onPageVisibility = (listener: () => void) => {
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
};

export interface PixelCharacterProps {
  mood: CharacterMood; px?: number; color?: string | null; level?: number;
  look?: number; still?: boolean; className?: string;
}
export function PixelCharacter({ mood, px = 2, color, level = 0, look = 0, still = false, className = '' }: PixelCharacterProps) {
  const reducedMotion = React.useSyncExternalStore(onCharacterMotionChange, isCharacterMotionReduced);
  const hidden = React.useSyncExternalStore(onPageVisibility, pageHidden);
  still = still || reducedMotion || hidden;
  const [blink, setBlink] = React.useState(false);
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    if (still || mood === 'sleep' || mood === 'happy' || mood === 'music' || mood === 'eat') return;
    let timer: ReturnType<typeof setTimeout>;
    const nextBlink = () => {
      timer = setTimeout(() => {
        setBlink(true);
        timer = setTimeout(() => { setBlink(false); nextBlink(); }, 130);
      }, 2400 + Math.random() * 3800);
    };
    nextBlink();
    return () => { clearTimeout(timer); setBlink(false); };
  }, [mood, still]);
  React.useEffect(() => {
    setStep(0);
    const every = still ? 0 : PIXEL_INTERVALS[mood];
    if (!every) return;
    const timer = setInterval(() => setStep(value => value + 1), every);
    return () => clearInterval(timer);
  }, [mood, still]);
  const { body, extra } = React.useMemo(() => pixelLayout(mood, { step, blink, look }), [mood, step, blink, look]);
  const hop = still ? 0 : pixelHop(mood, step, level);
  const fill = color || PIXEL_COLORS[mood];
  return <svg width={16 * px} height={13 * px} viewBox="-3 -3 16 13" shapeRendering="crispEdges"
    aria-hidden className={`shrink-0 ${className}`} style={{ transform: hop ? `translateY(${-hop * px}px)` : undefined }}>
    <path d={pixelPath(body)} fill={fill}/>
    {extra.length > 0 && <path d={pixelPath(extra)} fill={PIXEL_EXTRA_COLORS[mood] ?? fill}/>}
  </svg>;
}
