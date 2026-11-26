import { React } from "../react";
import { invoke } from "../ipc/client";
import { AudioGlyph } from "./AudioGlyph";
const attempted = new Set<string>();
export function TrackArtwork({
  cover,
  trackKey,
  playing,
  size,
  radius,
  className = "",
  readBands,
  accent,
  showSpectrum = true,
}: {
  cover: string | null;
  trackKey: string;
  playing: boolean;
  size: number;
  radius: number;
  className?: string;
  readBands?: () => readonly number[];
  accent?: string | null;
  showSpectrum?: boolean;
}) {
  const [failed, setFailed] = React.useState<string | null>(null);
  const style = { width: size, height: size, borderRadius: radius };
  return cover && cover !== failed ? (
    <img
      src={cover}
      alt=""
      draggable={false}
      className={`shrink-0 object-cover ${className}`}
      style={style}
      onError={() => {
        setFailed(cover);
        const identity = `${trackKey}:${cover}`;
        if (!trackKey || attempted.has(identity)) return;
        if (attempted.size >= 32) attempted.clear();
        attempted.add(identity);
        void invoke("media_cover_recover", {
          key: trackKey,
          failedCover: cover,
        }).catch(() => {});
      }}
    />
  ) : (
    <span
      data-artwork-placeholder
      className={`grid shrink-0 place-items-center bg-white/10 ${className}`}
      style={style}
    >
      {showSpectrum ? <AudioGlyph
        playing={playing}
        readBands={readBands}
        accent={accent}
        width={Math.min(20, size * 0.6)}
        height={Math.min(20, size * 0.6)}
      /> : <svg viewBox="0 0 16 16" width={Math.min(16, size * 0.55)} fill="currentColor" className="text-ink-3" aria-hidden="true">
        <path d="M7 3.1 13 2v8.4c0 1.2-1 2.1-2.3 2.1s-2.3-.8-2.3-1.8c0-1.3 1.8-2.1 3.1-1.8V4.2l-3 .6v7.1c0 1.2-1 2.1-2.3 2.1S4 13.2 4 12.2c0-1.3 1.7-2.1 3-1.8V3.1Z" />
      </svg>}
    </span>
  );
}
