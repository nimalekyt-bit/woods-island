import { createMediaActivityTracker, scheduleTimeout, type Schedule } from './activity';

export interface MediaTrack { key: string; playing: boolean }
export interface CoverEvent { key: string; cover: string | null }
interface MediaPorts<M extends MediaTrack> {
  getMedia: () => M | null;
  setMedia: (media: M | null) => void;
  setCover: (cover: string | null) => void;
  setAccent: (accent: string | null) => void;
  resetLevel: () => void;
  isLive: () => boolean;
  setLive: (live: boolean) => void;
  extractAccent: (cover: string) => Promise<string | null>;
  schedule?: Schedule;
}

// Preserve the previous cover while waiting for the next one. The fallback and
// color extraction belong to this controller so changing tracks cannot leave
// timers or stale asynchronous color updates behind.
export const COVER_WAIT_MS = 4000;
export function createMediaEventController<M extends MediaTrack>(ports: MediaPorts<M>) {
  const schedule = ports.schedule ?? scheduleTimeout;
  const activity = createMediaActivityTracker({
    isLive: ports.isLive, isPlaying: () => ports.getMedia()?.playing === true,
    setLive: ports.setLive, schedule,
  });
  let pendingCover: CoverEvent | null = null;
  let appliedKey: string | null = null;
  let cancelFallback: (() => void) | null = null;
  let revision = 0;
  let disposed = false;
  const stopFallback = () => { cancelFallback?.(); cancelFallback = null; };
  const applyCover = ({ key, cover }: CoverEvent) => {
    stopFallback();
    appliedKey = key;
    const currentRevision = ++revision;
    ports.setCover(cover);
    if (!cover) { ports.setAccent(null); return; }
    void ports.extractAccent(cover).then(accent => {
      if (!disposed && currentRevision === revision && ports.getMedia()?.key === key) ports.setAccent(accent);
    }).catch(() => {});
  };
  return {
    seed(media: M | null, cover: string | null) {
      if (disposed) return;
      if (media && cover) applyCover({ key: media.key, cover });
    },
    update(media: M | null) {
      if (disposed) return;
      const previous = ports.getMedia();
      ports.setMedia(media);
      if (!media) {
        stopFallback(); pendingCover = null; appliedKey = null; ++revision;
        ports.setCover(null); ports.setAccent(null); ports.resetLevel();
      } else if (previous?.key !== media.key) {
        stopFallback(); ++revision;
        const nextCover = pendingCover?.key === media.key ? pendingCover : null;
        pendingCover = null;
        if (nextCover) applyCover(nextCover);
        else {
          const key = media.key;
          cancelFallback = schedule(() => {
            cancelFallback = null;
            if (!disposed && ports.getMedia()?.key === key && appliedKey !== key) {
              ++revision; ports.setCover(null); ports.setAccent(null);
            }
          }, COVER_WAIT_MS);
        }
      }
      activity.update(media);
    },
    cover(event: CoverEvent) {
      if (disposed) return;
      if (ports.getMedia()?.key !== event.key) pendingCover = event;
      else applyCover(event);
    },
    dispose() { disposed = true; ++revision; pendingCover = null; stopFallback(); activity.dispose(); },
  };
}
