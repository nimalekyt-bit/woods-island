import { React } from '../react';
import { ChevronRight, RotateCcw, SearchIcon, XIcon } from '../components/settings-icons';
import { SECTION_META, searchSettings, type SettingsSearchEntry } from './search-index';
import './settings-v2.css';

export interface AnchorItem {
  id: string;
  label: string;
}

function ruFoundCount(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return `Найдено ${count} настроек`;
  if (mod10 === 1) return `Найдена ${count} настройка`;
  if (mod10 >= 2 && mod10 <= 4) return `Найдено ${count} настройки`;
  return `Найдено ${count} настроек`;
}

export function SettingsSearchBar({
  value,
  onChange,
  en,
}: {
  value: string;
  onChange: (next: string) => void;
  en: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.code === 'KeyF' || event.code === 'KeyK')) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        if (value) {
          event.preventDefault();
          onChange('');
        } else {
          inputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [value, onChange]);

  return (
    <div className="wi-search-wrap">
      <div className="wi-search-input">
        <SearchIcon size={13} className="shrink-0 text-white/40" />
        <input
          ref={inputRef}
          type="text"
          data-settings-search="true"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={en ? 'Search settings…' : 'Поиск настроек…'}
          aria-label={en ? 'Search settings' : 'Поиск настроек'}
          spellCheck={false}
          className="wi-search-field outline-none"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={en ? 'Clear search' : 'Очистить поиск'}
            className="wi-search-clear"
          >
            <XIcon size={11} />
          </button>
        ) : (
          <span className="wi-search-kbd">Ctrl+F</span>
        )}
      </div>
    </div>
  );
}

export function SettingsSearchResults({
  query,
  en,
  onPick,
  onClear,
}: {
  query: string;
  en: boolean;
  onPick: (entry: SettingsSearchEntry) => void;
  onClear: () => void;
}) {
  const results = React.useMemo(() => searchSettings(query), [query]);

  return (
    <section data-settings-search-results="true" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <div>
          <h2 className="wi-section-title">
            {en ? 'Search results' : 'Результаты поиска'}
          </h2>
          <p className="wi-section-desc">
            {results.length > 0
              ? en
                ? `Found ${results.length} matching settings for “${query.trim()}”`
                : `${ruFoundCount(results.length)} по запросу «${query.trim()}»`
              : en
                ? `Nothing matched “${query.trim()}”. Try another word.`
                : `По запросу «${query.trim()}» ничего не найдено. Попробуй другое слово.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="h-8 shrink-0 rounded-lg bg-white/[0.08] px-3 text-[12px] text-white/80 hover:bg-white/[0.14] hover:text-white"
        >
          {en ? 'Back' : 'Закрыть'}
        </button>
      </div>

      {results.length > 0 ? (
        <div className="wi-setting-card">
          {results.map((item, idx) => {
            const meta = SECTION_META[item.section];
            const sectionLabel = meta ? (en ? meta.en : meta.ru) : item.section;
            return (
              <button
                key={`${item.section}-${item.groupId ?? idx}-${item.ru}`}
                type="button"
                data-search-result={item.section}
                onClick={() => onPick(item)}
                className="wi-setting-row wi-search-row"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-medium text-white">
                      {en ? item.en : item.ru}
                    </span>
                    <span className="wi-search-badge">{sectionLabel}</span>
                  </div>
                  <div className="mt-0.5 text-[12px] leading-snug text-white/45">
                    {en ? item.hintEn : item.hintRu}
                  </div>
                </div>
                <ChevronRight size={15} className="shrink-0 text-white/30" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="wi-setting-card px-4 py-6 text-center text-[13px] text-white/45">
          {en
            ? 'Try: music, games, 4K, size, screenshot, recording, folder, snow, hotkey, AI'
            : 'Попробуй: музыка, игры, 4k, размер, скриншот, запись, папка, снег, клавиши, ИИ'}
        </div>
      )}
    </section>
  );
}

export function SectionHeader({
  title,
  description,
  anchors,
  onAnchor,
}: {
  title: string;
  description?: string;
  anchors?: AnchorItem[];
  onAnchor?: (groupId: string) => void;
}) {
  const [activeAnchor, setActiveAnchor] = React.useState<string | null>(null);
  return (
    <div className="wi-section-header">
      <div>
        <h2 className="wi-section-title">{title}</h2>
        {description && <p className="wi-section-desc">{description}</p>}
      </div>
      {anchors && anchors.length > 1 && onAnchor && (
        <div className="wi-anchor-row">
          {anchors.map((anchor) => (
            <button
              key={anchor.id}
              type="button"
              data-active={activeAnchor === anchor.id ? 'true' : undefined}
              onClick={() => {
                setActiveAnchor(anchor.id);
                onAnchor(anchor.id);
              }}
              className="wi-anchor-pill"
            >
              {anchor.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SettingGroup({
  id,
  title,
  hint,
  children,
}: {
  id?: string;
  title?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} data-setting-group={id} className="wi-group-wrap">
      {title && (
        <div className="wi-group-head">
          <h3 className="wi-group-title">{title}</h3>
          {hint && <span className="wi-group-hint">{hint}</span>}
        </div>
      )}
      <div className="wi-setting-card">{children}</div>
    </div>
  );
}

export function StageSceneBar({
  scene,
  onSelect,
  en,
}: {
  scene: string;
  onSelect: (scene: string) => void;
  en: boolean;
}) {
  const scenes = [
    { id: 'idle', label: en ? 'Folded' : 'Свёрнутый' },
    { id: 'home', label: en ? 'Home' : 'Главная' },
    { id: 'music', label: en ? 'Music' : 'Музыка' },
    { id: 'through', label: en ? 'Through' : 'Сквозной' },
  ];
  return (
    <div data-stage-scene-bar="true" className="wi-stage-overlay-tabs">
      {scenes.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={scene === item.id}
          onClick={() => onSelect(item.id)}
          className="wi-stage-tab"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function AppearancePresets({
  settings,
  onApply,
  en,
}: {
  settings: { style?: string; scale?: number; notchBar?: boolean; theme?: string };
  onApply: (patch: Record<string, unknown>) => void;
  en: boolean;
}) {
  const scale = settings.scale ?? 100;
  const presets = [
    {
      id: 'notch',
      active: settings.style !== 'capsule' && settings.notchBar !== true && scale === 100,
      title: en ? 'Classic notch' : 'Классика',
      sub: en ? 'Edge notch · 100%' : 'Вырез у края · 100%',
      badge: null as string | null,
      patch: { style: 'notch', notchBar: false, scale: 100 },
    },
    {
      id: 'capsule',
      active: settings.style === 'capsule' && settings.notchBar !== true && scale === 100,
      title: en ? 'Floating pill' : 'Капсула',
      sub: en ? 'Floating · 100%' : 'Парит сверху · 100%',
      badge: null as string | null,
      patch: { style: 'capsule', notchBar: false, scale: 100 },
    },
    {
      id: 'macbook',
      active: settings.notchBar === true,
      title: 'MacBook',
      sub: en ? 'Top bar · macOS style' : 'Полоса как в macOS',
      badge: 'BAR' as string | null,
      patch: { style: 'notch', notchBar: true },
    },
    {
      id: '4k',
      active: settings.style === 'capsule' && settings.notchBar !== true && scale >= 125,
      title: en ? '4K / HiDPI' : 'Для 4K',
      sub: en ? 'Large capsule · 125%' : 'Крупная капсула · 125%',
      badge: '4K' as string | null,
      patch: { style: 'capsule', notchBar: false, scale: 125 },
    },
  ];
  return (
    <div className="wi-group-wrap">
      <div className="wi-group-head">
        <h3 className="wi-group-title">{en ? 'Quick styles' : 'Быстрые стили'}</h3>
        <span className="wi-group-hint">
          {en ? 'Apply in one click' : 'Применяются в 1 клик'}
        </span>
      </div>
      <div className="wi-preset-grid">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={preset.active}
            onClick={() => onApply(preset.patch)}
            className="wi-preset-card"
          >
            <div className={`wi-preset-screen wi-preset-screen-${preset.id}`}>
              {preset.id === 'macbook' ? (
                <div className="wi-preset-menubar">
                  <span className="wi-preset-mb-dots">
                    <i />
                    <i />
                  </span>
                  <span className="wi-preset-mb-notch">
                    <i />
                    <i />
                  </span>
                  <span className="wi-preset-mb-clock">12:00</span>
                </div>
              ) : (
                <div className={`wi-preset-island wi-preset-island-${preset.id}`}>
                  <span className="wi-preset-eyes">
                    <i />
                    <i />
                  </span>
                </div>
              )}
              {preset.badge && <span className="wi-preset-tag">{preset.badge}</span>}
              <span className="wi-preset-dock" aria-hidden="true" />
            </div>
            <div className="wi-preset-meta">
              <div className="wi-preset-title-row">
                <span className="wi-preset-title">{preset.title}</span>
                {preset.active && (
                  <span className="wi-preset-check" aria-hidden="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>
              <div className="wi-preset-sub">{preset.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function QuickResetButton({
  visible,
  label,
  title,
  onClick,
}: {
  visible: boolean;
  label: string;
  title: string;
  onClick: () => void;
}) {
  if (!visible) return null;
  return (
    <button type="button" title={title} onClick={onClick} className="wi-reset-btn">
      <RotateCcw size={11} />
      <span>{label}</span>
    </button>
  );
}

export function focusSettingGroup(container: HTMLElement | null, groupId?: string) {
  if (!groupId) {
    container?.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  window.requestAnimationFrame(() => {
    const target = document.getElementById(groupId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const card = target.querySelector('.wi-setting-card') ?? target;
    card.classList.remove('wi-setting-highlight');
    void (card as HTMLElement).offsetWidth;
    card.classList.add('wi-setting-highlight');
  });
}
