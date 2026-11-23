import type { ReactNode } from 'react';
import { React } from '../react';
import { isCharacterMotionReduced, onCharacterMotionChange, subscribeAnimationFrames } from '../characters/scheduler';
import { weatherTween, type WeatherTweenOptions } from './animation';

/** Forecast updates continue from the visible value; hidden windows share Woods' paused frame loop. */
export function useWeatherTween(target: number, { ms = 900, delay = 0, from = 0, overshoot = 0 }: WeatherTweenOptions = {}) {
  const [value, setValue] = React.useState(() => isCharacterMotionReduced() || !Number.isFinite(target) ? target : from);
  const current = React.useRef(value);
  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const settle = () => {
      unsubscribe?.();
      unsubscribe = undefined;
      current.current = target;
      setValue(target);
    };
    if (isCharacterMotionReduced() || !Number.isFinite(target) || !Number.isFinite(current.current) || ms <= 0) {
      settle();
      return;
    }
    if (current.current === target) return;
    const startValue = current.current;
    const startTime = performance.now() + Math.max(0, delay);
    unsubscribe = subscribeAnimationFrames(time => {
      const elapsed = time - startTime;
      if (elapsed >= ms) { settle(); return; }
      const next = weatherTween(startValue, target, elapsed, ms, overshoot);
      current.current = next;
      setValue(next);
    }, () => 16);
    const removeMotionListener = onCharacterMotionChange(() => {
      if (isCharacterMotionReduced()) settle();
    });
    return () => { unsubscribe?.(); removeMotionListener(); };
  }, [target, ms, delay, overshoot]);
  return value;
}

export function AnimatedWeatherValue({ value, format, ...options }: WeatherTweenOptions & { value: number; format: (value: number) => ReactNode }) {
  return <>{format(useWeatherTween(value, options))}</>;
}
