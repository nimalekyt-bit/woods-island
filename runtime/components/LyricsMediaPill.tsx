import { React } from '../react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from '../motion';
import { MediaTitle, PauseBadge } from './CollapsedTrack';
import { songLyricsWidth } from './woods-extensions.js';

export interface LyricsMediaPillProps {
  media: { title: string; artist: string; playing: boolean } | null;
  activeIndex: number;
  text: string;
  widths: number[];
  publishLineWidth: (width: number) => void;
  cover: ReactNode;
  lineIcon: ReactNode;
  extras: ReactNode;
  character: ReactNode;
}

export function LyricsMediaPill({ media, activeIndex, text, widths, publishLineWidth,
  cover, lineIcon, extras, character }: LyricsMediaPillProps) {
  React.useEffect(() => {
    publishLineWidth(songLyricsWidth(widths));
  }, [widths, publishLineWidth]);
  React.useEffect(() => () => publishLineWidth(0), [publishLineWidth]);

  if (!media) return null;
  return <div data-media-pill="lyrics" data-playback-state={media.playing ? 'playing' : 'paused'}
    className="relative flex h-full items-center gap-2.5 pr-3 pl-2.5">
    <span data-media-cover className="relative flex shrink-0">{cover}<PauseBadge playing={media.playing}/></span>
    {activeIndex >= 0 ? <span data-lyrics-viewport
      className="relative grid h-[30px] min-w-0 flex-1 items-center overflow-hidden text-[12.5px] leading-tight">
      <AnimatePresence initial={false} mode="sync">
        <motion.span key={activeIndex} data-lyrics-line style={{ gridArea: '1 / 1', minWidth: 0 }}
          className="flex min-w-0 items-center gap-1.5"
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}>
          {lineIcon}
          <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}
            className={`min-w-0 line-clamp-2 leading-[1.2] ${text ? 'font-semibold text-ink' : 'text-ink-3'}`}>
            {text || '♪ ♪ ♪'}
          </span>
        </motion.span>
      </AnimatePresence>
    </span> : <MediaTitle title={media.title} artist={media.artist} className="flex-1 text-[12.5px] leading-tight"/>}
    {extras}{character}
  </div>;
}
