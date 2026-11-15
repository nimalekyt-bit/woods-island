import { listen } from '@tauri-apps/api/event';
import { React } from '../react';
import { invoke } from '../ipc/client';
import { parseStatus, type WebAiStatus } from './status';

export function useWebAiStatus(service: string, target: WebAiStatus['target']) {
  const [status, setStatus] = React.useState<WebAiStatus | null>(null);
  const [slow, setSlow] = React.useState(false);
  const [listenerError, setListenerError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    let eventSeen = false;
    setStatus(null); setListenerError(null); setSlow(false);
    const accept = (value: unknown) => {
      const s = parseStatus(value);
      if (active && s?.service === service && s.target === target) {
        setStatus(old => old && old.navigation > s.navigation ? old : s);
        return true;
      }
      return false;
    };
    void (async () => {
      unlisten = await listen('webai:status', event => { if (accept(event.payload)) eventSeen = true; });
      if (!active) { unlisten(); return; }
      const values = await invoke('web_ai_status');
      if (Array.isArray(values) && !eventSeen) values.forEach(accept);
    })().catch(error => { if (active) setListenerError(String(error)); });
    return () => { active = false; unlisten?.(); };
  }, [service, target]);
  React.useEffect(() => {
    setSlow(false);
    if (status?.phase === 'loaded' || status?.phase === 'error') return;
    const timer = window.setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(timer);
  }, [service, target, status?.phase, status?.navigation]);
  return { status, slow, listenerError };
}
