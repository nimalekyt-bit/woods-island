import { React } from '../react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from '../motion';
import { H as translate } from '../compat/shared.js';

export interface TrackLabel { title: string; artist: string; playing: boolean; durationMs: number }

export function MediaTitle({ title, artist, className = '' }: {
  title: string; artist: string; className?: string;
}) {
  return <span className={`relative block min-w-0 overflow-hidden ${className}`}>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={`${title}|${artist}`} className="block truncate"
        initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -7 }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
        <span className="font-semibold text-ink">{title || translate('Без названия', 'Untitled')}</span>
        {artist && <span className="text-ink-3"> · {artist}</span>}
      </motion.span>
    </AnimatePresence>
  </span>;
}

export function PauseBadge({ playing }: { playing: boolean }) {
  return playing ? null : <span data-media-paused role="img"
    aria-label={translate('На паузе', 'Paused')} title={translate('На паузе', 'Paused')}
    style={{ position: 'absolute', right: 1, bottom: 1, width: 14, height: 14,
      display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#171717',
      color: '#fff', boxShadow: '0 0 0 1px rgb(255 255 255 / 0.35)', zIndex: 1 }}>
    <svg viewBox="0 0 12 12" width="9" height="9" fill="currentColor" aria-hidden="true">
      <rect x="2" y="1" width="3" height="10" rx="1"/><rect x="7" y="1" width="3" height="10" rx="1"/>
    </svg>
  </span>;
}

export function CollapsedTrack({ media, cover, extras, character, positionMs, accent }: {
  media: TrackLabel; cover: ReactNode; extras: ReactNode; character: ReactNode;
  positionMs: number; accent: string | null;
}) {
  const progress = media.durationMs > 0 ? Math.min(1, Math.max(0, positionMs / media.durationMs)) : 0;
  return <div data-media-pill="title" data-playback-state={media.playing ? 'playing' : 'paused'}
    className="relative flex h-full items-center gap-2.5 pr-3 pl-2.5">
    <span data-media-cover className="relative flex shrink-0">{cover}<PauseBadge playing={media.playing}/></span>
    <MediaTitle title={media.title} artist={media.artist} className="flex-1 text-[12.5px] leading-tight"/>
    {extras}{character}
    {media.durationMs > 0 && <span className="absolute right-3 bottom-[5px] left-[48px] h-[2px] overflow-hidden rounded-full bg-white/12">
      <span data-media-progress className="block h-full rounded-full transition-[width] ease-linear"
        style={{ width: `${progress * 100}%`, transitionDuration: media.playing ? '1000ms' : '0ms',
          opacity: media.playing ? 1 : 0.45, background: accent ?? 'var(--color-ink)' }}/>
    </span>}
  </div>;
}
