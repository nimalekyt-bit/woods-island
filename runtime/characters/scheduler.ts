import type { CharacterMood } from './types';

export const STILL_INTERVAL_MS = 1e9;
export type AnimationSubscription = (() => void) & { refresh: () => void };

export interface CharacterSchedulerDependencies {
  requestFrame: (callback: (time: number) => void) => number;
  cancelFrame: (handle: number) => void;
  isHidden: () => boolean;
  onVisibilityChange: (callback: () => void) => () => void;
}
interface Subscriber {
  frame: (time: number) => void;
  interval: () => number;
  last: number;
}

/** One RAF serves all animated characters, with the original per-view cadence. */
export function createCharacterScheduler(dependencies: CharacterSchedulerDependencies) {
  const subscribers = new Set<Subscriber>();
  const suspendReasons = new Set<string>();
  let frameHandle: number | null = null;
  let removeVisibilityListener: (() => void) | null = null;
  let disposed = false;

  const cancel = () => {
    if (frameHandle !== null) dependencies.cancelFrame(frameHandle);
    frameHandle = null;
  };
  function runnable() {
    if (disposed || dependencies.isHidden() || suspendReasons.size > 0) return false;
    for (const subscriber of subscribers) if (subscriber.interval() < STILL_INTERVAL_MS) return true;
    return false;
  }

  function refresh() {
    if (!runnable()) { cancel(); return; }
    if (frameHandle === null) frameHandle = dependencies.requestFrame(tick);
  }
  function tick(time: number) {
    frameHandle = null;
    if (!runnable()) return;
    try {
      subscribers.forEach(subscriber => {
        const every = subscriber.interval();
        if (every < STILL_INTERVAL_MS && time - subscriber.last >= every - 2) {
          subscriber.last = time;
          subscriber.frame(time);
        }
      });
    } finally { refresh(); }
  }
  function subscribe(frame: Subscriber['frame'], interval: Subscriber['interval']): AnimationSubscription {
    const subscriber = { frame, interval, last: 0 };
    if (!disposed) {
      subscribers.add(subscriber);
      removeVisibilityListener ??= dependencies.onVisibilityChange(refresh);
      refresh();
    }
    const unsubscribe = () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        cancel();
        removeVisibilityListener?.();
        removeVisibilityListener = null;
      }
    };
    return Object.assign(unsubscribe, { refresh });
  }
  function suspend(reason: string, value: boolean) {
    if (value) suspendReasons.add(reason); else suspendReasons.delete(reason);
    refresh();
  }
  function dispose() {
    disposed = true;
    subscribers.clear();
    suspendReasons.clear();
    cancel();
    removeVisibilityListener?.();
    removeVisibilityListener = null;
  }
  function repaint(time: number) {
    if (disposed || dependencies.isHidden()) return;
    subscribers.forEach(subscriber => { subscriber.last = time; subscriber.frame(time); });
  }
  return { subscribe, suspend, refresh, repaint, dispose };
}

export function animationInterval(mood: CharacterMood, still = false): number {
  return still ? STILL_INTERVAL_MS : mood === 'sleep' ? 66 : mood === 'idle' ? 16 : 0;
}

const sharedScheduler = createCharacterScheduler({
  requestFrame: callback => requestAnimationFrame(callback),
  cancelFrame: handle => cancelAnimationFrame(handle),
  isHidden: () => typeof document !== 'undefined' && document.hidden,
  onVisibilityChange: callback => {
    if (typeof document === 'undefined') return () => {};
    document.addEventListener('visibilitychange', callback);
    return () => document.removeEventListener('visibilitychange', callback);
  },
});
export const subscribeAnimationFrames = sharedScheduler.subscribe;
export const suspendCharacterAnimations = sharedScheduler.suspend;
export const refreshCharacterScheduler = () => {
  sharedScheduler.repaint(performance.now());
  sharedScheduler.refresh();
};

export type CharacterMotionPreference = 'auto' | 'reduce' | 'full';
export function shouldReduceCharacterMotion(preference: CharacterMotionPreference, systemReduced: boolean) {
  return preference === 'reduce' || (preference === 'auto' && systemReduced);
}
const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
let motionPreference: CharacterMotionPreference = 'auto';
let reducedMotion = shouldReduceCharacterMotion(motionPreference, motionQuery?.matches ?? false);
const motionListeners = new Set<() => void>();
export const isCharacterMotionReduced = () => reducedMotion;
export function onCharacterMotionChange(listener: () => void) {
  motionListeners.add(listener); return () => { motionListeners.delete(listener); };
}
function applyMotionPreference() {
  const next = shouldReduceCharacterMotion(motionPreference, motionQuery?.matches ?? false);
  if (next === reducedMotion) return;
  reducedMotion = next;
  sharedScheduler.suspend('reduced-motion', next);
  motionListeners.forEach(listener => listener());
  refreshCharacterScheduler();
}
export function setCharacterMotionPreference(preference: CharacterMotionPreference) {
  motionPreference = ['auto', 'reduce', 'full'].includes(preference) ? preference : 'auto';
  applyMotionPreference();
}
sharedScheduler.suspend('reduced-motion', reducedMotion);
motionQuery?.addEventListener('change', applyMotionPreference);
