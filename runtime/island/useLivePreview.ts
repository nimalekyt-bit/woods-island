import { React } from '../react';
import { N as listen } from '../compat/shared.js';
import { ot as useIslandStore, vt as extractAccent } from '../compat/island-store.js';
import { z as weatherStore, c as startLyrics, L as normalizeMedia } from '../compat/home.js';
import { invoke } from '../ipc/client';
import { createMediaEventController } from '../media/events';
import { freeLicense } from '../free';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { suspendCharacterAnimations } from '../characters/scheduler';

const store = useIslandStore as any;
const weather = weatherStore as any;

/** Feed production preview widgets from the desktop, without window commands. */
export function useLivePreview(enabled: boolean) {
  const [ready, setReady] = React.useState(!enabled);
  const [error, setError] = React.useState(false);
  const [documentVisible, setDocumentVisible] = React.useState(() => !document.hidden);
  const [nativeVisible, setNativeVisible] = React.useState(true);
  const visible = documentVisible && nativeVisible;
  React.useEffect(() => {
    const changed=()=>setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange',changed);
    return ()=>document.removeEventListener('visibilitychange',changed);
  }, []);
  React.useEffect(() => {
    if (!enabled) return;
    let alive=true, observed=false, stop:(() => void)|undefined;
    void listen('settings:visible', (event: {payload: boolean}) => {
      if (alive) {observed=true;setNativeVisible(event.payload);}
    }).then((unlisten: () => void) => {if (alive) stop=unlisten;else unlisten();}).catch(() => {});
    const window=getCurrentWindow();
    void Promise.all([window.isVisible(),window.isMinimized()]).then(([shown,minimized]) => {
      if (alive && !observed) setNativeVisible(shown && !minimized);
    }).catch(() => {});
    return () => {alive=false;stop?.();};
  }, [enabled]);
  React.useEffect(() => {
    suspendCharacterAnimations('preview-hidden', enabled && !visible);
    return () => suspendCharacterAnimations('preview-hidden', false);
  }, [enabled, visible]);
  React.useEffect(() => {
    if (!enabled) return;
    if (!visible) {setReady(false);return;}
    setReady(false); setError(false);
    let alive = true, mediaObserved = false, shelfObserved = false;
    const stops: (() => void)[] = [];
    store.setState({ media: null, mediaLive: false, cover: null, accent: null, level: 0, bands: [], bandsAt: 0, battery: null, peripherals: null, shelf: [], privacy: {mic: [], cam: []} });
    weather.setState({data: null});
    const media = createMediaEventController<any>({
      getMedia: () => store.getState().media,
      setMedia: value => store.setState({media: value}),
      setCover: cover => store.setState({cover}),
      setAccent: accent => store.setState({accent}),
      resetLevel: () => store.setState({level: 0}),
      isLive: () => store.getState().mediaLive,
      setLive: mediaLive => store.setState({mediaLive}),
      extractAccent,
    });
    const on = (name: string, receive: (value: any) => void) => {
      void listen(name, (event: {payload: unknown}) => { if (alive) receive(event.payload); })
        .then((stop: () => void) => { if (alive) stops.push(stop); else stop(); }).catch(() => {});
    };
    on('media:update', value => {mediaObserved = true; media.update(value ? normalizeMedia(value) : null);});
    on('media:cover', value => media.cover(value));
    on('media:level', level => {if (typeof level === 'number' && Number.isFinite(level)) store.setState({level});});
    on('media:bands', bands => {if (Array.isArray(bands)) store.setState({bands, bandsAt: performance.now()});});
    on('power:update', battery => store.setState({battery}));
    on('input:lang', layoutCode => store.setState({layoutCode}));
    on('input:caps', caps => store.setState({caps}));
    on('desktop:virtual', vdesk => store.setState({vdesk}));
    on('privacy:update', privacy => store.setState({privacy}));
    on('peripherals:update', peripherals => store.setState({peripherals}));
    on('shelf:changed', shelf => {shelfObserved = true; store.setState({shelf});});
    on('weather:update', data => weather.getState().received(data));
    void invoke('bootstrap', {}).then((value: any) => {
      if (!alive) return;
      store.setState({audio: value.audio, battery: value.battery, caps: value.capsLock, layoutCode: value.layout, vdesk: value.vdesk, privacy: value.privacy, license: freeLicense});
      if (!shelfObserved) store.setState({shelf: value.shelf});
      if (!mediaObserved) {media.update(value.media); media.seed(value.media, value.cover);}
      setReady(true);
    }).catch(() => {if (alive) setError(true);});
    void invoke('peripherals_get', {}).then(peripherals => {if (alive) store.setState({peripherals});}).catch(() => {});
    void invoke('weather_get', {}).then(data => {if (alive && data) weather.getState().received(data);}).catch(() => {});
    stops.push(startLyrics());
    return () => {alive = false; media.dispose(); for (const stop of stops) stop();};
  }, [enabled, visible]);
  return {ready, error};
}
