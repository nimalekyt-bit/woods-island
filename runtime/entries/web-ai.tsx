import { listen } from '@tauri-apps/api/event';
import { React } from '../react';
import { g } from '../vendor/react-foundation.js';
import { invoke } from '../ipc/client';
import { useWebAiStatus } from '../web-ai/use-status';
import { statusText } from '../web-ai/status';
import '../web-ai/window.css';

const names: Record<string, string> = { gemini: 'Gemini', deepseek: 'DeepSeek', chatgpt: 'ChatGPT', openai: 'ChatGPT', claude: 'Claude', grok: 'Grok', qwen: 'Qwen' };
function WebAiWindow() {
  const [service, setService] = React.useState('');
  const [english, setEnglish] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const slot = React.useRef<HTMLDivElement>(null);
  const pendingRef = React.useRef(false);
  const { status, slow, listenerError } = useWebAiStatus(service, 'window');
  React.useEffect(() => {
    let active = true, seen = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listen<string | null>('webai:popped', event => {
        seen = true; if (active) { setError(null); setService(event.payload ?? ''); }
      });
      if (!active) { unlisten(); return; }
      const initial = await invoke('web_ai_popped');
      if (active && !seen) setService(initial ?? '');
      const settings = await invoke('settings_get');
      if (active) setEnglish(settings.language === 'en');
    })().catch(e => { if (active) setError(String(e)); });
    return () => { active = false; unlisten?.(); };
  }, []);
  React.useEffect(() => {
    if (!service || !slot.current) return;
    let active = true, running = false, dirty = false;
    const attach = async () => {
      if (!active) return;
      if (running) { dirty = true; return; }
      const bounds = slot.current?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
      running = true;
      try { await invoke('web_ai_window_attach', { service, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }); }
      catch (e) { if (active) setError(String(e)); }
      finally { running = false; if (dirty && active) { dirty = false; void attach(); } }
    };
    setError(null);
    const observer = new ResizeObserver(() => void attach());
    observer.observe(slot.current); void attach();
    return () => { active = false; observer.disconnect(); };
  }, [service]);
  const action = async (fn: () => Promise<unknown>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true); setError(null);
    try { await fn(); } catch (e) { setError(String(e)); } finally { pendingRef.current = false; setPending(false); }
  };
  const message = error || listenerError || statusText(status, slow, english);
  const failed = !!(error || listenerError || status?.phase === 'error');
  const ready = status?.phase === 'loaded' && !failed;
  const retry = () => action(() => invoke('web_ai_reload', { service, target: 'window' }));
  const browser = () => action(() => invoke('web_ai_browser', { service }));
  const choices = ['gemini', 'deepseek', ...(!['', 'gemini', 'deepseek'].includes(service) ? [service] : [])];
  return <main data-web-ai-shell={service}>
    <header>
      <div className="brand"><span className="brand-mark"><Glyph kind="spark" /></span><strong>Woods Island</strong></div>
      <nav aria-label={english ? 'AI service' : 'AI сервис'}>
        {choices.map(id => <button key={id} data-web-ai-service={id} aria-pressed={service === id} disabled={pending}
          onClick={() => void action(() => invoke('web_ai_window', { service: id }))}>{names[id]}</button>)}
      </nav>
      <div className="toolbar-status" data-web-ai-status={failed ? 'error' : status?.phase ?? 'loading'} title={message}>
        <i /><span>{failed ? (english ? 'Unavailable' : 'Не загрузилось') : ready ? (english ? 'Ready' : 'Готово') : (english ? 'Connecting' : 'Подключение')}</span>
      </div>
      <div className="actions">
        <button className="icon-button" data-web-ai-retry disabled={!service || pending} title={english ? 'Reload website' : 'Перезагрузить сайт'} aria-label={english ? 'Reload website' : 'Перезагрузить сайт'} onClick={() => void retry()}><Glyph kind="retry" /></button>
        <button className="quiet-button" data-web-ai-browser disabled={!service || pending} aria-label={english ? 'Open in browser' : 'Открыть в браузере'} onClick={() => void browser()}><Glyph kind="external" /><span>{english ? 'Browser' : 'В браузере'}</span></button>
        <button className="back-button" data-web-ai-back disabled={pending} onClick={() => void action(() => invoke('web_ai_window_close'))}><Glyph kind="back" /><span>{english ? 'Island' : 'В остров'}</span></button>
      </div>
    </header>
    <div ref={slot} data-web-ai-content>
      {!ready && <div className="notice" role="status">
        <div className="notice-mark" data-error={failed || undefined}><Glyph kind={failed ? 'error' : 'spark'} /></div>
        <span className="eyebrow">{english ? 'YOUR AI SPACE' : 'ВАШ AI ЧАТ'}</span>
        <h1>{failed ? (english ? 'Could not open ' : 'Не удалось открыть ') : ''}{names[service] ?? (english ? 'Opening a chat' : 'Открываем чат')}</h1>
        <p>{message}</p>
        {!failed && !slow && <div className="loading-track" aria-hidden="true"><i /></div>}
        {(failed || slow) && <div className="notice-actions">
          <button className="primary-button" disabled={!service || pending} onClick={() => void retry()}><Glyph kind="retry" />{english ? 'Try again' : 'Попробовать снова'}</button>
          <button className="quiet-button" disabled={!service || pending} onClick={() => void browser()}><Glyph kind="external" />{english ? 'Open in browser' : 'Открыть в браузере'}</button>
        </div>}
        <span className="notice-hint">{english ? 'Sign in on the service website. Your conversation stays here.' : 'Вход — на сайте сервиса. Общаться можно прямо здесь.'}</span>
        {status?.code != null && <details><summary>{english ? 'Technical details' : 'Технические сведения'}</summary><small>{english ? 'Error code' : 'Код ошибки'}: {status.code}</small></details>}
      </div>}
    </div>
  </main>;
}
function Glyph({ kind }: { kind: 'spark' | 'retry' | 'external' | 'back' | 'error' }) {
  const paths = { spark: 'M12 3l2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z', retry: 'M20 7v5h-5M19.2 12a7.2 7.2 0 1 0-1.5 5', external: 'M14 4h6v6M20 4l-9 9M10 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5', back: 'M10 6l-6 6 6 6M4 12h16', error: 'M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z' };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

g().createRoot(document.getElementById('root')!).render(<WebAiWindow />);
