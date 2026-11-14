import { React } from '../react';
import type { ComponentType, ReactNode } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '../ipc/client';
import { H as t } from '../compat/shared.js';
import { INITIAL_UPDATE, updateState, updateProgress, updateActions, updateErrors, diagnosticSummary, supportReport, type DiagnosticSummary } from './reliability-state';
import { Music2, Monitor, Video, Sparkles, Bell, Keyboard, Terminal, Clipboard, PawPrint, RefreshCw, ExternalLink, ChevronRight, CircleHelp, Download, Check, ShieldCheck } from './settings-icons';
import './reliability.css';

const call = <T,>(command: string, args?: object) => window.__TAURI_INTERNALS__.invoke<T>(command, args);
const releaseUrl = 'https://github.com/nimalekyt-bit/woods-island/releases/latest';
const issueUrl = 'https://github.com/nimalekyt-bit/woods-island/issues/new/choose';
type Save = (settings: Record<string, unknown>) => void;
export type SettingRow = ComponentType<{title: string; hint?: string; stacked?: boolean; children?: ReactNode}>;
type SettingSwitch = ComponentType<{value: boolean; onChange: (value: boolean) => void; label?: string}>;
const button = 'press h-8 shrink-0 rounded-lg bg-white/[0.08] px-3 text-[12.5px] hover:bg-white/[0.12] disabled:opacity-40';
const field = 'h-9 min-w-0 flex-1 rounded-lg bg-black/40 px-2.5 text-[12.5px] text-white/85 outline-none placeholder:text-white/30 focus:ring-1 focus:ring-white/20';
const group = 'divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-white/[0.045]';
function updateErrorMessage(code: string) {
  const message = updateErrors[code];
  return message ? t(...message) : t('Не удалось выполнить обновление. Попробуй ещё раз.', 'The update could not complete. Try again.');
}

export function UpdateSettings({ version, autoDownload, checkUpdates, save, Row, Switch }: {
  version: string; autoDownload: boolean; checkUpdates: boolean; save: Save; Row: SettingRow; Switch: SettingSwitch;
}) {
  const [state, setState] = React.useState(INITIAL_UPDATE);
  const [operation, setOperation] = React.useState(false), [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true, eventReceived = false;
    const stop = listen('update:state', event => { eventReceived = true; if (active) setState(updateState(event.payload)); });
    void stop.catch(reason => { if(active) setError(String(reason)); });
    call('update_status').then(value => { if (active && !eventReceived) setState(updateState(value)); }).catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; void stop.then(unlisten => unlisten()).catch(() => {}); };
  }, []);
  const act = async (command: string) => {
    if (operation) return;
    setOperation(true); setError('');
    try { await call(command); setState(updateState(await call('update_status'))); }
    catch (reason) { setError(String(reason)); }
    finally { setOperation(false); }
  };
  const actions = updateActions(state), percent = updateProgress(state), portable = state.reason === 'portable';
  const labels = {
    idle: t('Готов к проверке обновлений', 'Ready to check for updates'),
    checking: t('Проверяем новую версию…', 'Checking for a new version…'),
    available: t(`Доступна версия ${state.version ?? ''}`, `Version ${state.version ?? ''} is available`),
    downloading: t(`Скачиваем ${state.version ?? ''}`, `Downloading ${state.version ?? ''}`),
    ready: t(`Версия ${state.version ?? ''} готова к установке`, `Version ${state.version ?? ''} is ready to install`),
    installing: t('Запускаем установку…', 'Starting installation…'),
    upToDate: t('Установлена последняя версия', 'You have the latest version'),
    error: t('Не удалось обновить приложение', 'The app could not be updated'),
  };
  const openRelease = () => void invoke('open_path', {path:releaseUrl});
  let primary = {label:t('Проверить', 'Check now'), action:()=>void act('update_check'), disabled:operation || !actions.check};
  if (actions.manual) primary = {label:t('Открыть выпуск', 'Open release'),action:openRelease,disabled:false};
  if (actions.download) primary = {label:t('Скачать обновление', 'Download update'),action:()=>void act('update_download'),disabled:operation};
  if (actions.install) primary = {label:t('Установить', 'Install update'),action:()=>void act('update_install'),disabled:operation};
  if (actions.cancel) primary = {label:t('Отмена', 'Cancel'),action:()=>void call('update_cancel').catch(reason=>setError(String(reason))),disabled:false};
  const StatusIcon = state.status === 'ready' ? ShieldCheck : state.status === 'upToDate' ? Check : state.status === 'downloading' ? Download : RefreshCw;
  return <div data-update-settings>
    <div className="wi-update-summary">
      <span className="wi-update-icon"><StatusIcon size={20}/></span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] text-white">Woods Island {version}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-white/45" role="status">{labels[state.status]}{state.status === 'downloading' && percent !== null ? ` · ${percent}%` : ''}</div>
      </div>
      <button data-update-primary className={button} disabled={primary.disabled} onClick={primary.action}>{primary.label}</button>
    </div>
    {state.status === 'downloading' && <div className="wi-update-progress"><progress value={percent ?? undefined} max={100} aria-label={t('Загрузка обновления', 'Update download')}/></div>}
    {(error || state.error) && <p className="wi-inline-message wi-error" role="alert">{updateErrorMessage(error || state.error!)}</p>}
    {actions.install && <p className="wi-inline-message">{t('Установщик перезапустит остров. Сначала заверши запись и диктовку.', 'Setup will restart the island. Finish recording and dictation first.')}</p>}
    {actions.manual && <p className="wi-inline-message">{t('Portable обновляется вручную: скачай новый архив и замени файлы после закрытия острова.', 'Portable updates manually: download a new archive and replace the files after closing the island.')}</p>}
    <div className="wi-update-links">
      <button onClick={openRelease} className="wi-text-action">{t('Что нового в выпуске', 'Release notes')}<ExternalLink size={12}/></button>
      {primary.action === openRelease && <button disabled={operation || !actions.check} onClick={()=>void act('update_check')} className="wi-text-action">{t('Проверить ещё раз', 'Check again')}</button>}
    </div>
    <div className="wi-border-top">
      <Row title={t('Проверять обновления', 'Check for updates')} hint={t('При запуске и каждые 6 часов', 'At startup and every 6 hours')}><Switch value={checkUpdates} onChange={value=>save({checkUpdates:value})}/></Row>
      <Row title={t('Скачивать автоматически', 'Download automatically')} hint={portable ? t('В Portable обновления скачиваются вручную', 'Download updates manually in Portable') : t('Установка — когда тебе удобно', 'Install when you are ready')}>
        <fieldset className="wi-update-auto-download" disabled={portable}>
          <Switch value={!portable && autoDownload} onChange={value=>{if(!portable)save({autoDownloadUpdates:value});}}/>
        </fieldset>
      </Row>
    </div>
  </div>;
}

const modules: Record<string,{name:[string,string]; icon:ComponentType<{size?:number}>; section?:string}> = {
  media:{name:['Музыка Windows','Windows media'],icon:Music2},yandex:{name:['Яндекс Музыка','Yandex Music'],icon:Music2},
  ai:{name:['ИИ','AI'],icon:Sparkles,section:'ai'},obs:{name:['OBS Studio','OBS Studio'],icon:Video,section:'events'},
  speech:{name:['Диктовка','Dictation'],icon:Music2,section:'voice'},stt:{name:['Диктовка','Dictation'],icon:Music2,section:'voice'},
  ffmpeg:{name:['Запись MP4 / GIF','MP4 / GIF recording'],icon:Video},webview:{name:['Интерфейс','App interface'],icon:Monitor},
  notifications:{name:['Уведомления','Notifications'],icon:Bell,section:'events'},hotkeys:{name:['Горячие клавиши','Hotkeys'],icon:Keyboard,section:'hotkeys'},
  agents:{name:['Агенты в терминале','Terminal agents'],icon:Terminal,section:'events'},node:{name:['Инструменты агентов','Agent tools'],icon:Terminal,section:'events'},
  clipboard:{name:['Буфер обмена','Clipboard'],icon:Clipboard,section:'clipboard'},storage:{name:['Локальные данные','Local data'],icon:ShieldCheck},
  pets:{name:['Питомцы','Pets'],icon:PawPrint,section:'character'},updater:{name:['Обновления','Updates'],icon:RefreshCw,section:'updates'},
};
export function ConnectionSettings({completed,save,navigate,hotkeyToggle,hotkeyPalette,Row}: {
  completed:boolean;save:Save;navigate:(section:string)=>void;hotkeyToggle:string;hotkeyPalette:string;Row:SettingRow;
}) {
  const [summary,setSummary]=React.useState<DiagnosticSummary|null>(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[message,setMessage]=React.useState('');
  const [showGuide,setShowGuide]=React.useState(false),[expanded,setExpanded]=React.useState<string|null>(null),[showReport,setShowReport]=React.useState(false);
  const refresh=React.useCallback(async()=>{setBusy(true);setError('');try{setSummary(diagnosticSummary(await call('diagnostics_summary')));}catch(reason){setError(String(reason));}finally{setBusy(false);}},[]);
  React.useEffect(()=>{void refresh();},[refresh]);
  const statusNames={ready:t('Готово','Ready'),notConfigured:t('Не настроено','Not configured'),unavailable:t('Недоступно','Unavailable'),error:t('Нужна проверка','Needs attention')};
  const copy=async()=>{if(!summary)return;try{await invoke('clip_set_text',{text:supportReport(summary)});setMessage(t('Сведения скопированы','Details copied'));}catch(reason){setMessage(String(reason));}};
  return <div className="flex flex-col gap-3" data-connection-settings>
    <div className={group}>
      <Row title={t('Краткое знакомство','Quick introduction')} hint={completed ? undefined : t('Три шага, чтобы настроить остров под себя','Three steps to make the island yours')}>
        <button className={button} aria-expanded={showGuide} onClick={()=>setShowGuide(value=>!value)}>{showGuide?t('Свернуть','Collapse'):t('Показать','Show')}</button>
      </Row>
      {showGuide && <div className="wi-guide">
        <div><span>{t('Внешний вид и поведение','Appearance and behavior')}</span><button onClick={()=>navigate('general')} className="wi-text-action">{t('Настроить','Configure')}<ChevronRight size={13}/></button></div>
        <div><span>{t('Питомец или простая пилюля','A pet or a simple pill')}</span><button onClick={()=>navigate('character')} className="wi-text-action">{t('Выбрать','Choose')}<ChevronRight size={13}/></button></div>
        <div><span>{t('Открыть остров','Open island')}</span><kbd>{hotkeyToggle||t('Не назначено','Not set')}</kbd></div>
        <div><span>{t('Быстрые команды','Quick commands')}</span><kbd>{hotkeyPalette||t('Не назначено','Not set')}</kbd></div>
        {!completed && <button className="wi-text-action" onClick={()=>{save({onboardingCompleted:true});setShowGuide(false);}}>{t('Всё понятно','Got it')}<Check size={13}/></button>}
      </div>}
    </div>
    <div className={group}>
      {summary?.modules.map(module=>{
        const meta=modules[module.id],Icon=meta?.icon||CircleHelp,open=expanded===module.id;
        const configured=module.status==='ready'&&['ai','obs'].includes(module.id);
        return <div key={module.id} className="wi-connection" data-connection={module.id}>
          <button className="wi-connection-row" aria-expanded={open} onClick={()=>setExpanded(open?null:module.id)}>
            <span className="wi-connection-icon"><Icon size={17}/></span>
            <span className="min-w-0 flex-1 text-left">{meta?t(...meta.name):module.id}</span>
            <span className="wi-connection-status" data-state={configured?'configured':module.status}><i/>{configured?t('Настроено','Configured'):statusNames[module.status]}</span>
            <ChevronRight size={13} className={open?'wi-chevron-open':''}/>
          </button>
          {open && <div className="wi-connection-detail">
            {module.detail && <p>{module.detail}</p>}
            {meta?.section && <button className="wi-text-action" onClick={()=>navigate(meta.section!)}>{t('Открыть настройки','Open settings')}<ExternalLink size={12}/></button>}
          </div>}
        </div>;
      })}
      {!summary && <div className="px-4 py-3 text-[12px] text-white/45">{busy?t('Проверяем подключения…','Checking connections…'):t('Сведения пока недоступны','Details are unavailable')}</div>}
    </div>
    {summary?.recovery.map((item,index)=><p className="wi-error text-[12px]" role="status" key={`${item.kind}-${index}`}>{item.message}</p>)}
    {error&&<p className="wi-error text-[12px]" role="alert">{error}</p>}
    <div className="wi-support-actions">
      <button className="wi-text-action" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={13}/>{busy?t('Проверяем…','Checking…'):t('Проверить снова','Check again')}</button>
      <button className="wi-text-action" onClick={()=>void invoke('open_path',{path:issueUrl})}>{t('Сообщить об ошибке','Report a bug')}<ExternalLink size={12}/></button>
      <button className="wi-text-action" aria-expanded={showReport} onClick={()=>setShowReport(value=>!value)}>{t('Сведения','Details')}<ChevronRight size={13} className={showReport?'wi-chevron-open':''}/></button>
    </div>
    {showReport&&summary&&<div className={group}>
      <Row title={t('Сведения для отчёта','Details for a report')} hint={t('Версии и состояния — без ключей, истории и личных путей','Versions and statuses, without keys, history or personal paths')}><button className={button} onClick={()=>void copy()}>{t('Скопировать','Copy')}</button></Row>
      <pre className="wi-report">{supportReport(summary)}</pre>
    </div>}
    {message&&<p className="text-[12px] text-white/55" role="status">{message}</p>}
  </div>;
}

export function UploadKeySettings({keyName}:{keyName:string}) {
  const [saved,setSaved]=React.useState(false),[value,setValue]=React.useState(''),[busy,setBusy]=React.useState(false),[message,setMessage]=React.useState('');
  React.useEffect(()=>{let active=true;call<boolean>('upload_key_status').then(value=>{if(active)setSaved(value);}).catch(reason=>{if(active)setMessage(String(reason));});return()=>{active=false;};},[]);
  const store=async(key:string)=>{setBusy(true);setMessage('');try{setSaved(await call<boolean>('upload_key_set',{key}));setValue('');setMessage(key?t('Ключ сохранён и зашифрован','Key saved and encrypted'):t('Ключ удалён','Key removed'));}catch(reason){setMessage(String(reason));}finally{setBusy(false);}};
  return <div className="flex flex-col gap-2">
    <div className="flex gap-2">
      <input aria-label={keyName} className={field} data-upload-key type="password" value={value} onChange={event=>setValue(event.target.value)} autoComplete="off" spellCheck={false} placeholder={saved?t('•••••••• (ключ сохранён)','•••••••• (key saved)'):keyName}/>
      <button className={button} disabled={busy||!value.trim()} onClick={()=>void store(value.trim())}>{t('Сохранить','Save')}</button>
      {saved&&<button className="wi-text-action wi-error" disabled={busy} onClick={()=>void store('')}>{t('Удалить','Remove')}</button>}
    </div>
    {message&&<span className="text-[12px] text-white/55" role="status">{message}</span>}
  </div>;
}
