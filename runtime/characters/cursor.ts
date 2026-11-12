export interface CursorPoint { x: number; y: number }
export type NativeCursor = readonly [offsetX: number, y: number];
export const NATIVE_CURSOR_GRACE_MS = 250;

/** Clamp cursor look to the original ellipse: x ±4, y ±3 SVG units. */
export function normalizedLook(dx: number, dy: number): [number, number] {
  const x = dx / 120, y = dy / 75;
  const length = Math.hypot(x, y);
  const scale = length > 1 ? 1 / length : 1;
  return [x * scale * 4, y * scale * 3];
}

export interface CursorDependencies {
  now: () => number;
  viewportWidth: () => number;
  onMouseMove: (callback: (point: CursorPoint) => void) => () => void;
}
export function createCursorTracker(dependencies: CursorDependencies) {
  let point: CursorPoint | null = null;
  let lastMouseMove = 0;
  const removeMouseListener = dependencies.onMouseMove(next => {
    point = { x: next.x, y: next.y };
    lastMouseMove = dependencies.now();
  });
  return {
    get: () => point,
    setNative(next: NativeCursor | null) {
      if (dependencies.now() - lastMouseMove < NATIVE_CURSOR_GRACE_MS) return;
      point = next ? { x: dependencies.viewportWidth() / 2 + next[0], y: next[1] } : null;
    },
    dispose: removeMouseListener,
  };
}

const sharedCursor = createCursorTracker({
  now: () => performance.now(),
  viewportWidth: () => typeof window === 'undefined' ? 0 : window.innerWidth,
  onMouseMove: callback => {
    if (typeof window === 'undefined') return () => {};
    const mouseMove = (event: MouseEvent) => callback({ x: event.clientX, y: event.clientY });
    window.addEventListener('mousemove', mouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', mouseMove);
  },
});
export const getCursor = sharedCursor.get;
export const setNativeCursor = sharedCursor.setNative;
