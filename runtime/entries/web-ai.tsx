import { listen } from '@tauri-apps/api/event';
import { React } from '../react';
import { g } from '../vendor/react-foundation.js';
import { invoke } from '../ipc/client';
import { useWebAiStatus } from '../web-ai/use-status';
import { statusText } from '../web-ai/status';
import { SitePermissions } from '../web-ai/SitePermissions';
import { ProviderIcon } from '../web-ai/ProviderIcon';
import { webChatProviders } from '../web-ai/providers';
import { applyMotionPreferences } from '../preferences/motion';
import { ArrowLeft, Check, CircleAlert, ExternalLink, Globe, Link2, PanelsTopLeft, RefreshCw } from '../components/settings-icons';
import islandLogo from '../../src-tauri/icons/128x128.png';
import '../styles/runtime.css';
import '../web-ai/window.css';

const names: Record<string, string> = { gemini: 'Gemini', deepseek: 'DeepSeek', chatgpt: 'ChatGPT', openai: 'ChatGPT', claude: 'Claude', grok: 'Grok', qwen: 'Qwen' };
function SatinBackdrop() {
  return <div className="webai-backdrop" aria-hidden="true">
    <svg className="webai-satin" viewBox="0 0 520 720" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <linearGradient id="webai-satin-face" x1="130" y1="0" x2="445" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--webai-satin-dark)"/><stop offset=".25" stopColor="var(--webai-satin-mid)"/>
          <stop offset=".43" stopColor="var(--webai-satin-light)"/><stop offset=".53" stopColor="var(--webai-satin-mid)"/>
          <stop offset=".7" stopColor="var(--webai-satin-dark)"/><stop offset="1" stopColor="var(--webai-satin-mid)"/>
        </linearGradient>
        <linearGradient id="webai-satin-shine" x1="0" y1="-80" x2="450" y2="660" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--webai-satin-glint)" stopOpacity="0"/><stop offset=".35" stopColor="var(--webai-satin-glint)" stopOpacity=".12"/>
          <stop offset=".57" stopColor="var(--webai-satin-glint)" stopOpacity=".72"/><stop offset=".76" stopColor="var(--webai-satin-glint)" stopOpacity=".06"/>
          <stop offset="1" stopColor="var(--webai-satin-glint)" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="webai-satin-edge" x1="0" y1="0" x2="0" y2="720" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--webai-satin-glint)" stopOpacity="0"/><stop offset=".24" stopColor="var(--webai-satin-glint)" stopOpacity=".4"/>
          <stop offset=".52" stopColor="var(--webai-satin-glint)" stopOpacity=".08"/><stop offset=".8" stopColor="var(--webai-satin-glint)" stopOpacity=".5"/>
          <stop offset="1" stopColor="var(--webai-satin-glint)" stopOpacity="0"/>
        </linearGradient>
        <path id="webai-satin-fold" d="M250 -90 C65 60 420 145 315 285 C245 380 90 430 240 810 L425 810 C250 430 430 350 448 275 C478 100 235 65 392 -90 Z"/>
        <path id="webai-satin-contour" d="M250 -90 C65 60 420 145 315 285 C245 380 90 430 240 810"/>
      </defs>
      <g className="webai-satin-sculpture">
        <use href="#webai-satin-fold" fill="url(#webai-satin-face)"/>
        <g className="webai-satin-light"><use href="#webai-satin-fold" fill="url(#webai-satin-shine)"/></g>
        <g fill="none" stroke="url(#webai-satin-edge)" strokeWidth=".8">
          {[0, 8, 21, 41, 70].map(offset => <use key={offset} href="#webai-satin-contour" transform={`translate(${offset} 0)`}/>)}
        </g>
      </g>
    </svg>
  </div>;
}
function WebAiWindow() {
  const [service, setService] = React.useState('');
  const [english, setEnglish] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [preferencesReady, setPreferencesReady] = React.useState(false);
  const slot = React.useRef<HTMLDivElement>(null);
  const pendingRef = React.useRef(false);
  const placeholder = React.useRef<HTMLDivElement>(null);
  const [contentRevealed, setContentRevealed] = React.useState(false);
  const { status, slow, listenerError } = useWebAiStatus(service, 'window');
  React.useEffect(() => {
    let active = true, seen = false;
    const cleanup: (() => void)[] = [];
    const settingsChanged = (settings: { language?: unknown; theme?: unknown; reducedMotion?: unknown }) => {
      if (!active) return;
      setEnglish(settings.language === 'en');
      document.documentElement.lang = settings.language === 'en' ? 'en' : 'ru';
      document.documentElement.dataset.theme = settings.theme === 'light' ? 'light' : 'dark';
      applyMotionPreferences(settings.reducedMotion);
      setPreferencesReady(true);
    };
    void (async () => {
      const unlisten = await listen<string | null>('webai:window-service', event => {
        seen = true; if (active) { setError(null); setService(event.payload ?? ''); }
      });
      if (!active) { unlisten(); return; }
      cleanup.push(unlisten);
      let changed = false;
      const unsettings = await listen<Record<string, unknown>>('settings:changed', event => { changed = true; settingsChanged(event.payload); });
      if (!active) { unsettings(); return; }
      cleanup.push(unsettings);
      const initial = await invoke('web_ai_popped');
      if (active && !seen) setService(initial ?? '');
      const settings = await invoke('settings_get');
      if (!changed) settingsChanged(settings);
    })().catch(e => { if (active) { setError(String(e)); setPreferencesReady(true); } });
    return () => { active = false; cleanup.forEach(fn => fn()); };
  }, []);
  React.useEffect(() => {
    if (!service || !preferencesReady || !slot.current) return;
    let active = true, running = false, dirty = false;
    const attach = async () => {
      if (!active) return;
      if (running) { dirty = true; return; }
      const bounds = slot.current?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
      running = true;
      try {
        await invoke('web_ai_window_attach', { service, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
        if (active) await invoke('web_ai_window_present', { service });
      }
      catch (e) { if (active) setError(String(e)); }
      finally { running = false; if (dirty && active) { dirty = false; void attach(); } }
    };
    setError(null);
    const observer = new ResizeObserver(() => void attach());
    observer.observe(slot.current); void attach();
    return () => { active = false; observer.disconnect(); };
  }, [service, preferencesReady]);
  const action = async (fn: () => Promise<unknown>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true); setError(null);
    try { await fn(); } catch (e) { setError(String(e)); } finally { pendingRef.current = false; setPending(false); }
  };
  const message = error || listenerError || statusText(status, slow, english);
  const failed = !!(error || listenerError || status?.phase === 'error');
  const ready = status?.service === service && status.phase === 'loaded' && !failed;
  React.useEffect(() => {
    setContentRevealed(false);
    if (!ready || !preferencesReady || !status || !placeholder.current) return;
    let active = true;
    const animation = placeholder.current.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: document.documentElement.dataset.woodsReducedMotion === 'true' ? 0 : 160,
      easing: 'ease-out', fill: 'forwards',
    });
    const observer = new MutationObserver(() => {
      if (document.documentElement.dataset.woodsReducedMotion === 'true' && ['running', 'paused'].includes(animation.playState)) animation.finish();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-woods-reduced-motion'] });
    void (async () => {
      try {
        await animation.finished;
        if (!active) return;
        const revealed = await invoke('web_ai_window_reveal', { service, navigation: status.navigation });
        if (active) {
          if (revealed) setContentRevealed(true);
          else { animation.cancel(); setError(english ? 'The page changed. Please reconnect.' : 'Страница изменилась. Повторите подключение.'); }
        }
      } catch (e) { if (active) { animation.cancel(); setError(String(e)); } }
    })();
    return () => { active = false; observer.disconnect(); animation.cancel(); };
  }, [ready, service, status?.navigation, preferencesReady]);
  const retry = () => action(() => invoke('web_ai_reload', { service, target: 'window' }));
  const browser = () => action(() => invoke('web_ai_browser', { service }));
  const choices: string[] = webChatProviders.map(provider=>provider.id);
  if(service&&!choices.includes(service))choices.push(service);
  const domain = service === 'gemini' ? 'gemini.google.com' : service === 'deepseek' ? 'chat.deepseek.com' : names[service];
  // Mount once the initial theme and motion preferences have been applied.
  // Toggling inherited visibility on an already mounted tree can leave cached
  // descendant styles hidden on the first Chromium/WebView2 presentation.
  if (!preferencesReady) return null;
  return <main data-web-ai-shell={service} className="webai-app" data-preferences-ready={preferencesReady} data-phase={failed ? 'error' : ready ? 'ready' : 'loading'}>
    <header className="webai-header">
      <div className="webai-brand"><img src={islandLogo} alt="" /><div className="webai-brand-copy"><strong>Woods Island</strong><span>{english ? 'AI chats' : 'Чаты с ИИ'}</span></div></div>
      <button className="press webai-return" data-web-ai-back disabled={pending} onClick={() => void action(() => invoke('web_ai_window_close', { returnToPill: true }))}><span className="webai-return-icon" aria-hidden="true"><ArrowLeft size={16}/></span><span>{english ? 'Back to island' : 'Вернуть в пилюлю'}</span></button>
    </header>
    <section className="webai-workspace" aria-label={names[service] ?? 'AI'}>
      <div className="webai-tabs-row">
      <nav aria-label={english ? 'AI service' : 'AI сервис'} className="webai-tabs">
        {choices.map(id => <button className="press webai-service" key={id} data-web-ai-service={id} aria-pressed={service === id} disabled={pending}
          onClick={() => void action(() => invoke('web_ai_window', { service: id }))}>
          <ProviderIcon service={id} size={20}/>
          <span>{names[id]}</span>
        </button>)}
      </nav>
      <div className="webai-tools">
        <SitePermissions service={service||null} compact english={english} className="press webai-tool-button"/>
        <button className="press webai-tool-button" data-web-ai-retry disabled={!service || pending} title={english ? 'Reload website' : 'Перезагрузить сайт'} aria-label={english ? 'Reload website' : 'Перезагрузить сайт'} onClick={() => void retry()}><RefreshCw size={17}/></button>
        <button className="press webai-tool-button" data-web-ai-browser disabled={!service || pending} title={english ? 'Open in browser' : 'Открыть в браузере'} aria-label={english ? 'Open in browser' : 'Открыть в браузере'} onClick={() => void browser()}><ExternalLink size={17}/></button>
      </div></div>
      <div className="webai-location"><span><Globe size={13}/>{domain ?? (english ? 'Service website' : 'Сайт сервиса')}</span>
        <span data-web-ai-status={failed ? 'error' : status?.phase ?? 'loading'} className="webai-status" role="status" aria-live="polite">{failed ? <CircleAlert size={13}/> : ready ? <Check size={13}/> : <Link2 size={13}/>}<span>{failed ? (english ? 'Connection failed' : 'Нет соединения') : ready ? (english ? 'Website open' : 'Сайт открыт') : (english ? 'Connecting' : 'Подключаемся')}</span></span>
      </div>
      <div ref={slot} data-web-ai-content>
        <SatinBackdrop/>
        {(!ready || !contentRevealed) && <div ref={placeholder} className="webai-placeholder" role={failed ? 'alert' : 'status'} aria-hidden={ready || undefined}>
          <div className="webai-state-card" key={`${service}-${failed}`}>
            <div className="webai-state-heading"><div className="webai-provider-mark"><ProviderIcon service={service} size={42}/> {failed ? <span className="webai-provider-badge" aria-hidden="true"><CircleAlert size={16}/></span> : <span className="webai-orbit" data-web-ai-loader aria-hidden="true"><i/><i/><i/></span>}</div>
            <div className="webai-state-copy"><span className="webai-eyebrow"><PanelsTopLeft size={14}/>{english ? 'Chat in a window' : 'Чат в отдельном окне'}</span>
            <h1>{failed ? (english ? `${names[service] ?? 'Service'} is not responding` : `${names[service] ?? 'Сервис'} не отвечает`) : <span className="webai-service-title">{names[service] ?? (english ? 'Your chat' : 'Ваш чат')}</span>}</h1>
            <p>{failed || slow ? message : (english ? 'Connecting to the website…' : 'Подключаемся к сайту…')}</p>
            {failed || slow ? <div className="webai-recovery-actions">
              <button className="press webai-primary" disabled={!service || pending} onClick={() => void retry()}><RefreshCw size={16}/>{english ? 'Try again' : 'Подключиться снова'}</button>
              <button className="press webai-secondary" disabled={!service || pending} onClick={() => void browser()}>{english ? 'Use browser' : 'Открыть в браузере'}<ExternalLink size={15}/></button>
            </div> : null}
            {status?.code != null && <details><summary>{english ? 'Technical details' : 'Технические сведения'}</summary><small>{english ? 'Error code' : 'Код ошибки'}: {status.code}</small></details>}
            </div></div>
            {failed ? <div className="webai-connection-note">
              <span className="webai-note-icon"><CircleAlert size={18}/></span>
              <div><strong>{english ? 'Continue in your browser' : 'Можно продолжить в браузере'}</strong>
              <span>{english ? 'You may need to sign in again there.' : 'Там может понадобиться войти в аккаунт заново.'}</span></div>
            </div> : <div className="webai-connection-note webai-return-note">
              <div className="webai-mode-switch" role="group" aria-label={english ? 'Chat view' : 'Режим чата'}>
                <button className="press webai-resume" data-web-ai-inline-back disabled={pending} aria-label={english ? 'Return this chat to the pill' : 'Вернуть этот чат в пилюлю'} aria-describedby="webai-return-hint" onClick={() => void action(() => invoke('web_ai_window_close', { returnToPill: true }))}>
                  <ArrowLeft size={16}/><span>{english ? 'Pill' : 'Пилюля'}</span>
                </button>
                <span className="webai-mode-current" aria-current="true"><PanelsTopLeft size={15}/>{english ? 'Window' : 'Окно'}</span>
              </div>
              <span id="webai-return-hint" className="webai-resume-hint">{english ? 'Your draft and scroll position are kept.' : 'Черновик и прокрутка сохранятся.'}</span>
            </div>}
          </div>
        </div>}
      </div>
    </section>
  </main>;
}

g().createRoot(document.getElementById('root')!).render(<WebAiWindow />);
