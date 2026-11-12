import { React } from '../react';
import type { CharacterDefinition } from './catalog';
import type { CharacterMood } from './types';
import { createCharacterPose } from './pose';
import { subscribeAnimationFrames, animationInterval } from './scheduler';
import { createSvg } from './drawings/helpers';
import { attachedCharacterLayout, attachedVisualInsets } from './attached-layout';

export function AttachedCharacter({ definition, mood = 'idle', look = 0, face = true }: {
  definition: CharacterDefinition; mood?: CharacterMood; look?: number; face?: boolean;
}) {
  const svg = React.useRef<SVGSVGElement>(null);
  const latest = React.useRef({ mood, look, face });
  latest.current = { mood, look, face };
  React.useEffect(() => {
    const element = svg.current, parent = element?.parentElement;
    if (!element || !parent || definition.kind !== 'attach' || !definition.puppet) return;
    const art = createSvg('g', {}, element);
    const frame = definition.puppet.create(art, 0);
    const animator = createCharacterPose(() => false);
    const draw = (time: number) => {
      const width = parent.clientWidth, height = parent.clientHeight;
      const layout = attachedCharacterLayout(definition.id, width, height);
      element.setAttribute('width', String(layout.width));
      element.setAttribute('height', String(layout.height));
      element.setAttribute('viewBox', layout.viewBox.join(' '));
      art.setAttribute('transform', `translate(${layout.translate[0]},${layout.translate[1]})`);
      const props = latest.current;
      const { pose, t: elapsed, dt } = animator.pose(time, props.mood, props.look, null, parent);
      try { frame.draw({ ...pose, h: height, face: props.face }, time, elapsed, dt); } catch { /* Isolate drawing failures. */ }
    };
    draw(performance.now());
    const stop = subscribeAnimationFrames(draw, () => animationInterval(latest.current.mood));
    return () => { stop(); element.replaceChildren(); };
  }, [definition]);
  const insets = attachedVisualInsets(definition.id);
  return <svg ref={svg} data-ink-art data-character={definition.id} data-character-mood={mood}
    data-attached-character data-attachment-right={insets.right} data-attachment-bottom={insets.bottom}
    className="pointer-events-none absolute top-0 left-0 overflow-visible" aria-hidden/>;
}
