import { listen } from '@tauri-apps/api/event';
import { React } from '../react';
import { g } from '../vendor/react-foundation.js';
import { invoke } from '../ipc/client';
import { useWebAiStatus } from '../web-ai/use-status';
import { statusText } from '../web-ai/status';
import { ArrowLeft, CircleAlert, ExternalLink, Globe, LoaderCircle, RefreshCw } from '../components/settings-icons';
import geminiLogo from '../assets/providers/gemini.svg';
import deepseekLogo from '../assets/providers/deepseek.svg';
import islandLogo from '../../src-tauri/icons/32x32.png';
import '../styles/runtime.css';
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
      if (active) { setEnglish(settings.language === 'en'); document.documentElement.dataset.theme = settings.theme === 'light' ? 'light' : 'dark'; }
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
  const logo = service === 'deepseek' ? deepseekLogo : service === 'gemini' ? geminiLogo : null;
  return <main data-web-ai-shell={service} className="webai-app">
    <aside className="webai-sidebar">
      <div className="webai-brand"><img src={islandLogo} alt="" /><div><strong>Woods Island</strong><span>{english ? 'AI workspace' : 'Пространство ИИ'}</span></div></div>
      <div className="webai-nav-label">{english ? 'CHATS' : 'ЧАТЫ'}</div>
      <nav aria-label={english ? 'AI service' : 'AI сервис'}>
        {choices.map(id => <button className="press webai-service" key={id} data-web-ai-service={id} aria-pressed={service === id} disabled={pending}
          onClick={() => void action(() => invoke('web_ai_window', { service: id }))}>
          {id === 'gemini' || id === 'deepseek' ? <img src={id === 'gemini' ? geminiLogo : deepseekLogo} alt="" /> : <Globe size={20} />}
          <span>{names[id]}</span>{service === id && <i />}
        </button>)}
      </nav>
      <div className="webai-sidebar-bottom">
        <button className="press webai-side-action" data-web-ai-browser disabled={!service || pending} onClick={() => void browser()}><ExternalLink size={16}/><span>{english ? 'Open in browser' : 'Открыть в браузере'}</span></button>
        <button className="press webai-side-action" data-web-ai-back disabled={pending} onClick={() => void action(() => invoke('web_ai_window_close'))}><ArrowLeft size={16}/><span>{english ? 'Back to island' : 'Вернуться в остров'}</span></button>
      </div>
    </aside>
    <section className="webai-workspace" aria-label={names[service] ?? 'AI'}>
      <header className="webai-toolbar">
        <div className="webai-page-title"><strong>{names[service] ?? (english ? 'Chat' : 'Чат')}</strong>
          <span data-web-ai-status={failed ? 'error' : status?.phase ?? 'loading'}>{failed ? (english ? 'Could not connect' : 'Не удалось подключиться') : ready ? (english ? 'Website open' : 'Сайт открыт') : (english ? 'Connecting…' : 'Подключение…')}</span>
        </div>
        <button className="press webai-tool-button" data-web-ai-retry disabled={!service || pending} title={english ? 'Reload website' : 'Перезагрузить сайт'} aria-label={english ? 'Reload website' : 'Перезагрузить сайт'} onClick={() => void retry()}><RefreshCw size={17}/></button>
      </header>
      <div ref={slot} data-web-ai-content>
        {!ready && <div className="webai-placeholder" role="status">
          <div className="webai-state-card">
            <div className="webai-provider-mark">{logo ? <img src={logo} alt="" /> : <Globe size={32}/>}</div>
            <h1>{failed ? (english ? 'Let’s try again' : 'Попробуем ещё раз') : (english ? 'Opening ' : 'Открываем ') + (names[service] ?? (english ? 'your chat' : 'чат'))}</h1>
            <p>{failed || slow ? message : (english ? 'Your conversation will open here. Sign in to your account after loading.' : 'Здесь откроется ваш чат. После загрузки войдите в свой аккаунт.')}</p>
            {failed || slow ? <div className="webai-recovery-actions">
              <button className="press webai-primary" disabled={!service || pending} onClick={() => void retry()}><RefreshCw size={15}/>{english ? 'Try again' : 'Повторить попытку'}</button>
              <button className="press webai-secondary" disabled={!service || pending} onClick={() => void browser()}><ExternalLink size={15}/>{english ? 'Open in browser' : 'Открыть в браузере'}</button>
            </div> : <div className="webai-loading"><LoaderCircle size={16}/><span>{english ? 'Loading website' : 'Загружаем сайт'}</span></div>}
            {failed && <div className="webai-error-detail"><CircleAlert size={14}/><span>{english ? 'Check your connection or try a browser.' : 'Проверьте подключение или попробуйте браузер.'}</span></div>}
            {status?.code != null && <details><summary>{english ? 'Technical details' : 'Технические сведения'}</summary><small>{english ? 'Error code' : 'Код ошибки'}: {status.code}</small></details>}
          </div>
        </div>}
      </div>
    </section>
  </main>;
}

g().createRoot(document.getElementById('root')!).render(<WebAiWindow />);
