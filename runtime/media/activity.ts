// A pause grace period starts once, even when the player keeps publishing metadata.
export const PAUSED_MEDIA_GRACE_MS = 2500;

interface ActivityOptions {
  isLive: () => boolean;
  isPlaying: () => boolean;
  setLive: (live: boolean) => void;
  schedule?: (callback: () => void, delay: number) => () => void;
}

export function createMediaActivityTracker({
  isLive, isPlaying, setLive,
  schedule = (callback, delay) => {
    const timer = setTimeout(callback, delay);
    return () => clearTimeout(timer);
  },
}: ActivityOptions) {
  let cancel: (() => void) | null = null;
  const stop = () => { cancel?.(); cancel = null; };
  return {
    update(media: { playing: boolean } | null) {
      if (!media) { stop(); setLive(false); }
      else if (media.playing) { stop(); setLive(true); }
      else if (isLive() && !cancel) {
        cancel = schedule(() => { cancel = null; setLive(isPlaying()); }, PAUSED_MEDIA_GRACE_MS);
      }
    },
    dispose: stop,
  };
}
