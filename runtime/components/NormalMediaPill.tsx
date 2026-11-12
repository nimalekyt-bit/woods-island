import { React } from '../react';
import type { ReactNode } from 'react';
import { PauseBadge } from './CollapsedTrack';

export interface NormalMediaPillProps {
  playing: boolean;
  hasCharacter: boolean;
  characterHasFace: boolean;
  cover: ReactNode;
  clock: ReactNode;
  battery: ReactNode;
  weather: ReactNode;
  inputIndicators: ReactNode;
  status: ReactNode;
  character: ReactNode;
}

// Store adapters provide the existing widgets; this component owns their layout.
export function NormalMediaPill({ playing, hasCharacter, characterHasFace, cover,
  clock, battery, weather, inputIndicators, status, character }: NormalMediaPillProps) {
  return <div data-media-pill="normal" data-playback-state={playing ? 'playing' : 'paused'}
    className={`grid h-full grid-cols-[1fr_auto_1fr] items-center pl-2 ${hasCharacter ? 'pr-2' : 'pr-3.5'}`}>
    <span className="flex items-center gap-2 justify-self-start">
      <span data-media-cover className="relative flex shrink-0">{cover}<PauseBadge playing={playing}/></span>
      {characterHasFace && clock}{characterHasFace && battery}
    </span>
    {characterHasFace ? <span style={{ width: 40 }}/>
      : <span className="flex items-center gap-2 px-3">{inputIndicators}{clock}{battery}{weather}</span>}
    <div className="flex items-center gap-2.5 justify-self-end">
      {characterHasFace && weather}{characterHasFace && inputIndicators}{status}{character}
    </div>
  </div>;
}
