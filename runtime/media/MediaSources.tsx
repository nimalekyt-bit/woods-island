import { React } from '../react';
import { invoke } from '../ipc/client';
import { H as t } from '../compat/shared.js';
import type { SettingRow } from '../components/ReliabilitySettings';
import type { ComponentType } from 'react';

interface Source { id: string; name: string; title: string; playing: boolean; hidden?: boolean; active?: boolean }

function useSources() {
  const [sources, setSources] = React.useState<Source[] | null>(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true, pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await invoke('media_sources') as unknown as Source[];
        if (active) { setSources(result); setError(''); }
      } catch { if (active) setError(t('Не удалось получить плееры.', 'Could not read media players.')); }
      finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return { sources, error };
}

export function MediaVisibilitySettings({ value, save, Row, Switch }: {
  value: string[]; save: (settings: Record<string, unknown>) => void; Row: SettingRow;
  Switch: ComponentType<{value: boolean; onChange: (value: boolean) => void}>;
}) {
  const { sources, error } = useSources();
  value = Array.isArray(value) ? value.filter(id => typeof id === 'string' && id.length > 0) : [];
  const items = [...(sources || [])];
  for (const id of value) if (!items.some(source => source.id.toLowerCase() === id.toLowerCase()))
    items.push({id, name: id, title: '', playing: false, hidden: true});
  return <div data-media-visibility>
    <Row title={t('Плееры на острове', 'Players on the island')}
      hint={t('Скрытый плеер не выбирается автоматически. Здесь его можно вернуть, даже когда он закрыт.', 'Hidden players are excluded from automatic selection. Restore them here, even while they are closed.')} stacked>
      {error && <p role="alert" className="text-[12px] text-[#ff9b9b]">{error}</p>}
      {!items.length && <p className="text-[12px] text-white/40">{t('Запусти плеер, чтобы настроить его видимость.', 'Start a player to change its visibility.')}</p>}
    </Row>
    {items.map(source => <Row key={source.id} title={source.name || source.id} hint={source.title || undefined}>
      <Switch value={!value.some(id => id.toLowerCase() === source.id.toLowerCase())} onChange={visible => {
        const next = value.filter(id => id.toLowerCase() !== source.id.toLowerCase());
        save({mediaHidden: visible ? next : [...next, source.id]});
      }}/>
    </Row>)}
  </div>;
}

export function MediaSourcePicker({ onClose }: {onClose: () => void}) {
  const { sources, error } = useSources();
  const [busy, setBusy] = React.useState(false), [actionError, setActionError] = React.useState('');
  const root = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const outside = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) onClose(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', outside, true); window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', escape); };
  }, [onClose]);
  const act = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setActionError('');
    try { await action(); onClose(); }
    catch { setActionError(t('Не удалось изменить плеер. Попробуй ещё раз.', 'Could not change the player. Try again.')); }
    finally { setBusy(false); }
  };
  const hide = (id: string) => act(async () => {
    const settings = await invoke('settings_get');
    const hidden = Array.isArray(settings.mediaHidden) ? settings.mediaHidden.filter(id => typeof id === 'string' && id.length > 0) : [];
    const warnings = await invoke('settings_set', {settings: {mediaHidden: [...hidden.filter(item => item.toLowerCase() !== id.toLowerCase()), id]}});
    if (warnings.length) throw new Error('Settings could not be saved');
  });
  return <div ref={root} data-media-sources className="scroll-thin absolute inset-1.5 z-20 flex flex-col gap-1 overflow-y-auto rounded-xl bg-sheet p-1 ring-1 ring-white/10">
    {(error || actionError) && <p role="alert" className="px-2 py-1 text-[12px] text-danger">{actionError || error}</p>}
    {(sources || []).filter(source => !source.hidden).map(source => <div key={source.id} className="flex min-w-0 shrink-0 items-center gap-1">
      <button disabled={busy} onClick={() => void act(() => invoke('media_pick', {id: source.id}))}
        className="press flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left hover:bg-white/8 disabled:opacity-40">
        <span aria-hidden className="w-4 shrink-0 text-accent">{source.active ? '✓' : ''}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[11px] text-ink-3">{source.name}</span><span className="block truncate text-[12px] text-ink">{source.title || t('Без названия', 'Untitled')}</span></span>
      </button>
      <button disabled={busy} onClick={() => void hide(source.id)} aria-label={t(`Скрыть ${source.name}`, `Hide ${source.name}`)}
        className="press h-8 shrink-0 rounded-lg px-2 text-[11px] text-ink-3 hover:bg-white/8 disabled:opacity-40">{t('Скрыть', 'Hide')}</button>
    </div>)}
    <button disabled={busy} onClick={() => void act(() => invoke('media_pick', {id: null}))} className="press min-h-8 shrink-0 rounded-lg px-2 text-left text-[12px] text-ink-2 hover:bg-white/8">{t('Пусть остров выбирает сам', 'Let the island choose')}</button>
    {sources && !sources.some(source => !source.hidden) && <p className="px-2 py-2 text-[12px] text-ink-3">{t('Нет видимых плееров. Вернуть скрытые можно в настройках.', 'No visible players. Restore hidden players in settings.')}</p>}
  </div>;
}
