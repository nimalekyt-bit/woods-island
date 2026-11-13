import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Calculator,
  Terminal,
  Sparkles,
  ArrowRight,
  Sliders,
  FileText,
  Compass
} from 'lucide-react';

interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand?: (cmd: string) => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  isOpen,
  onClose,
  onExecuteCommand,
}) => {
  const [query, setQuery] = useState('');
  const [calcResult, setCalcResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setCalcResult(null);
    }
  }, [isOpen]);

  // Live calculator evaluator
  useEffect(() => {
    if (/^[0-9+\-*/^().\s%]+$/.test(query.trim()) && query.length > 2) {
      try {
        // Safe math evaluation
        const res = Function(`'use strict'; return (${query})`)();
        if (typeof res === 'number' && !isNaN(res)) {
          setCalcResult(String(res));
          return;
        }
      } catch {}
    }
    setCalcResult(null);
  }, [query]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className="fixed inset-x-0 top-12 mx-auto z-50 w-[580px] overflow-hidden rounded-2xl border border-white/15 bg-[#0b0c10]/95 p-3 text-white shadow-2xl backdrop-blur-3xl"
        style={{
          boxShadow: '0 20px 70px -10px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2 border border-white/10">
          {query.startsWith('>') ? (
            <Terminal className="h-4 w-4 text-emerald-400" />
          ) : calcResult ? (
            <Calculator className="h-4 w-4 text-purple-400" />
          ) : (
            <Search className="h-4 w-4 text-white/50" />
          )}

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск, калькулятор, > команда в терминале..."
            className="w-full bg-transparent text-sm text-white placeholder-white/40 outline-none"
          />

          <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-white/40">
            Esc
          </kbd>
        </div>

        {/* Live Calculation Output */}
        {calcResult && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-purple-500/10 p-3 border border-purple-500/20">
            <div className="flex items-center gap-2 text-xs text-purple-300 font-medium">
              <Calculator className="h-4 w-4 text-purple-400" />
              <span>Результат вычисления:</span>
            </div>
            <span className="font-mono text-sm font-bold text-white">{calcResult}</span>
          </div>
        )}

        {/* Quick Suggestion List */}
        {!calcResult && (
          <div className="mt-2.5 space-y-1">
            {[
              { title: 'Запустить OBS Studio', desc: 'Стриминг и видеозапись', icon: <Compass className="h-4 w-4 text-blue-400" /> },
              { title: 'Открыть Obsidian Vault', desc: 'Папка заметок, выбранная в настройках', icon: <FileText className="h-4 w-4 text-purple-400" /> },
              { title: 'Центр управления', desc: 'Wi-Fi, Bluetooth, питание', icon: <Sliders className="h-4 w-4 text-emerald-400" /> },
              { title: 'Спросить ИИ (Claude / Gemini)', desc: 'Мгновенный ответ модели', icon: <Sparkles className="h-4 w-4 text-amber-400" /> },
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onExecuteCommand?.(item.title);
                  onClose();
                }}
                className="group flex w-full items-center justify-between rounded-xl p-2.5 text-left transition-colors hover:bg-white/10"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 group-hover:bg-white/10">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">{item.title}</div>
                    <div className="text-[10px] text-white/40">{item.desc}</div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/60" />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
