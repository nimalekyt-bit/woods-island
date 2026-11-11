import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Clipboard,
  FolderDown,
  Type,
  MessageSquare,
  FileText,
  Sliders,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Search,
  Copy,
  Check,
  Sparkles,
  Wifi,
  Bluetooth,
  Shield,
  Power,
  RotateCcw,
  Moon,
  Sun,
  Maximize2,
  Trash2,
  Pin,
  Music
} from 'lucide-react';

export type TabType = 'home' | 'clipboard' | 'shelf' | 'text' | 'chat' | 'note' | 'controls';

interface ExpandedPanelProps {
  onClose: () => void;
  initialTab?: TabType;
}

export const ExpandedPanel: React.FC<ExpandedPanelProps> = ({
  onClose,
  initialTab = 'home'
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(65);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Text tool states
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');

  // Sample clipboard entries
  const [clipboardItems] = useState([
    { id: '1', type: 'text', content: 'https://github.com/nimalekyt-bit/woods-island', time: '1 мин назад', pinned: true },
    { id: '2', type: 'text', content: 'pnpm dlx @tauri-apps/cli dev', time: '5 мин назад', pinned: false },
    { id: '3', type: 'text', content: 'SetWindowLongPtrW(hwnd, GWL_EXSTYLE, WS_EX_NOACTIVATE)', time: '12 мин назад', pinned: false },
    { id: '4', type: 'text', content: 'woods obs --scene "Main Screen"', time: '30 мин назад', pinned: false }
  ]);

  // Tab navigation items
  const navTabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Главная', icon: <Home className="h-4 w-4" /> },
    { id: 'clipboard', label: 'Буфер', icon: <Clipboard className="h-4 w-4" /> },
    { id: 'shelf', label: 'Полка', icon: <FolderDown className="h-4 w-4" /> },
    { id: 'text', label: 'Текст', icon: <Type className="h-4 w-4" /> },
    { id: 'chat', label: 'ИИ Чат', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'note', label: 'Заметка', icon: <FileText className="h-4 w-4" /> },
    { id: 'controls', label: 'Контроль', icon: <Sliders className="h-4 w-4" /> },
  ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Switch keyboard layout (Punto switcher logic)
  const fixLayout = (str: string) => {
    const en = "qwertyuiop[]asdfghjkl;'zxcvbnm,./`QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>?~";
    const ru = "йцукенгшщзхъфывапролджэячсмитьбю.ёЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,Ё";
    let res = '';
    for (const ch of str) {
      const idxEn = en.indexOf(ch);
      const idxRu = ru.indexOf(ch);
      if (idxEn !== -1) res += ru[idxEn];
      else if (idxRu !== -1) res += en[idxRu];
      else res += ch;
    }
    return res;
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#0b0c10]/95 text-white backdrop-blur-2xl">
      {/* Top Header & Tab Bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-1">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 rounded-full border border-white/20"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
        >
          <span className="text-xs font-bold leading-none">&times;</span>
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          {/* HOME TAB: Media Player & Launcher */}
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              {/* Media Player Card */}
              <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-4 border border-white/10">
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-purple-700 shadow-lg">
                  <div className="flex h-full w-full items-center justify-center">
                    <Music className="h-8 w-8 text-white/80" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="truncate font-semibold text-white">Woods Corp Anthem</h3>
                      <p className="truncate text-xs text-white/60">Nikita Kuznetsov • Hi-Fi Audio</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                      Яндекс Музыка
                    </span>
                  </div>

                  {/* Playback Progress */}
                  <div className="mt-3 space-y-1">
                    <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-2/5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="flex justify-between text-[10px] text-white/40 font-mono">
                      <span>1:24</span>
                      <span>3:45</span>
                    </div>
                  </div>

                  {/* Playback Controls */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-white/70 hover:text-white">
                        <SkipBack className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-md hover:scale-105 active:scale-95 transition-transform"
                      >
                        {isPlaying ? <Pause className="h-4 w-4 fill-black" /> : <Play className="h-4 w-4 fill-black ml-0.5" />}
                      </button>
                      <button className="p-1 text-white/70 hover:text-white">
                        <SkipForward className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Volume Slider */}
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-3.5 w-3.5 text-white/60" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="h-1 w-20 accent-emerald-400 cursor-pointer"
                      />
                      <span className="font-mono text-[10px] text-white/50">{volume}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Launcher / Quick Actions Grid */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                  Быстрый запуск (Woods Launcher)
                </h4>
                <div className="grid grid-cols-4 gap-2.5">
                  {[
                    { name: 'OBS Studio', desc: 'Стрим & Запись', color: 'from-blue-600 to-indigo-800' },
                    { name: 'Obsidian', desc: 'База знаний HQ', color: 'from-purple-600 to-indigo-900' },
                    { name: 'VS Code', desc: 'Разработка', color: 'from-sky-500 to-blue-700' },
                    { name: 'Terminal', desc: 'PowerShell 7', color: 'from-zinc-700 to-zinc-900' }
                  ].map((app, i) => (
                    <button
                      key={i}
                      className="group flex flex-col items-start rounded-xl border border-white/5 bg-white/[0.03] p-3 text-left transition-all hover:border-white/20 hover:bg-white/[0.08]"
                    >
                      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${app.color} shadow-sm group-hover:scale-110 transition-transform`}>
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-white">{app.name}</span>
                      <span className="text-[10px] text-white/50">{app.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* CLIPBOARD TAB */}
          {activeTab === 'clipboard' && (
            <motion.div
              key="clipboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/10">
                <Search className="h-4 w-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Поиск по истории буфера..."
                  className="w-full bg-transparent text-xs text-white placeholder-white/40 outline-none"
                />
              </div>

              <div className="space-y-2">
                {clipboardItems.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] p-3 hover:border-white/15 hover:bg-white/[0.07] transition-all"
                  >
                    <div className="flex-1 pr-3 overflow-hidden">
                      <p className="truncate text-xs font-mono text-white/90">{item.content}</p>
                      <span className="text-[10px] text-white/40">{item.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100">
                      {item.pinned && <Pin className="h-3 w-3 text-amber-400 fill-amber-400" />}
                      <button
                        onClick={() => handleCopy(item.content, item.id)}
                        className="rounded-lg bg-white/10 p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
                      >
                        {copiedId === item.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TEXT TOOLS TAB */}
          {activeTab === 'text' && (
            <motion.div
              key="text"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/60">Входной текст:</label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Введите или вставьте текст (например, 'ghbdtn vbh' для смены раскладки)..."
                  className="h-24 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white placeholder-white/30 outline-none focus:border-emerald-400/50"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setOutputText(fixLayout(inputText))}
                  className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                >
                  Сменить раскладку (EN ↔ RU)
                </button>
                <button
                  onClick={() => setOutputText(inputText.toUpperCase())}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
                >
                  ВЕРХНИЙ РЕГИСТР
                </button>
                <button
                  onClick={() => setOutputText(inputText.toLowerCase())}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
                >
                  строчный регистр
                </button>
                <button
                  onClick={() => {
                    try {
                      setOutputText(JSON.stringify(JSON.parse(inputText), null, 2));
                    } catch {
                      setOutputText('Ошибка: некорректный JSON');
                    }
                  }}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
                >
                  Форматировать JSON
                </button>
                <button
                  onClick={() => setOutputText(btoa(inputText))}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
                >
                  Base64 Encode
                </button>
              </div>

              {outputText && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-emerald-400">Результат:</label>
                    <button
                      onClick={() => handleCopy(outputText, 'output')}
                      className="flex items-center gap-1 text-[11px] text-white/60 hover:text-white"
                    >
                      {copiedId === 'output' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>Копировать</span>
                    </button>
                  </div>
                  <pre className="max-h-32 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-white">
                    {outputText}
                  </pre>
                </div>
              )}
            </motion.div>
          )}

          {/* CONTROLS TAB */}
          {activeTab === 'controls' && (
            <motion.div
              key="controls"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <div className="flex items-center gap-2.5">
                    <Wifi className="h-4 w-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold">Wi-Fi</div>
                      <div className="text-[10px] text-white/50">Подключено (5 GHz)</div>
                    </div>
                  </div>
                  <input type="checkbox" defaultChecked className="toggle-checkbox" />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3.5">
                  <div className="flex items-center gap-2.5">
                    <Bluetooth className="h-4 w-4 text-blue-400" />
                    <div>
                      <div className="text-xs font-semibold">Bluetooth</div>
                      <div className="text-[10px] text-white/50">2 устройства</div>
                    </div>
                  </div>
                  <input type="checkbox" defaultChecked className="toggle-checkbox" />
                </div>
              </div>

              {/* Power Actions */}
              <div className="pt-2">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                  Управление питанием
                </h4>
                <div className="grid grid-cols-3 gap-2.5">
                  <button className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/5 p-3 hover:bg-white/10 text-white">
                    <Power className="mb-1 h-4 w-4 text-rose-400" />
                    <span className="text-xs font-medium">Выключение</span>
                  </button>
                  <button className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/5 p-3 hover:bg-white/10 text-white">
                    <RotateCcw className="mb-1 h-4 w-4 text-amber-400" />
                    <span className="text-xs font-medium">Перезагрузка</span>
                  </button>
                  <button className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/5 p-3 hover:bg-white/10 text-white">
                    <Moon className="mb-1 h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-medium">Спящий режим</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* AI CHAT & NOTES PLACEHOLDERS */}
          {(activeTab === 'chat' || activeTab === 'shelf' || activeTab === 'note') && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex h-64 flex-col items-center justify-center text-center text-white/40"
            >
              <Sparkles className="mb-2 h-8 w-8 text-white/20" />
              <p className="text-sm font-medium">Модуль готов к работе</p>
              <p className="text-xs text-white/30">Подключен к локальному ядру Woods OS</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
