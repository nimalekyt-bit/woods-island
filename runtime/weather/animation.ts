export interface WeatherTweenOptions {
  ms?: number;
  delay?: number;
  from?: number;
  overshoot?: number;
}

export const WEATHER_TILE_DELAY_MS = 70;
export const WEATHER_GAUGE_TWEEN = { ms: 1150, overshoot: 1.1 } as const;

export function weatherEase(elapsed: number, duration: number, overshoot = 0): number {
  if (duration <= 0 || elapsed >= duration) return 1;
  if (elapsed <= 0) return 0;
  const x = elapsed / duration - 1;
  return overshoot <= 0 ? 1 + x * x * x : 1 + (overshoot + 1) * x * x * x + overshoot * x * x;
}

export function weatherTween(from: number, to: number, elapsed: number, duration: number, overshoot = 0): number {
  return from + (to - from) * weatherEase(elapsed, duration, overshoot);
}
