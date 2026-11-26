import { React } from "../react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "../motion";
import { MediaTitle, PauseBadge } from "./CollapsedTrack";
import { songLyricsWidth } from "./woods-extensions.js";

let titleMeasure: CanvasRenderingContext2D | null | undefined;
function gapTitleWidth(title: string, artist: string): number {
  titleMeasure ??= document.createElement("canvas").getContext("2d");
  if (!titleMeasure) return 160;
  titleMeasure.font = "600 12px Segoe UI, sans-serif";
  const titleWidth = titleMeasure.measureText(title).width;
  titleMeasure.font = "400 12px Segoe UI, sans-serif";
  return Math.min(
    240,
    Math.max(
      96,
      titleWidth +
        (artist ? titleMeasure.measureText(` · ${artist}`).width : 0),
    ),
  );
}

export interface LyricsMediaPillProps {
  media: {
    key: string;
    title: string;
    artist: string;
    playing: boolean;
  } | null;
  activeIndex: number;
  loading: boolean;
  text: string;
  widths: number[];
  publishLineWidth: (width: number) => void;
  cover: ReactNode;
  lineIcon: ReactNode;
  extras: ReactNode;
  character: ReactNode;
}

export function LyricsMediaPill({
  media,
  activeIndex,
  loading,
  text,
  widths,
  publishLineWidth,
  cover,
  lineIcon,
  extras,
  character,
}: LyricsMediaPillProps) {
  const currentWidth = React.useRef(0);
  const previousLine = React.useRef({ key: media?.key, hasText: false });
  React.useEffect(() => {
    const hasText = !!text.trim();
    const newContent =
      previousLine.current.key !== media?.key || !previousLine.current.hasText;
    previousLine.current = { key: media?.key, hasText };
    const next = songLyricsWidth(
      loading
        ? [96]
        : text.trim()
          ? [widths[activeIndex] ?? 96]
          : [gapTitleWidth(media?.title ?? "", media?.artist ?? "")],
    );
    const apply = () => {
      currentWidth.current = next;
      publishLineWidth(next);
    };
    // Grow for the next line promptly. Brief short lines must not pump the pill.
    if (newContent || next >= currentWidth.current) {
      apply();
      return;
    }
    const timer = setTimeout(apply, 250);
    return () => clearTimeout(timer);
  }, [
    widths,
    activeIndex,
    loading,
    text,
    media?.key,
    media?.title,
    media?.artist,
    publishLineWidth,
  ]);
  React.useEffect(() => () => publishLineWidth(0), [publishLineWidth]);

  if (!media) return null;
  return (
    <div
      data-media-pill="lyrics"
      data-playback-state={media.playing ? "playing" : "paused"}
      className="relative flex h-full items-center gap-2.5 pr-3 pl-2.5"
    >
      <span data-media-cover className="relative flex shrink-0">
        {cover}
        <PauseBadge playing={media.playing} />
      </span>
      <span
        data-lyrics-viewport
        className="relative grid h-[30px] min-w-0 flex-1 items-center overflow-hidden text-[12.5px] leading-tight"
      >
        <AnimatePresence key={media.key} initial={false} mode="sync">
          <motion.span
            key={text.trim() ? `${activeIndex}:${text}` : `gap:${media.title}`}
            data-lyrics-line
            data-lyrics-gap={!text.trim() || undefined}
            style={{ gridArea: "1 / 1", minWidth: 0 }}
            className="flex min-w-0 items-center gap-1.5"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {lineIcon}
            {text.trim() ? (
              <span
                style={{ overflowWrap: "anywhere", minWidth: 0 }}
                className="min-w-0 line-clamp-2 leading-[1.2] font-semibold text-ink"
              >
                {text}
              </span>
            ) : (
              <MediaTitle
                title={media.title}
                artist={media.artist}
                className="min-w-0 flex-1 text-[12px] leading-tight"
              />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      {extras}
      {character}
    </div>
  );
}
