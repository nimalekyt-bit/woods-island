import type { CharacterPose, Drawing, DrawingFrame } from '../types';

interface Implementation<State> {
  build(this: State, parent: SVGElement, seed: number): void;
  draw(this: State, pose: CharacterPose, timeMs: number, elapsedMs: number, dtSeconds: number): void;
}

// A frame is exposed only after build has populated that instance's typed SVG state.
// The prototype contains methods only; every create owns its nodes and mutable values.
export function defineDrawing<State>(implementation: Implementation<State> & Partial<State> & ThisType<State>): Drawing {
  return {
    create(parent: SVGElement, seed: number): DrawingFrame {
      const instance = Object.create(implementation) as State & Implementation<State>;
      implementation.build.call(instance, parent, seed);
      return {
        draw(pose, timeMs, elapsedMs, dtSeconds) {
          implementation.draw.call(instance, pose, timeMs, elapsedMs, dtSeconds);
        },
      };
    },
  };
}
