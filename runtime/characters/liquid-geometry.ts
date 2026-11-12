export const LIQUID_POINTS = 90;
export const gaussian = (value: number) => Math.exp(-value * value);
export type LiquidPoint = readonly [x: number, y: number];

export interface EnvelopeState {
  top: number; low: number; level: number; avg: number; last: number;
  moved: number; heard: number; hit: boolean; age: number;
}
export const createEnvelope = (): EnvelopeState => ({
  top: 0, low: 0, level: 0, avg: 0, last: -1, moved: -1e9, heard: 0, hit: false, age: 0,
});

export function updateEnvelope(state: EnvelopeState, input: number, timeMs: number, dt: number) {
  const value = Math.max(0, Math.min(1, input)), first = state.last < 0;
  if (first) state.top = state.low = value;
  else if (Math.abs(value - state.last) > 0.004) state.moved = timeMs;
  state.last = value;
  const audible = value > 0.003 && timeMs - state.moved < 1200;
  state.heard += (+audible - state.heard) * (1 - Math.exp(-dt / 0.25));
  const decay = 1 - Math.exp(-dt / 4);
  state.top = value > state.top ? value : state.top + (value - state.top) * decay;
  state.low = value < state.low ? value : state.low + (value - state.low) * decay;
  const normalized = Math.max(0, Math.min(1, (value - state.low) / Math.max(0.08, state.top - state.low)));
  if (first) state.level = state.avg = normalized;
  state.level += (normalized - state.level) * (1 - Math.exp(-dt / (normalized > state.level ? 0.025 : 0.16)));
  state.age += dt;
  state.avg += (normalized - state.avg) * (1 - Math.exp(-dt / Math.min(1.1, 0.2 + state.age * 0.45)));
  const transient = Math.max(0, Math.min(1, (state.level - state.avg) / (0.22 * state.avg + 0.05)));
  let hit = false;
  if (transient > 0.45 && !state.hit) { state.hit = true; hit = audible; }
  else if (transient < 0.2) state.hit = false;
  return { env: 0.2 + 0.8 * Math.min(1, 0.45 * state.level + 0.9 * transient), heard: state.heard, hit };
}

/** Match the old rounded quadratic path, including endpoint order. */
export function smoothLiquidPath(points: readonly LiquidPoint[]): string {
  let path = `${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let index = 1; index < points.length - 1; index++) {
    const current = points[index], next = points[index + 1];
    path += ` Q${current[0].toFixed(1)},${current[1].toFixed(1)} ${((current[0] + next[0]) / 2).toFixed(1)},${((current[1] + next[1]) / 2).toFixed(1)}`;
  }
  const last = points[points.length - 1];
  return path + ` L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
}

export function liquidBottomAt(x: number, width: number, height: number): number {
  const radius = Math.min(height / 2, height > 60 ? 32 : 26);
  const straight = width / 2 - radius, distance = Math.abs(x);
  if (distance <= straight) return height;
  const curve = Math.min(radius, distance - straight);
  return height - radius + Math.sqrt(Math.max(0, radius * radius - curve * curve));
}

/** Existing eight substeps keep the 90-point wave stable during size changes. */
export function advanceLiquidWave(displacement: Float32Array, velocity: Float32Array,
  target: Float32Array, height: number, dt: number, stiffness: number, attraction: number, damping: number) {
  const step = dt / 8;
  for (let substep = 0; substep < 8; substep++) {
    for (let index = 1; index < 89; index++)
      velocity[index] += (stiffness * (displacement[index - 1] + displacement[index + 1] - 2 * displacement[index])
        - attraction * (displacement[index] - target[index]) - damping * velocity[index]) * step;
    const floor = Math.min(25, height * 0.45);
    for (let index = 1; index < 89; index++) {
      displacement[index] = Math.min(50, displacement[index] + velocity[index] * step);
      if (displacement[index] < -floor) {
        displacement[index] = -floor;
        if (velocity[index] < 0) velocity[index] = 0;
      }
    }
    displacement[0] = displacement[89] = velocity[0] = velocity[89] = 0;
  }
}
